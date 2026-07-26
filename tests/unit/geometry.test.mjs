import test, { describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  scaleGap,
  computeTilePositions,
  computeSinglePosition,
  resolveOutputName,
  resolvePosition,
  EDGE_PADDING_RATIO
} from '../../shared/geometry.mjs'

describe('scaleGap', () => {
  test('leaves the gap alone when the image was not resized', () => {
    assert.equal(scaleGap(150, 4000, 4000), 150)
  })

  test('never scales up when the target is larger than the source', () => {
    assert.equal(scaleGap(150, 5000, 4000), 150)
  })

  // This is the regression that made output show ~2 tiles where the preview
  // promised ~21: a 150px gap on a 4000px original is 60px on a 1600px resize.
  test('scales the gap into the resized coordinate space', () => {
    assert.equal(scaleGap(150, 1600, 4000), 60)
  })

  test('clamps to at least 1px so tiling can never divide by zero', () => {
    assert.equal(scaleGap(2, 10, 4000), 1)
  })

  test('passes the gap through when dimensions are unknown', () => {
    assert.equal(scaleGap(150, 1600, undefined), 150)
    assert.equal(scaleGap(150, 0, 4000), 150)
  })
})

describe('computeTilePositions', () => {
  test('lays out a predictable grid', () => {
    // 1000x1000 canvas, 100x100 logo, 100px gap => step 200, starting at 100
    // x/y take values 100, 300, 500, 700, 900 => 5 x 5
    const positions = computeTilePositions({
      imgWidth: 1000,
      imgHeight: 1000,
      tileW: 100,
      tileH: 100,
      gap: 100
    })
    assert.equal(positions.length, 25)
    assert.deepEqual(positions[0], { top: 100, left: 100 })
    assert.deepEqual(positions.at(-1), { top: 900, left: 900 })
  })

  test('keeps the grid step at pre-rotation size and centres the rotated logo', () => {
    // A 100x100 logo rotated 45° has a ~142x142 bounding box. Stepping must
    // still use 100 so the rhythm matches the un-rotated case, with each tile
    // pulled back by (100-142)/2 = -21 and clamped at the edges.
    const rotated = computeTilePositions({
      imgWidth: 1000,
      imgHeight: 1000,
      tileW: 100,
      tileH: 100,
      finalW: 142,
      finalH: 142,
      gap: 100
    })
    const plain = computeTilePositions({
      imgWidth: 1000,
      imgHeight: 1000,
      tileW: 100,
      tileH: 100,
      gap: 100
    })
    assert.equal(rotated.length, plain.length, 'rotation must not change tile count')
    assert.deepEqual(rotated[0], { top: 79, left: 79 })
  })

  test('never returns a negative offset', () => {
    const positions = computeTilePositions({
      imgWidth: 500,
      imgHeight: 500,
      tileW: 50,
      tileH: 50,
      finalW: 400,
      finalH: 400,
      gap: 10
    })
    assert.ok(positions.every((p) => p.top >= 0 && p.left >= 0))
  })

  test('returns nothing when the gap alone exceeds the canvas', () => {
    const positions = computeTilePositions({
      imgWidth: 100,
      imgHeight: 100,
      tileW: 20,
      tileH: 20,
      gap: 200
    })
    assert.deepEqual(positions, [])
  })

  test('returns nothing for degenerate input rather than looping forever', () => {
    assert.deepEqual(
      computeTilePositions({ imgWidth: 100, imgHeight: 100, tileW: 0, tileH: 10, gap: 5 }),
      []
    )
    assert.deepEqual(
      computeTilePositions({ imgWidth: 100, imgHeight: 100, tileW: 10, tileH: 10, gap: 0 }),
      []
    )
    assert.deepEqual(
      computeTilePositions({ imgWidth: 0, imgHeight: 100, tileW: 10, tileH: 10, gap: 5 }),
      []
    )
  })
})

describe('computeSinglePosition', () => {
  const base = { imgWidth: 1000, imgHeight: 800, logoW: 100, logoH: 50 }
  const pad = Math.round(1000 * EDGE_PADDING_RATIO) // 20

  test('insets corners rather than pinning them flush to the edge', () => {
    // Sharp's own `gravity` would return {top: 750, left: 900} here — flush
    // against the corner. The preview canvas insets by 2%, so the pipeline has
    // to as well or the preview lies about the result.
    assert.deepEqual(computeSinglePosition({ ...base, position: 'southeast' }), {
      top: 800 - 50 - pad,
      left: 1000 - 100 - pad
    })
    assert.deepEqual(computeSinglePosition({ ...base, position: 'northwest' }), {
      top: pad,
      left: pad
    })
  })

  test('centres the middle placement on both axes', () => {
    assert.deepEqual(computeSinglePosition({ ...base, position: 'center' }), {
      top: (800 - 50) / 2,
      left: (1000 - 100) / 2
    })
  })

  test('edge placements are centred on their free axis', () => {
    assert.deepEqual(computeSinglePosition({ ...base, position: 'north' }), {
      top: pad,
      left: (1000 - 100) / 2
    })
    assert.deepEqual(computeSinglePosition({ ...base, position: 'west' }), {
      top: (800 - 50) / 2,
      left: pad
    })
  })

  test('falls back to bottom-right for unknown positions', () => {
    assert.deepEqual(
      computeSinglePosition({ ...base, position: 'nowhere' }),
      computeSinglePosition({ ...base, position: 'southeast' })
    )
  })

  test('centres a rotated logo on its slot, clamped to the canvas', () => {
    const { top, left } = computeSinglePosition({
      ...base,
      finalW: 140,
      finalH: 90,
      position: 'northwest'
    })
    assert.equal(left, Math.max(0, pad + Math.round((100 - 140) / 2))) // 0
    assert.equal(top, Math.max(0, pad + Math.round((50 - 90) / 2))) // 0
  })
})

describe('resolveOutputName', () => {
  test('rewrites the extension when compressing', () => {
    assert.equal(resolveOutputName('villa-01.png', 'compress', 'jpeg'), 'villa-01.jpg')
    assert.equal(resolveOutputName('villa-01.jpg', 'compress', 'webp'), 'villa-01.webp')
    assert.equal(resolveOutputName('villa-01.jpeg', 'both', 'png'), 'villa-01.png')
  })

  test('maps the jpeg format to the conventional .jpg extension', () => {
    assert.equal(resolveOutputName('a.png', 'both', 'jpeg'), 'a.jpg')
  })

  test('leaves the name untouched in watermark-only mode', () => {
    assert.equal(resolveOutputName('villa-01.png', 'watermark', 'jpeg'), 'villa-01.png')
  })

  test('only replaces the final extension in a dotted name', () => {
    assert.equal(
      resolveOutputName('beach.house.final.png', 'compress', 'jpeg'),
      'beach.house.final.jpg'
    )
  })

  test('appends an extension to a name that has none', () => {
    assert.equal(resolveOutputName('noext', 'compress', 'webp'), 'noext.webp')
  })
})

describe('resolvePosition', () => {
  test('passes through the nine valid anchors', () => {
    for (const p of [
      'northwest',
      'north',
      'northeast',
      'west',
      'center',
      'east',
      'southwest',
      'south',
      'southeast'
    ]) {
      assert.equal(resolvePosition(p), p)
    }
  })

  test('defaults anything else to southeast', () => {
    assert.equal(resolvePosition(undefined), 'southeast')
    assert.equal(resolvePosition('middle'), 'southeast')
  })
})

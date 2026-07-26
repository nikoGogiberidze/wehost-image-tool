// Single source of truth for watermark placement geometry.
//
// Both the preview canvas (renderer) and the Sharp pipeline (main process)
// import this module. That is deliberate: when the two had their own copies of
// this arithmetic they drifted, and the preview started promising layouts the
// output never produced. Everything here is pure — no Sharp, no DOM — so it is
// unit-testable and safe to run in either process.

/** Inset of edge/corner watermarks, as a fraction of image width. */
export const EDGE_PADDING_RATIO = 0.02

/** Placements accepted by the position picker. */
export const POSITIONS = [
  'northwest',
  'north',
  'northeast',
  'west',
  'center',
  'east',
  'southwest',
  'south',
  'southeast'
]

/** Fall back to bottom-right for anything unrecognised (e.g. older settings). */
export function resolvePosition(position) {
  return POSITIONS.includes(position) ? position : 'southeast'
}

/**
 * Convert a tile gap expressed in ORIGINAL-image pixels into the coordinate
 * space of an already-resized image.
 *
 * `tileGap` is authored against the original image because that is what the
 * preview shows. In "both" mode compression resizes the image before
 * watermarking, so a gap of 150 original-pixels covers a much larger fraction
 * of the smaller image — without this rescale the output ends up with far
 * fewer tiles than the preview promised.
 *
 * @param {number} tileGap        gap in original-image pixels
 * @param {number} resizedWidth   width of the image about to be tiled
 * @param {number} originalWidth  width of the source image on disk
 * @returns {number} gap in resized-image pixels (never below 1)
 */
export function scaleGap(tileGap, resizedWidth, originalWidth) {
  if (!originalWidth || !resizedWidth) return tileGap
  if (resizedWidth >= originalWidth) return tileGap
  return Math.max(1, Math.round((tileGap * resizedWidth) / originalWidth))
}

/**
 * Lay out a grid of watermark tiles across an image.
 *
 * Stepping uses the logo's PRE-rotation dimensions so the visual rhythm stays
 * even at any angle; the (possibly larger) rotated logo is then centred inside
 * each slot. Tiles that overhang the right/bottom edge are intentional — Sharp
 * clips them and the canvas does too, which is what makes tiling look
 * continuous rather than stopping short of the edge.
 *
 * @param {object} opts
 * @param {number} opts.imgWidth   canvas width
 * @param {number} opts.imgHeight  canvas height
 * @param {number} opts.tileW      logo width before rotation (grid step)
 * @param {number} opts.tileH      logo height before rotation (grid step)
 * @param {number} [opts.finalW]   logo width after rotation (defaults to tileW)
 * @param {number} [opts.finalH]   logo height after rotation (defaults to tileH)
 * @param {number} opts.gap        spacing between tiles, in canvas pixels
 * @returns {Array<{top: number, left: number}>} top-left offsets for each tile
 */
export function computeTilePositions({
  imgWidth,
  imgHeight,
  tileW,
  tileH,
  finalW = tileW,
  finalH = tileH,
  gap
}) {
  const positions = []
  if (!imgWidth || !imgHeight || tileW <= 0 || tileH <= 0 || gap <= 0) return positions

  const offsetX = Math.round((tileW - finalW) / 2)
  const offsetY = Math.round((tileH - finalH) / 2)

  for (let y = gap; y < imgHeight; y += tileH + gap) {
    for (let x = gap; x < imgWidth; x += tileW + gap) {
      positions.push({
        top: Math.max(0, y + offsetY),
        left: Math.max(0, x + offsetX)
      })
    }
  }

  return positions
}

/**
 * Place a single watermark at one of the nine anchor points, inset from the
 * edges by `EDGE_PADDING_RATIO`.
 *
 * Sharp's own `gravity` option would be simpler, but it pins the overlay flush
 * against the edge with no padding — which is not what the preview draws. This
 * returns explicit offsets so both sides agree.
 *
 * @param {object} opts
 * @param {number} opts.imgWidth
 * @param {number} opts.imgHeight
 * @param {number} opts.logoW     logo width before rotation
 * @param {number} opts.logoH     logo height before rotation
 * @param {number} [opts.finalW]  logo width after rotation (defaults to logoW)
 * @param {number} [opts.finalH]  logo height after rotation (defaults to logoH)
 * @param {string} opts.position
 * @returns {{top: number, left: number}} clamped top-left offset
 */
export function computeSinglePosition({
  imgWidth,
  imgHeight,
  logoW,
  logoH,
  finalW = logoW,
  finalH = logoH,
  position
}) {
  const pad = Math.round(imgWidth * EDGE_PADDING_RATIO)

  const left = {
    west: pad,
    center: Math.round((imgWidth - logoW) / 2),
    east: imgWidth - logoW - pad
  }
  const top = {
    north: pad,
    middle: Math.round((imgHeight - logoH) / 2),
    south: imgHeight - logoH - pad
  }

  const anchors = {
    northwest: [left.west, top.north],
    north: [left.center, top.north],
    northeast: [left.east, top.north],
    west: [left.west, top.middle],
    center: [left.center, top.middle],
    east: [left.east, top.middle],
    southwest: [left.west, top.south],
    south: [left.center, top.south],
    southeast: [left.east, top.south]
  }

  const [slotLeft, slotTop] = anchors[resolvePosition(position)]

  // Centre the (possibly rotated) logo on the slot, same rule as tiling
  return {
    left: Math.max(0, slotLeft + Math.round((logoW - finalW) / 2)),
    top: Math.max(0, slotTop + Math.round((logoH - finalH) / 2))
  }
}

/**
 * Work out the output filename. Compression can change the container, so the
 * extension is rewritten to match the chosen format; watermark-only runs keep
 * the original name untouched.
 *
 * @param {string} name    original filename, e.g. "villa-01.png"
 * @param {string} mode    'watermark' | 'compress' | 'both'
 * @param {string} format  'jpeg' | 'png' | 'webp'
 * @returns {string} output filename
 */
export function resolveOutputName(name, mode, format) {
  if (mode !== 'compress' && mode !== 'both') return name
  const ext = format === 'jpeg' ? 'jpg' : format
  return name.replace(/\.[^.]+$/, '') + '.' + ext
}

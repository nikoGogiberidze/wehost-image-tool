# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-07-26

First public release.

### Added

- Three processing modes: watermark, compress, or both in a single pass.
- Watermark placement with nine anchor positions or edge-to-edge tiling, plus opacity, rotation, logo size and tile spacing controls.
- Live preview modal that renders the current settings on a real image before processing.
- Compression to JPEG, PNG or WebP with a quality slider and an optional max-width resize.
- Per-image progress with before/after file sizes and percentage saved.
- Settings and watermark logo persisted between sessions.
- Unit test suite for the placement geometry and an end-to-end suite that drives the real Electron application.
- CI on every push, and a release workflow that builds the Windows installer from source.

### Fixed

- **Out-of-memory crash on large batches.** Images were passed to the main process as base64 and every result was held in renderer memory until the user chose a save location; a batch of 33 × 22 MB photos exhausted RAM. Files now cross IPC as disk paths, the output folder is chosen before processing starts, and each result is written and released as it completes — memory is now flat with respect to batch size.
- **Tiled watermarks disagreed with the preview in "both" mode.** `tileGap` is defined in original-image pixels, but compression resizes the image before watermarking, so the gap was applied in the wrong coordinate space and the output had far fewer tiles than the preview showed.
- **Corner watermarks were placed flush against the edge.** The pipeline used Sharp's `gravity`, which applies no padding, while the preview inset the logo by 2% of the image width. Both now share one placement implementation.
- **Fast-failing batches left rows stuck on "Queued".** Progress events and the IPC reply have no relative ordering guarantee; when a batch failed immediately (for example, watermark mode with no logo set) the reply could arrive first and the progress listener was torn down before the per-image events landed, hiding the error from the user.
- **Duplicate key in the Tailwind colour palette** silently shadowed one of the two `wh-500` definitions.
- **Broken application icon reference.** The build pointed at `assets/icon.ico`, which did not exist, so packaged builds silently fell back to the default Electron icon.

### Changed

- Windows builds now produce an NSIS installer rather than an unpacked directory.
- Removed the unused `@electron/remote` dependency.

[1.0.0]: https://github.com/nikoGogiberidze/wehost-image-tool/releases/tag/v1.0.0

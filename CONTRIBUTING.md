# Contributing

Thanks for taking a look. This is a small, focused tool — bug reports and fixes are more useful to it than large new features, but if you have an idea, open an issue first so we can talk about scope before you spend time on it.

## Setup

You need [Node.js](https://nodejs.org) 20 or newer. Building on Windows is the well-trodden path; macOS and Linux should work for development but are untested for packaging.

```bash
npm install && npm run dev
```

That starts Vite and Electron together with hot reload for the renderer. Changes to `electron/` require restarting the process.

## Before opening a pull request

```bash
npm run lint && npm test && npm run build && npm run test:e2e
```

CI runs exactly these, so a green local run should mean a green PR.

The E2E suite launches the real Electron app, so it needs `npm run build` to have produced `dist/` first. It generates its own fixtures — you never need to add image files to the repo.

## How the code is laid out

Read [ARCHITECTURE.md](ARCHITECTURE.md) before making structural changes. The two things worth knowing up front:

- **`shared/geometry.mjs` is imported by both processes.** Watermark placement maths belongs there and nowhere else. Two copies of it have drifted twice before, in ways that silently produced output that didn't match the preview — so if you find yourself writing placement arithmetic in `main.js` or in a component, it goes in the shared module with a unit test instead.
- **Image bytes must not cross IPC.** The renderer works with file paths, thumbnails and capped previews. If a change starts moving full-resolution buffers into the renderer, it will reintroduce the out-of-memory failure the pipeline was rebuilt to fix.

## Style

ESLint and Prettier are configured; `npm run format` applies them. Nothing exotic: no semicolons, single quotes, 100 columns.

Comments should explain _why_, not restate the code. The valuable comments in this codebase are the ones recording a constraint that isn't obvious — that libvips caches decoded images, that Sharp clips out-of-bounds composites instead of throwing, that IPC replies can overtake progress events. Please write more of those and fewer of the other kind.

## Commits

Present tense, and say what changed and why:

```
Scale tile gap into resized coordinate space

In "both" mode the image is resized before watermarking, so a gap
authored against the original produced far fewer tiles than the
preview showed.
```

## Reporting bugs

Open an [issue](https://github.com/nikoGogiberidze/wehost-image-tool/issues) with your Windows version, app version, and what you did. For image-processing bugs, the source image's dimensions and format matter a lot — please include them.

# Security

## Scope

Wehost Image Tool is a local desktop application. It has no server component, no accounts, and no network code — it reads images you point it at, writes results where you tell it to, and stores its settings in your user profile. Nothing is uploaded anywhere.

The security-relevant surface is therefore small and mostly about the Electron process boundary:

- The renderer runs with `contextIsolation: true` and `nodeIntegration: false`.
- A strict Content-Security-Policy is set in [`index.html`](index.html) and permits no remote origins.
- The renderer reaches the main process only through the explicit channel list in [`electron/preload.js`](electron/preload.js).
- Image decoding is done by [Sharp](https://sharp.pixelplumbing.com) (libvips) in the main process. Malformed image files are the most plausible source of a memory-safety issue here, and that risk is inherited from libvips.

## Reporting a vulnerability

Please report privately rather than opening a public issue — use [GitHub's private vulnerability reporting](https://github.com/nikoGogiberidze/wehost-image-tool/security/advisories/new) on this repository.

Include what you did, what happened, and the affected version. If a specific image file triggers it, that file is the most useful thing you can send.

This is a personal project maintained in spare time, so please don't expect an enterprise response time — but reports will be read and acted on.

## Supported versions

The latest release is the only supported version.

## A note on the unsigned installer

Release binaries are not code-signed, so Windows SmartScreen will warn about them. This is a cost decision, not an oversight. Every release is built from tagged source by the [release workflow](.github/workflows/release.yml) on GitHub's runners, so you can verify what went into a binary — or build it yourself from source.

# Squish Pocket

A soft-body physics merge game for phones. Shoot jelly blobs into a glass bottle, combine matching numbers up to **4096**, and rearrange or merge the three ready blobs before shooting.

**[Play in your browser](https://squish.chemisgreat.online/)**

The browser version is the current playable game. A separate, earlier native iPhone prototype is included for future development; its gameplay differs from the browser version and it has not been built or installed on iOS.

## Run the browser game

Requires Node.js for tests and Python 3 for the development server. No build step or JavaScript dependency installation is needed.

```sh
cd browser
npm start
```

Open <http://localhost:4173>. On iPhone, open the public game in Safari and use **Share → Add to Home Screen**.

Pull a ready blob downward to charge and release to shoot, or hold **Shoot**. While holding Shoot, slide horizontally to aim and vertically to adjust force. Lift a blob to merge or rearrange it; use the bottom arrows to select a neighboring blob. Physics settings adjust stiffness and viscosity. Blob size is fixed at 150%. Progress stays in the current browser's local storage.

## Project layout

- `browser/dist/`: directly served HTML, CSS, JavaScript, and icons.
- `browser/tests/`: Node simulation tests and Playwright browser checks.
- `cloudflare/`: static Worker deployment configuration and instructions.
- `SquishPocket/` and `SquishPocket.xcodeproj/`: earlier SwiftUI iPhone prototype.
- `Tests/`: native simulation checks.

See [browser details](browser/README.md), [browser verification](browser/VERIFICATION.md), and [native setup](NATIVE.md).

## Tests

```sh
cd browser
npm test
node tests/simulate-slot-limits.mjs
```

The current browser source passed 121 Node tests and a 1,728-case launch simulation. Chromium and WebKit checks also passed during development. To run the Python browser checks, install Playwright and its Chromium/WebKit runtimes in a Python environment, keep the local server running on port 4173, then run the relevant `browser/tests/browser_*.py` script. Some scripts write screenshots under `/tmp/squish-pocket-qa/`.

Native checks and the remaining iOS validation limits are documented in [NATIVE.md](NATIVE.md) and [VERIFICATION.md](VERIFICATION.md).

## Deploy

See [Cloudflare deployment](cloudflare/README.md). Credentials, local hosting bindings, build outputs, and deployment archives are excluded from this repository.

An independent project inspired by [Sobosuba](https://sobosuba.com/), with original code, graphics, and branding. It is not an official Sobosuba port and includes no Sobosuba source code or assets.

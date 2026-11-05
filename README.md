# Squish Pocket

A soft-body physics merge game for phones. Shoot jelly blobs into a glass bottle, combine matching numbers up to **4096**, and rearrange or merge the three ready blobs before shooting.

**[Play in your browser](https://squish.chemisgreat.online/)**

**[Test the latest candidate](https://squish-test.chemisgreat.online/)**

All development now lives in this GitHub checkout. The old
`/Users/chem/SquishPocket` path points here, and a verified archive preserves its
older files. Releases go to the test site first; the official game changes only
when a tested version is explicitly promoted. See [the release workflow](RELEASING.md).

Choose **Classic** to play solo at your own pace, or **Multiplayer** to create or join a private two-player room with a six-character code (`GameRoom` Durable Object). Both modes let you choose the **Original bottle**, the **Three-neck flask**, or a **water-filled version of either shape**. Blobs float in the water; stronger shots dive below the surface and splash droplets into the air. Each bottle saves its own Classic round; the original bottle remains the default.

The browser version is the current playable game. A separate, earlier native iPhone prototype is included for future development; its gameplay differs from the browser version and it has not been built or installed on iOS.

## Run the browser game

Requires Node.js for tests and Python 3 for the static development server. No frontend build step is needed.

```sh
cd browser
npm start
```

Open <http://localhost:4173>. For local Multiplayer rooms and shared Achievements (`/api/*`), run the Cloudflare Worker dev server from `cloudflare/` instead (`npm run dev`). On iPhone, open the public game in Safari and use **Share → Add to Home Screen**.

Pull a ready blob downward to charge and release to shoot, or hold **Shoot**. While holding Shoot, slide horizontally to aim and vertically to adjust force. Lift a blob to merge or rearrange it; use the bottom arrows to select a neighboring blob. Stiffness is locked at 10% and viscosity at 0% for every player. The round summary shows the world record to the right of Personal Best. Blob size is fixed at 150%. Progress stays in the current browser's local storage.

In **Multiplayer**, the room host chooses the bottle and starts the match. Both players receive the same random seed in separate bottles, see live score updates and an on-demand opponent bottle preview, and the higher score wins once both rounds finish (with a 30-second reconnect grace period).

The crown button opens **Achievements**: the shared count of players who reach 2048, the world high score and holder, the biggest tile, and your personal records. Each browser counts once across rounds. The current world-record holder of any bottle gets a congratulations page and can write a message inside the game for delivery to the creator's inbox. Shared records and Multiplayer rooms need the Worker API; see [local development and deployment](cloudflare/README.md).

## Project layout

- `browser/dist/`: directly served HTML, CSS, JavaScript, and icons (`start-page.js` and `room-client.js` drive mode selection and multiplayer rooms).
- `browser/tests/`: Node simulation/client tests and Playwright browser checks.
- `cloudflare/`: Worker router (`api.js`), multiplayer room API and `GameRoom` Durable Object (`rooms-api.js`, `game-room.js`, `room-model.js`), D1 migrations, email handler, tests, and Worker deployment configuration.
- `SquishPocket/` and `SquishPocket.xcodeproj/`: earlier SwiftUI iPhone prototype.
- `Tests/`: native simulation checks.

See [browser details](browser/README.md), [browser verification](browser/VERIFICATION.md), and [native setup](NATIVE.md).

## Tests

```sh
cd browser
npm test
node tests/simulate-slot-limits.mjs

cd ../cloudflare
npm test
npm run test:rooms
```

The original bottle retains its 1,728-case launch sweep. The separate lab-flask tests include a 45-case entry matrix for normal values across all three slots and forces. Chromium and WebKit checks also passed during development. To run the Python browser checks, install Playwright and its Chromium/WebKit runtimes in a Python environment, keep the local server running on port 4173, then run the relevant `browser/tests/browser_*.py` script. Some scripts write screenshots under `/tmp/squish-pocket-qa/`.

Native checks and the remaining iOS validation limits are documented in [NATIVE.md](NATIVE.md) and [VERIFICATION.md](VERIFICATION.md).

## Deploy

Run `npm run deploy:test` from the repository root. The command runs checks,
migrates the isolated test database, deploys the test Worker, and verifies every
published game asset. `npm run deploy` also targets test. Official promotion uses
`npm run deploy:production -- --tested-version ID` after approval of that candidate.
See [release details](RELEASING.md) and [Cloudflare deployment](cloudflare/README.md).
Credentials, local hosting bindings, build outputs, and deployment archives are
excluded from this repository.

An independent project inspired by [Sobosuba](https://sobosuba.com/), with original code, graphics, and branding. It is not an official Sobosuba port and includes no Sobosuba source code or assets.

## Three Combine test mode

On the test site, choose **Three Combine** for 1 → 3 → 9 → 27 merges, or keep
**Two Combine** for the original rules. Three equal touching blobs form the
next value. Both rules work with all vessels and multiplayer, with separate
saved rounds and scoreboards. The Three Combine milestone is 2,187.

### Milestone totals

Achievements shows both unique players reaching the milestone and the total
number of milestone blobs created (2,048 in Two Combine; 2,187 in Three Combine).
The total counts repeated bottle and ready-row merges from this update onward;
old high scores cannot reconstruct historic merge counts. Existing boards stay
unchanged. Per-round UUIDs and monotonic counts prevent reloads, upload retries
and repeated submissions from inflating the total. Offline progress is saved
locally and uploaded in batches of at most 50 rounds. Three Combine totals use
the current achievement epoch, so archived rounds cannot refill a fresh season.
Migration `0012_milestone_totals.sql` only adds tables; it resets no records.

### Vessel blob defaults

The Three-neck flask uses 120% base blob size. Conical flasks and separating
funnels use 100%; the Original bottle stays at 150%. Each default also applies
to the water variant. Three Combine retains its additional 20% scale.
Achievements shows the eight individual bottle Top 5 boards; the combined
“All bottles” tab is removed. Existing shared records are preserved.


### Bilingual home and merge previews

The interface defaults to Chinese and uses **团团** for blobs. The compact
**中/En** button changes language immediately and remembers the choice. The
Chinese home heading is “找到你的团团乐趣”, with “Find your kind of squish”
beneath it. Two/Three Combine controls show animated matching blobs merging,
with accessible labels, keyboard selection and a static reduced-motion view.
Both rules retain independent saved rounds, personal scores and Top 5 boards.
Multiplayer uses the same in-card Start game flow as Classic.

The congratulations page explains that only the current record holder can
message the creator and invites a playful message. Current-holder checks still
apply at the API. This official source excludes experimental Lab mode.

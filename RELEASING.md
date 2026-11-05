# Test-first releases

Use `/Users/chem/squish-pocket-github` for all work. `/Users/chem/SquishPocket`
is a symlink to this same project. The `origin` remote remains the official
GitHub repository: `https://github.com/Yuxiang-Chem/squish-pocket`.

The game has one source tree and two deployments:

- Test: https://squish-test.chemisgreat.online/ — Worker `squish-pocket-test`,
  D1 `squish-pocket-achievements-test`, config `cloudflare/wrangler.test.jsonc`.
- Official: https://squish.chemisgreat.online/ — Worker `squish-pocket`,
  D1 `squish-pocket-achievements`, config `cloudflare/wrangler.jsonc`.

Both serve `browser/dist` and run the same Worker source. Different Worker
names isolate multiplayer Durable Objects. Different D1 IDs isolate records.
Browser saves are separated by the two origins. Test email delivery stays off.
The older private Sites preview binding is retained locally; it is not either
of these Cloudflare deployment targets.

## Publish a candidate

From the repository root:

```sh
npm run deploy:test
# npm run deploy also means deploy:test
```

The command runs the browser/server Node suites and Worker runtime tests, applies pending migrations
only to the test database, and deploys only the test Worker. It then reads back
every game asset and checks it byte-for-byte against local source, and checks
the shared-achievement API. No test identity or score is submitted by this check.

A successful release saves its Worker version, source fingerprint, URL, and
verification time in ignored `.releases/test-release.json`. Inspect it with:

```sh
npm run check:release
```

If publication succeeds but network verification is interrupted, use
`npm run verify:test` to resume verification of that exact source/version without
publishing again.

Play the test candidate and run relevant browser checks before requesting an
official release. Browser tests that create records or rooms must target local
development or the test site when their origin guard permits it. Never point
write-producing QA at the official site.

## Promote the tested source

Promote only after the user explicitly requests the official release:

```sh
npm run deploy:production -- --tested-version THE_TEST_WORKER_VERSION
```

The guard requires a verified test receipt, the exact test version, and the same
source fingerprint. It also checks the live test assets again before migrating
the official database and deploying the official Worker. Editing game, server,
migration, configuration, package, or release-script files requires a new test
release first. Documentation changes do not alter the published fingerprint.

The release scripts do not commit or push Git branches automatically. Commit
unapproved candidates on test/feature branches; keep GitHub `main` for official
releases. Review and test the candidate before approval and merge. Do not create
a second editable copy merely to run a test release.

## Local development

```sh
cd cloudflare
npm run db:local
npm run dev
```

These commands use the test configuration and local resources. Its remote D1
database is `1724b1c3-701c-40ca-b6c8-61b7eb233164`; the official D1 database is
`6c18b29f-f6b2-4e44-bd32-40c3206db8bf`. Never substitute one for the other.

## Legacy recovery

The verified local archive and its file manifest are described in
`archive/README.md`. Restore into a temporary directory when comparing older
files; the canonical browser game is newer than that archive.

## Consolidation release — 2026-11-04

The first verified test release from this consolidated workflow is
`67bebb37-4eb0-41af-819b-4c90d5c90e8a`. All 160 game tests, 25 server/release
tests, and 4 Worker runtime tests passed. Every published asset matched local
source, the test database had no pending migrations, and Chromium/WebKit live
checks passed for the current flask physics and achievement panels.

The official deployment list was identical before and after this operation.
No GitHub commits or pushes were performed by the consolidation/release tools.

## Optional names and laboratory vessels — 2026-11-04

Test version `9b519998-091e-4dec-ab36-5807b641243d` adds optional champion
names, immediate name replacement, Separating funnel and Conical flask.
168 game tests, 27 backend/release tests and 4 Worker runtime tests passed;
all 29 deployed assets and the six-bottle API matched the candidate.
Migration 0008 expanded only the test database, preserving existing records.

## Larger funnel and water variants — 2026-11-04

Test version `7f37ee77-6022-4f88-a74a-a595fdfec8c0` lengthens the funnel and
increases its playable area by 34%, and adds water-filled funnel and conical
variants. All 169 game, 28 backend/release and 4 Worker runtime tests passed.
All 29 deployed assets and the eight-bottle API matched the source. Migration
0009 expanded only the test database and preserved existing records.

## Wide funnel opening — 2026-11-04

Test version `61bec270-9b14-42d9-92f3-5ca8b314ea37` gives both separating
funnel variants an Original-style flared opening, enlarged to 280 units
(Original: 256). Geometry version 3 preserves saved progress. All 171 game,
28 backend/release and 4 Worker runtime tests passed. All 29 deployed assets
and the achievement API matched local source.

## Frosted funnel and top-five Achievements — 2026-11-04

Test version `cfc19185-c972-4d65-aef8-bfc2b20bdd62` reduces the funnel opening
by one third, adds a frosted band near its rim, and shows ranks 1–5 on all
nine achievement boards. All 171 game, 30 backend/release and 4 Worker runtime
tests passed. All 29 deployed assets and the top-five API matched local
source. No database migration was required.

## Slightly longer funnel neck — 2026-11-04

Test version `e2b02cb1-3787-48e3-820d-a69849b0fdf5` adds a short straight
throat below the frosted rim on dry and water funnels. Geometry version 5
fits saved entered blobs. All 171 game, 30 backend/release and 4 Worker
runtime checks passed; all 29 deployed assets and the achievement API matched
local source.

## Larger decorative funnel outlet — 2026-11-04

Test version `d30afa02-c061-49cb-8988-5a517239864d` thickens and lengthens
the decorative outlet beneath both funnel variants and slightly enlarges
the tap and handle. All 171 game, 30 backend/release and 4 Worker runtime
checks passed. All 29 assets and the achievement API matched local source.

## Official promotion — 2026-11-04

Approved test version `d30afa02-c061-49cb-8988-5a517239864d` was promoted to
`https://squish.chemisgreat.online/` as Worker version
`fee21e1b-99d7-4127-9888-893134a081d8`. The source fingerprint is identical to
the verified test build, which passed 205 automated checks.

A private database export was validated before promotion. Only migrations 0008
and 0009 were pending; both were first applied to that export in local SQLite,
where every existing row stayed identical. After the real migration, all 28
players, 58 bottle-score rows, 7 current dry-flask score rows, the overall
record, 4 bottle record holders and the existing message were unchanged.
Foreign-key checks passed. Test records were not copied to official.

Every one of the 29 official assets matched the tested source. Live Chromium
and WebKit verified the bottle views and all nine Top 5 boards against the
real official public API. QA name/score submissions were intercepted and no
QA messages were sent. Private exports and audit snapshots remain ignored
inside `.releases/`.

## Three Combine candidate — 2026-11-04

Test version `50680601-b368-4a6e-8a64-07565866a476` adds Three Combine alongside
Two Combine, with 1 → 3 → 9 → 27 values, connected triple merging, separate
browser saves and shared boards, and room-specific multiplayer rules. All 178
game, 33 backend/release and 5 Worker runtime checks passed (216 total).
Migration 0010 adds only independent `three_` records tables to the test database.
All 30 deployed assets and both merge-mode achievement APIs matched the source.
Live Chromium/WebKit checks passed the picker, actual triple merge, reload,
original score retention, phone layouts and cross-mode room joining with
remote writes mocked. The official site still serves the approved version 52.

## Double-width conical opening — 2026-11-04

Test version `6d37dd5d-7207-4c5c-afbf-66c4a1f5903c` doubles both conical
openings from 82 to 164 units and widens the neck-to-cone transition. Geometry
version 2 preserves saved round statistics in both merge modes. All 179 game,
33 backend/release and 5 Worker runtime checks passed (217 total). All 30
deployed assets and both merge-mode APIs matched source. Live Chromium/WebKit
passed dry/water conical views and phone layouts with record writes mocked.

## Achievement merge-mode selector — 2026-11-04

Test version `56cf2967-cd2f-4bd7-b0a6-258fd78d28c0` adds an in-place
Two Combine / Three Combine selector inside Achievements. Personal scores,
names, Top 5 boards, milestones, champion pages and messages follow the
displayed rule while the running game keeps its own rule and HUD. Bottle
selection now stays stable during programmatic slides, including WebKit.
All 180 game, 33 backend/release and 5 Worker runtime checks passed (218 total).
All 30 assets and both achievement APIs matched source. Live Chromium/WebKit
passed all nine boards, independent names/scores, champion/message flows,
phone layouts and touch/keyboard browsing with remote writes mocked. No new
database migration was needed; this remains a test candidate.

## Smooth gameplay mode switching — 2026-11-04

Test version `d0dd2d02-8f68-4989-bc7e-0b2d9e56f7f4` (assets v57) removes
document reloads when choosing a merge rule or joining a room with another
rule. The game restores the chosen rule's vessel and saved pile, updates
instructions/evolution/HUD in place, and reuses its separate achievement
identity. All 218 automated checks passed, and all 30 assets plus both
achievement APIs matched source. Live Chromium/WebKit verified repeated
switches and cross-rule room joining with no document reloads or errors;
saved scores, shot counts, identities and personal boards stayed separate.
Actual triple merging and achievement/champion/message regressions passed
locally in both browsers. All shared QA writes were mocked. No new migration
was needed; this is a test-only candidate.

## Three Combine official promotion — 2026-11-04

Approved test `d0dd2d02-8f68-4989-bc7e-0b2d9e56f7f4` was promoted as official
Worker `82dfcb73-d45d-41c3-8535-57f6ccb18f0f` (assets v57). Its fingerprint
matches the exact test candidate that passed 218 automated checks. All 30
official assets and both achievement APIs were verified against source.

The official backup passed SQLite integrity and foreign-key checks. The only
pending migration, 0010, was rehearsed against that backup and added seven
independent Three Combine tables. Full pre/post exports then confirmed every
row in every existing table remained identical, including 28 players, 66
bottle scores, 7 current dry-flask scores, all record holders and messages.
The new Three Combine tables were empty; no test scores were copied.

Live Chromium/WebKit verified seven in-place switches, independent identities
and saves, cross-rule room joining, both achievement/champion/message flows,
all nine boards per rule against real public API snapshots, and widened dry
and water conical openings. All QA writes and room sockets were mocked or
blocked. Private backups and preservation reports remain ignored in `.releases/`.

## Compact bottle start screen — 2026-11-04

Test `93042a12-16b9-4eb6-b0ad-678934a22b51` (assets v58) moves solo launch
away from the bottom of the bottle list. Choosing any bottle opens a compact
screen with one blob and Start game; the second tap starts or continues that
bottle's saved pile. Returning to choose another bottle does not start play
or change the saved pile. Multiplayer choices continue to configure the room.

All 218 automated checks passed. The initial app.js asset verification failed;
`npm run verify:test` then verified the unchanged build's 30 assets and both
achievement APIs. Local and live Chromium/WebKit verified all eight vessels in
both merge modes, start-button visibility at 320×568 through 430×932, keyboard
selection, saved/fresh rounds and multiplayer selection with shared writes
mocked. This is a test-only candidate.

## Start inside the bottle card — 2026-11-04

Test `cbaa2890-78de-4361-96f6-b68d5bab9675` (assets v59) replaces the separate
ready screen with an in-card start control. Selecting a bottle shows a blob,
Start game and its saved/fresh status inside that same card. The second tap
starts play; choosing another card moves the control there. Card dimensions,
the bottle list, headings and scroll position stay unchanged.

All 218 automated checks passed, with all 30 deployed assets and both APIs
verified against source. Local and live Chromium/WebKit passed all eight
vessels in both merge modes, unchanged grid/scroll, contained content at
320–430px, keyboard selection, explicit second taps, saved/fresh starts and
multiplayer configuration. Shared QA writes were mocked. This remains a
test-only candidate.

## Bottle-card official promotion — 2026-11-04

Approved test `cbaa2890-78de-4361-96f6-b68d5bab9675` was promoted as official
Worker `dfb8f086-23a0-4bc6-afff-10651c71811d` (assets v59), with the exact
source fingerprint that passed 218 automated checks. All 30 official assets
and both achievement APIs matched source. No migration was pending.

Read-only pre/post snapshots confirmed every row in both modes' record,
player, score and message tables stayed identical, along with migration
history and zero foreign-key violations. Live Chromium/WebKit passed all
16 vessel/mode card selections, unchanged grid/scroll, a required second tap,
saved/fresh starts, phone layouts and multiplayer selection. Every QA write
and room socket was mocked or blocked. Private audits remain in `.releases/`.

## Three Combine size increase — 2026-11-04

Test `931b572d-bf3b-41cd-b510-58bf931d7d06` (assets v60) makes Three Combine
blobs 30% larger in linear size. Physical membranes, ready bodies and opponent
previews use the same multiplier. Older saves resize once and fit to the glass,
preserving score, shots and merge progress. Two Combine sizing is unchanged.

All 183 game, 33 backend/release and 5 Worker runtime checks passed (221 total).
All 30 deployed assets and both mode APIs matched source. Local/live
Chromium/WebKit verified real shooting, ready/physical size ratios, old-save
upgrades and repeated reloads, preserved scores/shots and phone layouts with
shared writes mocked. Entry checks passed every spawned value, slot and force
across all eight vessels. No migration was required; this is a test candidate.

## Three Combine restart and two-day announcement — 2026-11-04

Approved test `be4bc363-a27a-4075-9805-5ff798c1392c` (assets v61) was promoted
to official Worker `3129833e-f16c-4c2e-89e6-ce1b438fb701`. Its exact source
passed 225 automated checks (186 game, 34 backend/release, 5 Worker runtime).
All 31 assets and both achievement APIs matched source. Initial test asset
verification was retried successfully with `npm run verify:test` on the
unchanged build.

Three Combine blobs are 30% larger. Migration 0011 restarts personal, vessel,
overall and milestone achievements in separate `three_v2_` tables, copying
identities/names with zero progress. Old saved piles stay playable but cannot
refill the reset boards; epoch-less clients cannot submit old achievements.
Two Combine retains its existing rules and records.

The official database was privately backed up, and migration 0011 was rehearsed
on that backup. Full pre/post exports verified exact preservation of every
original table row, including all 29 Two Combine players, 75 bottle scores,
record holders/messages and the archived Three Combine history with zzz's
65,610 score. Four Three Combine identities were copied with zero score and
starting tile 1, and all fresh leaderboards were empty. Foreign-key and SQLite
integrity checks passed.

The thank-you announcement runs from 2026-11-04 18:42:12 to 2026-11-06 18:42:12
Asia/Shanghai (48 hours). Test and official windows start independently when
their migration is applied. Page timers hide both home and achievement notices
automatically, including pages left open.

Local, test-site and official Chromium/WebKit checks passed notice content,
two-day expiry, personal/Top 5 reset, stale-save exclusion, Two Combine score
retention, larger ready/physical blobs, shooting and repeated save restoration.
All QA writes and room sockets were mocked or blocked. Private exports and
reports remain ignored inside `.releases/`. The earlier review-service usage
limit interruption was resolved before these release checks and publication.

## Milestone totals without Lab — 2026-11-04

This release adds the total number of 2,048 blobs in Two Combine and 2,187 blobs
in Three Combine alongside the existing unique-player counters. It preserves
all existing scores, names and Top 5 boards. Additive migration 0012 starts
tracking new milestone creations; it does not reset achievements.

The official candidate is based on the previous official release plus the
milestone feature only. It excludes the experimental Lab mode, its menu and
its assets. Lab stays on the test deployment and its development branch.

Assets v68 passed all 233 automated checks (191 browser Node, 37 backend/release,
five Worker runtime). Verified test candidate:
`260d78d2-4c34-49ec-96bb-21acbf2798af`, source fingerprint
`63c53bf85c798f2f725e5d6ed871e0528cbefb67abb4d4ffc0e1e9ad4818af76`.
A private official database backup and migration rehearsal confirm preservation
of all 260 existing rows across 26 tables.

Promoted that exact candidate to official Worker
`8a2d34ed-5c75-4084-b6c2-24f6e3e9d2cb`. All 32 official assets and both APIs
matched source. Live Chromium/WebKit confirmed both counters and the absence
of Lab, with all browser writes mocked. Post-release database exports retain
all 260 existing rows and pass integrity/foreign-key checks; two score rows
improved through normal live play during the release. No achievements reset.

Restored the test Worker to its preserved Lab version
`ae049779-8b05-47f0-ad5d-26fa8f44202d`; all 34 test assets match their saved
pre-promotion hashes. This restoration changes no database data. Lab remains
exclusive to the test site and its development branch.

## Vessel defaults and individual achievement boards — 2026-11-05

Assets v72 set Three-neck base blob size to 120%, conical and separating-funnel
sizes to 100%, including water variants. Original bottles remain at 150%.
Stiffness remains 10%, viscosity 0%, and Three Combine retains its 30% multiplier.
New rounds and restored official rounds use these per-vessel defaults. Opponent
previews use the same vessel sizes. The “All bottles” achievement tab/page is
removed; eight vessel Top 5 boards, milestone counters and all stored history
remain. No schema change or achievement reset is required.

Verified test `a5edc969-e280-427e-974a-3d2a96e1d48f` passed 234 automated checks
and Chrome/WebKit checks across all sixteen vessel/rule combinations. A parallel
Lab test release caused the first promotion guard to reject mismatched assets.
The exact verified candidate was reinstated on test, then promoted through the
guard to official `201ffe69-82ef-41f3-9dd0-f500671fbc85`. All 32 official assets
and both mode APIs matched source. Lab is excluded from this official release.

## Three Combine at 120% of Two Combine — 2026-11-05

Assets v75 change the Three Combine multiplier from 1.3 to 1.2, consistently
for physical membranes, ready blobs and opponent previews. Two Combine keeps
its existing base sizes: Original 150%, Three-neck 120%, conical/funnel 100%.
Three Combine therefore uses effective 180%, 144%, and 120%, including water
variants. Existing 1.3-scale saves resize once to 1.2 without resetting scores,
shots, milestone history or saved round identity. No achievement reset, schema
change or new announcement window is included. The existing notice/settings
copy now describes the current 20% increase.

Test `8f3f1b74-5a3f-4513-b002-b36a83e16aa6`, source fingerprint
`2a625bd8ff50f39c0213c78c5e6dc1e86ae18f1955a9c6d0199f0a4b8cdaad85`,
passed all 236 automated checks plus local/live-test Chrome/WebKit checks for
every vessel's bottle/ready ratio and one-time 1.3-to-1.2 saved-round resizing.
The official candidate excludes Lab; its development remains test-only.

Promoted that exact candidate through the release guard to official
`595ca74b-1ce1-4611-90c3-ad9a62544064`. All 32 assets and both achievement APIs
matched source. No migration was pending. Lab remains test-only; scores and
achievement history are not reset by this adjustment.

## Bilingual 团团 heading, animated selectors and holder note — 2026-11-05

Lab-free assets v84 were verified on test as
`2f2f5165-362d-408d-a92e-1f4c6079cfbe` and promoted through the release guard
to official `d0828357-46f0-4db8-8bc9-9b1d6bd5a0c6`. Source digest:
`4cc185663e3d99c1a8288eed5d96a9f3d81f5e544e7405d699b6951aa22e1a0f`.
All 239 automated checks passed (197 game/locale, 37 backend/release, five
Worker runtime); all 34 assets and both achievement APIs matched. No migrations
were pending. Official physics, vessel geometry, record epochs, API and room
backend remain identical to the previous approved official baseline.

Chinese uses 团团 throughout. The restored heading keeps “Find your kind of
squish” below the Chinese title. Both home and achievement mode selectors show
two or three blobs merging, without visible text labels, with keyboard/screen
reader names and reduced-motion alternatives. The congratulations page explains
that only the current record holder can message the creator and invites a fun
message in both languages. The larger Back/Achievements controls, 中/En toggle
and shared multiplayer in-card start flow are included. Lab's entry, controller
and simulation assets are excluded from official; dry/water Three-neck vessels
remain regular game bottles.

Local Chromium/WebKit passed both real two-player rule flows, animation phases,
phone/desktop sizes, language switching, all eight Top 5 boards and the holder
note/ownership loss state. Live-test checks passed with remote writes mocked
and no messages sent. Source, receipts and audit logs are archived privately
under `.releases/animated-picker-2026-11-05/`.

Live official Chromium/WebKit checks also passed both language headings,
animation phases, reduced motion, all four selectors, both rule settings and
Lab asset exclusion. The bilingual holder note fits a 320px phone; ownership
loss disables messaging. All QA writes were mocked and no messages were sent.
Public before/after audits preserved every bottle record, achievement epoch
and announcement deadline: Two Combine remained 12 players / 7 milestone
creations, and Three Combine remained 2 players / 2 creations.

## Published game-style previews and 115% vessels — 2026-11-05

The Lab-free v89 candidate was verified on test as
`8bdd8bed-5b06-4f0e-91d1-8af5e80012e1` and promoted through the release guard
to official `230062af-8cb3-4b43-a317-cddae9e35f03`. Source digest:
`fc6d6acb05592a123c3d4247832f48d1deb89f994a550c18f899fb9698e7aa3d`.
All 240 automated checks passed (198 game/locale, 37 backend/release, five
Worker runtime). All 36 assets and both achievement APIs matched source;
no migrations were pending. Engine mechanics, vessel geometry, achievement
epochs and the room/API backend match the prior official baseline, aside
from the requested vessel defaults.

The home heading stays English under both locales, Chinese UI uses 团子,
and combine controls share the actual game renderer and values. Conical and
separating funnel defaults are 115%, including water variants (138% effective
in Three Combine). Official settings show each bottle’s real fixed values.
Lab entries and simulation assets are excluded from official. Local and live
Chromium/WebKit passed animations, reduced motion, keyboard/language flow,
all sixteen vessel/mode sizes and locked settings, and all eight Top 5 boards.
Local real multiplayer passed both rules. The live holder-note/permission
checks also passed, with no messages sent. All shared QA writes were mocked.
Receipts, logs and public before/after audits are archived privately under
`.releases/publish-game-previews-2026-11-05/`.

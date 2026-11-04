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

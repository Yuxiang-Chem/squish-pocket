# Cloudflare deployment

Routine releases target **https://squish-test.chemisgreat.online/** first. Run `npm run deploy:test` from the repository root. The same game source serves both environments, with separate Worker/D1/room resources. Official releases require explicit promotion of a verified test candidate; see [RELEASING.md](../RELEASING.md).

The public game at <https://squish.chemisgreat.online/> uses a Cloudflare Worker with static assets from `../browser/dist`, a SQLite-backed `GameRoom` Durable Object (`ROOMS`) for two-player Multiplayer rooms, a D1 achievement database (`ACHIEVEMENTS`), and an Email Service binding (`EMAIL`). No frontend build is needed. Classic round saves remain in each browser; achievement records and private multiplayer rooms run on the Worker.

## Local development

Requires Node.js 24+ (the API tests use Node's SQLite module).

```sh
cd cloudflare
npm ci
npm run db:local
npm run dev
```

Open <http://localhost:4173>. This serves the game, Multiplayer room endpoints (`/api/rooms/*` and WebSocket upgrades), and shared achievements (`/api/achievements`, `/api/record-message`). The browser directory's Python server still runs solo Classic mode, but cannot serve Multiplayer rooms or shared achievements.

For email UI testing, copy `.dev.vars.example` to `.dev.vars`, then restart the dev server. This enables the **local email simulator only**: messages are captured by Wrangler and are not delivered. Do not add `remote: true` to the email binding for routine tests. Local data is under ignored `.wrangler/` and is never uploaded as production data.

```sh
npm test
npm run test:rooms
npm exec -- wrangler deploy --dry-run --config wrangler.test.jsonc
```

## Multiplayer rooms (`GameRoom` Durable Object)

- `POST /api/rooms` creates a private two-player room with a 6-character code (`[A-HJ-NP-Z2-9]{6}`) and sets an `HttpOnly; SameSite=Strict` session cookie scoped to `/api/rooms/<code>`.
- `POST /api/rooms/<code>/join` seats the second player (or verifies an existing browser session cookie), `GET /api/rooms/<code>/session` returns the caller's public room snapshot (omitting `tokenHash`), `GET /api/rooms/<code>/connect` upgrades to a hibernatable WebSocket, and `POST /api/rooms/<code>/leave` leaves or forfeits.
- Only the host (slot 0) chooses the bottle (`classic` or `lab-flask`) and starts the match (`start`). Starting a round assigns a shared 32-bit seed (`round`, `seed`) so both players get the same sequence of blobs in separate bottles.
- Live progress updates (`progress`) validate scores, shot counts, highest tiles, and up to 90 blob positions, ignoring stale or decreasing updates and duplicate no-op ticks. The match concludes once both players finish or a player forfeits.
- Disconnected players during an active round have a 30-second grace period (`RECONNECT_GRACE = 30000`), enforced both on incoming requests/messages and via Durable Object storage alarms (`syncAlarm`), before forfeiting. Rooms expire after 6 hours (`ROOM_TTL`).

## Deployment databases

Both databases already exist. `wrangler.test.jsonc` binds
`squish-pocket-achievements-test` (`1724b1c3-701c-40ca-b6c8-61b7eb233164`);
`wrangler.jsonc` binds the official `squish-pocket-achievements`
(`6c18b29f-f6b2-4e44-bd32-40c3206db8bf`). The release scripts select the correct
configuration for every migration and deployment. Do not create replacement
resources or mix their IDs.

```sh
# From the repository root: tests, test migration, test deployment, verification
npm run deploy:test
# Only after the user requests the official release of that tested candidate
npm run deploy:production -- --tested-version THE_TEST_WORKER_VERSION
```

Database IDs are identifiers, not credentials. Authentication stays outside the
repository. Test email sending remains disabled; the official setting is retained.

## Connect the creator's inbox

The fixed destination is **chem.xjtlu@gmail.com**. The browser submits messages to the Worker; it never talks directly to an email provider and does not open a mail app. The server verifies player identity and current record ownership, then sends with the [Email Sending Workers API](https://developers.cloudflare.com/email-service/api/send-emails/workers-api/).

Production email is enabled with `EMAIL_ENABLED: "true"`. The verified destination is `chem.xjtlu@gmail.com`, and the sender is `records@chemisgreat.online`. Email Routing is enabled for `chemisgreat.online` with status `ready`. A real delivery test succeeded on 2026-11-03; Cloudflare reported `Delivered to: chem.xjtlu@gmail.com`.

This setup uses [free sending to a verified destination](https://developers.cloudflare.com/email-service/platform/pricing/); a paid sending-domain plan is not required for this fixed inbox. Sending to arbitrary recipients has different plan requirements. The Worker binding is restricted to the fixed recipient.

For a separate deployment:

1. Register and verify your destination address:

   ```sh
   npm exec -- wrangler email routing addresses create you@example.com
   npm exec -- wrangler email routing addresses list
   ```

2. Configure a routing domain for the sender. Review existing email DNS before enabling routing so existing mail service is preserved:

   ```sh
   npm exec -- wrangler email routing dns get yourdomain.com
   npm exec -- wrangler email routing enable yourdomain.com
   ```

3. Change the server's fixed recipient, the binding destination, and `EMAIL_FROM` to match your setup. Keep `EMAIL_ENABLED` false until your sender and recipient are ready, then enable it and deploy.

Use a controlled staging record for full message-flow testing; never seed fake achievements into production. A successful send means Cloudflare accepted the email; it does not independently confirm Gmail inbox placement. Check Spam if a message does not appear.

## Record behavior and limits

- Anonymous browser identity and a random bearer token persist independently of round saves. Only a SHA-256 token hash is stored server-side; tokens and player IDs are not exposed by public summaries.
- Reaching 2048 or 4096 in the bottle or preparation row counts once per identity. A new round, repeated submission, or a late request cannot lower scores or count that player again. Older round saves infer the biggest tile still present; already-disappeared milestones from before this feature cannot be recovered.
- Highest score and biggest tile are separate shared records. The first player to a high score keeps ownership on ties, including simultaneous submissions. A strictly higher score transfers ownership.
- Only the current high-score holder can send a 1–2,000-character message, with an optional reply address, once per UTC day. Ownership and daily claims are checked atomically on the server. Failed provider calls release the daily claim for retry. Drafts stay in the open form on errors; delivered message text and reply addresses are stored privately in `record_messages`.
- This is a casual, client-reported leaderboard, not an authenticated competition or cheat-proof score verifier. One identity means one browser profile, not a verified person; clearing browser data or changing device creates another identity. The UI explains these limits.
- Email addresses and message text are not included in public summaries or application logs. Public display names are rendered as text, and email HTML is escaped. JSON bodies are bounded and cross-origin browser submissions are rejected.

## Published state (2026-11-03)

Published to <https://squish.chemisgreat.online/> as Worker version `a2ba0c73-a0b9-47e7-98f6-507240aeab5f`.

The production D1 database is `squish-pocket-achievements`, ID `6c18b29f-f6b2-4e44-bd32-40c3206db8bf`, in APAC. Migration `0001_achievements.sql` was applied successfully. No local QA data was uploaded. The public game, achievement module, and shared API were checked after deployment, and the live achievement dialog showed that records were up to date.

The original bottle is restored as the default with its exact prior drawing and collision implementation. The bottle selector adds a separate reference-based flask with a round body, a taller central joint, and two angled side necks. Each bottle keeps its own browser-saved round; legacy saves restore into Original bottle. Stiffness is locked at 10%, viscosity at 0%, and the round summary places World Record to the right of Personal Best. Shared achievements and record-holder email messages are enabled; the live API returned `emailReady: true` after deployment. A direct delivery test to the real inbox succeeded; no fake record was created in production.


## Bottle-specific achievement records

Migration `0002_bottle_records.sql` adds independent personal and world records for `classic` and `lab-flask`. Apply pending D1 migrations before deploying this API update. The existing overall board and its record-holder message permission are retained. Historical server records have no bottle attribution and remain on the overall board.

`POST /api/achievements` accepts an optional `bottles` object, keyed by bottle ID, with `{score, highestTile}` records. Each record must fit within the submitted overall score and tile maxima. Scores only increase, ties retain the first holder, and the existing identity/token check applies before bottle writes. GET and POST summaries include `bottles`, with each bottle's world `record`, global `highestTile`, and authenticated `personal` best. No player identifiers or tokens are exposed in public records.

`browser/tests/browser_achievement_bottle_checks.py` runs against the local Worker and D1 database. It creates named test records, so use an isolated local database, never the public game. Set `SQUISH_TEST_URL` to the local Worker URL when using a port other than 4173.


## Published flask and swipeable achievements update — 2026-11-03

Published to `squish.chemisgreat.online` as Worker version `28312784-a684-4d54-857e-f1759f58bd27`. The live database also contained an earlier `player_scores` / `bottle_record` layout, recorded as `0002_bottle_achievements.sql`. The new record triggers use distinct names, and `0003_import_existing_bottle_scores.sql` imports those attributed records while retaining their original tables and tied record holders. Earlier clients submitting a `bottle` field remain supported for score attribution.

Both new migrations applied successfully. Read-only production verification confirmed 21 existing identities, 4 achievers, the Original bottle record of 16,364, and the Three-neck flask record of 9,036 were preserved. No QA scores or identities were submitted to production. The server suite now has 15 passing tests, including the earlier schema, tied-holder import, repeat import, and legacy-client submission checks.


Published the larger flask and neck-containment update on 2026-11-03 as Worker version `bc527062-30a4-4e49-84de-07b8c701f84a`. The flask uses geometry version 3, about 22% more playable area, and a 750 mL marking. Closed-neck membrane crossings and smoothed rendering across the glass are corrected. No database schema changes are required for this release. All 145 browser Node tests pass; Chromium and WebKit crowded-save, rendering, reload, small-phone, and gap-miss checks pass.


Published bottle-specific pause, saved-resume, and game-over summaries on 2026-11-03 as Worker version `10625699-6524-4c1c-880f-f5b3be344698`. Personal Best and World Record now use the current bottle’s records, with its name displayed above the score fields. All-bottle achievement totals remain available in the Achievements panel. No database changes are required. Focused achievement tests, Chromium/WebKit summary checks, and the existing Chromium touch/summary regression passed.


## Messages from either bottle champion

Apply migration `0004_bottle_record_messages.sql` before deploying this update. It preserves an existing `bottle_messages` table/history when present and creates it on fresh databases. Authenticated achievement summaries expose `bottles[id].isRecordHolder`; public summaries keep those flags false and do not expose player identifiers.

`POST /api/record-message` accepts `bottle: "classic" | "lab-flask" | "all"` (omitting it retains the previous overall-record behavior). A player holding either bottle record may send for that bottle without holding the overall record. The selected ownership is checked again in the INSERT that claims the daily quota. Rate limits are per player, selected record, and UTC day. Emails retain the fixed creator destination, include the bottle name/score/tile, support an optional reply email, and escape all HTML content. Failed delivery releases that record’s claim; successful responses include `{sent: true, bottle}`.

The congratulations UI is based on server-confirmed ownership, can be reopened from the corresponding achievement card, and links to the eligible message composer. `browser/tests/browser_record_champion_checks.py` uses local D1 and local email simulation only. No test records or emails should be seeded into production.


Published bottle champion messaging and congratulations on 2026-11-03 as Worker version `4ff1ee66-c67c-4961-9e5b-00ff38fffaff`. Migration `0004_bottle_record_messages.sql` applied successfully and preserved the already-existing bottle message table/history. The creator destination was verified and the routing domain reported enabled/ready. Email sends were tested with local simulation; no QA email or score was submitted to production.


Final congratulations-page version: `24c67338-a885-4126-b72e-d3eef5063d5d` (2026-11-03). Offline refresh failures preserve the celebration and ask the player to reconnect; they do not falsely report that another player won.


## Water bottle variants

Migration `0005_water_bottle_records.sql` expands the bottle IDs accepted by `bottle_scores`, `bottle_records`, and `bottle_messages` to include `classic-water` and `lab-flask-water`. It rebuilds the constrained tables inside the D1 migration transaction, copying all records and message history before recreating the record triggers/index. Tests verify that dry scores, first holders on ties, and daily message claims survive. Global player identities, overall records, and earlier legacy tables remain intact.

The achievement API, record-holder composer, congratulations page, pause/game-over summaries, saved rounds, and Multiplayer room host selection support all four IDs. Water-mode email subject/body labels identify the selected water vessel. Apply the pending migration before deploying the updated client/API together.


Published both water-filled variants on 2026-11-03 as Worker version `369b2ea9-ed92-471f-bbe3-9b0452f146af`. Migration `0005_water_bottle_records.sql` applied successfully (17 commands). Production checks retained all 21 Original-bottle and 2 Three-neck-flask score rows, their records of 16,364 and 13,960, and the existing message counts. `PRAGMA foreign_key_check` returned no violations. Both dry modes remain available, with new water IDs keeping separate saves and records.


## Dry flask world-record reset — 2026-11-04

Apply `0006_reset_dry_flask_world_record.sql` before deploying the v45 client/API. It clears only the dry `lab-flask` world record and creates `flask_record_scores` for repaired-game rounds. Historical `bottle_scores`, overall achievements, every other bottle record, player identities, and messages remain intact. Historical-score triggers exclude the dry flask so old clients cannot undo the reset. New clients submit `flaskRecord: {epoch: 1, score, highestTile}` independently of their historical personal best. Fresh-round eligibility is saved as `engine.recordEpoch`; earlier saves remain playable but do not compete on the fresh world board.

The dry-flask summary includes `recordEpoch` and authenticated `recordPersonal`. World tiles and champion emails use the fresh board, while `personal` retains lifetime history. Other bottle APIs and tie handling retain their existing behavior.

Published on 2026-11-04 as Worker version `984c1609-a89f-4d37-910a-8c8bc5f600fd` at `https://squish.chemisgreat.online/`, with migration 0006 applied. Production verification confirmed the dry world record was cleared, while other world-record rows, all personal score totals, all 26 identities, the overall record, and message totals stayed unchanged; foreign-key checks passed. Live Chromium/WebKit checks verified all five Achievements panels, fresh-board state, versioned assets, old/new round eligibility, and crowded above-line stability with no JavaScript errors. Maximum settled per-step vertical movement was about 0.244 / 0.253 units versus the reproduced 2.424-unit jump. Live QA intercepted score submissions and sent no production messages.


## Dry-flask personal scores and fast neck containment — 2026-11-04

Migration `0007_reset_dry_flask_personal_scores.sql` resets every dry `lab-flask` personal best score while retaining personal merge milestones, overall history, identities, messages, and all other bottle scores. Epoch 2 uses `flask_current_scores` as the authoritative personal/world score source. The previous epoch table remains compatible with requests finishing on the previous Worker version; its record triggers are removed, so these writes cannot reinstate the new board. New API requests also normalize the dry `bottle_scores` mirror to current-epoch points. Cached epoch-1 clients can still save other bottle records without restoring dry-flask scores.

The browser clears its dry personal score once when adopting epoch 2, retains the saved round, and excludes older round scores from Personal Best. It ignores personal-score responses explicitly carrying an older epoch during rollout. New round records and offline progress persist normally.

Published on 2026-11-04 as Worker version `14512392-e5ea-4a57-ab1f-1c79202f6f7b` with migration 0007. Production checks confirmed all 8 existing dry-flask personal score rows are zero, with their merge milestones, all other bottle score totals/records, all identities, overall history, and messages unchanged. No stale dry scores or foreign-key violations remained. Live Chromium and WebKit checks confirmed byte-identical solver assets, epoch-2 eligibility, browser personal-score migration, retained Original/water bests, five achievement panels, native Chromium swipe, above-line stability, and no JavaScript errors. Production QA score submissions were intercepted and no production messages were sent.

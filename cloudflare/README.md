# Cloudflare deployment

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
npm exec -- wrangler deploy --dry-run
```

## Multiplayer rooms (`GameRoom` Durable Object)

- `POST /api/rooms` creates a private two-player room with a 6-character code (`[A-HJ-NP-Z2-9]{6}`) and sets an `HttpOnly; SameSite=Strict` session cookie scoped to `/api/rooms/<code>`.
- `POST /api/rooms/<code>/join` seats the second player (or verifies an existing browser session cookie), `GET /api/rooms/<code>/session` returns the caller's public room snapshot (omitting `tokenHash`), `GET /api/rooms/<code>/connect` upgrades to a hibernatable WebSocket, and `POST /api/rooms/<code>/leave` leaves or forfeits.
- Only the host (slot 0) chooses the bottle (`classic` or `lab-flask`) and starts the match (`start`). Starting a round assigns a shared 32-bit seed (`round`, `seed`) so both players get the same sequence of blobs in separate bottles.
- Live progress updates (`progress`) validate scores, shot counts, highest tiles, and up to 90 blob positions, ignoring stale or decreasing updates and duplicate no-op ticks. The match concludes once both players finish or a player forfeits.
- Disconnected players during an active round have a 30-second grace period (`RECONNECT_GRACE = 30000`), enforced both on incoming requests/messages and via Durable Object storage alarms (`syncAlarm`), before forfeiting. Rooms expire after 6 hours (`ROOM_TTL`).

## Production database

Authenticate with the Cloudflare account that owns `chemisgreat.online`. The configured Worker is `squish-pocket`; the existing custom domain, public audience, and unrelated resources should stay intact.

```sh
npm exec -- wrangler login
npm exec -- wrangler d1 create squish-pocket-achievements
```

Add the returned `database_id` to the `ACHIEVEMENTS` entry in `wrangler.jsonc`, then apply the migration **to that new database** before deploying:

```sh
npm exec -- wrangler d1 migrations apply ACHIEVEMENTS --remote
npm run deploy
```

Database IDs are identifiers, not credentials. Do not reuse or modify another game's database. Authentication is stored outside this repository; never commit tokens, `.dev.vars`, or local Wrangler files. An omitted database ID allows Wrangler's automatic provisioning, but explicit creation and migration are recommended so the schema exists before the first request.

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
- Original bottle and Three-neck flask keep separate scores, 2048 counts, world records, and daily messages. Earlier shared records remain on the original bottle.
- Only the current high-score holder for that bottle can send a 1–2,000-character message, with an optional reply address, once per UTC day. Ownership and daily claims are checked atomically on the server. Failed provider calls release the daily claim for retry. Drafts stay in the open form on errors; delivered message text and reply addresses are stored privately in `record_messages`.
- This is a casual, client-reported leaderboard, not an authenticated competition or cheat-proof score verifier. One identity means one browser profile, not a verified person; clearing browser data or changing device creates another identity. The UI explains these limits.
- Email addresses and message text are not included in public summaries or application logs. Public display names are rendered as text, and email HTML is escaped. JSON bodies are bounded and cross-origin browser submissions are rejected.

## Published state (2026-11-03)

Published to <https://squish.chemisgreat.online/> as Worker version `a2ba0c73-a0b9-47e7-98f6-507240aeab5f`.

The production D1 database is `squish-pocket-achievements`, ID `6c18b29f-f6b2-4e44-bd32-40c3206db8bf`, in APAC. Migration `0001_achievements.sql` was applied successfully. No local QA data was uploaded. The public game, achievement module, and shared API were checked after deployment, and the live achievement dialog showed that records were up to date.

The original bottle is restored as the default with its exact prior drawing and collision implementation. The bottle selector adds a separate reference-based flask with a round body, a taller central joint, and two angled side necks. Each bottle keeps its own browser-saved round; legacy saves restore into Original bottle. Stiffness is locked at 10%, viscosity at 0%, and the round summary places World Record to the right of Personal Best. Shared achievements and record-holder email messages are enabled; the live API returned `emailReady: true` after deployment. A direct delivery test to the real inbox succeeded; no fake record was created in production.

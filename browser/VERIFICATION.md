# Verification

Multiplayer rooms and start-page mode selector (2026-11-03):

- All **135 Node browser tests** and **11 Cloudflare room/achievement tests** pass (`npm test` in `browser/` and `cloudflare/`), plus the 4 Durable Object runtime tests in `cloudflare/runtime-tests/rooms.test.js`.
- Added `start-page.js` and `room-client.js` for Classic vs. Multiplayer mode selection, private 6-character room creation/joining, live opponent score and bottle preview (`#opponent-dialog`), and automatic WebSocket reconnection.
- Fixed overlay restoration when returning to a finished bottle in an active match, guarded against the 0.7-second spill reveal overwriting a completed match result overlay, played initial rack arrivals on fresh multiplayer rounds, and scheduled Durable Object alarms (`syncAlarm`) for the 30-second disconnect grace period while skipping redundant SQLite commits/broadcasts on unchanged progress ticks.

Bottle selector and reference flask correction (2026-11-03):

- All **135 Node tests pass**, including the separate flask’s **45-case** normal-entry matrix. Targeted flask checks also pass after the final neck sizing.
- Restored the original `bottle.js` exactly from the pre-flask implementation. Original bottle is the default, with its previous wide opening, chamber, floor and collision behavior.
- Added a separate reference flask with a round chamber, taller wider central joint, and two narrower angled side joints. Real angled-mouth crossings and solid separating glass are covered by targeted physics tests, including 45 normal-value launches.
- The Your bottle selector preserves an independent round for each bottle. Browser checks cover switching both ways, returning to the prior ready values and pile, remembering the selected bottle after reload, and phone layouts.
- Legacy saves without a bottle ID restore into Original bottle, retaining score, shots and peak tile. Fixed physics, achievements, world record and messaging remain available.

Current own-slot and preparation-animation update:

- All **121 Node tests pass** on the final launch-height fix. JavaScript syntax and whitespace checks pass.

- The selected blob launches from its current preparation-row slot, bounded to x 94–266 and y 58–68 according to force. Engine, keyboard, pull aiming, Shoot swipes and guide drawing share the position-dependent angle clamp. Middle is ±55°; at the outermost left slot the range is −14°/+55°, and the right side mirrors it. Near-rim limits interpolate as the slot moves inward.
- The 1,728-case reproducible sweep in `tests/simulate-slot-limits.mjs` passes for 2048/4096, both raised and lowered origin requests, all three launch positions, four forces, three stiffness levels, both viscosity extremes and three sizes. These are empty-bottle checks. An earlier raised-origin, fully stiff 2048 case failed; launches are now anchored no higher than the resting row.
- Own-slot/limit and preparation-animation tests pass. The preparation merge stretches sources together, emits one expanding color ring/spark burst, flashes and performs a 0.5-second damped jelly pop. Reduced motion omits the burst and overshoot. Interrupting a pop restores one opaque, full-size result.
- Chromium and WebKit phone checks confirm left/middle/right launch coordinates, asymmetric bounds at both ends, bottom selectors, and removal of the incoming preview. Chromium checks also pass slide-to-aim and force adjustment, selected-membrane guide origins, and preparation merge animation capture. Screenshots of the merge effect were reviewed. No browser errors.


Current always-ready control update:

- All **106 Node tests pass**. Four new regressions cover twelve immediate manual shots while preserving three ready values, grabbing another blob during a shift without losing the first body’s pose/velocity, reconciling logical IDs without stale merge faces, and touch-end suppression without blocking unrelated controls.
- Both Chromium and **WebKit 26.0** passed phone/touch checks: six rapid real Shoot taps, no animation frames between taps, all six shots accepted during the old refill/cooldown, viewport scale stays 1, and cancelable Shoot touch-end defaults are prevented.
- Both engines also passed input during a shift, continued motion of the earlier body, Shoot during return, Shoot taking priority over an active drag without firing on its stale release, and blocked shooting while paused. No browser errors. This uses mobile emulation rather than a physical iPhone.
- Existing Chromium real held-touch charging, button and bottle-aim cancellation, force levels, both-direction contact / return merging, pull-to-shoot, lift-to-insert, and save/reload checks pass. JavaScript syntax and whitespace checks pass.


Current mobile tap and summary update:

- All **106 Node tests pass**.
- Chromium phone/touch checks verify that double touch taps on page text and controls keep the viewport scale at 1, game double-click default is suppressed, and touch selection still works. The body, game and ordinary controls use `touch-action: manipulation`; canvas, blob drags and charge button retain `none`. Viewport zoom is not disabled globally. Physical iPhone Safari remains a device check.
- Score/best cards are absent from active gameplay. Pause, saved-resume and game-over summaries show correct values; finish updates the best; resuming/restarting hides the scores. Floating score labels were removed. Screenshots of clean play and the paused summary were reviewed.
- The full mouse/touch pull-to-shoot and lift-to-rearrange browser regression passes. Phone layouts at 320×568, 375×667, 390×844 and 430×932 pass without overflow. No browser errors.


Current glass-crossing and motion update:

- **106 Node tests pass**. Four new regressions reproduce collision velocity incorrectly changing glass side, blocked shoulder crossings versus valid mouth exits/re-entry, an old small blob whose center is below the floor, and repeated strong impacts at both bottom corners. The first three failed before the repair.
- Three motion tests cover a small projectile moving a large target, stronger but bounded glass rebound with a resting-contact dead zone, and 1080-unit full-force launches with controllable gentle shots. Existing preparation impact tests pass with their original displacement/deformation requirements.
- The 24,000-step stress test, material extremes, membrane area, floor merges, nested-body separation, save/restore, full-spill detection, and all gesture tests pass.
- Chromium phone checks passed a screenshot-like 256/32/2/4 pile with the 4 initially caught under the base. Over repeated sampled frames all particles remain at or above the 408-unit floor, sampled membrane penetration is zero, and score/shot count remain unchanged. Screenshots were reviewed.
- Partial-spill / visible-fall checks still pass. Full pull/rearrangement mouse and touch checks pass with launch speeds about 278 / 648 / 1080. No browser errors. JavaScript syntax and whitespace checks pass.


Current directional gesture update:

- **106 Node tests pass**. Seven new tests cover tap/direction classification, distance-based force and cancellation, stable drop anchors, insertion in all directions, intentional neighbor cascades, visible displacement before committing, and non-merging charge deformation. Existing overlap, floor, material, save, and stress checks pass.
- Chromium with phone/touch emulation passed downward pulls from all three positions (increasing measured launch speeds about 278 / 648 / 1080 units per second), release-only shooting from (180,58), cancellation, insertion in both directions, the middle-to-right push preview, lifted synthesis, real touch charge/rearrangement, persistence on reload, and phone layouts. Screenshots of charging and rearranging were reviewed. No browser errors.
- Existing fast-swipe / return-only contact checks, alternate Shoot-button and bottle-aim controls, and selected-membrane guide checks passed unchanged. Preparation boundary, cancellation, far-away return, return-around-base, and manual synthesis checks also passed with the revised interaction rules.


Current overlap and floor fix:

- **106 Node tests pass**, including five new regressions for floor merges at several sizes, growth beside a floor neighbor, nested membranes, previously saved base leakage with preserved progress, and a crowded mixed pile. The new checks require sampled membrane penetration below 0.15 world pixels after each simulated frame. Material extremes, area preservation, and the 24,000-step stress test pass (210 merges).
- New merge particles retain their interior glass side, including particles initially generated below the base. The solver repairs older in-bottle floor leakage. Residual polygon intersections receive a separation translation that preserves deformation and velocity; wall-blocked corrections transfer to the free neighbor.
- Chromium phone checks passed for a floor merge beside another blob, nested saved bodies, and saved leakage. Repeated sampled frames show zero penetration and no particles below the 408-unit floor in those scenes. Canvas instrumentation verifies all face drawing is clipped to the membrane, and screenshots were reviewed. Score and shot count are preserved except for legitimate merge scoring. No browser errors.
- Partial-spill / visible-fall and mouse/touch preparation-contact checks passed unchanged with the stronger collision solver. JavaScript syntax and whitespace checks pass.


Current bottle and preparation update:

- All **106 Node tests pass**, including 10,000 selectable shots checking three ready blobs, a middle value distinct from both sides, and value conservation. Saved duplicate rows, swap cascades, capped values, selection, and migration of older settled piles are covered.
- The glass uses a 360×420 playfield, a 296-unit-tall interior, and a 340-unit-wide body. Tests verify the inward neck waist and collision behavior against the same curved outline.
- Chromium phone checks passed for saved duplicate rows, repeated shots, reload, capped reordering, equal outer values, and 320×568 / 375×667 / 430×932 layouts. Screenshots confirm the shorter, wider bottle and inward mouth.
- Selected-blob guide checks and controlled-frame partial-spill / visible-fall checks passed against the new layout with no browser errors.


Latest guide adjustment: the arrow begins at the selected membrane’s current edge. A focused Chromium check passed for left/middle/right selection, a returning blob outside the canvas, the charge button, and bottle aiming, with no browser errors. Canvas draw calls and screenshots verified the actual origins. JavaScript syntax and whitespace checks passed.

Completed for contact merging, separation, and whole-blob spill handling:

- **106 Node tests passed**. Existing material, teardrop, preparation, 4096, defaults, save/restore, and stress tests remain included.
- Drag contact regressions cover fast swipes in both directions, contacts found only during return, brief contacts retained across substeps, duplicate suppression, ignored mismatches/stale IDs, capped values, retirement after returning home, and merge descendants. Idle equal side blobs stay separate. Preparation merges preserve score and shot count.
- Collision tests measure membrane penetration at soft, default, and rigid settings for board blobs settling on the floor and a held blob pushing different neighbors. Maximum sampled penetration is under 1.25 world pixels; defaults are substantially below that. This is the numerical tolerance of a discrete membrane solver. Merge animation draws a single result face after contact rather than overlapping both source faces with it.
- Spill tests cover half-out bodies, a tiny remaining interior sliver, thin polygons spanning the neck, re-entry, normal wall collisions, exterior sliding, missed shots, and saved losses. A capacity warning cannot end play while part of a blob remains inside. Full exit uses membrane/interior intersection rather than center position.
- After full clearance, escaped bodies continue falling in a 0.7-second reveal while logical score and shot count remain frozen. Exterior glass collisions continue during this fall. The result then appears and can restart normally. Malformed saved side flags are rejected.
- Browser checks completed without JavaScript errors:
  - Both-direction mouse swipes and real touch edge brushes merge before release; return-only paths merge after release; stale remaining pointer movement cannot shoot; small custom blobs and saved preparation state work.
  - Preparation regression: selection, outside dragging, return around the base, glass blocking, cancellation, idle matching sides, and intentional merges.
  - Controlled-frame spill checks: a partly outside blob remains playable beyond the old timer; full exit is detected; the fall stays visible before results; score/shot count remain unchanged.
  - Spill/default checks: new defaults, reset, valid entry, loss/reload/restart, personal best, default migration, and custom settings.
  - General phone gameplay and layouts; real touch shooting and cancellation.
- Screenshots reviewed for a half-out playable blob, the visible falling blob, return-contact merges, and the preparation row. Phone layouts cover 320×568, 375×667, 390×844, and 430×932; desktop 1440×1000.
- JavaScript syntax and whitespace checks passed.

Physics is a stylized particle-membrane approximation with finite numerical tolerances. Browser tests use Chromium with phone/touch emulation; physical iPhone Safari, audio output, and sustained device performance remain unverified on a device. The separate native Swift project has not been built with the iOS SDK.

## Fixed player blob size

Removed the blob-size slider and its input handlers. The playable app fixes size at 150%, including restored saves, while retaining score, best, inventory, stiffness, and viscosity preferences. Internal simulation size support remains for physics regression checks.

Validation: 5 settings tests passed, including legacy-save resizing without loss of progress; Chromium and WebKit mobile checks passed for the two remaining sliders, saved-game migration, reload/restart, and narrow-phone layout. JavaScript syntax and diff whitespace checks passed.


## Reference flask and missed-neck shots — 2026-11-03

The three-neck flask now follows the supplied reference more closely: a rounder chamber, taller frosted central joint, angled side joints, translucent glass reflections, and a 500 mL writing area. Collision geometry follows the revised outline; its geometry version advances so saved piles fit the updated vessel.

Shots into either gap now end the round even when their soft edges overlap a neck. Missed blobs tumble outside during the existing 0.7-second reveal instead of balancing between the joints. Older stranded saves also resolve to a spill. Score and shot count stay fixed during the fall.

Validation: all **138 Node tests pass**, including the 45-case valid-entry matrix, 30 new gap-miss cases across both gaps and all incoming values/forces, angled misses from both side slots, continued falling after save/restore, and older stranded saves. Chromium and WebKit checks in `tests/browser_flask_gap_checks.py` passed for both gaps through the real keyboard controls, visible fall before results, preserved score/shot count, game-over messaging, restart, and 320×568 / 390×844 / 430×932 phone layouts. No JavaScript browser errors. Updated flask and falling-shot screenshots were visually reviewed. JavaScript syntax and diff whitespace checks passed.

Run the new browser check against the local server with `python tests/browser_flask_gap_checks.py`; set `SQUISH_TEST_URL` to use a different local port.


## Swipeable achievements by bottle — 2026-11-03

Achievements has horizontally swipeable All bottles, Original bottle, and Three-neck flask panels showing independent world scores, record holders, biggest merges, and personal bests. Bottle tabs, previous/next buttons, keyboard arrows/Home/End, reduced-motion preferences, and current-bottle selection are supported. Older overall achievements remain available, while actual saved-round scores migrate into the appropriate bottle record. Server writes validate bottle IDs and maxima, preserve personal bests, and retain the first holder on ties.

Validation: **141 browser Node tests and 13 server Node tests pass**. New regressions cover score isolation, old-save recovery, pending updates during sync, remote personal-record merging, independent winners, ties, out-of-order updates, legacy clients, invalid payloads, and forged identities. Both D1 migrations applied successfully to an isolated local Wrangler database. Chromium and WebKit checks passed against the actual local Worker API for world/personal score separation, tabs, arrows, keyboard navigation, responsive phone layouts, refresh, and reload. Chromium also passed a native touch-swipe check. Screenshots were visually reviewed and no browser JavaScript errors occurred. JavaScript syntax and diff whitespace checks passed.


Published on 2026-11-03 to `https://squish.chemisgreat.online/` (Worker version `28312784-a684-4d54-857e-f1759f58bd27`). Compatibility migrations preserve the earlier live per-bottle score layout and its record holders. All 15 server tests pass, including the legacy-layout import and legacy-client submission regressions. Chromium and WebKit smoke checks on the public game verified both bottle records, the Achievements slider, the updated flask assets, and playable phone layout with no JavaScript errors. These checks read shared production data without submitting QA scores. Existing Original/Three-neck records remain 16,364 / 9,036; the 21 identities and 4 achievers are preserved.


## Larger flask and whole-membrane neck containment — 2026-11-03

The three-neck flask’s playable polygon area increases from 59,600.85 to 72,693.25 world units (about 22%). Its widest chamber grows from about 253 to 319 units within the existing 360×420 field. The floor, three mouth positions, launch slots, and player blob size stay the same. The capacity marking is 750 mL and the flask geometry version is 3.

The reported crowded-neck penetration was reproduced: interior particles could still be joined by a membrane edge crossing a concave glass saddle. The solver now detects edges crossing the closed neck/shoulder boundaries and glass tips covered by an interior membrane, then resolves the interior portion into the connected chamber while preserving particle momentum. Fully entered membranes also use vessel clipping during rendering so curve smoothing cannot draw through a glass corner. Saved rounds adopt the larger geometry and repair earlier penetration while retaining scores and shot counts.

Validation: all **145 browser Node tests pass**, including four new capacity, crowded-neck, old-save, oversized-shot, and neck-merge regressions. The valid-entry matrix and gap-miss checks remain included. Chromium and WebKit passed the new controlled-frame crowded-neck checks with zero invalid particle/edge samples, vessel clipping at every board draw, preserved score (9,036) and shots (77), reload, and 320×568 / 390×844 / 430×932 phone layouts. Updated crowded flask screenshots were visually reviewed. JavaScript syntax and diff whitespace checks passed.


This update is live at `https://squish.chemisgreat.online/`, Worker version `bc527062-30a4-4e49-84de-07b8c701f84a`. Public Chromium and WebKit checks verified geometry version 3, the enlarged playable area, updated flask assets, functioning bottle-record navigation, and no JavaScript errors. Shared production records were read without submitting QA identities or scores.


## Bottle-specific pause and game-over records — 2026-11-03

Pause, saved-resume, and game-over summaries now show the selected bottle’s personal best and world high score. The bottle name appears above the three score fields. Summary rendering uses the current round score, that bottle’s saved personal best, and its authenticated shared personal record; the overall all-bottle best is kept for overall achievements. Missing shared data displays a dash, and a new bottle record updates immediately. Async refreshes and bottle switches use the current engine’s bottle ID.

Validation: all 9 achievement Node tests pass, including new per-bottle summary and missing/offline-record cases. Chromium and WebKit checks passed for both bottles, saved resume, pause/resume, game over with a new personal best below the overall best, bottle switching, new-round persistence, world-record placement, and 320×568 / 390×844 / 430×932 layouts. Summary screenshots were visually reviewed. JavaScript syntax and diff whitespace checks passed.


## Bottle champions, congratulations, and creator messages — 2026-11-03

A current world-record holder in either bottle can now message the creator independently of the overall record. The composer identifies the eligible record, and server-side ownership checks are part of the atomic daily message claim. Emails include the selected bottle, verified record score, and that bottle’s highest tile. Limits apply once per player, bottle, and UTC day; provider failures release the selected claim for retry. Overall-record messaging remains supported.

Server-confirmed new bottle ownership opens a congratulations page with a crown, bottle preview, score, and Email the creator action. Previously celebrated records are remembered locally, ongoing improvements to an already-held record do not repeatedly interrupt play, and the page can be reopened from that bottle’s achievement card. Celebrations wait while another dialog is open; losing ownership removes message/replay permission.

Validation: all **11 achievement Node tests and 17 server Node tests pass**. Chromium and WebKit passed end-to-end checks against local D1 and simulated email: both champion pages, eligibility below the overall record, correct message scope, successful local sends, daily limits with retained drafts, reload suppression, replay, lost-owner lockout, and phone layouts. Both champion screenshots were visually reviewed. The configured creator inbox is verified and Email Routing reports ready. No QA emails were sent through production.


This feature is published at `https://squish.chemisgreat.online/`, final Worker version `24c67338-a885-4126-b72e-d3eef5063d5d`. The public API and deployed HTML/script were verified. A live Chromium smoke check exercised the congratulations page and selected bottle composer using browser-only mock ownership, without production writes or email sends. External font requests were disabled for the smoke check after network stalls; local Chromium and WebKit full-flow checks passed with the actual local API and email simulator. A public WebKit navigation check timed out before the app loaded.


After the final offline-wording adjustment, public HTML and the achievement script were fetched and confirmed byte-for-byte identical to the tested local files. Live browser navigation was intermittent during the final recheck; local Chromium/WebKit full-flow checks and the earlier live Chromium UI check had passed. Production deployment completed successfully and no production QA emails or scores were created.


## Two water-filled bottle choices — 2026-11-03

The menu now offers four choices: the existing dry Original/Three-neck vessels plus `classic-water` and `lab-flask-water`. Water versions share their base geometry and capacity, adding a translucent animated surface, submerged tint, bubbles, ripples, and droplets. Submerged interior particles receive buoyancy and drag. Full-power entries dive farther and create droplets; low-force entries settle floating with smaller ripples. Droplets do not affect game-over detection. Fluid visual state is transient, and restored submerged blobs do not spawn phantom splashes. Wet saves, scoreboards, champion pages, and email limits have distinct bottle identities; Multiplayer supports all four.

Validation: **153 browser Node tests and 20 server Node tests pass**. New checks cover floating equilibrium, stronger-shot depth, gentle versus strong droplets, underwater merging, saved wet rounds, gap misses, independent wet records/email permissions, migration preservation of dry scores/tied holders/message history, and water room selection. The 17-command D1 migration applied successfully to the isolated local database. Chromium and WebKit passed real-control checks for all four choices, both floating scenes, strong-shot droplet rendering, gentle shots without droplets, wet pause records, reload, five achievement slides, and phone layouts. Both browsers produced the same measured entry depths for the seeded fixtures. Choice, floating, and splash screenshots were visually reviewed.


Published water-mode release: `369b2ea9-ed92-471f-bbe3-9b0452f146af` at `https://squish.chemisgreat.online/`. The production migration retained the existing dry score rows and record holders; foreign-key checks passed. No QA scores or emails were written to production.


A live Chromium smoke check passed for the four-choice menu, Three-neck flask · water pause summary, and the published physics module. The seeded full-power simulation produced 18 peak droplets, dived to y≈396.68, and settled floating at y≈252.65 around the y=244 surface without game over. The check used public read-only records and browser-local simulation; no production test score was submitted.


## Crowded flask jumping, swipeable achievements, and dry world-board reset — 2026-11-04

The deployed whole-membrane neck repair was reproduced with the above-fill-line regression: a settled level-6 blob moved 2.424 units in one 1/120-second step. Its glass repair translated the entire interior membrane into the bodies beneath it. The repaired solver resolves crossing edges/neck tips locally and retains glass containment without translating the lower body. The original bottle keeps its existing solver.

The five swipeable Achievements panels are retained with refreshed asset versions. The dry Three-neck world record starts fresh via migration 0006. A separate epoch-1 board accepts new repaired-game rounds, while prior saved piles, lifetime personal/overall achievements, all other bottle records, and message history remain intact. Old clients and pre-fix saves cannot immediately repopulate the cleared world record.

Validation: all 156 game Node tests and 21 server Node tests pass; the additional in-flight fresh-board sync regression also passes. The exact crowded test fails against the downloaded production solver and passes against the repaired one. Chromium and WebKit pass old-save containment/clipping/reload checks, per-bottle achievement records and carousel navigation, phone layouts, floating, strong/gentle splashes, and five achievement panels with no browser JavaScript errors. Chromium additionally passes a native touch swipe. The database migration was applied successfully to a fresh isolated local D1 database. JavaScript syntax checks, diff whitespace checks, and Wrangler deployment dry run pass.

Both Chromium and WebKit also pass the fresh dry-flask champion flow against local D1/email simulation: eligibility below the overall record, correct tile/score/message scope, daily limits with retained drafts, reload suppression, replay, and lost-owner lockout. No production test scores or messages were submitted.

Published on 2026-11-04 as Worker version `984c1609-a89f-4d37-910a-8c8bc5f600fd` at `https://squish.chemisgreat.online/`, with migration 0006 applied. Production verification confirmed the dry world record was cleared, while other world-record rows, all personal score totals, all 26 identities, the overall record, and message totals stayed unchanged; foreign-key checks passed. Live Chromium/WebKit checks verified all five Achievements panels, fresh-board state, versioned assets, old/new round eligibility, and crowded above-line stability with no JavaScript errors. Maximum settled per-step vertical movement was about 0.244 / 0.253 units versus the reproduced 2.424-unit jump. Live QA intercepted score submissions and sent no production messages.


## Partially entered neck shapes, crowded runtime, and all dry personal scores — 2026-11-04

The supplied IMG_8275 scene was reconstructed with eleven blobs, including the partly entered 32 at the right neck. The prior solver allowed mixed inside/outside membrane edges to cut the closed glass and repeatedly ray-tested the full static outline. The repaired solver retains entered centers on the interior side below each real opening and resolves mixed membrane edges locally while permitting lobes above open mouths. Exact scanline and spatial indexes narrow point, chord, particle-path, and nearest-wall queries. A 6,000-point reference test verifies containment and boundary tolerances against the full outline.

All 160 game tests and 22 server tests pass. Chromium and WebKit pass the screenshot fixture, old-round resume, personal-score reset/reload, carousel/keyboard/phone layouts, and water modes. The same 180-frame rendered batch improved from 9,649.6 ms to 959.4 ms in Chromium and 10,250 ms to 990 ms in WebKit on this desktop test host (about 10x; not a measured iPhone frame rate). The current scene had zero sampled glass penetration in both browsers. Screenshots were visually reviewed. JavaScript syntax/diff checks and Worker deployment dry run pass.

Migration 0007 resets every dry-flask personal best score, retains merge milestones and other bottle/overall history, and isolates epoch-2 scores from requests finishing on the previous Worker version. Client/server regressions cover old profiles, old saved rounds, old epoch submissions, in-flight previous-table writes, fresh lower bests, offline retries, and reloads.

Published on 2026-11-04 as Worker version `14512392-e5ea-4a57-ab1f-1c79202f6f7b` with migration 0007. Production checks confirmed all 8 existing dry-flask personal score rows are zero, with their merge milestones, all other bottle score totals/records, all identities, overall history, and messages unchanged. No stale dry scores or foreign-key violations remained. Live Chromium and WebKit checks confirmed byte-identical solver assets, epoch-2 eligibility, browser personal-score migration, retained Original/water bests, five achievement panels, native Chromium swipe, above-line stability, and no JavaScript errors. Production QA score submissions were intercepted and no production messages were sent.

## Optional names and laboratory vessels — 2026-11-04

- Anonymous champions see an optional name form and can dismiss the page without naming themselves.
- Anonymous board editors are empty with a placeholder. Existing names select in full for immediate replacement, including mobile WebKit; saved names survive reload.
- Separating funnel (closed tap) and Conical flask are available in Classic and multiplayer, each with independent saves, personal/world records, champion pages and message scopes. Achievements now has seven swipeable panels.
- The new schema migration copies existing score, holder and message rows, retains dry-flask epoch 2 and its triggers, and does not reset records.
- Local mobile Chromium/WebKit checks: `browser_names_vessels_checks.py`; all API writes are mocked. Screenshots are in `/tmp/squish-pocket-qa`.
- Published test version `9b519998-091e-4dec-ab36-5807b641243d`: 168 game + 27 backend/release + 4 Worker runtime checks passed. All 29 assets and the six-bottle API verified. Live Chromium and WebKit passed optional-name dismissal/save/reload, immediate name replacement, seven board tabs, both new vessels and 320–430px layouts; no browser errors or remote QA writes.

## Larger funnel and laboratory water variants — 2026-11-04

- The funnel interior is 294 units tall (previously 262) and has 48,618 square units of playable area (previously 36,192), a 34% increase. The capacity label is now 500 mL. Geometry version 2 fits saved entered blobs while retaining scores and shots.
- Separating funnel · water and Conical flask · water use the same outlines as their dry counterparts, with buoyancy, splashes and ripples. Each has independent saved rounds and boards in Classic and multiplayer.
- Targeted physics checks cover floating/settling, strong dives and splashes, wet merges, wet save restoration, dry containment and legacy funnel restoration. Migration 0009 preserves all existing scores, first holders, message history and dry-flask epoch rules.
- Mobile Chromium and WebKit verified eight vessel cards, nine Achievements panels, both wet variants, optional naming and 320–430px layouts without browser errors; shared record writes were mocked.
- Published and verified test version `7f37ee77-6022-4f88-a74a-a595fdfec8c0`: 201 automated checks passed, all 29 assets and the eight-bottle API matched local source. Live Chromium/WebKit passed the full mobile check with no browser errors or remote QA record writes.

## Original-style wide funnel opening — 2026-11-04

- Dry and water separating funnels now share a 280-unit opening (Original: 256) with a rolled elliptical rim and an inward-curving waist. The body remains the taller 500 mL funnel with its closed tap.
- Geometry version 3 fits legacy entered blobs during restoration, retaining scores and shots. Targeted checks cover the newly opened outer edges, gentle/full-force shots from both outside ready slots, containment, floating and saved-round restoration.
- Mobile Chromium and WebKit verified both funnel variants, all eight cards and nine boards with no browser errors. Record writes were mocked.
- Published test version `61bec270-9b14-42d9-92f3-5ca8b314ea37`: 203 automated checks passed, all 29 deployed assets matched source, and live Chromium/WebKit confirmed the 280-unit opening and geometry version 3 in both dry and water modes without browser errors or QA record writes.

## Frosted funnel and top-five boards — 2026-11-04

- Reduced the funnel mouth from 280 to 186⅔ units (one third smaller), retaining its flared style. Both dry and water versions have a textured frosted band immediately below the rim. Geometry version 4 preserves entered blobs and saved round statistics.
- All bottles and each of the eight vessel boards show ranks 1–5 with names and scores. Fewer than five positive records leave explicitly open positions; empty boards never fabricate players. Names render as literal text and long names wrap on phone layouts.
- API rankings use one best score per player, keep the existing tied champion in first place, and return no identities or tokens. Dry Three-neck rankings use only `flask_current_scores`; wet and overall history remain available. The queries return at most five rows per board and share the existing D1 read batch; no schema migration is needed.
- Targeted Node checks cover order, ties, score increases, monotonic scores, rename, privacy, empty boards and old dry-flask exclusion, alongside funnel containment, water and restoration checks.
- Published test version `cfc19185-c972-4d65-aef8-bfc2b20bdd62`: 205 automated checks passed, all 29 assets matched source, and live Chromium/WebKit compared every displayed row on all nine boards with the real public API. Both reduced frosted funnel variants rendered without browser errors. Remote QA record writes were mocked.

## Slightly longer funnel neck — 2026-11-04

- Added a 16-unit straight throat below the frosted section on dry and water separating funnels. The shoulder transition moves down slightly, giving the neck more visible length.
- Geometry version 5 fits saved entered blobs. Targeted containment, outer-slot entry, floating, splashes, merges and save-restoration checks passed for the revised outline.
- Published test version `e2b02cb1-3787-48e3-820d-a69849b0fdf5`: 205 automated checks and live Chromium/WebKit checks passed for both funnel versions and the nine achievement boards. All 29 assets matched source; no browser errors or remote QA record writes.

## Larger decorative funnel outlet — 2026-11-04

- Increased the decorative outlet from 10 to 14 units wide and from 18 to 25 units long, with a slightly larger tap and handle. The shadow moves down beneath the pipe, within the 420-unit canvas.
- Both funnel variants share this rendering. Mobile Chromium/WebKit checks and visual inspection passed; geometry version remains 5 because this change affects decoration only.
- Published test version `d30afa02-c061-49cb-8988-5a517239864d`: 205 automated checks and live Chromium/WebKit checks passed. Both outlet variants fit the game view, all 29 assets matched source, and no browser errors or remote QA record writes occurred.

## Approved official release — 2026-11-04

- Promoted exact test `d30afa02-c061-49cb-8988-5a517239864d` to official Worker `fee21e1b-99d7-4127-9888-893134a081d8`. All 29 assets matched the verified source; the test candidate had passed 205 automated checks.
- The pre-release official SQL export was valid, and both pending migrations (0008/0009) preserved every row in a local rehearsal. Live pre/post snapshots then confirmed exact preservation of all 28 player rows, 58 bottle-score rows, 7 fresh dry-flask rows, overall and bottle record holders, and message history. No foreign-key violations occurred.
- Live Chromium and WebKit passed all nine leaderboard comparisons against official public API data and the current funnel views without browser errors. QA writes were intercepted; no test identities, scores or messages were submitted to official.

## Three Combine candidate — 2026-11-04

- Added a separate home-page merge rule for Classic and multiplayer. Three equal touching/connected blobs merge into the next power of 3, starting at 1 and capped at 177,147. Pairs stay separate; ready-row merging also requires three. The achievement milestone is 2,187.
- Added independent browser save/profile keys and per-request API mode scoping. Migration 0010 creates separate Three Combine tables only. Regression checks prove old identities, scores and champions remain unchanged, and mode-specific score validation and leaderboard/message permissions work.
- Core checks cover 1+1+1→3, 3+3+3→9, 9+9+9→27, disconnected groups, a fourth blob remaining, delayed fusion/save/reload, ordinary dry/water play, ready refill and old-save compatibility.
- Mobile Chromium/WebKit passed the mode picker, actual triple merge, save/reload, original score retention, milestone/labels, 320–430px layouts and automatic rule switching when joining a room. Runtime sockets passed Three Combine scoring, winner selection and hibernation persistence.
- Published test version `50680601-b368-4a6e-8a64-07565866a476`: all 216 automated checks passed, including five real Worker runtime socket tests. All 30 assets matched source and live read-only API checks confirmed separate Two/Three boards and 2,048/2,187 milestones. Live Chromium/WebKit passed switching, actual 1+1+1 merge, save/reload, original scores, mobile layouts and cross-mode room joining with all record/room/WebSocket writes mocked. Official version 52 was confirmed unchanged.

## Double-width conical opening — 2026-11-04

- Conical flask and Conical flask · water now have a 164-unit mouth (previously 82), with a widened neck and a smooth transition into the cone.
- Geometry version 2 fits older conical saves while retaining score, shots and merge mode. Targeted checks cover both outer launcher slots at gentle/full force in both merge modes and wet/dry variants, as well as existing centered shots, containment and water behavior.
- Mobile Chromium and WebKit verified all four mode/variant combinations, exact mouth width and 320–430px layouts without browser errors. Remote record writes were mocked.
- Published test version `6d37dd5d-7207-4c5c-afbf-66c4a1f5903c`: all 217 automated checks passed (179 game, 33 backend/release and 5 Worker runtime). All 30 deployed assets and both achievement APIs matched source. Live Chromium and WebKit confirmed the doubled opening for dry/water conical flasks in both merge modes, with no browser errors or remote record writes.

## Achievement merge-mode selector — 2026-11-04

- Achievements can browse Two Combine and Three Combine in place, retaining the selected bottle and the running game. Each mode uses its own identity, local progress, API requests, personal scores, Top 5 boards and 2,048/2,187 milestone.
- Champion pages, optional naming, refresh and record messages follow the displayed board's mode. The game HUD and automatic celebrations continue to use the running game's mode. Requests reject responses from another mode.
- A WebKit timing check exposed bottle selection moving during an unfinished programmatic slide. Navigation now retains the requested destination through the animation; pointer/wheel gestures take over normally.
- Local Chromium and WebKit passed all nine Three Combine Top 5 boards, both sets of names/scores, optional champion naming, intercepted messages, phone widths and preservation of the current game and URL. All shared QA writes were mocked.
- Published and verified test version `56cf2967-cd2f-4bd7-b0a6-258fd78d28c0` (assets v56): all 218 automated checks passed (180 game, 33 backend/release and 5 Worker runtime). All 30 deployed assets and both achievement APIs matched source. Live Chromium/WebKit passed the complete mode flow, native Chromium touch swipe, WebKit keyboard slide and last-tab navigation without browser errors or real record/message writes. No new migration was required.

## Smooth gameplay mode switching — 2026-11-04

- Home-page Two/Three Combine selection and cross-rule room joining now update in place using history replacement. Game rule, selected vessel, saved pile, HUD, ready values, evolution, guide and menu copy switch together. Two-mode instructions restore when switching back.
- Achievements reuses each mode's existing tracker and identity as the gameplay rule changes. In-flight responses stay with their original tracker, while automatic milestones and champion notifications follow only the active game. Names, scores and message permissions remain separate.
- Local Chromium/WebKit passed seven consecutive switches with no document requests, unchanged `performance.timeOrigin` and a surviving page object. Both saved piles retained their mode, vessel, score and shot count; identities and personal scores stayed separate. Cross-rule room joining retained the page and authenticated connection. The complete achievement suite also passed in both browsers with all shared writes mocked.
- Published test version `d0dd2d02-8f68-4989-bc7e-0b2d9e56f7f4` (assets v57): all 218 automated checks passed; all 30 assets and both achievement APIs matched source. Live Chromium/WebKit repeated seven switches and cross-rule room joining without document reloads or browser errors, while preserving identities, selected vessels, saved scores and shot counts. Actual triple merge/save/reload and the full achievement/champion/message regression suites passed locally in both browsers. Shared QA writes were mocked; no new migration was required.

## Three Combine official release — 2026-11-04

- Approved exact test `d0dd2d02-8f68-4989-bc7e-0b2d9e56f7f4` promoted to official `82dfcb73-d45d-41c3-8535-57f6ccb18f0f`. All 30 assets and both mode APIs matched source; the candidate passed 218 automated checks.
- Private pre/post database exports confirmed exact preservation of every existing table row, including all 28 players, 66 bottle scores, 7 current dry-flask scores, record ownership and message history. Migration 0010 added only seven empty Three Combine tables, with no foreign-key violations or copied test records.
- Live Chromium/WebKit passed seven switches without document reloads, independent saves/names/scores, cross-rule rooms, champion/message flows, phone layouts, conical mouth widths and all 18 Top 5 boards compared with real public API snapshots. Every QA write and room socket was intercepted or blocked.

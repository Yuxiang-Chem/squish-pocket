# Verification

Three-neck saved round removed:

- The original bottle still saves its Classic round, personal best, and shared world record under `squish-pocket-v1`.
- The three-neck flask no longer keeps `squish-pocket-v1:lab-flask`. An existing flask save is deleted and is not offered as Continue. Shared achievements stay common to both bottles.
- `node --test tests/*.test.js` passed all 137 browser tests, including the new round-record checks and the flask physics matrix. A headless Chrome pass confirmed an old flask save is deleted, Continue is offered only for the original bottle, and playing the flask leaves that original record unchanged.

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

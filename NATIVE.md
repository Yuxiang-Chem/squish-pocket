# Squish Pocket for iPhone

A native, offline iPhone physics merge game prototype inspired by Sobosuba. It has original code, artwork, and branding. It is not an official port and does not include Sobosuba source code or assets.

## Run on an iPhone

1. Install full **Xcode** from the Mac App Store. The standalone Command Line Tools cannot build iOS apps.
2. Open `SquishPocket.xcodeproj` in Xcode.
3. Select the **SquishPocket** target, then **Signing & Capabilities**. Select your Apple development team and change `com.example.SquishPocket` to a unique bundle identifier.
4. Select an iPhone simulator, or connect your iPhone and choose it as the run destination. A physical phone requires signing and may require Developer Mode.
5. Press **Run** (Command-R).

Requires iOS 17 or later. The app supports iPhone portrait orientation and has no network or third-party package dependencies. A personal Apple team can run development builds on your own device. TestFlight and App Store distribution need the appropriate Apple Developer membership and signing setup.

## Play

Tap **Let's squish**. Touch inside the jar and slide horizontally to aim. Pull down during the same gesture for a harder shot, then release. Equal numbers merge and add the new value to your score. Keep the pile below the dotted line: a blob that remains above it for 2.8 seconds after its initial falling grace ends the round. The largest blob is 1024 and remains on the board.

Pause/resume, restart confirmation, a guide, next-blob preview, haptic toggle, personal best, automatic game saving, background pausing, and VoiceOver aim/drop actions are included. Returning to a saved game opens it paused.

## Implementation and scope

- SwiftUI interface and Canvas rendering; no web view.
- Fixed 120 Hz simulation; 60 Hz rendering timer; bounded frame catch-up and particle counts.
- Mass-weighted circle collisions with a 24-point spring-deformed perimeter, contact indentation, wobble, and merge particles. This prototype uses approximate collisions; it does not reproduce the original game's full soft-body squeezing behavior.
- Atomic local game saves in Application Support. Best score and preferences use app-local UserDefaults. No analytics, accounts, ads, or network calls.
- A self-contained Xcode project, iOS app icon, launch configuration, and privacy manifest are included.

## Verification

Run the platform-independent simulation checks on this Mac:

```sh
mkdir -p build
swiftc -O SquishPocket/Physics.swift Tests/PhysicsChecks.swift -o build/physics-checks
./build/physics-checks
```

The checks exercise launch cooldown, input bounds, merging/scoring, collision contacts, spring deformation, overflow, save restoration, seeded randomness, invalid input handling, and a 24,000-step stress simulation.

Full Xcode and the iOS SDK were unavailable during development. An iOS build, simulator visual review, physical-device performance, haptics, and signing remain to be verified in Xcode. No signed IPA or TestFlight build is included. See `VERIFICATION.md` for checks actually completed.

Reference: https://sobosuba.com/ — the original developer's game and official mobile-release information.

import Foundation
import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

struct Spark: Identifiable {
    var id = UUID()
    var position: V2
    var velocity: V2
    var life = 0.65
    var level: Int
}

@MainActor
final class GameModel: ObservableObject {
    @Published var engine = GameEngine()
    @Published var started = false
    @Published var paused = false
    @Published var best = UserDefaults.standard.integer(forKey: "squish.best")
    @Published var haptics = UserDefaults.standard.object(forKey: "squish.haptics") as? Bool ?? true
    @Published var sparks: [Spark] = []
    @Published var aimX = GameEngine.width / 2
    @Published var aiming = false
    @Published var power = 0.0
    @Published var showHelp = false
    private var timer: Timer?
    private var lastTick = Date.timeIntervalSinceReferenceDate
    private var accumulator = 0.0
    private var saveCounter = 0.0
    private let saveURL: URL?

    init() {
        let folder = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first?
            .appendingPathComponent("SquishPocket", isDirectory: true)
        if let folder { try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true) }
        saveURL = folder?.appendingPathComponent("game-v1.json")
        if let url = saveURL, let data = try? Data(contentsOf: url),
           let saved = try? JSONDecoder().decode(GameEngine.self, from: data), saved.isValid {
            engine = saved
            started = saved.shots > 0
            paused = started && !saved.isGameOver
        }
    }

    func activate() {
        guard timer == nil else { return }
        lastTick = Date.timeIntervalSinceReferenceDate
        timer = Timer.scheduledTimer(withTimeInterval: 1.0/60, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated { self?.tick() }
        }
        if let timer { RunLoop.main.add(timer, forMode: .common) }
    }

    func deactivate() {
        timer?.invalidate(); timer = nil
        aiming = false
        if started && !engine.isGameOver { paused = true }
        save()
    }

    func newGame() {
        engine = GameEngine(randomState: UInt64.random(in: 1...UInt64.max))
        started = true; paused = false; sparks = []
        aimX = GameEngine.width/2; aiming = false; power = 0
        save()
    }

    func shoot() {
        guard started, !paused, !showHelp else { aiming = false; return }
        if engine.shoot(x: aimX, power: power) {
            feedback(merge: false)
            save()
        }
        aiming = false; power = 0
    }

    func feedback(merge: Bool) {
        guard haptics else { return }
        #if canImport(UIKit)
        UIImpactFeedbackGenerator(style: merge ? .soft : .light).impactOccurred(intensity: merge ? 0.8 : 0.4)
        #endif
    }

    func toggleHaptics() {
        haptics.toggle()
        UserDefaults.standard.set(haptics, forKey: "squish.haptics")
        feedback(merge: false)
    }

    private func tick() {
        let now = Date.timeIntervalSinceReferenceDate
        let elapsed = min(0.05, max(0, now-lastTick))
        lastTick = now
        guard started, !paused, !showHelp, !engine.isGameOver else { accumulator = 0; return }
        accumulator += elapsed
        var events: [MergeEvent] = []
        while accumulator >= 1.0/120 {
            events += engine.step(1.0/120)
            accumulator -= 1.0/120
        }
        for event in events {
            for k in 0..<10 {
                let angle = Double(k) * .pi/5
                sparks.append(Spark(position: event.position,
                                    velocity: V2(x: cos(angle)*95, y: sin(angle)*95-40), level: event.level))
            }
        }
        if !events.isEmpty { feedback(merge: true) }
        for i in sparks.indices {
            sparks[i].life -= elapsed
            sparks[i].position = sparks[i].position + sparks[i].velocity * elapsed
            sparks[i].velocity.y += 150 * elapsed
        }
        sparks.removeAll { $0.life <= 0 }
        if sparks.count > 160 { sparks.removeFirst(sparks.count-160) }
        if engine.score > best {
            best = engine.score
            UserDefaults.standard.set(best, forKey: "squish.best")
        }
        saveCounter += elapsed
        if saveCounter > 2 || engine.isGameOver { save(); saveCounter = 0 }
    }

    func save() {
        guard engine.isValid, let url = saveURL, let data = try? JSONEncoder().encode(engine) else { return }
        try? data.write(to: url, options: .atomic)
    }
}

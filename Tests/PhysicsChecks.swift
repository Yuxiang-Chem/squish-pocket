import Foundation

@main
struct PhysicsChecks {
    static var checks = 0
    static func check(_ condition: @autoclosure () -> Bool, _ label: String) {
        precondition(condition(), "FAILED: \(label)")
        checks += 1
        print("PASS: \(label)")
    }

    static func main() throws {
        let dt = 1.0/120
        var game = GameEngine()
        check(game.shoot(x: 180, power: 0.4), "First touch launches")
        check(!game.shoot(x: 180, power: 1), "Cooldown prevents accidental double launch")
        check(game.shots == 1 && game.blobs.count == 1, "One launch creates one blob")
        for _ in 0..<65 { _ = game.step(dt) }
        check(game.shoot(x: -100, power: 2), "Shot input is clamped safely")
        check(game.blobs.last!.position.x >= game.blobs.last!.radius, "Launch stays inside walls")

        game = GameEngine(blobs: [Blob(level: 0, position: V2(x: 100, y: 400)), Blob(level: 0, position: V2(x: 119, y: 400))])
        let events = game.step(dt)
        check(events.count == 1 && game.blobs.count == 1, "Matching touching blobs merge once")
        check(game.blobs[0].level == 1 && game.score == 4, "Merge doubles value and awards score")

        game = GameEngine(blobs: [Blob(level: 0, position: V2(x: 100, y: 400)), Blob(level: 1, position: V2(x: 120, y: 400))])
        check(game.step(dt).isEmpty && game.blobs.count == 2, "Different values collide without merging")
        game = GameEngine(blobs: (0..<3).map { Blob(level: 0, position: V2(x: 120+Double($0)*15, y: 400)) })
        check(game.step(dt).count == 1 && game.blobs.count == 2, "A blob participates in at most one merge per step")

        game = GameEngine(blobs: [Blob(level: 9, position: V2(x: 120, y: 400)), Blob(level: 9, position: V2(x: 200, y: 400))])
        check(game.step(dt).isEmpty, "Maximum level is capped without overflow")
        game = GameEngine(blobs: [Blob(level: 2, position: V2(x: 0, y: 900), velocity: V2(x: -20, y: 500))])
        _ = game.step(dt)
        check(game.blobs[0].position.x >= game.blobs[0].radius && game.blobs[0].position.y <= GameEngine.height-game.blobs[0].radius, "Wall and floor contacts contain blobs")
        for _ in 0..<100 { _ = game.step(dt) }
        check(game.blobs[0].deformation.contains { abs($0) > 0.001 }, "Contacts deform the spring surface")

        var danger = Blob(level: 9, position: V2(x: 180, y: 150))
        danger.age = 3; danger.dangerTime = 2.799
        game = GameEngine(blobs: [danger])
        _ = game.step(dt)
        check(game.isGameOver && !game.shoot(x: 100, power: 0), "Sustained overflow ends game and blocks launch")
        game = GameEngine(blobs: [Blob(level: 0, position: V2(x: 180, y: 58))])
        _ = game.step(dt)
        check(!game.isGameOver && game.blobs[0].dangerTime == 0, "Freshly falling blobs receive overflow grace")

        let encoded = try JSONEncoder().encode(game)
        let restored = try JSONDecoder().decode(GameEngine.self, from: encoded)
        check(restored.isValid && restored.blobs[0].position == game.blobs[0].position, "Save round trip preserves physics state")
        var corrupt = restored
        corrupt.blobs[0].deformation = []
        check(!corrupt.isValid, "Malformed save is rejected before rendering")
        check(!game.shoot(x: .nan, power: 0), "Nonfinite input is rejected")
        let before = game
        _ = game.step(.infinity)
        check(game.blobs[0].position == before.blobs[0].position, "Invalid time step cannot corrupt simulation")

        var first = GameEngine(randomState: 123)
        var second = first
        check((0..<100).map { _ in first.randomLevel() } == (0..<100).map { _ in second.randomLevel() }, "Seeded blob queue is deterministic")

        var rounds = 0
        var totalMerges = 0
        game = GameEngine(randomState: 987)
        for tick in 0..<24000 {
            if tick % 75 == 0 {
                _ = game.shoot(x: 25+Double((tick*7919)%310), power: Double(tick%5)/4)
            }
            totalMerges += game.step(dt).count
            precondition(game.isValid, "Invalid simulation at tick \(tick)")
            if game.isGameOver { rounds += 1; game = GameEngine(randomState: UInt64(tick+1)) }
        }
        check(totalMerges > 60, "Stress run exercises repeated merges (\(totalMerges) merges, \(rounds) completed rounds)")
        print("\(checks) checks passed; 24,000 fixed simulation steps verified.")
    }
}

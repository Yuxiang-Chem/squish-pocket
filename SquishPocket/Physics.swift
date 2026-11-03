import Foundation

struct V2: Codable, Equatable {
    var x: Double
    var y: Double
    static let zero = V2(x: 0, y: 0)
    static func + (a: V2, b: V2) -> V2 { V2(x: a.x + b.x, y: a.y + b.y) }
    static func - (a: V2, b: V2) -> V2 { V2(x: a.x - b.x, y: a.y - b.y) }
    static func * (a: V2, b: Double) -> V2 { V2(x: a.x * b, y: a.y * b) }
    var length: Double { sqrt(x * x + y * y) }
    func dot(_ other: V2) -> Double { x * other.x + y * other.y }
}

struct Blob: Codable, Identifiable {
    var id = UUID()
    var level: Int
    var position: V2
    var velocity: V2 = .zero
    var age: Double = 0
    var dangerTime: Double = 0
    var deformation = Array(repeating: 0.0, count: 24)
    var springVelocity = Array(repeating: 0.0, count: 24)
    var radius: Double { Self.radius(for: level) }
    var value: Int { 1 << (level + 1) }
    static func radius(for level: Int) -> Double { 15 * pow(1.245, Double(level)) }
}

struct MergeEvent {
    var position: V2
    var value: Int
    var level: Int
}

/// Fixed-step circle contact dynamics with a spring-deformed surface for each blob.
/// Contacts push the perimeter inward; coupled springs let the rest of it wobble out.
struct GameEngine: Codable {
    static let width = 360.0
    static let height = 570.0
    static let dangerY = 103.0
    static let maximumLevel = 9
    var blobs: [Blob] = []
    var score = 0
    var shots = 0
    var currentLevel = 0
    var nextLevel = 1
    var shotCooldown = 0.0
    var isGameOver = false
    var randomState: UInt64 = 193742

    mutating func randomLevel() -> Int {
        randomState = randomState &* 6364136223846793005 &+ 1442695040888963407
        let n = (randomState >> 32) % 100
        return n < 62 ? 0 : (n < 91 ? 1 : 2)
    }

    @discardableResult
    mutating func shoot(x: Double, power: Double, horizontal: Double = 0) -> Bool {
        guard !isGameOver, shotCooldown <= 0, blobs.count < 90,
              x.isFinite, power.isFinite, horizontal.isFinite else { return false }
        let r = Blob.radius(for: currentLevel)
        blobs.append(Blob(level: currentLevel,
                          position: V2(x: min(Self.width-r-3, max(r+3, x)), y: 58),
                          velocity: V2(x: min(210, max(-210, horizontal)),
                                       y: 130 + min(1, max(0, power)) * 620)))
        currentLevel = nextLevel
        nextLevel = randomLevel()
        shots += 1
        shotCooldown = 0.5
        return true
    }

    mutating func step(_ dt: Double) -> [MergeEvent] {
        guard !isGameOver, dt > 0, dt <= 1.0 / 30, dt.isFinite else { return [] }
        shotCooldown = max(0, shotCooldown - dt)
        var impulses = Array(repeating: Array(repeating: 0.0, count: 24), count: blobs.count)
        for i in blobs.indices {
            blobs[i].age += dt
            blobs[i].velocity.y += 790 * dt
            blobs[i].velocity = blobs[i].velocity * pow(0.997, dt * 120)
            blobs[i].position = blobs[i].position + blobs[i].velocity * dt
        }

        var pendingPairs: [(Int, Int)] = []
        var merging: Set<Int> = []
        for iteration in 0..<5 {
            for i in blobs.indices {
                let r = blobs[i].radius
                if blobs[i].position.x < r + 3 {
                    blobs[i].position.x = r + 3
                    blobs[i].velocity.x = abs(blobs[i].velocity.x) * 0.22
                    impulses[i][12] = max(impulses[i][12], 0.15)
                }
                if blobs[i].position.x > Self.width-r-3 {
                    blobs[i].position.x = Self.width-r-3
                    blobs[i].velocity.x = -abs(blobs[i].velocity.x) * 0.22
                    impulses[i][0] = max(impulses[i][0], 0.15)
                }
                if blobs[i].position.y > Self.height-r-3 {
                    let impact = abs(blobs[i].velocity.y)
                    blobs[i].position.y = Self.height-r-3
                    blobs[i].velocity.y = impact > 55 ? -impact * 0.18 : 0
                    blobs[i].velocity.x *= 0.98
                    impulses[i][6] = max(impulses[i][6], min(0.26, 0.08+impact/2400))
                }
                if blobs[i].position.y < r + 2 {
                    blobs[i].position.y = r + 2
                    blobs[i].velocity.y = abs(blobs[i].velocity.y) * 0.15
                }
            }
            guard blobs.count > 1 else { continue }
            for i in 0..<(blobs.count-1) {
                for j in (i+1)..<blobs.count {
                    let delta = blobs[j].position - blobs[i].position
                    let radii = blobs[i].radius + blobs[j].radius
                    guard abs(delta.x) < radii, abs(delta.y) < radii else { continue }
                    let distance = delta.length
                    guard distance < radii else { continue }
                    if iteration == 0, blobs[i].level == blobs[j].level,
                       blobs[i].level < Self.maximumLevel,
                       !merging.contains(i), !merging.contains(j) {
                        merging.insert(i); merging.insert(j)
                        pendingPairs.append((i, j))
                    }
                    let normal = distance > 0.001 ? delta * (1 / distance) : V2(x: 1, y: 0)
                    let massI = blobs[i].radius * blobs[i].radius
                    let massJ = blobs[j].radius * blobs[j].radius
                    let weightI = massJ / (massI + massJ)
                    let weightJ = 1 - weightI
                    let overlap = radii - distance
                    let correction = max(0, overlap - 0.5) * 0.65
                    blobs[i].position = blobs[i].position - normal * (correction * weightI)
                    blobs[j].position = blobs[j].position + normal * (correction * weightJ)
                    let relative = (blobs[j].velocity - blobs[i].velocity).dot(normal)
                    if relative < 0 {
                        let impulse = -relative * 1.12
                        blobs[i].velocity = blobs[i].velocity - normal * (impulse * weightI)
                        blobs[j].velocity = blobs[j].velocity + normal * (impulse * weightJ)
                    }
                    let angle = atan2(normal.y, normal.x)
                    let a = (Int((angle + 2 * .pi) / (2 * .pi) * 24) % 24)
                    impulses[i][a] = max(impulses[i][a], min(0.25, overlap / radii * 0.7 + 0.025))
                    impulses[j][(a+12)%24] = max(impulses[j][(a+12)%24], impulses[i][a])
                }
            }
        }

        for i in blobs.indices {
            let previous = blobs[i].deformation
            for k in 0..<24 {
                var target = 0.0
                for c in 0..<24 where impulses[i][c] > 0 {
                    let raw = abs(k-c)
                    let separation = Double(min(raw, 24-raw))
                    target += impulses[i][c] * (0.28 - exp(-separation * separation / 3.3))
                }
                let neighbors = (previous[(k+23)%24] + previous[(k+1)%24]) * 0.5
                let acceleration = (target-previous[k]) * 210 + (neighbors-previous[k]) * 95
                blobs[i].springVelocity[k] += acceleration * dt
                blobs[i].springVelocity[k] *= exp(-9 * dt)
                blobs[i].deformation[k] = min(0.24, max(-0.27, previous[k] + blobs[i].springVelocity[k]*dt))
            }
            if !merging.contains(i), blobs[i].age > 2.0 && blobs[i].position.y - blobs[i].radius < Self.dangerY {
                blobs[i].dangerTime += dt
                if blobs[i].dangerTime > 2.8 { isGameOver = true }
            } else { blobs[i].dangerTime = 0 }
        }

        var events: [MergeEvent] = []
        var newBlobs: [Blob] = []
        for (i, j) in pendingPairs {
            let position = (blobs[i].position + blobs[j].position) * 0.5
            let level = blobs[i].level+1
            var blob = Blob(level: level, position: position,
                            velocity: (blobs[i].velocity+blobs[j].velocity)*0.4)
            for k in 0..<24 { blob.deformation[k] = k % 2 == 0 ? 0.12 : 0.07 }
            newBlobs.append(blob)
            score += blob.value
            events.append(MergeEvent(position: position, value: blob.value, level: level))
        }
        if !merging.isEmpty {
            blobs = blobs.enumerated().filter { !merging.contains($0.offset) }.map(\.element)
            blobs.append(contentsOf: newBlobs)
        }
        return events
    }

    var isValid: Bool {
        score >= 0 && shots >= 0 && blobs.count <= 90 && (0...2).contains(currentLevel)
        && (0...2).contains(nextLevel) && shotCooldown.isFinite
        && blobs.allSatisfy {
            (0...Self.maximumLevel).contains($0.level) && $0.position.x.isFinite
            && $0.position.y.isFinite && $0.velocity.x.isFinite && $0.velocity.y.isFinite
            && $0.age.isFinite && $0.dangerTime.isFinite
            && $0.deformation.count == 24 && $0.springVelocity.count == 24
            && $0.deformation.allSatisfy(\.isFinite) && $0.springVelocity.allSatisfy(\.isFinite)
        }
    }
}

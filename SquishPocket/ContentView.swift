import SwiftUI

enum Palette {
    static let ink = Color(red: 0.16, green: 0.15, blue: 0.22)
    static let paper = Color(red: 0.98, green: 0.96, blue: 0.92)
    static let coral = Color(red: 0.92, green: 0.43, blue: 0.39)
    static let colors: [Color] = [
        Color(red: 0.93, green: 0.60, blue: 0.54),
        Color(red: 0.97, green: 0.76, blue: 0.39),
        Color(red: 0.61, green: 0.77, blue: 0.63),
        Color(red: 0.56, green: 0.73, blue: 0.84),
        Color(red: 0.71, green: 0.62, blue: 0.82),
        Color(red: 0.91, green: 0.61, blue: 0.73),
        Color(red: 0.40, green: 0.72, blue: 0.69),
        Color(red: 0.94, green: 0.64, blue: 0.36),
        Color(red: 0.60, green: 0.66, blue: 0.89),
        Color(red: 0.85, green: 0.74, blue: 0.44)
    ]
}

struct ContentView: View {
    @StateObject private var game = GameModel()
    @Environment(\.scenePhase) private var scenePhase
    @State private var confirmRestart = false

    var body: some View {
        GeometryReader { geometry in
            VStack(spacing: geometry.size.height < 650 ? 8 : 14) {
                header
                HStack(spacing: 12) {
                    scoreCard("SCORE", value: game.engine.score, symbol: "sparkle", tint: Palette.coral)
                    scoreCard("PERSONAL BEST", value: game.best, symbol: "crown.fill", tint: Palette.ink)
                }
                BoardView(game: game)
                    .aspectRatio(GameEngine.width / GameEngine.height, contentMode: .fit)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                footer
            }
            .padding(.horizontal, 20)
            .padding(.top, 10)
            .padding(.bottom, 8)
            .frame(maxWidth: 540)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .background(Palette.paper.ignoresSafeArea())
        .foregroundStyle(Palette.ink)
        .preferredColorScheme(.light)
        .onAppear { game.activate() }
        .onDisappear { game.deactivate() }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { game.activate() } else { game.deactivate() }
        }
        .sheet(isPresented: $game.showHelp) { help }
        .confirmationDialog("Start a fresh game? Your best score stays saved.", isPresented: $confirmRestart, titleVisibility: .visible) {
            Button("Start fresh", role: .destructive) { game.newGame() }
            Button("Keep playing", role: .cancel) {}
        }
    }

    private var header: some View {
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 0) {
                Text("squish pocket").font(.system(size: 28, weight: .heavy, design: .rounded)).tracking(-1.2)
                Text("little blobs. big feelings.")
                    .font(.system(size: 11, weight: .medium, design: .rounded))
                    .foregroundStyle(Palette.ink.opacity(0.5))
            }
            Spacer(minLength: 6)
            roundButton("questionmark", label: "How to play") { game.aiming = false; game.showHelp = true }
            roundButton(game.paused ? "play.fill" : "pause.fill", label: game.paused ? "Resume game" : "Pause game") {
                guard game.started, !game.engine.isGameOver else { return }
                game.aiming = false; game.paused.toggle(); game.save()
            }
        }
    }

    private func roundButton(_ symbol: String, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol).font(.system(size: 15, weight: .bold))
                .frame(width: 44, height: 44)
                .background(.white.opacity(0.65), in: Circle())
                .overlay(Circle().stroke(Palette.ink.opacity(0.06)))
        }.buttonStyle(.plain).accessibilityLabel(label)
    }

    private func scoreCard(_ title: String, value: Int, symbol: String, tint: Color) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 1) {
                Text(title).font(.system(size: 9, weight: .bold, design: .rounded)).tracking(1.4).foregroundStyle(Palette.ink.opacity(0.48))
                Text(value.formatted()).font(.system(size: 27, weight: .heavy, design: .rounded)).monospacedDigit()
            }
            Spacer(minLength: 2)
            Image(systemName: symbol).font(.system(size: 19)).foregroundStyle(tint.opacity(0.65))
        }
        .padding(.horizontal, 14).padding(.vertical, 9)
        .background(.white.opacity(0.8), in: RoundedRectangle(cornerRadius: 18))
    }

    private var footer: some View {
        VStack(spacing: 9) {
            HStack(spacing: 12) {
                HStack(spacing: 8) {
                    Text("UP NEXT").font(.system(size: 9, weight: .bold, design: .rounded)).tracking(1)
                        .foregroundStyle(Palette.ink.opacity(0.5))
                    miniBlob(level: game.engine.nextLevel, size: 35)
                }
                Spacer()
                roundButton(game.haptics ? "hand.tap.fill" : "hand.tap", label: game.haptics ? "Turn haptics off" : "Turn haptics on") { game.toggleHaptics() }
                roundButton("arrow.counterclockwise", label: "Restart game") {
                    if game.engine.shots > 0 && !game.engine.isGameOver { confirmRestart = true }
                    else { game.newGame() }
                }
            }
            Text(game.aiming ? "PULL DOWN FOR A STRONGER SHOT" : "SLIDE TO AIM  ·  RELEASE TO DROP")
                .font(.system(size: 9, weight: .bold, design: .rounded)).tracking(1.1)
                .foregroundStyle(Palette.ink.opacity(0.45))
        }
    }

    private var help: some View {
        VStack(alignment: .leading, spacing: 25) {
            HStack {
                Text("A little guide").font(.system(size: 30, weight: .heavy, design: .rounded))
                Spacer()
                Button { game.showHelp = false } label: { Image(systemName: "xmark.circle.fill").font(.title) }
                    .accessibilityLabel("Close guide")
            }
            Text("Make room for something bigger.").font(.system(size: 17, design: .rounded)).foregroundStyle(.secondary)
            guideRow("hand.draw.fill", title: "Aim with your thumb", detail: "Touch the jar and slide left or right. Lift your finger to drop a blob.")
            guideRow("arrow.down", title: "Give it a little push", detail: "Pull down before releasing to launch harder and nudge the pile.")
            guideRow("sparkles", title: "Find a matching friend", detail: "Two blobs with the same number merge into a bigger one. Each merge adds its new value to your score.")
            guideRow("line.3.horizontal", title: "Mind the dotted line", detail: "The game ends if a settled blob stays above the line for nearly three seconds. Falling blobs get a grace period.")
            HStack(spacing: 8) { ForEach(0..<6) { miniBlob(level: $0, size: 36) } }
                .frame(maxWidth: .infinity)
            Text("Your game saves on this iPhone.\nAn independent prototype inspired by physics merge games.")
                .font(.footnote).foregroundStyle(.secondary).frame(maxWidth: .infinity).multilineTextAlignment(.center)
            Spacer(minLength: 0)
        }
        .padding(26).padding(.top, 15)
        .background(Palette.paper).foregroundStyle(Palette.ink)
        .presentationDetents([.large])
    }

    private func guideRow(_ symbol: String, title: String, detail: String) -> some View {
        HStack(alignment: .top, spacing: 16) {
            Image(systemName: symbol).font(.title2).frame(width: 32).foregroundStyle(Palette.coral)
            VStack(alignment: .leading, spacing: 5) {
                Text(title).font(.system(size: 17, weight: .bold, design: .rounded))
                Text(detail).font(.system(size: 14, design: .rounded)).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}

func miniBlob(level: Int, size: Double) -> some View {
    ZStack {
        RoundedRectangle(cornerRadius: size * 0.42).fill(Palette.colors[level])
        Text("\(1 << (level+1))").font(.system(size: size*0.34, weight: .heavy, design: .rounded)).foregroundStyle(Palette.ink)
    }.frame(width: size, height: size)
}

struct BoardView: View {
    @ObservedObject var game: GameModel

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                Canvas { context, size in
                    context.scaleBy(x: size.width/GameEngine.width, y: size.height/GameEngine.height)
                    drawBoard(&context)
                }
                .contentShape(Rectangle())
                .gesture(DragGesture(minimumDistance: 0)
                    .onChanged { gesture in
                        guard game.started, !game.paused, !game.engine.isGameOver, game.engine.shotCooldown <= 0 else { return }
                        let r = Blob.radius(for: game.engine.currentLevel)
                        game.aimX = min(GameEngine.width-r-3, max(r+3, gesture.location.x / geometry.size.width * GameEngine.width))
                        game.power = min(1, max(0, gesture.translation.height / geometry.size.height * 3.2))
                        game.aiming = true
                    }
                    .onEnded { _ in if game.aiming { game.shoot() } })
                .accessibilityLabel("Blob jar. \(game.engine.blobs.count) blobs. Score \(game.engine.score).")
                .accessibilityHint("Slide to aim, pull down for power, release to shoot.")
                .accessibilityAdjustableAction { direction in
                    let delta = direction == .increment ? 24.0 : -24.0
                    game.aimX = min(330, max(30, game.aimX+delta))
                }
                .accessibilityAction(named: "Drop blob") { game.power = 0; game.shoot() }
                if !game.started { intro }
                else if game.engine.isGameOver { gameOver }
                else if game.paused { pauseOverlay }
            }
            .background(Color.white.opacity(0.56))
            .clipShape(RoundedRectangle(cornerRadius: 30))
            .overlay(RoundedRectangle(cornerRadius: 30).stroke(Palette.ink.opacity(0.12), lineWidth: 1.5))
        }
        .aspectRatio(GameEngine.width/GameEngine.height, contentMode: .fit)
    }

    private var intro: some View {
        VStack(spacing: 15) {
            Spacer()
            HStack(spacing: -6) {
                miniBlob(level: 0, size: 62).rotationEffect(.degrees(-14)).offset(y: 10)
                miniBlob(level: 2, size: 86).rotationEffect(.degrees(8))
                miniBlob(level: 1, size: 55).rotationEffect(.degrees(20)).offset(y: 17)
            }.padding(.bottom, 18)
            Text("A pocketful\nof possibility.")
                .font(.system(size: 32, weight: .heavy, design: .rounded)).tracking(-1).multilineTextAlignment(.center)
            Text("Drop. Match. Squish. Repeat.")
                .font(.system(size: 14, weight: .medium, design: .rounded)).foregroundStyle(Palette.ink.opacity(0.55))
            actionButton("Let's squish", symbol: "arrow.right") { game.newGame() }.padding(.top, 10)
            Text("NO RUSH. JUST ONE MORE MERGE.")
                .font(.system(size: 8, weight: .bold, design: .rounded)).tracking(1.5).foregroundStyle(Palette.ink.opacity(0.4))
            Spacer()
        }.padding(20).frame(maxWidth: .infinity).background(Palette.paper.opacity(0.84))
    }

    private var pauseOverlay: some View {
        VStack(spacing: 20) {
            Image(systemName: "moon.zzz.fill").font(.system(size: 35)).foregroundStyle(Palette.coral)
            Text("Take a breather.").font(.system(size: 27, weight: .heavy, design: .rounded))
            Text("Your little pile will be here.").font(.system(size: 14, design: .rounded)).foregroundStyle(.secondary)
            actionButton("Keep squishing", symbol: "play.fill") { game.paused = false }
        }.frame(maxWidth: .infinity, maxHeight: .infinity).background(Palette.paper.opacity(0.94))
    }

    private var gameOver: some View {
        VStack(spacing: 16) {
            Text("Full of feelings.").font(.system(size: 29, weight: .heavy, design: .rounded)).tracking(-0.8)
            Text("\(game.engine.score.formatted())").font(.system(size: 64, weight: .heavy, design: .rounded))
            Text(game.engine.score > 0 && game.engine.score >= game.best ? "A NEW PERSONAL BEST!" : "A LOVELY LITTLE PILE.")
                .font(.system(size: 10, weight: .bold, design: .rounded)).tracking(1.2).foregroundStyle(.secondary)
            actionButton("One more round", symbol: "arrow.counterclockwise") { game.newGame() }.padding(.top, 12)
        }.frame(maxWidth: .infinity, maxHeight: .infinity).background(Palette.paper.opacity(0.95))
    }

    private func actionButton(_ title: String, symbol: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 15) {
                Text(title)
                Image(systemName: symbol)
            }.font(.system(size: 16, weight: .bold, design: .rounded))
                .padding(.horizontal, 25).frame(height: 52)
                .foregroundStyle(.white).background(Palette.ink, in: Capsule())
        }.buttonStyle(.plain)
    }

    private func drawBoard(_ context: inout GraphicsContext) {
        for x in stride(from: 18.0, to: GameEngine.width, by: 23) {
            for y in stride(from: 18.0, to: GameEngine.height, by: 23) {
                context.fill(Path(ellipseIn: CGRect(x: x, y: y, width: 1.8, height: 1.8)), with: .color(Palette.ink.opacity(0.07)))
            }
        }
        let danger = game.engine.blobs.map(\.dangerTime).max() ?? 0
        var line = Path()
        line.move(to: CGPoint(x: 14, y: GameEngine.dangerY)); line.addLine(to: CGPoint(x: 346, y: GameEngine.dangerY))
        context.stroke(line, with: .color(danger > 0 ? Palette.coral : Palette.ink.opacity(0.16)), style: StrokeStyle(lineWidth: 1.2, dash: [4, 6]))
        if danger > 0 {
            context.draw(Text("MAKE A LITTLE ROOM").font(.system(size: 9, weight: .bold, design: .rounded)).foregroundColor(Palette.coral), at: CGPoint(x: 180, y: 123))
        }
        for blob in game.engine.blobs { drawBlob(&context, blob: blob) }
        for spark in game.sparks {
            let radius = 2.5 * spark.life/0.65
            context.fill(Path(ellipseIn: CGRect(x: spark.position.x-radius, y: spark.position.y-radius, width: radius*2, height: radius*2)), with: .color(Palette.colors[spark.level].opacity(spark.life/0.65)))
        }
        if game.started, !game.engine.isGameOver {
            let ready = game.engine.shotCooldown <= 0
            let preview = Blob(level: game.engine.currentLevel, position: V2(x: game.aimX, y: 58))
            var previewContext = context
            previewContext.opacity = ready ? 1 : 0.3
            if game.aiming {
                var trail = Path()
                trail.move(to: CGPoint(x: game.aimX, y: 85))
                trail.addLine(to: CGPoint(x: game.aimX, y: 155+game.power*80))
                context.stroke(trail, with: .color(Palette.ink.opacity(0.2)), style: StrokeStyle(lineWidth: 2, lineCap: .round, dash: [2, 8]))
                let width = 70.0
                context.fill(Path(roundedRect: CGRect(x: game.aimX-width/2, y: 22, width: width, height: 4), cornerRadius: 2), with: .color(Palette.ink.opacity(0.1)))
                context.fill(Path(roundedRect: CGRect(x: game.aimX-width/2, y: 22, width: width * max(0.04, game.power), height: 4), cornerRadius: 2), with: .color(Palette.coral))
            }
            drawBlob(&previewContext, blob: preview)
        }
    }

    private func drawBlob(_ context: inout GraphicsContext, blob: Blob) {
        let r = blob.radius
        var points: [CGPoint] = []
        for k in 0..<24 {
            let angle = Double(k) / 24 * 2 * .pi
            let radius = r * (1+blob.deformation[k])
            points.append(CGPoint(x: blob.position.x+cos(angle)*radius, y: blob.position.y+sin(angle)*radius))
        }
        var path = Path()
        path.move(to: CGPoint(x: (points[23].x+points[0].x)/2, y: (points[23].y+points[0].y)/2))
        for k in 0..<24 {
            let next = points[(k+1)%24]
            path.addQuadCurve(to: CGPoint(x: (points[k].x+next.x)/2, y: (points[k].y+next.y)/2), control: points[k])
        }
        path.closeSubpath()
        let color = Palette.colors[blob.level]
        context.fill(path, with: .linearGradient(Gradient(colors: [color, color.opacity(0.86)]), startPoint: CGPoint(x: blob.position.x-r, y: blob.position.y-r), endPoint: CGPoint(x: blob.position.x+r, y: blob.position.y+r)))
        context.stroke(path, with: .color(Palette.ink.opacity(0.12)), lineWidth: 1)
        context.fill(Path(ellipseIn: CGRect(x: blob.position.x-r*0.5, y: blob.position.y-r*0.65, width: r*0.42, height: r*0.2)), with: .color(.white.opacity(0.3)))
        let eye = max(1.8, r*0.065)
        for side in [-1.0, 1.0] {
            context.fill(Path(ellipseIn: CGRect(x: blob.position.x+side*r*0.22-eye, y: blob.position.y-r*0.18, width: eye*2, height: eye*2.5)), with: .color(Palette.ink))
        }
        var smile = Path()
        smile.move(to: CGPoint(x: blob.position.x-r*0.1, y: blob.position.y+r*0.035))
        smile.addQuadCurve(to: CGPoint(x: blob.position.x+r*0.1, y: blob.position.y+r*0.035), control: CGPoint(x: blob.position.x, y: blob.position.y+r*0.14))
        context.stroke(smile, with: .color(Palette.ink.opacity(0.8)), style: StrokeStyle(lineWidth: max(1.2, r*0.035), lineCap: .round))
        context.draw(Text("\(blob.value)").font(.system(size: max(10, r*0.4), weight: .heavy, design: .rounded)).foregroundColor(Palette.ink.opacity(0.78)), at: CGPoint(x: blob.position.x, y: blob.position.y+r*0.45))
    }
}

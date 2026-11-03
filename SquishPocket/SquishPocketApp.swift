import SwiftUI

@main
struct SquishPocketApp: App {
    var body: some Scene {
        WindowGroup { ContentView() }
        #if os(macOS)
        .defaultSize(width: 390, height: 800)
        #endif
    }
}

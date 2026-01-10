import SwiftUI
import SwiftData

@main
struct RepCompanionWatchApp: App {
    // Use Watch-specific persistence with offline support
    let persistence = WatchPersistenceManager.shared
    
    var body: some Scene {
        WindowGroup {
            WatchContentView()
        }
        .modelContainer(persistence.container ?? {
            // Fallback if SwiftData not available (watchOS 9 and below)
            // This will use UserDefaults-based storage
            fatalError("Could not create model container")
        }())
    }
}

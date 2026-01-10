import SwiftUI
import SwiftData

// This file is kept for reference but the main app entry point is RepCompanion_2App.swift
// Remove @main to avoid duplicate entry point errors

struct RepCompanioniOSApp: App {
    let persistenceController = PersistenceController.shared

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .modelContainer(persistenceController.container)
    }
}

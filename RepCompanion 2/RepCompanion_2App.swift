//
//  RepCompanion_2App.swift
//  RepCompanion 2
//
//  Created by Thomas Söderberg on 2025-11-27.
//

import SwiftUI
import SwiftData
import UserNotifications

@main
struct RepCompanion_2App: App {
    let persistenceController = PersistenceController.shared
    @StateObject private var languageService = AppLanguageService.shared
    private let connectivityManager = WatchConnectivityManager.shared
    
    init() {
        // Ensure WatchConnectivity is initialized early
        _ = WatchConnectivityManager.shared
        
        // Request notification authorization on app launch
        Task {
            do {
                try await NotificationService.shared.requestAuthorization()
            } catch {
                print("Failed to request notification authorization: \(error)")
            }
        }
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(\.locale, Locale(identifier: languageService.currentLanguage))
                .environmentObject(languageService)
        }
        .modelContainer(persistenceController.container)
    }
}

//
//  RepCompanion_2App.swift
//  RepCompanion 2
//
//  Created by Thomas Söderberg on 2025-11-27.
//

import SwiftUI
import SwiftData
import UserNotifications
#if canImport(GoogleSignIn)
import GoogleSignIn
#endif

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
                .onOpenURL { url in
                    #if canImport(GoogleSignIn)
                    GIDSignIn.sharedInstance.handle(url)
                    #endif
                    
                    // Handle Magic Link
                    if url.scheme == "repcompanion" && url.host == "magic-link" {
                        handleMagicLink(url: url)
                    }
                }
        }
        .modelContainer(persistenceController.container)
    }
    
    // MARK: - Helper Methods
    
    private func handleMagicLink(url: URL) {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: true),
              let queryItems = components.queryItems,
              let token = queryItems.first(where: { $0.name == "token" })?.value else {
            return
        }
        
        Task {
            do {
                try await AuthService.shared.signInWithMagicLink(
                    token: token,
                    modelContext: persistenceController.container.mainContext
                )
            } catch {
                print("[App] ❌ Failed to sign in with magic link: \(error.localizedDescription)")
            }
        }
    }
}

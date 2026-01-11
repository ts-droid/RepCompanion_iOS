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
        // Clear old authentication data to force re-login with new auth methods
        // Check if user is using old email/password auth
        let authMethod = UserDefaults.standard.string(forKey: "auth_method")
        if authMethod == "email" || authMethod == nil {
            print("[App] 🔄 Clearing old/invalid authentication data...")
            UserDefaults.standard.removeObject(forKey: "auth_user_id")
            UserDefaults.standard.removeObject(forKey: "auth_user_email")
            UserDefaults.standard.removeObject(forKey: "auth_user_name")
            UserDefaults.standard.removeObject(forKey: "auth_method")
            UserDefaults.standard.removeObject(forKey: "authToken")
            print("[App] ✅ Old auth data cleared - user will need to login with Apple/Google/Magic Link")
        } else {
            print("[App] ✅ User authenticated with: \(authMethod ?? "unknown")")
        }
        
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

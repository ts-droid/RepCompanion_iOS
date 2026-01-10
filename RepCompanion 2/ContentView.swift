//
//  ContentView.swift
//  RepCompanion 2
//
//  Created by Thomas Söderberg on 2025-11-27.
//

import SwiftUI
import SwiftData

struct ContentView: View {
    @AppStorage("colorScheme") private var colorScheme = "System"
    @Environment(\.modelContext) private var modelContext
    @Query private var userProfiles: [UserProfile]
    @StateObject private var authService = AuthService.shared
    
    init() {
        // Customize TabBar appearance to match dark theme
        let appearance = UITabBarAppearance()
        appearance.configureWithOpaqueBackground()
        appearance.backgroundColor = UIColor(Color.appBackground)
        
        // Unselected items
        appearance.stackedLayoutAppearance.normal.iconColor = UIColor(Color.textSecondary)
        appearance.stackedLayoutAppearance.normal.titleTextAttributes = [.foregroundColor: UIColor(Color.textSecondary)]
        
        // Selected items
        appearance.stackedLayoutAppearance.selected.iconColor = UIColor.white
        appearance.stackedLayoutAppearance.selected.titleTextAttributes = [.foregroundColor: UIColor.white]

        UITabBar.appearance().standardAppearance = appearance
        UITabBar.appearance().scrollEdgeAppearance = appearance
    }
    
    @AppStorage("welcomeAccepted") private var welcomeAccepted = false
    
    private var currentProfile: UserProfile? {
        // Filter profiles by current authenticated user
        guard let userId = authService.currentUserId else { return nil }
        return userProfiles.first { $0.userId == userId }
    }
    
    private var shouldShowOnboarding: Bool {
        // Check if any profile exists and is completed
        if let profile = currentProfile {
            return !profile.onboardingCompleted
        }
        // No profile exists for this user, show onboarding
        return true
    }
    
    var body: some View {
        Group {
            if !authService.isAuthenticated {
                LoginView()
            } else if !welcomeAccepted {
                WelcomeView()
            } else if shouldShowOnboarding {
                OnboardingView()
            } else {
                TabView {
                    HomeView()
                        .tabItem {
                            Label("Hem", systemImage: "house.fill")
                        }
                    
                    WorkoutListView()
                        .tabItem {
                            Label("Program", systemImage: "dumbbell.fill")
                        }
                    
                    StatisticsView()
                        .tabItem {
                            Label("Statistik", systemImage: "chart.bar.xaxis")
                        }
                    
                    ProfileView()
                        .tabItem {
                            Label("Profil", systemImage: "person.fill")
                        }
                }
                .preferredColorScheme(preferredColorScheme)
            }
        }
    }
    
    private var preferredColorScheme: ColorScheme? {
        switch colorScheme {
        case "Light":
            return .light
        case "Dark":
            return .dark
        default:
            return nil // System
        }
    }
}

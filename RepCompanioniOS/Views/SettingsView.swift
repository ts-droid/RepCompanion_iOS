import SwiftUI
import SwiftData

/// Settings view for configuring integrations and services
struct SettingsView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @StateObject private var healthKitService = HealthKitService.shared
    @StateObject private var notificationService = NotificationService.shared
    @StateObject private var cloudKitService = CloudKitSyncService.shared
    
    @State private var showHealthKitAlert = false
    @State private var showNotificationAlert = false
    @State private var isSyncing = false
    @State private var showResetOnboardingAlert = false
    @State private var showResetPassAlert = false
    
    @Query private var userProfiles: [UserProfile]
    @Query private var programTemplates: [ProgramTemplate]
    @Query private var gyms: [Gym]
    
    private var currentProfile: UserProfile? {
        userProfiles.first
    }
    
    var body: some View {
        NavigationView {
            List {
                // HealthKit Integration
                Section(String(localized: "Health data")) {
                    HStack {
                        Image(systemName: "heart.text.square.fill")
                            .foregroundColor(.red)
                        Text(String(localized: "Apple Health"))
                        Spacer()
                        if healthKitService.isAuthorized {
                            Text(String(localized: "Activated"))
                                .foregroundColor(.green)
                        } else {
                            Text(String(localized: "Deactivated"))
                                .foregroundColor(.gray)
                        }
                    }
                    
                    if !healthKitService.isAuthorized {
                        Button(String(localized: "Activate HealthKit")) {
                            Task {
                                do {
                                    try await healthKitService.requestAuthorization()
                                } catch {
                                    showHealthKitAlert = true
                                }
                            }
                        }
                    }
                    
                    Button(String(localized: "Sync health data")) {
                        Task {
                            isSyncing = true
                            do {
                                try await healthKitService.syncToServer()
                            } catch {
                                showHealthKitAlert = true
                            }
                            isSyncing = false
                        }
                    }
                    .disabled(isSyncing || !healthKitService.isAuthorized)
                }
                
                // Notifications
                Section(String(localized: "Notifications")) {
                    HStack {
                        Image(systemName: "bell.fill")
                            .foregroundColor(.blue)
                        Text(String(localized: "Push notifications"))
                        Spacer()
                        if notificationService.authorizationStatus == .authorized {
                            Text(String(localized: "Activated"))
                                .foregroundColor(.green)
                        } else {
                            Text(String(localized: "Deactivated"))
                                .foregroundColor(.gray)
                        }
                    }
                    
                    if notificationService.authorizationStatus != .authorized {
                        Button(String(localized: "Activate notifications")) {
                            Task {
                                do {
                                    try await notificationService.requestAuthorization()
                                } catch {
                                    showNotificationAlert = true
                                }
                            }
                        }
                    }
                }
                
                // Cloud Sync
                Section(String(localized: "Syncing")) {
                    HStack {
                        Image(systemName: "icloud.fill")
                            .foregroundColor(.blue)
                        Text(String(localized: "CloudKit sync"))
                        Spacer()
                        if cloudKitService.isAvailable {
                            switch cloudKitService.syncStatus {
                            case .idle:
                                Text(String(localized: "Waiting"))
                                    .foregroundColor(.gray)
                            case .syncing:
                                ProgressView()
                            case .success:
                                Text(String(localized: "Synced"))
                                    .foregroundColor(.green)
                            case .error:
                                Text(String(localized: "Error"))
                                    .foregroundColor(.red)
                            }
                        } else {
                            Text(String(localized: "Not available"))
                                .foregroundColor(.orange)
                        }
                    }
                    
                    if !cloudKitService.isAvailable {
                        Text(String(localized: "CloudKit entitlement missing. Contact developer."))
                            .font(.caption)
                            .foregroundColor(.orange)
                    } else if cloudKitService.lastSyncDate != nil {
                        HStack(spacing: 4) {
                            Text(String(localized: "Last synced:"))
                            Text(cloudKitService.lastSyncDate!, style: .relative)
                        }
                        .font(.caption)
                        .foregroundColor(.secondary)
                    }
                    
                    Button(String(localized: "Sync now")) {
                        Task {
                            // TODO: Pass modelContext
                            // try await cloudKitService.performFullSync(modelContext: modelContext)
                        }
                    }
                    .disabled(!cloudKitService.isAvailable)
                }
                
                // Exercise Catalog
                Section(String(localized: "Exercise catalog")) {
                    HStack {
                        Image(systemName: "list.bullet.rectangle")
                            .foregroundColor(.blue)
                        Text(String(localized: "Exercises"))
                        Spacer()
                        if ExerciseCatalogService.shared.lastSyncDate != nil {
                            Text(String(localized: "Synced"))
                                .font(.caption)
                                .foregroundColor(.green)
                        } else {
                            Text(String(localized: "Not synced"))
                                .font(.caption)
                                .foregroundColor(.gray)
                        }
                    }
                    
                    NavigationLink(destination: ExerciseListView()) {
                        HStack {
                            Image(systemName: "magnifyingglass")
                            Text(String(localized: "Browse exercises"))
                        }
                    }
                    
                    Button(String(localized: "Sync exercise catalog")) {
                        Task {
                            // TODO: Pass modelContext
                            // try await ExerciseCatalogService.shared.syncExercises(modelContext: modelContext)
                        }
                    }
                }
                
                // Social Features
                Section(String(localized: "Social")) {
                    NavigationLink(destination: ChallengesView()) {
                        HStack {
                            Image(systemName: "trophy.fill")
                                .foregroundColor(.yellow)
                            Text(String(localized: "Challenges"))
                        }
                    }
                    
                    NavigationLink(destination: LeaderboardView()) {
                        HStack {
                            Image(systemName: "chart.bar.fill")
                                .foregroundColor(.blue)
                            Text(String(localized: "Leaderboard"))
                        }
                    }
                }
                
                // Program Management
                Section(String(localized: "Program management")) {
                    Button(role: .none) {
                        showResetPassAlert = true
                    } label: {
                        HStack {
                            Image(systemName: "arrow.counterclockwise")
                                .foregroundColor(.blue)
                            VStack(alignment: .leading) {
                                Text(String(localized: "Reset to Session 1"))
                                Text(String(localized: "Reset the counter for your current program."))
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                    
                    Button(role: .destructive) {
                        showResetOnboardingAlert = true
                    } label: {
                        HStack {
                            Image(systemName: "exclamationmark.triangle")
                                .foregroundColor(.red)
                            VStack(alignment: .leading) {
                                Text(String(localized: "Reset all"))
                                Text(String(localized: "Delete all programs and gyms to start over completely."))
                                    .font(.caption)
                                    .foregroundColor(.red.opacity(0.8))
                            }
                        }
                    }
                }
                
                // Admin Section (Dev Only)
                let isDevUser = AuthService.shared.currentUserEmail == "dev@recompute.it" || 
                                AuthService.shared.currentUserEmail == "dev@test.com"
                if isDevUser {
                    Section(String(localized: "Admin")) {
                        NavigationLink(destination: AdminView()) {
                            HStack {
                                Image(systemName: "shield.checkered")
                                    .foregroundColor(.red)
                                Text(String(localized: "Approve exercises & equipment"))
                            }
                        }
                    }
                }
                
                #if DEBUG
                Section("Debug") {
                    Button(role: .destructive) {
                        deleteAllTemplates()
                    } label: {
                        HStack {
                            Image(systemName: "trash")
                                .foregroundColor(.red)
                            Text("Manuell templates-rensning")
                        }
                    }
                }
                #endif
            }
            .navigationTitle(String(localized: "Settings"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(String(localized: "Done")) {
                        dismiss()
                    }
                }
            }
            .alert(String(localized: "Reset to Session 1?"), isPresented: $showResetPassAlert) {
                Button(String(localized: "Cancel"), role: .cancel) { }
                Button(String(localized: "Reset"), role: .destructive) {
                    resetCurrentPass()
                }
            } message: {
                Text(String(localized: "This will reset your counter to Session 1. Your existing training programs will not be deleted."))
            }
            .alert(String(localized: "Delete everything and start over?"), isPresented: $showResetOnboardingAlert) {
                Button(String(localized: "Cancel"), role: .cancel) { }
                Button(String(localized: "Reset"), role: .destructive) {
                    resetOnboarding()
                }
            } message: {
                Text(String(localized: "This will reset onboarding and you will need to go through onboarding again."))
            }
            .alert(String(localized: "HealthKit error"), isPresented: $showHealthKitAlert) {
                Button(String(localized: "OK")) { }
            } message: {
                Text(String(localized: "Could not activate HealthKit. Check that the app has permission in Settings."))
            }
            .alert(String(localized: "Notification error"), isPresented: $showNotificationAlert) {
                Button(String(localized: "OK")) { }
            } message: {
                Text(String(localized: "Could not activate notifications. Check that the app has permission in Settings."))
            }
        }
    }
    
    // MARK: - Program Functions
    
    private func resetCurrentPass() {
        if let profile = currentProfile {
            profile.currentPassNumber = 1
            try? modelContext.save()
            print("[SettingsView] ✅ Reset currentPassNumber to 1")
        }
    }
    
    // MARK: - Debug Functions
    
    private func resetOnboarding() {
        Task {
            // Delete all templates on server first
            do {
                try await APIService.shared.deleteAllTemplates()
                print("[SettingsView] ✅ Deleted all templates on server")
            } catch {
                print("[SettingsView] ⚠️ Warning: Failed to delete templates on server: \(error.localizedDescription)")
                // Continue anyway - templates will be cleared on next onboarding
            }
            
            // Delete all gyms on server
            do {
                try await APIService.shared.deleteAllGyms()
                print("[SettingsView] ✅ Deleted all gyms on server")
            } catch {
                print("[SettingsView] ⚠️ Warning: Failed to delete gyms on server: \(error.localizedDescription)")
                // Continue anyway - gyms will be cleared on next onboarding
            }
            
            // Reset profile values on server (sessionsPerWeek, etc.)
            do {
                try await APIService.shared.resetProfile()
                print("[SettingsView] ✅ Reset profile values on server")
            } catch {
                print("[SettingsView] ⚠️ Warning: Failed to reset profile on server: \(error.localizedDescription)")
                // Continue anyway - profile will be reset locally
            }
            
            // Delete all templates locally
            let templateCount = programTemplates.count
            for template in programTemplates {
                modelContext.delete(template)
            }
            
            // Delete all gyms locally
            let gymCount = gyms.count
            for gym in gyms {
                modelContext.delete(gym)
            }
            
            // Reset all user profile settings
            if let profile = currentProfile {
                // Personal info
                profile.age = nil
                profile.sex = nil
                profile.bodyWeight = nil
                profile.height = nil
                
                // 1RM values
                profile.oneRmBench = nil
                profile.oneRmOhp = nil
                profile.oneRmDeadlift = nil
                profile.oneRmSquat = nil
                profile.oneRmLatpull = nil
                
                // Goals - reset to default values (25% each)
                profile.goalStrength = 25
                profile.goalVolume = 25
                profile.goalEndurance = 25
                profile.goalCardio = 25
                
                // Training settings
                profile.motivationType = nil
                profile.trainingLevel = nil
                profile.specificSport = nil
                profile.sessionsPerWeek = 3 // Default
                profile.sessionDuration = 60 // Default
                
                // Program tracking
                profile.currentPassNumber = 1
                profile.lastCompletedTemplateId = nil
                profile.selectedGymId = nil
                profile.onboardingCompleted = false
            }
            
            do {
                try modelContext.save()
                print("[SettingsView] ✅ Onboarding reset:")
                print("[SettingsView]   • Deleted \(templateCount) program templates locally")
                print("[SettingsView]   • Deleted \(gymCount) gym(s) locally")
                print("[SettingsView]   • Reset all user profile settings")
                print("[SettingsView]   • Set selectedGymId = nil")
                print("[SettingsView]   • Set onboardingCompleted = false")
            } catch {
                print("[SettingsView] ❌ Error resetting onboarding: \(error)")
            }
        }
    }
    
    private func deleteAllTemplates() {
        Task {
            // Step 1: Delete all ProgramTemplateExercise entities first
            let exerciseDescriptor = FetchDescriptor<ProgramTemplateExercise>()
            if let exercises = try? modelContext.fetch(exerciseDescriptor) {
                print("[SettingsView] 🗑️ Deleting \(exercises.count) template exercises...")
                for exercise in exercises {
                    modelContext.delete(exercise)
                }
            }
            
            // Step 2: Delete all ProgramTemplate entities
            let templateCount = programTemplates.count
            print("[SettingsView] 🗑️ Deleting \(templateCount) program templates...")
            for template in programTemplates {
                modelContext.delete(template)
            }
            
            do {
                try modelContext.save()
                print("[SettingsView] ✅ Deleted all local templates and exercises")
            } catch {
                print("[SettingsView] ❌ Error deleting templates: \(error)")
            }
            
            // Step 3: Re-sync from server
            if let userId = AuthService.shared.currentUserId {
                print("[SettingsView] 🔄 Re-syncing templates from server...")
                do {
                    try await SyncService.shared.syncProgramTemplates(userId: userId, modelContext: modelContext)
                    print("[SettingsView] ✅ Re-sync complete!")
                } catch {
                    print("[SettingsView] ❌ Re-sync failed: \(error.localizedDescription)")
                }
            }
        }
    }
}

struct ChallengesView: View {
    @StateObject private var socialService = SocialService.shared
    @State private var isLoading = false
    
    var body: some View {
        List {
            ForEach(socialService.activeChallenges) { challenge in
                VStack(alignment: .leading, spacing: 8) {
                    Text(challenge.title)
                        .font(.headline)
                    Text(challenge.description)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                    HStack {
                        Text(String(localized: "\(challenge.participants) participants"))
                            .font(.caption)
                        Spacer()
                        if challenge.isParticipating {
                            Text(String(localized: "Participating"))
                                .font(.caption)
                                .foregroundColor(.green)
                        }
                    }
                }
                .padding(.vertical, 4)
            }
        }
        .navigationTitle("Challenges")
        .task {
            isLoading = true
            do {
                try await socialService.fetchChallenges()
            } catch {
                print("Error fetching challenges: \(error)")
            }
            isLoading = false
        }
    }
}

struct LeaderboardView: View {
    var body: some View {
        Text(String(localized: "Leaderboard coming soon"))
            .navigationTitle(String(localized: "Leaderboard"))
    }
}


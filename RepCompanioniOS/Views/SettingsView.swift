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
                Section("Hälsodata") {
                    HStack {
                        Image(systemName: "heart.text.square.fill")
                            .foregroundColor(.red)
                        Text("Apple Health")
                        Spacer()
                        if healthKitService.isAuthorized {
                            Text("Aktiverad")
                                .foregroundColor(.green)
                        } else {
                            Text("Inaktiverad")
                                .foregroundColor(.gray)
                        }
                    }
                    
                    if !healthKitService.isAuthorized {
                        Button("Aktivera HealthKit") {
                            Task {
                                do {
                                    try await healthKitService.requestAuthorization()
                                } catch {
                                    showHealthKitAlert = true
                                }
                            }
                        }
                    }
                    
                    Button("Synka hälsodata") {
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
                Section("Notifikationer") {
                    HStack {
                        Image(systemName: "bell.fill")
                            .foregroundColor(.blue)
                        Text("Push-notifikationer")
                        Spacer()
                        if notificationService.authorizationStatus == .authorized {
                            Text("Aktiverad")
                                .foregroundColor(.green)
                        } else {
                            Text("Inaktiverad")
                                .foregroundColor(.gray)
                        }
                    }
                    
                    if notificationService.authorizationStatus != .authorized {
                        Button("Aktivera notifikationer") {
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
                Section("Synkning") {
                    HStack {
                        Image(systemName: "icloud.fill")
                            .foregroundColor(.blue)
                        Text("CloudKit-synkning")
                        Spacer()
                        if cloudKitService.isAvailable {
                            switch cloudKitService.syncStatus {
                            case .idle:
                                Text("Väntar")
                                    .foregroundColor(.gray)
                            case .syncing:
                                ProgressView()
                            case .success:
                                Text("Synkad")
                                    .foregroundColor(.green)
                            case .error:
                                Text("Fel")
                                    .foregroundColor(.red)
                            }
                        } else {
                            Text("Ej tillgänglig")
                                .foregroundColor(.orange)
                        }
                    }
                    
                    if !cloudKitService.isAvailable {
                        Text("CloudKit entitlement saknas. Kontakta utvecklaren.")
                            .font(.caption)
                            .foregroundColor(.orange)
                    } else if cloudKitService.lastSyncDate != nil {
                        Text("Senast synkad: \(cloudKitService.lastSyncDate!, style: .relative)")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    
                    Button("Synka nu") {
                        Task {
                            // TODO: Pass modelContext
                            // try await cloudKitService.performFullSync(modelContext: modelContext)
                        }
                    }
                    .disabled(!cloudKitService.isAvailable)
                }
                
                // Exercise Catalog
                Section("Övningskatalog") {
                    HStack {
                        Image(systemName: "list.bullet.rectangle")
                            .foregroundColor(.blue)
                        Text("Övningar")
                        Spacer()
                        if ExerciseCatalogService.shared.lastSyncDate != nil {
                            Text("Synkad")
                                .font(.caption)
                                .foregroundColor(.green)
                        } else {
                            Text("Ej synkad")
                                .font(.caption)
                                .foregroundColor(.gray)
                        }
                    }
                    
                    NavigationLink(destination: ExerciseListView()) {
                        HStack {
                            Image(systemName: "magnifyingglass")
                            Text("Bläddra övningar")
                        }
                    }
                    
                    Button("Synka övningskatalog") {
                        Task {
                            // TODO: Pass modelContext
                            // try await ExerciseCatalogService.shared.syncExercises(modelContext: modelContext)
                        }
                    }
                }
                
                // Social Features
                Section("Social") {
                    NavigationLink(destination: ChallengesView()) {
                        HStack {
                            Image(systemName: "trophy.fill")
                                .foregroundColor(.yellow)
                            Text("Utmaningar")
                        }
                    }
                    
                    NavigationLink(destination: LeaderboardView()) {
                        HStack {
                            Image(systemName: "chart.bar.fill")
                                .foregroundColor(.blue)
                            Text("Topplista")
                        }
                    }
                }
                
                // Program Management
                Section("Programhantering") {
                    Button(role: .none) {
                        showResetPassAlert = true
                    } label: {
                        HStack {
                            Image(systemName: "arrow.counterclockwise")
                                .foregroundColor(.blue)
                            VStack(alignment: .leading) {
                                Text("Börja om på Pass 1")
                                Text("Nollställ räknaren för ditt nuvarande program.")
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
                                Text("Återställ allt")
                                Text("Ta bort alla program och gym för att börja om helt.")
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
                    Section("Admin") {
                        NavigationLink(destination: AdminView()) {
                            HStack {
                                Image(systemName: "shield.checkered")
                                    .foregroundColor(.red)
                                Text("Godkänn övningar & utrustning")
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
            .navigationTitle("Inställningar")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Klar") {
                        dismiss()
                    }
                }
            }
            .alert("Börja om på Pass 1?", isPresented: $showResetPassAlert) {
                Button("Avbryt", role: .cancel) { }
                Button("Nollställ", role: .destructive) {
                    resetCurrentPass()
                }
            } message: {
                Text("Detta kommer att sätta din räknare till Pass 1. Dina befintliga träningsprogram raderas inte.")
            }
            .alert("Radera allt och börja om?", isPresented: $showResetOnboardingAlert) {
                Button("Avbryt", role: .cancel) { }
                Button("Återställ", role: .destructive) {
                    resetOnboarding()
                }
            } message: {
                Text("Detta kommer att återställa onboarding och du kommer att behöva gå igenom onboarding igen.")
            }
            .alert("HealthKit-fel", isPresented: $showHealthKitAlert) {
                Button("OK") { }
            } message: {
                Text("Kunde inte aktivera HealthKit. Kontrollera att appen har behörighet i Inställningar.")
            }
            .alert("Notifikationsfel", isPresented: $showNotificationAlert) {
                Button("OK") { }
            } message: {
                Text("Kunde inte aktivera notifikationer. Kontrollera att appen har behörighet i Inställningar.")
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
                        Text("\(challenge.participants) deltagare")
                            .font(.caption)
                        Spacer()
                        if challenge.isParticipating {
                            Text("Deltar")
                                .font(.caption)
                                .foregroundColor(.green)
                        }
                    }
                }
                .padding(.vertical, 4)
            }
        }
        .navigationTitle("Utmaningar")
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
        Text("Topplista kommer snart")
            .navigationTitle("Topplista")
    }
}


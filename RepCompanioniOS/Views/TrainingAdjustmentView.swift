
import SwiftUI
import SwiftData

struct TrainingAdjustmentView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) var colorScheme
    @AppStorage("selectedTheme") private var selectedTheme = "Main"
    
    // User Profile
    @Query private var profiles: [UserProfile]
    private var currentProfile: UserProfile? { profiles.first }
    
    // Gym
    @Query private var gyms: [Gym]
    private var selectedGym: Gym? {
        guard let profile = currentProfile, let gymId = profile.selectedGymId else { return nil }
        return gyms.first(where: { $0.id == gymId })
    }
    
    // State for adjustments
    @State private var motivationType: String = "bygga_muskler"
    @State private var goalStrength: Int = 25
    @State private var goalHypertrophy: Int = 25
    @State private var goalEndurance: Int = 25
    @State private var goalCardio: Int = 25
    @State private var focusTags: [String] = []
    @State private var selectedIntent: String? = nil
    
    @State private var sessionsPerWeek: Int = 3
    @State private var sessionDuration: Int = 60
    
    // Steps
    enum AdjustmentStep {
        case motivation
        case sportSelection
        case goals
        case logistics
        case processing
    }
    @State private var currentStep: AdjustmentStep = .motivation
    @State private var specificSport: String = ""
    
    // Processing
    @State private var isProcessing = false
    @State private var errorMessage: String?
    @State private var showErrorAlert = false
    
    var body: some View {
        NavigationView {
            VStack {
                if isProcessing {
                    ProcessingView
                } else {
                    switch currentStep {
                    case .motivation:
                        ScrollView {
                            MotivationSelectionView
                                .padding()
                        }
                        
                    case .sportSelection:
                        ScrollView {
                            sportSelectionStep
                                .padding()
                        }
                        
                    case .goals:
                        GoalSelectionView(
                            goalStrength: $goalStrength,
                            goalHypertrophy: $goalHypertrophy,
                            goalEndurance: $goalEndurance,
                            goalCardio: $goalCardio,
                            focusTags: $focusTags,
                            colorScheme: colorScheme,
                            selectedTheme: selectedTheme
                        )
                        .padding()
                        
                    case .logistics:
                        LogisticsSelectionView(
                            sessionsPerWeek: $sessionsPerWeek,
                            sessionDuration: $sessionDuration,
                            colorScheme: colorScheme,
                            selectedTheme: selectedTheme
                        )
                        .padding()
                        
                    case .processing:
                        EmptyView()
                    }
                    
                    Spacer()
                    
                    // Navigation Buttons
                    HStack {
                        if currentStep != .motivation {
                            Button("Tillbaka") {
                                goBack()
                            }
                            .buttonStyle(.plain)
                            .foregroundColor(Color.textSecondary(for: colorScheme))
                        }
                        
                        Spacer()
                        
                        Button(action: nextStep) {
                            Text(currentStep == .logistics ? String(localized: "Generate new program") : String(localized: "Next"))
                                .fontWeight(.bold)
                                .foregroundColor(.white)
                                .padding()
                                .padding(.horizontal, 20)
                                .background(Color.themeGradient(theme: selectedTheme, colorScheme: colorScheme))
                                .cornerRadius(12)
                        }
                    }
                    .padding()
                }
            }
            .navigationTitle(String(localized: "Adjust Training"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    if !isProcessing {
                        Button("Avbryt") { dismiss() }
                    }
                }
            }
            .onAppear(perform: loadCurrentSettings)
            .alert(String(localized: "Error"), isPresented: $showErrorAlert) {
                Button("OK", role: .cancel) { }
            } message: {
                Text(errorMessage ?? String(localized: "An unknown error occurred."))
            }
        }
    }
    
    private var ProcessingView: some View {
        VStack(spacing: 20) {
            ProgressView()
                .scaleEffect(1.5)
            Text(String(localized: "Generating your new program..."))
                .font(.headline)
            Text(String(localized: "This may take a moment. Analyzing your new goals and equipment."))
                .font(.caption)
                .multilineTextAlignment(.center)
                .foregroundColor(.gray)
        }
        .padding()
    }
    
    private var MotivationSelectionView: some View {
        VStack(spacing: 24) {
            Text("What is your primary training goal?")
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(Color.textPrimary(for: colorScheme))
                .multilineTextAlignment(.center)
            
            VStack(spacing: 16) {
                MotivationOption(
                    title: "Lose weight",
                    description: "Lose weight and improve your health.",
                    isSelected: motivationType == "lose_weight",
                    colorScheme: colorScheme,
                    selectedTheme: selectedTheme,
                    action: {
                        motivationType = "lose_weight"
                        calculatePresetGoals()
                    }
                )
                
                MotivationOption(
                    title: "Rehabilitation",
                    description: "Recover from injury or illness.",
                    isSelected: motivationType == "rehabilitation",
                    colorScheme: colorScheme,
                    selectedTheme: selectedTheme,
                    action: {
                        motivationType = "rehabilitation"
                        calculatePresetGoals()
                    }
                )
                
                MotivationOption(
                    title: "Better health",
                    description: "Improve stamina, fitness and energy.",
                    isSelected: motivationType == "better_health",
                    colorScheme: colorScheme,
                    selectedTheme: selectedTheme,
                    action: {
                        motivationType = "better_health"
                        calculatePresetGoals()
                    }
                )
                
                MotivationOption(
                    title: "Build muscle",
                    description: "Build muscle mass and get stronger.",
                    isSelected: motivationType == "build_muscle",
                    colorScheme: colorScheme,
                    selectedTheme: selectedTheme,
                    action: {
                        motivationType = "build_muscle"
                        calculatePresetGoals()
                    }
                )
                
                MotivationOption(
                    title: "Sports performance",
                    description: "Train to perform better in your sport.",
                    isSelected: motivationType == "sport",
                    colorScheme: colorScheme,
                    selectedTheme: selectedTheme,
                    action: {
                        motivationType = "sport"
                        calculatePresetGoals()
                    }
                )
                
                MotivationOption(
                    title: "Mobility",
                    description: "Increase mobility, reduce stiffness and prevent injury.",
                    isSelected: motivationType == "mobility",
                    colorScheme: colorScheme,
                    selectedTheme: selectedTheme,
                    action: {
                        motivationType = "mobility"
                        calculatePresetGoals()
                    }
                )
            }
        }
    }
    
    private var sportSelectionStep: some View {
        VStack(spacing: 24) {
            Text(String(localized: "Which sport are you training for?"))
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(Color.textPrimary(for: colorScheme))
                .multilineTextAlignment(.center)
            
            VStack(spacing: 8) {
                let sports = [
                    "alpine_skiing", "badminton", "basketball", "cycling",
                    "floorball", "football", "track_and_field", "golf",
                    "handball", "ice_hockey", "martial_arts", "cross_country_skiing",
                    "padel", "running", "swimming", "tennis", "other"
                ]
                
                ForEach(sports, id: \.self) { sport in
                    Button(action: { 
                        specificSport = sport 
                        calculatePresetGoals()
                    }) {
                        HStack {
                            Text(LocalizedStringKey(sport.capitalized.replacingOccurrences(of: "_", with: " ")))
                                .foregroundColor(Color.textPrimary(for: colorScheme))
                            Spacer()
                            if specificSport == sport {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundColor(Color.themePrimaryColor(theme: selectedTheme, colorScheme: colorScheme))
                            }
                        }
                        .padding()
                        .background(
                            specificSport == sport
                                ? Color.themePrimaryColor(theme: selectedTheme, colorScheme: colorScheme).opacity(0.1)
                                : Color.cardBackground(for: colorScheme)
                        )
                        .cornerRadius(12)
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(
                                    specificSport == sport
                                        ? Color.themePrimaryColor(theme: selectedTheme, colorScheme: colorScheme)
                                        : Color.textSecondary(for: colorScheme).opacity(0.1),
                                    lineWidth: specificSport == sport ? 2 : 1
                                )
                        )
                    }
                }
            }
        }
    }
    
    private func loadCurrentSettings() {
        guard let profile = currentProfile else { return }
        
        motivationType = profile.motivationType ?? "build_muscle"
        specificSport = profile.specificSport ?? ""
        goalStrength = profile.goalStrength
        goalHypertrophy = profile.goalVolume
        goalEndurance = profile.goalEndurance
        goalCardio = profile.goalCardio
        focusTags = profile.focusTags
        selectedIntent = profile.selectedIntent
        
        sessionsPerWeek = profile.sessionsPerWeek
        sessionDuration = profile.sessionDuration
        
        // Reset to first step
        currentStep = .motivation
    }
    
    private func goBack() {
        withAnimation {
            switch currentStep {
            case .motivation:
                break
            case .sportSelection:
                currentStep = .motivation
            case .goals:
                if motivationType == "sport" {
                    currentStep = .sportSelection
                } else {
                    currentStep = .motivation
                }
            case .logistics:
                currentStep = .goals
            case .processing:
                break
            }
        }
    }
    
    private func nextStep() {
        withAnimation {
            switch currentStep {
            case .motivation:
                if motivationType == "sport" {
                    currentStep = .sportSelection
                } else {
                    currentStep = .goals
                }
            case .sportSelection:
                currentStep = .goals
            case .goals:
                currentStep = .logistics
            case .logistics:
                generateProgram()
            case .processing:
                break
            }
        }
    }
    
    private func generateProgram() {
        guard let profile = currentProfile else { return }
        
        isProcessing = true
        currentStep = .processing
        
        // Update profile locally first
        profile.motivationType = motivationType
        profile.specificSport = specificSport
        profile.goalStrength = goalStrength
        profile.goalVolume = goalHypertrophy
        profile.goalEndurance = goalEndurance
        profile.goalCardio = goalCardio
        profile.focusTags = focusTags
        profile.selectedIntent = selectedIntent
        profile.sessionsPerWeek = sessionsPerWeek
        profile.sessionDuration = sessionDuration
        
        Task {
            do {
                // 1. Update Profile Settings via Onboarding Endpoint (Generation Disabled)
                // Create profile data struct
                let profileData = APIService.OnboardingCompleteRequest.ProfileData(
                    motivationType: motivationType,
                    trainingLevel: profile.trainingLevel ?? "intermediate",
                    specificSport: specificSport,
                    focusTags: focusTags,
                    selectedIntent: selectedIntent,
                    age: profile.age,
                    sex: profile.sex,
                    bodyWeight: profile.bodyWeight,
                    height: profile.height,
                    goalStrength: goalStrength,
                    goalVolume: goalHypertrophy,
                    goalEndurance: goalEndurance,
                    goalCardio: goalCardio,
                    sessionsPerWeek: sessionsPerWeek,
                    sessionDuration: sessionDuration,
                    oneRmBench: profile.oneRmBench,
                    oneRmOhp: profile.oneRmOhp,
                    oneRmDeadlift: profile.oneRmDeadlift,
                    oneRmSquat: profile.oneRmSquat,
                    oneRmLatpull: profile.oneRmLatpull,
                    theme: selectedTheme
                )
                
                // We do this to persist the new goals/logistics to the server profile
                _ = try await APIService.shared.completeOnboarding(
                    profile: profileData,
                    equipment: [], // Empty for profile update, we handle gym-specifics below
                    useV4: true
                )
                
                // 2. Generate Program for EACH Gym
                // This ensures all gyms have updated programs based on new parameters
                print("🔄 Starting multi-gym generation for \(gyms.count) gyms...")
                
                for gym in gyms {
                    print("🏋️ Generating for gym: \(gym.name) (ID: \(gym.id))")
                    
                    // Call API to generate program (profile already updated with new goals above)
                    // The server will use the updated profile data that was just saved
                    let response = try await APIService.shared.generateWorkoutProgram(force: true)
                    
                    // 3. Save to Local Storage (SwiftData)
                    // Convert response to Dictionary for storage
                    let jsonData = try JSONEncoder().encode(response)
                    if let jsonDict = try JSONSerialization.jsonObject(with: jsonData) as? [String: Any] {
                        
                        await MainActor.run {
                            try? GymProgramService.shared.saveGymProgram(
                                userId: profile.userId,
                                gymId: gym.id,
                                programData: jsonDict,
                                modelContext: modelContext
                            )
                        }
                    }
                }
                
                // 4. Force a sync of templates to ensure UI updates
                try? await SyncService.shared.syncProgramTemplates(userId: profile.userId, modelContext: modelContext)
                
                await MainActor.run {
                    dismiss()
                }
                
            } catch {
                await MainActor.run {
                    isProcessing = false
                    errorMessage = error.localizedDescription
                    showErrorAlert = true
                    currentStep = .logistics
                }
            }
        }
    }
    
    private func calculatePresetGoals() {
        let trainingLevel = currentProfile?.trainingLevel ?? "beginner"
        
        var strength = 25
        var hypertrophy = 25
        var endurance = 25
        var cardio = 25
        
        // Base distribution on motivationType
        switch motivationType.lowercased() {
        case "lose_weight", "weight_loss", "viktminskning":
            cardio = 40
            endurance = 30
            strength = 20
            hypertrophy = 10
        case "rehabilitation", "rehabilitering":
            strength = 30
            endurance = 40
            hypertrophy = 20
            cardio = 10
        case "better_health", "better_health":
            endurance = 35
            cardio = 35
            strength = 20
            hypertrophy = 10
        case "sport":
            // Adjust base focus based on specific sport
            switch specificSport.lowercased() {
            case "football":
                strength = 30; hypertrophy = 20; endurance = 25; cardio = 25
                focusTags = ["power", "conditioning"]
            case "floorball":
                strength = 25; hypertrophy = 20; endurance = 30; cardio = 25
                focusTags = ["conditioning", "power"]
            case "golf":
                strength = 40; hypertrophy = 10; endurance = 30; cardio = 20
                focusTags = ["skill", "mobility"]
            case "ice_hockey":
                strength = 40; hypertrophy = 20; endurance = 20; cardio = 20
                focusTags = ["power", "conditioning"]
            case "handball":
                strength = 35; hypertrophy = 20; endurance = 25; cardio = 20
                focusTags = ["power", "conditioning"]
            case "track_and_field":
                strength = 45; hypertrophy = 15; endurance = 25; cardio = 15
                focusTags = ["power", "skill"]
            case "cross_country_skiing":
                strength = 20; hypertrophy = 10; endurance = 45; cardio = 25
                focusTags = ["conditioning", "recovery"]
            case "martial_arts":
                strength = 35; hypertrophy = 15; endurance = 30; cardio = 20
                focusTags = ["power", "skill"]
            case "tennis":
                strength = 30; hypertrophy = 15; endurance = 30; cardio = 25
                focusTags = ["power", "skill"]
            case "basketball":
                strength = 35; hypertrophy = 20; endurance = 25; cardio = 20
                focusTags = ["power", "conditioning"]
            case "swimming":
                strength = 25; hypertrophy = 15; endurance = 35; cardio = 25
                focusTags = ["conditioning", "recovery"]
            case "badminton":
                strength = 25; hypertrophy = 15; endurance = 35; cardio = 25
                focusTags = ["power", "skill"]
            case "cycling":
                strength = 20; hypertrophy = 10; endurance = 45; cardio = 25
                focusTags = ["conditioning", "recovery"]
            case "padel":
                strength = 30; hypertrophy = 15; endurance = 30; cardio = 25
                focusTags = ["power", "skill"]
            case "alpine_skiing":
                strength = 40; hypertrophy = 20; endurance = 25; cardio = 15
                focusTags = ["power", "conditioning"]
            case "running":
                strength = 20; hypertrophy = 15; endurance = 40; cardio = 25
                focusTags = ["conditioning", "recovery"]
            default:
                strength = 35; endurance = 30; hypertrophy = 20; cardio = 15
                focusTags = []
            }
        case "build_muscle", "bygga_muskler", "hypertrofi", "fitness":
            // Focus on strength and hypertrophy for muscle building
            strength = 30
            hypertrophy = 30
            endurance = 25
            cardio = 15
        case "mobility", "become_more_flexible":
            // Focus on mobility, flexibility, and injury prevention
            strength = 25
            hypertrophy = 20
            endurance = 30
            cardio = 25
        default:
            // Default balanced distribution
            strength = 30
            hypertrophy = 30
            endurance = 25
            cardio = 15
        }
        
        // Adjust based on training level
        switch trainingLevel.lowercased() {
        case "beginner", "beginner":
            // For muscle building, keep higher strength/hypertrophy even for beginners
            if motivationType.lowercased() == "build_muscle" || motivationType.lowercased() == "bygga_muskler" || motivationType.lowercased() == "hypertrofi" || motivationType.lowercased() == "fitness" {
                // Smaller adjustment for muscle building - still prioritize strength/hypertrophy
                strength = max(25, strength - 5)
                hypertrophy = max(25, hypertrophy - 5)
                endurance += 5
                cardio += 5
            } else {
                // For other goals, larger adjustment for beginners
                strength = max(15, strength - 10)
                hypertrophy = max(10, hypertrophy - 10)
                endurance += 10
                cardio += 10
            }
        case "advanced", "mycket_van", "elite", "elit":
            strength += 10
            hypertrophy += 5
            endurance = max(15, endurance - 10)
            cardio = max(10, cardio - 5)
        default:
            // "intermediate", "van" - no adjustment
            break
        }
        
        // Normalize to 100%
        let total = strength + hypertrophy + endurance + cardio
        let normalizedStrength = Int((Double(strength) / Double(total)) * 100)
        let normalizedHypertrophy = Int((Double(hypertrophy) / Double(total)) * 100)
        let normalizedEndurance = Int((Double(endurance) / Double(total)) * 100)
        let normalizedCardio = Int((Double(cardio) / Double(total)) * 100)
        
        // Final check to ensure sum is exactly 100
        let sum = normalizedStrength + normalizedHypertrophy + normalizedEndurance + normalizedCardio
        let diff = 100 - sum
        
        goalStrength = normalizedStrength
        goalHypertrophy = normalizedHypertrophy
        goalEndurance = normalizedEndurance
        goalCardio = normalizedCardio + diff // Add difference to cardio
    }
    
    private func pollForCompletion(userId: String) async throws {
        // Simple polling simulation/implementation
        // In reality we should get jobId from completeOnboarding response.
        // APIService.completeOnboarding usually returns the response object.
        // Let's assume we can't easily get jobId without changing APIService signature if currently void/bool.
        // Checking APIService.swift (I viewed it earlier) would confirm this.
        // I recall completeOnboarding returns `OnboardingResponse`.
        
        // If we can't get jobId easily, we can just wait a fixed time or rely on SyncService.
        // But let's try to sync waiting.
        
        let maxRetries = 60
        for _ in 0..<maxRetries {
            try await Task.sleep(nanoseconds: 1_000_000_000) // 1s
            // Try to sync
            let syncService = SyncService.shared
             // We can try syncing templates. If new ones appear (updatedAt changed?), we are good.
             // This is loose logic.
             // Ideally we pass jobId. 
             // Let's assume the server is fast enough or user will see "Updating..." in dashboard.
             // But user asked for "new program generated".
             
             // To trigger the "Onboarding" style flow properly, we really should mirror that behavior.
             // But for now, let's just trigger the generation and sync, then close.
             // The backend generation runs in background.
             
             // Ensure we trigger a sync before closing so UI updates if possible.
             try? await syncService.syncProgramTemplates(userId: userId, modelContext: modelContext)
        }
    }
}

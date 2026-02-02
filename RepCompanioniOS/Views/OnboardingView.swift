import SwiftUI
import SwiftData
import AVFoundation
import HealthKit

struct OnboardingView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme
    
    @StateObject private var authService = AuthService.shared
    @StateObject private var languageService = AppLanguageService.shared
    
    // Step management
    @State private var currentStep = 1
    @State private var currentStepIcon = "heart.fill"
    
    // Program generation
    @State private var isGeneratingProgram = false
    @State private var generationError: String?
    @State private var showGenerationErrorAlert = false
    @State private var generationJobId: String?
    @State private var generationProgress = 0
    @State private var generationStatus = ""
    @State private var showGenerationProgress = false
    @State private var showTimeoutMessage = false
    @State private var programGenerationStartedEarly = false // Track if generation started from Equipment step
    @State private var programGenerationComplete = false // Track if generation finished while user was in flow
    
    // Onboarding data
    @State private var motivationType = ""
    @State private var specificSport = ""
    @State private var trainingLevel = ""
    @State private var age: Int?
    @State private var sex = ""
    @State private var bodyWeight: Int?
    @State private var height: Int?
    @State private var birthDay: Int?
    @State private var birthMonth: Int?
    @State private var birthYear: Int?
    @State private var healthDataFetched = false
    @State private var goalStrength = 25
    @State private var goalHypertrophy = 25
    @State private var goalEndurance = 25
    @State private var goalCardio = 25
    @State private var focusTags: [String] = []
    @State private var selectedIntent: String? = nil
    @State private var goalsCalculated = false // Track if goals have been auto-calculated
    @State private var sessionsPerWeek = 3
    @State private var sessionDuration = 60
    @State private var oneRmBench: Int?
    @State private var oneRmOhp: Int?
    @State private var oneRmDeadlift: Int?
    @State private var oneRmSquat: Int?
    @State private var oneRmLatpull: Int?
    @State private var oneRmCalculated = false // Track if 1RM values have been auto-calculated
    @State private var selectedEquipment: [String] = []
    
    // Gym details
    @State private var gymName: String = String(localized: "My Gym")
    
    @State private var customSportName: String = ""
    
    @StateObject private var locationService = LocationService.shared
    @State private var showNearbyGyms = false

    @State private var gymAddress: String = ""
    @State private var gymIsPublic: Bool = false
    @State private var selectedNearbyGymId: String? = nil
    @State private var searchRadius: Double = 50.0
    @State private var selectedNearbyGym: NearbyGym? = nil
    @State private var showUnverifiedGymAlert = false
    @State private var pendingUnverifiedGym: NearbyGym? = nil
    
    @State private var selectedTheme = "Main" // Default theme
    @State private var selectedColorScheme: String = "auto"
    @State private var dailyStepGoal: Int = 10000 // Default step goal
    @AppStorage("savedColorScheme") private var savedColorScheme: String = "auto"
    
    // Validation alerts
    @State private var showValueValidationAlert = false
    @State private var valueValidationMessage = ""
    @State private var lastValidatedAge: Int? = nil
    @State private var lastValidatedWeight: Int? = nil
    @State private var lastValidatedHeight: Int? = nil
    @State private var displayedBMI: Double? = nil // BMI value to display (only updated when focus leaves fields)
    
    // Focus state for input fields
    @FocusState private var focusedField: Field?
    enum Field {
        case age
        case weight
        case height
        case gymName
        case gymAddress
    }
    
    // Gym tracking
    @State private var lastCreatedGymId: String? = nil
    
    // Equipment catalog
    @State private var availableEquipment: [EquipmentCatalog] = []
    @State private var isLoadingEquipment = false
    @State private var showCamera = false
    
    private var totalSteps: Int {
        // Total possible steps in the switch statement is 12.
        // Even if some steps are skipped (like sport selection), 
        // they occupy a slot in the currentStep index.
        12
    }
    
    private var progressPercentage: Double {
        // Subtract 0.05 or similar if you want it to never look "empty" at step 1,
        // or just use 1/totalSteps as minimum.
        Double(currentStep) / Double(totalSteps)
    }
    
    private var canProceedToNextStep: Bool {
        switch currentStep {
        case 1:
            return !motivationType.isEmpty
        case 2:
            // Sport selection (only for sport motivation)
            if motivationType == "sport" {
                return !specificSport.isEmpty
            }
            return true // Should be skipped if not sport
        case 3:
            return true // Health Data (Optional)
        case 4:
            return age != nil && sex != "" && bodyWeight != nil && height != nil && birthDay != nil && birthMonth != nil && birthYear != nil
        case 5:
            return goalStrength + goalHypertrophy + goalEndurance + goalCardio == 100
        case 6:
            return !trainingLevel.isEmpty // Level is now mandatory for everyone
        case 7:
            return true // 1RM (Optional/Auto)
        case 8:
            return sessionsPerWeek > 0 && sessionDuration > 0
        case 9:
            return !gymName.isEmpty || selectedNearbyGymId != nil
        case 10:
            return !selectedEquipment.isEmpty
        case 11:
            return true // Step Goal
        case 12:
            return true // Theme
        default:
            return false
        }
    }
    
    var body: some View {
        NavigationView {
            ZStack {
                Color.appBackground(for: colorScheme).ignoresSafeArea()
                
                VStack(spacing: 0) {
                    // Progress bar
                    GeometryReader { geometry in
                        ZStack(alignment: .leading) {
                            Rectangle()
                                .fill(Color.textSecondary(for: colorScheme).opacity(0.2))
                                .frame(height: 4)
                            
                            Rectangle()
                                .fill(Color.themeGradient(theme: selectedTheme, colorScheme: colorScheme))
                                .frame(width: geometry.size.width * progressPercentage, height: 4)
                        }
                    }
                    .frame(height: 4)
                    .padding(.horizontal)
                    .padding(.top, 8)
                    
                    // Step content
                    ScrollView {
                        stepContent
                            .padding()
                    }
                    
                    .padding()
                
                
                // Navigation buttons
                if true {
                    HStack {
                        if currentStep > 1 {
                            Button(action: goToPreviousStep) {
                                HStack {
                                    Image(systemName: "chevron.left")
                                    Text(String(localized: "Back"))
                                }
                                .foregroundColor(Color.textPrimary(for: colorScheme))
                                .padding()
                                .frame(maxWidth: .infinity)
                                .background(Color.cardBackground(for: colorScheme))
                                .cornerRadius(12)
                            }
                        }
                        
                        Button(action: {
                            // Step Goal step (step 9) - show progress and complete onboarding when "Finish" is clicked
                            if currentStep == 9 && (motivationType == "sport" || currentStep == totalSteps) {
                                // This is the last step (sport mode) or Step Goal is last, complete onboarding
                                completeOnboarding()
                            } else if currentStep == totalSteps {
                                // Last step (Theme in non-sport mode), complete onboarding
                                completeOnboarding()
                            } else {
                                goToNextStep()
                            }
                        }) {
                            HStack {
                                // Show "Finish" on Step Goal step if it's the last step, or on actual last step
                                let isFinishStep = (currentStep == 9 && (motivationType == "sport" || currentStep == totalSteps)) || currentStep == totalSteps
                                Text(isFinishStep ? String(localized: "Finish") : String(localized: "Continue"))
                                if !isFinishStep {
                                    Image(systemName: "chevron.right")
                                }
                            }
                            .foregroundColor(.white)
                            .padding()
                            .frame(maxWidth: .infinity)
                            .background(
                                Group {
                                    if canProceedToNextStep {
                                        Color.themeGradient(theme: selectedTheme, colorScheme: colorScheme)
                                    } else {
                                        Color.textSecondary(for: colorScheme).opacity(0.3)
                                    }
                                }
                            )
                            .cornerRadius(12)
                        }
                        .disabled(!canProceedToNextStep)
                    }
                    .padding()
                }
            }
                
                // Generation progress overlay
                if showGenerationProgress {
                    GenerationProgressView(
                        progress: generationProgress,
                        status: generationStatus,
                        iconName: "", // Not used anymore - animation rotates through steps
                        onDismiss: {
                            showGenerationProgress = false
                        }
                    )
                }
                
                // Timeout message overlay
                if showTimeoutMessage {
                    TimeoutMessageView(onDismiss: {
                        showTimeoutMessage = false
                    })
                }
            }
            .navigationBarHidden(true)
            .alert(String(localized: "Program generation failed"), isPresented: $showGenerationErrorAlert) {
                Button(String(localized: "Try again")) {
                    generationError = nil
                    showGenerationErrorAlert = false
                    // Retry program generation
                    completeOnboarding()
                }
                Button(String(localized: "Continue without program"), role: .cancel) {
                    generationError = nil
                    showGenerationErrorAlert = false
                    // Continue to next step or finish if at end
                    if currentStep >= totalSteps {
                        finalizeOnboarding()
                    } else {
                        goToNextStep()
                    }
                }
            } message: {
                if let error = generationError {
                    Text(String(format: String(localized: "Program generation did not succeed at this time. %@\n\nDo you want to try again or continue without a program?"), error))
                } else {
                    Text(String(localized: "Program generation did not succeed at this time.\n\nDo you want to try again or continue without a program?"))
                }
            }
            .alert(String(localized: "Check value"), isPresented: $showValueValidationAlert) {
                Button(String(localized: "OK")) {
                    showValueValidationAlert = false
                }
            } message: {
                Text(LocalizedStringKey(valueValidationMessage))
            }
            .sheet(isPresented: $showCamera) {
                EquipmentCameraView { equipment in
                    selectedEquipment.append(contentsOf: equipment)
                    showCamera = false
                }
            }
            .task {
                // Equipment catalog sync only - no auto-login
                syncEquipmentCatalogEarly()
            }
            .onChange(of: motivationType) { _, newValue in
                // Recalculate preset goals when motivation type changes
                 if !newValue.isEmpty {
                     // Recalculate based on new level
                     goalsCalculated = false
                     calculatePresetGoals()
                }
            }
            .onChange(of: programGenerationComplete) { _, newValue in
                if newValue && showGenerationProgress {
                    print("[Onboarding] ✅ Background generation completed while waiting, finalizing...")
                    // Add a small delay for smoother UX
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                        finalizeOnboarding()
                    }
                }
            }
            .onChange(of: trainingLevel) { _, newValue in
                // Recalculate preset goals when training level changes
                if !newValue.isEmpty && !motivationType.isEmpty {
                    goalsCalculated = false // Reset to allow recalculation
                    calculatePresetGoals()
                }
            }
        }
    }
    
    // MARK: - Step Content
    
    @ViewBuilder
    private var stepContent: some View {
        switch currentStep {
        case 1:
            motivationStep
        case 2:
            if motivationType == "sport" {
                sportSelectionStep
            } else {
                EmptyView() // Should be skipped
            }
        case 3:
            healthDataStep
        case 4:
            personalInfoStep
        case 5:
            trainingGoalsStep
        case 6:
            trainingLevelStep
        case 7:
            oneRmStep
        case 8:
            trainingFrequencyStep
        case 9:
            gymDetailsStep
        case 10:
            equipmentStep
        case 11:
            stepGoalStep
        case 12:
            if motivationType == "sport" {
                EmptyView() // Skipped for sport
            } else {
                themeStep
            }
        default:
            EmptyView()
        }
    }
    
    // MARK: - Step 1: Motivation
    
    private var motivationStep: some View {
        VStack(spacing: 24) {
            Text(String(localized: "What is your primary training goal?"))
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(Color.textPrimary(for: colorScheme))
                .multilineTextAlignment(.center)
            
            VStack(spacing: 16) {
                MotivationOption(
                    title: String(localized: "Lose weight"),
                    description: String(localized: "Lose weight and improve your health."),
                    isSelected: motivationType == "lose_weight",
                    colorScheme: colorScheme,
                    selectedTheme: selectedTheme,
                    action: {
                        motivationType = "lose_weight"
                        calculatePresetGoals()
                    }
                )
                
                MotivationOption(
                    title: String(localized: "Rehabilitation"),
                    description: String(localized: "Recover from injury or illness."),
                    isSelected: motivationType == "rehabilitation",
                    colorScheme: colorScheme,
                    selectedTheme: selectedTheme,
                    action: {
                        motivationType = "rehabilitation"
                        calculatePresetGoals()
                    }
                )
                
                MotivationOption(
                    title: String(localized: "Better health"),
                    description: String(localized: "Improve stamina, fitness and energy."),
                    isSelected: motivationType == "better_health",
                    colorScheme: colorScheme,
                    selectedTheme: selectedTheme,
                    action: {
                        motivationType = "better_health"
                        calculatePresetGoals()
                    }
                )
                
                MotivationOption(
                    title: String(localized: "Build muscle"),
                    description: String(localized: "Build muscle mass and get stronger."),
                    isSelected: motivationType == "build_muscle",
                    colorScheme: colorScheme,
                    selectedTheme: selectedTheme,
                    action: {
                        motivationType = "build_muscle"
                        calculatePresetGoals()
                    }
                )
                
                MotivationOption(
                    title: String(localized: "Sports performance"),
                    description: String(localized: "Train to perform better in your sport."),
                    isSelected: motivationType == "sport",
                    colorScheme: colorScheme,
                    selectedTheme: selectedTheme,
                    action: {
                        motivationType = "sport"
                        calculatePresetGoals()
                    }
                )
                
                MotivationOption(
                    title: String(localized: "Mobility"),
                    description: String(localized: "Increase mobility, reduce stiffness and prevent injury."),
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
    
    // MARK: - Step 2: Sport Selection (if sport)
    
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
                        VStack(spacing: 12) {
                            HStack {
                                Text(LocalizationService.localizeSpecificSport(sport))
                                    .foregroundColor(Color.textPrimary(for: colorScheme))
                                Spacer()
                                if specificSport == sport {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundColor(Color.themePrimaryColor(theme: selectedTheme, colorScheme: colorScheme))
                                }
                            }
                            
                            // Show custom input field if "Other" is selected
                            if sport == "other" && specificSport == "other" {
                                Divider()
                                
                                VStack(alignment: .leading, spacing: 8) {
                                    Text(String(localized: "Enter your sport"))
                                        .font(.caption)
                                        .foregroundColor(Color.textSecondary(for: colorScheme))
                                    
                                    TextField(String(localized: "e.g. Rowing, Boxing..."), text: $customSportName)
                                        .padding()
                                        .background(Color.appBackground(for: colorScheme))
                                        .cornerRadius(8)
                                        .submitLabel(.done)
                                        .onSubmit {
                                            if !customSportName.isEmpty {
                                                calculatePresetGoals()
                                            }
                                        }
                                        .onChange(of: customSportName) { _, _ in
                                            // Debounce could be added here, but for now we rely on submit or "Next"
                                        }
                                }
                                .padding(.top, 4)
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
    
    // MARK: - Step 2/3: Training Level
    
    private var trainingLevelStep: some View {
        VStack(spacing: 24) {
            Text(String(localized: "What is your training level?"))
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(Color.textPrimary(for: colorScheme))
                .multilineTextAlignment(.center)
            
            Text(String(localized: "This helps us adapt the program"))
                .font(.subheadline)
                .foregroundColor(Color.textSecondary(for: colorScheme))
                .multilineTextAlignment(.center)
            
            VStack(spacing: 16) {
                LevelOption(
                    title: String(localized: "Beginner"),
                    description: String(localized: "New to training or returning after a long break"),
                    isSelected: trainingLevel == "beginner", // Keeping current internal value for now but standardizing title/desc
                    colorScheme: colorScheme,
                    selectedTheme: selectedTheme,
                    action: { 
                        trainingLevel = "beginner"
                        calculatePresetGoals()
                    }
                )
                
                LevelOption(
                    title: String(localized: "Intermediate"),
                    description: String(localized: "Trained regularly for 6+ months"),
                    isSelected: trainingLevel == "van",
                    colorScheme: colorScheme,
                    selectedTheme: selectedTheme,
                    action: { 
                        trainingLevel = "van"
                        calculatePresetGoals()
                    }
                )
                
                LevelOption(
                    title: String(localized: "Advanced"),
                    description: String(localized: "Trained consistently for 2+ years"),
                    isSelected: trainingLevel == "mycket_van",
                    colorScheme: colorScheme,
                    selectedTheme: selectedTheme,
                    action: { 
                        trainingLevel = "mycket_van"
                        calculatePresetGoals()
                    }
                )
                
                LevelOption(
                    title: String(localized: "Elite"),
                    description: String(localized: "Professional or competitive athlete"),
                    isSelected: trainingLevel == "elit",
                    colorScheme: colorScheme,
                    selectedTheme: selectedTheme,
                    action: { 
                        trainingLevel = "elit"
                        calculatePresetGoals()
                    }
                )
            }
        }
    }
    
    // MARK: - Step 3: Health Data
    
    private var healthDataStep: some View {
        VStack(spacing: 24) {
            Text(String(localized: "Connect health data"))
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(Color.textPrimary(for: colorScheme))
                .multilineTextAlignment(.center)
            
            Text(String(localized: "We can import your weight, height and age from Apple Health"))
                .font(.subheadline)
                .foregroundColor(Color.textSecondary(for: colorScheme))
                .multilineTextAlignment(.center)
            
            Button(action: fetchHealthData) {
                HStack {
                    Image(systemName: healthDataFetched ? "checkmark.circle.fill" : "heart.fill")
                    Text(healthDataFetched ? String(localized: "Health data imported") : String(localized: "Import from Apple Health"))
                }
                .foregroundColor(.white)
                .padding()
                .frame(maxWidth: .infinity)
                .background(
                    Group {
                        if healthDataFetched {
                            Color.green
                        } else {
                            Color.themeGradient(theme: selectedTheme, colorScheme: colorScheme)
                        }
                    }
                )
                .cornerRadius(12)
            }
            
            if healthDataFetched {
                if bodyWeight != nil || height != nil {
                    Text(String(localized: "Health data imported. You can manually edit the values in the next step"))
                        .font(.caption)
                        .foregroundColor(Color.textSecondary(for: colorScheme))
                } else {
                    Text(String(localized: "No health data found. You can manually fill in the values in the next step"))
                        .font(.caption)
                        .foregroundColor(Color.textSecondary(for: colorScheme))
                }
            }
        }
    }
    
    // MARK: - Step 4: Personal Info
    
    private var personalInfoStep: some View {
        VStack(spacing: 12) {
            Text(String(localized: "Personal Information"))
                .font(.title3)
                .fontWeight(.bold)
                .foregroundColor(Color.textPrimary(for: colorScheme))
                .multilineTextAlignment(.center)
            
            Text(String(localized: "We need some information about you to adapt your training"))
                .font(.subheadline)
                .foregroundColor(Color.textSecondary(for: colorScheme))
                .multilineTextAlignment(.center)
                .padding(.bottom, 4)
            
            VStack(spacing: 10) {
                // 1. Gender
                VStack(alignment: .leading, spacing: 6) {
                    Text(String(localized: "Gender"))
                        .font(.caption)
                        .foregroundColor(Color.textSecondary(for: colorScheme))
                    HStack(spacing: 12) {
                        Button(action: {
                            sex = "male"
                        }) {
                            Text(String(localized: "Male"))
                                .font(.subheadline)
                                .foregroundColor(sex == "male" ? .white : Color.textPrimary(for: colorScheme))
                                .padding(.vertical, 10)
                                .frame(maxWidth: .infinity)
                                .background(
                                    Group {
                                        if sex == "male" {
                                            Color.themeGradient(theme: selectedTheme, colorScheme: colorScheme)
                                        } else {
                                            Color.cardBackground(for: colorScheme)
                                        }
                                    }
                                )
                                .cornerRadius(10)
                        }
                        
                        Button(action: {
                            sex = "female"
                        }) {
                            Text(String(localized: "Female"))
                                .font(.subheadline)
                                .foregroundColor(sex == "female" ? .white : Color.textPrimary(for: colorScheme))
                                .padding(.vertical, 10)
                                .frame(maxWidth: .infinity)
                                .background(
                                    Group {
                                        if sex == "female" {
                                            Color.themeGradient(theme: selectedTheme, colorScheme: colorScheme)
                                        } else {
                                            Color.cardBackground(for: colorScheme)
                                        }
                                    }
                                )
                                .cornerRadius(10)
                        }
                    }
                }
                
                // 2. Date of Birth
                VStack(alignment: .leading, spacing: 6) {
                    Text(String(localized: "Date of Birth"))
                        .font(.caption)
                        .foregroundColor(Color.textSecondary(for: colorScheme))
                    HStack(spacing: 8) {
                        ScrollablePicker(
                            label: String(localized: "Day"),
                            value: $birthDay,
                            range: 1...31,
                            colorScheme: colorScheme,
                            selectedTheme: selectedTheme
                        )
                        .frame(maxWidth: .infinity)
                        
                        ScrollablePicker(
                            label: String(localized: "Month"),
                            value: $birthMonth,
                            range: 1...12,
                            colorScheme: colorScheme,
                            selectedTheme: selectedTheme,
                            displayFormatter: { month in
                                monthName(for: month)
                            }
                        )
                        .frame(maxWidth: .infinity)
                        
                        ScrollablePicker(
                            label: String(localized: "Year"),
                            value: $birthYear,
                            range: 1920...2010,
                            colorScheme: colorScheme,
                            selectedTheme: selectedTheme
                        )
                        .frame(maxWidth: .infinity)
                    }
                    .onChange(of: birthDay) { _, _ in
                        calculateAgeFromBirthDate()
                    }
                    .onChange(of: birthMonth) { _, _ in
                        calculateAgeFromBirthDate()
                    }
                    .onChange(of: birthYear) { _, _ in
                        calculateAgeFromBirthDate()
                    }
                }
                
                // 3. Height
                ScrollablePicker(
                    label: String(localized: "Height"),
                    value: $height,
                    range: 100...250,
                    unit: "cm",
                    colorScheme: colorScheme,
                    selectedTheme: selectedTheme
                )
                .onChange(of: height) { _, _ in
                    updateBMI()
                }
                
                // 4. Weight
                ScrollablePicker(
                    label: String(localized: "Weight"),
                    value: $bodyWeight,
                    range: 30...200,
                    unit: "kg",
                    colorScheme: colorScheme,
                    selectedTheme: selectedTheme
                )
                .onChange(of: bodyWeight) { _, _ in
                    updateBMI()
                }
                
                // 5. Summary
                if !summaryText.isEmpty {
                    Text(summaryText)
                        .font(.subheadline)
                        .foregroundColor(Color.textPrimary(for: colorScheme))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 10)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(
                            RoundedRectangle(cornerRadius: 10)
                                .fill(Color.themePrimaryColor(theme: selectedTheme, colorScheme: colorScheme).opacity(0.15))
                        )
                }
            }
            
            Spacer()
        }
        .onAppear {
            applyDefaultPersonalInfoIfNeeded(for: sex.isEmpty ? "male" : sex)
        }
        .onChange(of: sex) { _, newValue in
            applyDefaultPersonalInfoIfNeeded(for: newValue)
        }
    }
    
    private func calculateAgeFromBirthDate() {
        guard let day = birthDay, let month = birthMonth, let year = birthYear else {
            return
        }
        
        let calendar = Calendar.current
        var dateComponents = DateComponents()
        dateComponents.year = year
        dateComponents.month = month
        dateComponents.day = day
        
        guard let birthDate = calendar.date(from: dateComponents) else {
            return
        }
        
        let ageComponents = calendar.dateComponents([.year], from: birthDate, to: Date())
        if let calculatedAge = ageComponents.year {
            age = calculatedAge
        }
    }
    
    // MARK: - BMI Calculation
    
    private func updateBMI() {
        guard let weight = bodyWeight, let height = height,
              weight > 0, height > 0 else {
            displayedBMI = nil
            return
        }
        let heightInMeters = Double(height) / 100.0
        displayedBMI = Double(weight) / (heightInMeters * heightInMeters)
    }
    
    private func bmiCategory(for bmi: Double) -> String? {
        if bmi < 18.5 {
            return "Underweight"
        } else if bmi < 25.0 {
            return "Normal weight"
        } else if bmi < 30.0 {
            return "Overweight"
        } else {
            return "Obese"
        }
    }
    
    private func bmiCategoryColor(for bmi: Double) -> Color {
        if bmi < 18.5 {
            return .blue
        } else if bmi < 25.0 {
            return .green
        } else if bmi < 30.0 {
            return .orange
        } else {
            return .red
        }
    }
    
    // MARK: - Helper Functions
    
    private func applyDefaultPersonalInfoIfNeeded(for selectedSex: String) {
        // Choose sensible defaults for height/weight based on sex
        let normalizedSex = selectedSex.lowercased()
        let defaultHeight: Int
        let defaultWeight: Int
        
        switch normalizedSex {
        case "female", "kvinna":
            defaultHeight = 165
            defaultWeight = 65
        case "male", "man":
            defaultHeight = 175
            defaultWeight = 75
        default:
            defaultHeight = 170
            defaultWeight = 70
        }
        
        // If DOB is still at the initial minimum year, move it to 1 Jan 2000
        if birthYear == nil || birthYear == 1920 {
            birthYear = 2000
            birthMonth = 1
            birthDay = 1
        }
        
        // Height/weight: only override when still unset or at minimum picker values
        if height == nil || height == 100 {
            height = defaultHeight
        }
        if bodyWeight == nil || bodyWeight == 30 {
            bodyWeight = defaultWeight
        }
        
        // Update derived fields
        calculateAgeFromBirthDate()
        updateBMI()
    }
    
    private func monthName(for month: Int) -> String {
        let months = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ]
        guard month >= 1 && month <= 12 else { return "" }
        return String(localized: LocalizedStringResource(stringLiteral: months[month - 1]))
    }
    
    private var summaryText: String {
        var parts: [String] = []
        
        // Start with gender
        if !sex.isEmpty {
            let localizedSex = (sex == "male" || sex == "man") ? String(localized: "Male") : String(localized: "Female")
            parts.append(localizedSex)
        }
        
        // Add birth date with "born"
        if let day = birthDay, let month = birthMonth, let year = birthYear {
            let bornStr = String(localized: "born")
            parts.append("\(bornStr) \(day) \(monthName(for: month)) \(year)")
        }
        
        // Add height and weight
        if let heightValue = height {
            parts.append("\(heightValue) cm")
        }
        
        if let weightValue = bodyWeight {
            parts.append("\(weightValue) kg")
        }
        
        return parts.joined(separator: ", ")
    }
    
    // MARK: - Validation Functions
    
    private func validateAge() {
        guard let ageValue = age else { return }
        
        // Only show alert if this is a new value (not the same as last validated)
        let shouldShowAlert = lastValidatedAge != ageValue
        
        if ageValue > 110 {
            // Hard limit: 10% over max
            age = 110
            if shouldShowAlert {
                valueValidationMessage = String(localized: "Age exceeds 110 years. Please check your value.")
                showValueValidationAlert = true
                lastValidatedAge = 110
            }
        } else if ageValue < 9 {
            // Hard limit: 10% under min
            age = 9
            if shouldShowAlert {
                valueValidationMessage = String(localized: "Age is below 9 years. Please check your value.")
                showValueValidationAlert = true
                lastValidatedAge = 9
            }
        } else if ageValue > 100 {
            // Over normal max, but within 10% tolerance - show warning, don't change value
            if shouldShowAlert {
                valueValidationMessage = String(localized: "Entered age (\(ageValue) years) is higher than normal. Please check your value.")
                showValueValidationAlert = true
                lastValidatedAge = ageValue
            }
        } else if ageValue < 10 {
            // Under normal min, but within 10% tolerance - show warning, don't change value
            if shouldShowAlert {
                valueValidationMessage = String(localized: "Entered age (\(ageValue) years) is lower than normal. Please check your value.")
                showValueValidationAlert = true
                lastValidatedAge = ageValue
            }
        } else {
            // Within normal range - clear last validated
            lastValidatedAge = nil
        }
    }
    
    private func validateWeight() {
        guard let weight = bodyWeight else { return }
        
        // Only show alert if this is a new value (not the same as last validated)
        let shouldShowAlert = lastValidatedWeight != weight
        
        if weight > 330 {
            // Hard limit: 10% over max
            bodyWeight = 330
            if shouldShowAlert {
                valueValidationMessage = String(localized: "Weight exceeds 330 kg. Please check your value.")
                showValueValidationAlert = true
                lastValidatedWeight = 330
            }
        } else if weight < 18 {
            // Hard limit: 10% under min
            bodyWeight = 18
            if shouldShowAlert {
                valueValidationMessage = String(localized: "Weight is below 18 kg. Please check your value.")
                showValueValidationAlert = true
                lastValidatedWeight = 18
            }
        } else if weight > 300 {
            // Over normal max, but within 10% tolerance - show warning, don't change value
            if shouldShowAlert {
                valueValidationMessage = String(localized: "Entered weight (\(weight) kg) is higher than normal. Please check your value.")
                showValueValidationAlert = true
                lastValidatedWeight = weight
            }
        } else if weight < 20 {
            // Under normal min, but within 10% tolerance - show warning, don't change value
            if shouldShowAlert {
                valueValidationMessage = String(localized: "Entered weight (\(weight) kg) is lower than normal. Please check your value.")
                showValueValidationAlert = true
                lastValidatedWeight = weight
            }
        } else {
            // Within normal range - clear last validated
            lastValidatedWeight = nil
        }
    }
    
    private func validateHeight() {
        guard let heightValue = height else { return }
        
        // Only show alert if this is a new value (not the same as last validated)
        let shouldShowAlert = lastValidatedHeight != heightValue
        
        if heightValue > 253 {
            // Hard limit: 10% over max
            height = 253
            if shouldShowAlert {
                valueValidationMessage = String(localized: "Height exceeds 253 cm. Please check your value.")
                showValueValidationAlert = true
                lastValidatedHeight = 253
            }
        } else if heightValue < 90 {
            // Hard limit: 10% under min
            height = 90
            if shouldShowAlert {
                valueValidationMessage = String(localized: "Height is below 90 cm. Please check your value.")
                showValueValidationAlert = true
                lastValidatedHeight = 90
            }
        } else if heightValue > 230 {
            // Over normal max, but within 10% tolerance - show warning, don't change value
            if shouldShowAlert {
                valueValidationMessage = String(localized: "Entered height (\(heightValue) cm) is higher than normal. Please check your value.")
                showValueValidationAlert = true
                lastValidatedHeight = heightValue
            }
        } else if heightValue < 100 {
            // Under normal min, but within 10% tolerance - show warning, don't change value
            if shouldShowAlert {
                valueValidationMessage = String(localized: "Entered height (\(heightValue) cm) is lower than normal. Please check your value.")
                showValueValidationAlert = true
                lastValidatedHeight = heightValue
            }
        } else {
            // Within normal range - clear last validated
            lastValidatedHeight = nil
        }
    }
    
    // MARK: - Step 5: Training Goals
    
    private var trainingGoalsStep: some View {
        VStack(spacing: 24) {
            Text(String(localized: "Training Goals"))
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(Color.textPrimary(for: colorScheme))
                .multilineTextAlignment(.center)
            
            Text(String(localized: "Distribute 100% between your training goals"))
                .font(.subheadline)
                .foregroundColor(Color.textSecondary(for: colorScheme))
                .multilineTextAlignment(.center)
            
            VStack(spacing: 20) {
                GoalSlider(
                    title: String(localized: "Strength"),
                    value: Binding(
                        get: { goalStrength },
                        set: { newValue in
                            adjustGoals(changed: .statusStrength, to: newValue)
                        }
                    ),
                    colorScheme: colorScheme,
                    selectedTheme: selectedTheme
                )
                
                GoalSlider(
                    title: String(localized: "Hypertrophy"),
                    value: Binding(
                        get: { goalHypertrophy },
                        set: { newValue in
                            adjustGoals(changed: .statusHypertrophy, to: newValue)
                        }
                    ),
                    colorScheme: colorScheme,
                    selectedTheme: selectedTheme
                )
                
                GoalSlider(
                    title: String(localized: "Endurance"),
                    value: Binding(
                        get: { goalEndurance },
                        set: { newValue in
                            adjustGoals(changed: .statusEndurance, to: newValue)
                        }
                    ),
                    colorScheme: colorScheme,
                    selectedTheme: selectedTheme
                )
                
                GoalSlider(
                    title: String(localized: "Cardio"),
                    value: Binding(
                        get: { goalCardio },
                        set: { newValue in
                            adjustGoals(changed: .statusCardio, to: newValue)
                        }
                    ),
                    colorScheme: colorScheme,
                    selectedTheme: selectedTheme
                )
            }
            
            let total = goalStrength + goalHypertrophy + goalEndurance + goalCardio
            Text(String(localized: "Total: \(total)%"))
                .font(.caption)
                .foregroundColor(
                    goalStrength + goalHypertrophy + goalEndurance + goalCardio == 100
                        ? Color.green
                        : Color.red
                )
            
            Divider()
                .padding(.vertical, 8)
            
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text(String(localized: "Extra Focus"))
                        .font(.headline)
                        .foregroundColor(Color.textPrimary(for: colorScheme))
                    
                    Spacer()
                    
                    Text(String(localized: "\(focusTags.count)/3"))
                        .font(.caption)
                        .foregroundColor(Color.textSecondary(for: colorScheme))
                }
                
                Text(String(localized: "Tags that refine your programming (max 3)"))
                    .font(.caption)
                    .foregroundColor(Color.textSecondary(for: colorScheme))
                
                let tags = ["Explosiveness", "Technique", "Mobility", "Rehab/Recovery", "Conditioning/Metcon"]
                
                FocusFlowLayout(spacing: 8) {
                    ForEach(tags, id: \.self) { tag in
                        FocusTagChip(
                            title: LocalizationService.localizeFocusTag(tag),
                            isSelected: focusTags.contains(tag),
                            colorScheme: colorScheme,
                            selectedTheme: selectedTheme,
                            action: {
                                if focusTags.contains(tag) {
                                    focusTags.removeAll(where: { $0 == tag })
                                } else if focusTags.count < 3 {
                                    focusTags.append(tag)
                                }
                            }
                        )
                    }
                }
            }
        }
        .onAppear {
            // Auto-calculate preset goals if not already calculated and we have required data
            if !goalsCalculated && !motivationType.isEmpty && !trainingLevel.isEmpty {
                calculatePresetGoals()
            }
            
            // 1RM calculation should already be started when user clicked "Continue" on Personal Info step
            // Values should be ready by the time user reaches 1RM step
            if oneRmCalculated {
                print("[Onboarding] ✅ 1RM values already calculated and ready")
            }
        }
    }
    
    // MARK: - Step 6: Training Frequency
    
    private var trainingFrequencyStep: some View {
        ScrollView {
            VStack(spacing: 24) {
                Text(String(localized: "Training Frequency"))
                    .font(.title2)
                    .fontWeight(.bold)
                    .foregroundColor(Color.textPrimary(for: colorScheme))
                    .multilineTextAlignment(.center)
                
                VStack(spacing: 32) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(String(localized: "Sessions per week: \(sessionsPerWeek)"))
                            .font(.headline)
                            .foregroundColor(Color.textPrimary(for: colorScheme))
                        
                        Slider(value: Binding(
                            get: { Double(sessionsPerWeek) },
                            set: { sessionsPerWeek = Int($0) }
                        ), in: 1...7, step: 1)
                        .tint(Color.themePrimaryColor(theme: selectedTheme, colorScheme: colorScheme))
                    }
                    
                    VStack(alignment: .leading, spacing: 8) {
                        Text(String(localized: "Session duration: \(sessionDuration) minutes"))
                            .font(.headline)
                            .foregroundColor(Color.textPrimary(for: colorScheme))
                        
                        Slider(value: Binding(
                            get: { Double(sessionDuration) },
                            set: { sessionDuration = Int($0) }
                        ), in: 15...120, step: 15)
                        .tint(Color.themePrimaryColor(theme: selectedTheme, colorScheme: colorScheme))
                    }
                }
                .padding()
                .background(Color.cardBackground(for: colorScheme))
                .cornerRadius(16)
                
                Spacer(minLength: 40)
            }
            .padding()
        }
    }
    
    // MARK: - Step 7: 1RM
    
    private var oneRmStep: some View {
        VStack(spacing: 24) {
            Text(String(localized: "One Rep Max (1RM)"))
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(Color.textPrimary(for: colorScheme))
                .multilineTextAlignment(.center)
            
            Text(String(localized: "Optional - helps us adapt weights"))
                .font(.subheadline)
                .foregroundColor(Color.textSecondary(for: colorScheme))
                .multilineTextAlignment(.center)
            
            VStack(spacing: 16) {
                OneRmField(
                    title: String(localized: "Bench Press"),
                    value: Binding(
                        get: { oneRmBench },
                        set: { oneRmBench = $0 }
                    ),
                    colorScheme: colorScheme
                )
                
                OneRmField(
                    title: String(localized: "Overhead Press"),
                    value: Binding(
                        get: { oneRmOhp },
                        set: { oneRmOhp = $0 }
                    ),
                    colorScheme: colorScheme
                )
                
                OneRmField(
                    title: String(localized: "Deadlift"),
                    value: Binding(
                        get: { oneRmDeadlift },
                        set: { oneRmDeadlift = $0 }
                    ),
                    colorScheme: colorScheme
                )
                
                OneRmField(
                    title: String(localized: "Squat"),
                    value: Binding(
                        get: { oneRmSquat },
                        set: { oneRmSquat = $0 }
                    ),
                    colorScheme: colorScheme
                )
                
                OneRmField(
                    title: String(localized: "Lat Pulldown"),
                    value: Binding(
                        get: { oneRmLatpull },
                        set: { oneRmLatpull = $0 }
                    ),
                    colorScheme: colorScheme
                )
            }
            
            Text(String(localized: "The values above are suggestions based on your profile. You can change them if you know your exact 1RM values."))
                .font(.caption)
                .foregroundColor(Color.textSecondary(for: colorScheme))
                .multilineTextAlignment(.center)
                .padding(.top, 8)
        }
        .onAppear {
            print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
            print("[Onboarding] 💪 1RM STEP - onAppear")
            print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
            print("[Onboarding] 📊 Current 1RM State:")
            print("  • oneRmCalculated: \(oneRmCalculated)")
            print("  • oneRmBench: \(oneRmBench?.description ?? "nil") kg")
            print("  • oneRmOhp: \(oneRmOhp?.description ?? "nil") kg")
            print("  • oneRmDeadlift: \(oneRmDeadlift?.description ?? "nil") kg")
            print("  • oneRmSquat: \(oneRmSquat?.description ?? "nil") kg")
            print("  • oneRmLatpull: \(oneRmLatpull?.description ?? "nil") kg")
            print("[Onboarding] 📊 Required Data:")
            print("  • age: \(age?.description ?? "nil")")
            print("  • bodyWeight: \(bodyWeight?.description ?? "nil") kg")
            print("  • height: \(height?.description ?? "nil") cm")
            print("  • sex: \(sex.isEmpty ? "empty" : sex)")
            print("  • trainingLevel: \(trainingLevel)")
            print("  • motivationType: \(motivationType)")
            print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
            
            // 1RM values should already be calculated from Training Goals step
            // If not, try to calculate now (fallback)
            if !oneRmCalculated && age != nil && bodyWeight != nil && height != nil && !sex.isEmpty && !trainingLevel.isEmpty && !motivationType.isEmpty {
                print("[Onboarding] ⚠️ 1RM values not ready, calculating now (fallback)...")
                print("[Onboarding] 📊 Data: age=\(age!), weight=\(bodyWeight!), height=\(height!), sex=\(sex), level=\(trainingLevel), motivation=\(motivationType)")
                calculateSuggestedOneRm()
            } else if oneRmCalculated {
                print("[Onboarding] ✅ 1RM values already calculated and ready")
                print("[Onboarding] 📊 Current values: Bench=\(oneRmBench?.description ?? "nil"), OHP=\(oneRmOhp?.description ?? "nil"), Deadlift=\(oneRmDeadlift?.description ?? "nil"), Squat=\(oneRmSquat?.description ?? "nil"), Latpull=\(oneRmLatpull?.description ?? "nil")")
            } else {
                print("[Onboarding] ⚠️ Cannot calculate 1RM - missing data:")
                print("  • age: \(age?.description ?? "nil")")
                print("  • bodyWeight: \(bodyWeight?.description ?? "nil")")
                print("  • height: \(height?.description ?? "nil")")
                print("  • sex: \(sex.isEmpty ? "empty" : sex)")
                print("  • trainingLevel: \(trainingLevel)")
                print("  • motivationType: \(motivationType)")
            }
            print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        }
    }
    
    // MARK: - Step 8: Equipment
    
    private var equipmentStep: some View {
        EquipmentSelectionView(
            selectedEquipmentIds: $selectedEquipment,
            colorScheme: colorScheme,
            selectedTheme: selectedTheme,
            onFinish: {
                goToNextStep()
            }
        )
    }
    
    // MARK: - Step 9: Gym Details
    
    private var gymDetailsStep: some View {
        VStack(spacing: 24) {
            Text(String(localized: "Gym Details"))
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(Color.textPrimary(for: colorScheme))
            
            Text(String(localized: "Where will you be training?"))
                .font(.subheadline)
                .foregroundColor(Color.textSecondary(for: colorScheme))
            
            VStack(spacing: 24) {
                // MARK: - Find Nearby Section (Now Prominent)
                VStack(spacing: 16) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(String(localized: "Search Distance"))
                            .font(.caption)
                            .foregroundColor(Color.textSecondary(for: colorScheme))
                        
                        HStack(spacing: 10) {
                            ForEach([5, 10, 20, 50, 100], id: \.self) { km in
                                Button(action: { searchRadius = Double(km) }) {
                                    Text("\(km)km")
                                        .font(.caption)
                                        .fontWeight(searchRadius == Double(km) ? .bold : .regular)
                                        .padding(.vertical, 8)
                                        .frame(maxWidth: .infinity)
                                        .background(
                                            searchRadius == Double(km)
                                                ? Color.themePrimaryColor(theme: selectedTheme, colorScheme: colorScheme)
                                                : Color.cardBackground(for: colorScheme)
                                        )
                                        .foregroundColor(
                                            searchRadius == Double(km)
                                                ? .white
                                                : Color.textPrimary(for: colorScheme)
                                        )
                                        .cornerRadius(8)
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 8)
                                                .stroke(Color.textSecondary(for: colorScheme).opacity(0.2), lineWidth: 1)
                                        )
                                }
                            }
                        }
                    }
                    
                    Button(action: {
                        locationService.requestPermission()
                        locationService.searchNearbyGyms(radiusKm: searchRadius)
                        showNearbyGyms = true
                    }) {
                        HStack {
                            Spacer()
                            Image(systemName: "location.magnifyingglass")
                                .font(.title3)
                            if locationService.isSearching {
                                ProgressView()
                                    .padding(.horizontal, 8)
                            } else {
                                Text(String(localized: "Search for nearby gyms"))
                                    .font(.headline)
                            }
                            Spacer()
                        }
                        .padding(.vertical, 16)
                        .background(
                            LinearGradient(
                                gradient: Gradient(colors: [
                                    Color.themePrimaryColor(theme: selectedTheme, colorScheme: colorScheme),
                                    Color.themePrimaryColor(theme: selectedTheme, colorScheme: colorScheme).opacity(0.8)
                                ]),
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .cornerRadius(12)
                        .foregroundColor(.white)
                        .shadow(color: Color.themePrimaryColor(theme: selectedTheme, colorScheme: colorScheme).opacity(0.3), radius: 8, x: 0, y: 4)
                    }
                }
                
                // Nearby Gyms List
                if showNearbyGyms {
                    if locationService.isSearching {
                        VStack(spacing: 12) {
                            ProgressView()
                            Text(String(localized: "Finding gyms..."))
                                .font(.caption)
                                .foregroundColor(.gray)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 20)
                    } else if locationService.nearbyGyms.isEmpty {
                        Text(String(localized: "No gyms found nearby. Try increasing search distance."))
                            .font(.caption)
                            .foregroundColor(.gray)
                            .multilineTextAlignment(.center)
                            .padding(.vertical, 20)
                    } else {
                        VStack(alignment: .leading, spacing: 12) {
                            HStack {
                                Text(String(localized: "Nearby gyms"))
                                    .font(.caption)
                                    .fontWeight(.bold)
                                    .foregroundColor(.gray)
                                Spacer()
                                Text("\(locationService.nearbyGyms.count) \(String(localized: "found"))")
                                    .font(.caption2)
                                    .foregroundColor(.gray)
                            }
                            .padding(.horizontal, 4)
                            
                            ScrollView {
                                VStack(spacing: 10) {
                                    ForEach(locationService.nearbyGyms) { nearby in
                                        Button(action: {
                                            if nearby.isRepCompanionGym {
                                                // Verified gym - just mark it as selected
                                                self.selectedNearbyGymId = nearby.apiGymId
                                                self.selectedNearbyGym = nearby
                                                // Keep list open, don't fill manual fields
                                            } else {
                                                // Unverified gym - show alert
                                                self.pendingUnverifiedGym = nearby
                                                self.showUnverifiedGymAlert = true
                                            }
                                        }) {
                                            HStack(spacing: 12) {
                                                // Icon/Indicator
                                                ZStack {
                                                    Circle()
                                                        .fill(nearby.isRepCompanionGym ? Color.themePrimaryColor(theme: selectedTheme, colorScheme: colorScheme).opacity(0.1) : Color.gray.opacity(0.1))
                                                        .frame(width: 40, height: 40)
                                                    
                                                    Image(systemName: nearby.isRepCompanionGym ? "checkmark.seal.fill" : "building.2.fill")
                                                        .foregroundColor(nearby.isRepCompanionGym ? Color.themePrimaryColor(theme: selectedTheme, colorScheme: colorScheme) : .gray)
                                                }
                                                
                                                VStack(alignment: .leading, spacing: 2) {
                                                    Text(nearby.name)
                                                        .font(.subheadline)
                                                        .fontWeight(.bold)
                                                        .foregroundColor(Color.textPrimary(for: colorScheme))
                                                    
                                                    if let addr = nearby.address {
                                                        Text(addr)
                                                            .font(.caption2)
                                                            .foregroundColor(.gray)
                                                            .lineLimit(1)
                                                    }
                                                    
                                                    if nearby.isRepCompanionGym {
                                                        Text(String(localized: "Equipment verified"))
                                                            .font(.system(size: 8, weight: .bold))
                                                            .foregroundColor(Color.themePrimaryColor(theme: selectedTheme, colorScheme: colorScheme))
                                                            .padding(.horizontal, 4)
                                                            .padding(.vertical, 2)
                                                            .background(Color.themePrimaryColor(theme: selectedTheme, colorScheme: colorScheme).opacity(0.1))
                                                            .cornerRadius(4)
                                                            .padding(.top, 2)
                                                    }
                                                }
                                                
                                                Spacer()
                                                
                                                VStack(alignment: .trailing, spacing: 4) {
                                                    if nearby.distance < 1000 {
                                                        Text("\(Int(nearby.distance)) m")
                                                            .font(.caption2)
                                                            .fontWeight(.bold)
                                                            .foregroundColor(Color.themePrimaryColor(theme: selectedTheme, colorScheme: colorScheme))
                                                    } else {
                                                        Text(String(format: "%.1f km", nearby.distance / 1000.0))
                                                            .font(.caption2)
                                                            .fontWeight(.bold)
                                                            .foregroundColor(Color.themePrimaryColor(theme: selectedTheme, colorScheme: colorScheme))
                                                    }
                                                    
                                                    Image(systemName: "chevron.right")
                                                        .font(.caption2)
                                                        .foregroundColor(.gray.opacity(0.5))
                                                }
                                            }
                                            .padding()
                                            .background(
                                                RoundedRectangle(cornerRadius: 12)
                                                    .fill(Color.cardBackground(for: colorScheme))
                                                    .shadow(color: Color.black.opacity(0.03), radius: 2, x: 0, y: 1)
                                            )
                                            .overlay(
                                                RoundedRectangle(cornerRadius: 12)
                                                    .stroke(selectedNearbyGymId != nil && nearby.apiGymId != nil && selectedNearbyGymId == nearby.apiGymId ? Color.themePrimaryColor(theme: selectedTheme, colorScheme: colorScheme) : Color.clear, lineWidth: 2)
                                            )
                                        }
                                    }
                                }
                                .padding(.top, 4)
                            }
                            .frame(maxHeight: 250)
                        }
                    }
                }
                
                // MARK: - Manual Entry Section
                VStack(alignment: .leading, spacing: 16) {
                    HStack {
                        Text(String(localized: "Or enter manually"))
                            .font(.caption)
                            .fontWeight(.bold)
                            .foregroundColor(.gray)
                        Spacer()
                        if !gymName.isEmpty && selectedNearbyGymId != nil {
                            Button(action: {
                                selectedNearbyGymId = nil
                                selectedNearbyGym = nil
                                gymName = ""
                                gymAddress = ""
                            }) {
                                Text(String(localized: "Reset"))
                                    .font(.caption2)
                                    .foregroundColor(Color.themePrimaryColor(theme: selectedTheme, colorScheme: colorScheme))
                            }
                        }
                    }
                    .padding(.horizontal, 4)
                    
                    VStack(alignment: .leading, spacing: 12) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(String(localized: "Gym Name"))
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(Color.textSecondary(for: colorScheme))
                            TextField(String(localized: "Enter gym name"), text: $gymName)
                                .textFieldStyle(PlainTextFieldStyle())
                                .padding(12)
                                .background(Color.appBackground(for: colorScheme).opacity(0.5))
                                .cornerRadius(8)
                                .focused($focusedField, equals: .gymName)
                                .onChange(of: gymName) { _, _ in
                                    // If user types manually, reset the "matched" gym ID unless it was a selection
                                    // Actually, better to only reset if they are changing a pre-filled value
                                }
                        }
                        
                        VStack(alignment: .leading, spacing: 4) {
                            Text(String(localized: "Address (Optional)"))
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(Color.textSecondary(for: colorScheme))
                            
                            HStack {
                                TextField(String(localized: "Enter address"), text: $gymAddress)
                                    .textFieldStyle(PlainTextFieldStyle())
                                    .padding(12)
                                    .background(Color.appBackground(for: colorScheme).opacity(0.5))
                                    .cornerRadius(8)
                                    .focused($focusedField, equals: .gymAddress)
                                    .onChange(of: gymAddress) { _, newValue in
                                        locationService.searchQuery = newValue
                                    }
                                
                                if !gymAddress.isEmpty {
                                    Button(action: { gymAddress = "" }) {
                                        Image(systemName: "xmark.circle.fill")
                                            .foregroundColor(.gray)
                                    }
                                }
                            }
                            
                            // Address Autocomplete Suggestions
                            if !locationService.suggestions.isEmpty && focusedField == .gymAddress {
                                VStack(alignment: .leading, spacing: 12) {
                                    ForEach(locationService.suggestions.prefix(3)) { suggestion in
                                        Button(action: {
                                            self.gymAddress = suggestion.title
                                            locationService.searchQuery = ""
                                            focusedField = nil
                                        }) {
                                            VStack(alignment: .leading) {
                                                Text(suggestion.title)
                                                    .font(.subheadline)
                                                    .foregroundColor(Color.textPrimary(for: colorScheme))
                                                Text(suggestion.subtitle)
                                                    .font(.caption)
                                                    .foregroundColor(.gray)
                                            }
                                            .frame(maxWidth: .infinity, alignment: .leading)
                                            .padding(.vertical, 4)
                                        }
                                        if suggestion.id != locationService.suggestions.prefix(3).last?.id {
                                            Divider()
                                        }
                                    }
                                }
                                .padding()
                                .background(Color.cardBackground(for: colorScheme))
                                .cornerRadius(8)
                                .shadow(radius: 4)
                            }
                        }
                        
                        Toggle(String(localized: "Public Gym"), isOn: $gymIsPublic)
                            .font(.subheadline)
                            .tint(Color.themePrimaryColor(theme: selectedTheme, colorScheme: colorScheme))
                    }
                    .padding()
                    .background(
                        RoundedRectangle(cornerRadius: 12)
                            .fill(Color.cardBackground(for: colorScheme))
                    )
                }
            }
        }
        .alert(String(localized: "Gym not verified"), isPresented: $showUnverifiedGymAlert) {
            Button(String(localized: "Select another gym"), role: .cancel) {
                pendingUnverifiedGym = nil
            }
            Button(String(localized: "Register equipment")) {
                // Pre-fill gym data and proceed to equipment selection
                if let gym = pendingUnverifiedGym {
                    self.gymName = gym.name
                    self.gymAddress = gym.address ?? ""
                    self.gymIsPublic = false // Manual gyms default to private
                    self.selectedNearbyGymId = nil // Not a verified gym
                    self.selectedNearbyGym = nil
                }
                pendingUnverifiedGym = nil
                // Navigate to equipment selection step
                withAnimation {
                    currentStep += 1
                    updateStepIcon()
                }
            }
        } message: {
            Text(String(localized: "This gym has not yet verified its equipment, therefore it is not selectable in the gym list. If you are at the gym, you can add it as a new gym, but you will need to select what equipment is available."))
        }
        .onAppear {
             locationService.requestPermission()
        }
    }
    
    // MARK: - Step 9: Step Goal
    
    private var stepGoalStep: some View {
        VStack(spacing: 24) {
            stepGoalHeader
            stepGoalInput
        }
    }
    
    private var stepGoalHeader: some View {
        VStack(spacing: 8) {
            Text(String(localized: "Daily Step Goal"))
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(Color.textPrimary(for: colorScheme))
                .multilineTextAlignment(.center)
            
            Text(String(localized: "Set your daily step goal to track your activity"))
                .font(.subheadline)
                .foregroundColor(Color.textSecondary(for: colorScheme))
                .multilineTextAlignment(.center)
        }
    }
    
    private var stepGoalInput: some View {
        VStack(spacing: 16) {
            stepGoalControls
            stepGoalPresets
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.textSecondary(for: colorScheme).opacity(0.05))
        )
    }
    
    private var stepGoalControls: some View {
        HStack(spacing: 20) {
            stepGoalDecreaseButton
            stepGoalDisplay
            stepGoalIncreaseButton
        }
        .padding()
    }
    
    private var stepGoalDecreaseButton: some View {
        Button(action: {
            if dailyStepGoal > 1000 {
                dailyStepGoal -= 1000
            }
        }) {
            Image(systemName: "minus.circle.fill")
                .font(.title2)
                .foregroundStyle(dailyStepGoal > 1000 ? AnyShapeStyle(Color.themeGradient(theme: selectedTheme, colorScheme: colorScheme)) : AnyShapeStyle(Color.textSecondary(for: colorScheme).opacity(0.3)))
        }
        .disabled(dailyStepGoal <= 1000)
    }
    
    private var stepGoalDisplay: some View {
        VStack(spacing: 8) {
            Text("\(dailyStepGoal)")
                .font(.system(size: 48, weight: .bold))
                .foregroundColor(Color.textPrimary(for: colorScheme))
            Text(String(localized: "steps"))
                .font(.subheadline)
                .foregroundColor(Color.textSecondary(for: colorScheme))
        }
        .frame(minWidth: 120)
    }
    
    private var stepGoalIncreaseButton: some View {
        Button(action: {
            if dailyStepGoal < 50000 {
                dailyStepGoal += 1000
            }
        }) {
            Image(systemName: "plus.circle.fill")
                .font(.title2)
                .foregroundStyle(dailyStepGoal < 50000 ? AnyShapeStyle(Color.themeGradient(theme: selectedTheme, colorScheme: colorScheme)) : AnyShapeStyle(Color.textSecondary(for: colorScheme).opacity(0.3)))
        }
        .disabled(dailyStepGoal >= 50000)
    }
    
    private var stepGoalPresets: some View {
        HStack(spacing: 12) {
            ForEach([5000, 10000, 15000, 20000], id: \.self) { preset in
                stepGoalPresetButton(preset: preset)
            }
        }
        .padding(.horizontal)
    }
    
    private func stepGoalPresetButton(preset: Int) -> some View {
        let isSelected = dailyStepGoal == preset
        return Button(action: {
            dailyStepGoal = preset
        }) {
            Text("\(preset / 1000)k")
                .font(.subheadline)
                .fontWeight(isSelected ? .bold : .regular)
                .foregroundColor(isSelected ? .white : Color.textPrimary(for: colorScheme))
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(isSelected ? AnyShapeStyle(Color.themeGradient(theme: selectedTheme, colorScheme: colorScheme)) : AnyShapeStyle(Color.textSecondary(for: colorScheme).opacity(0.1)))
                )
        }
    }
    
    private var programGenerationStatusView: some View {
        Group {
            if showGenerationProgress {
                VStack(spacing: 12) {
                    ProgressView(value: Double(generationProgress), total: 100)
                        .progressViewStyle(LinearProgressViewStyle())
                    Text(generationStatus.isEmpty ? String(localized: "Generating your workout program...") : generationStatus)
                        .font(.subheadline)
                        .foregroundColor(Color.textSecondary(for: colorScheme))
                    Text("\(generationProgress)%")
                        .font(.caption)
                        .foregroundColor(Color.textSecondary(for: colorScheme))
                }
                .padding()
            } else {
                VStack(spacing: 16) {
                    ProgressView()
                        .scaleEffect(1.5)
                    Text(String(localized: "Preparing your workout program..."))
                        .font(.subheadline)
                        .foregroundColor(Color.textSecondary(for: colorScheme))
                }
                .padding()
            }
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.textSecondary(for: colorScheme).opacity(0.1))
        )
    }
    
    // MARK: - Step 10: Theme
    
    private var themeStep: some View {
        VStack(spacing: 24) {
            Text(String(localized: "Choose Theme"))
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(Color.textPrimary(for: colorScheme))
                .multilineTextAlignment(.center)
            
            Text(String(localized: "Customize app appearance"))
                .font(.subheadline)
                .foregroundColor(Color.textSecondary(for: colorScheme))
                .multilineTextAlignment(.center)
            
            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible()),
                GridItem(.flexible()),
                GridItem(.flexible())
            ], spacing: 16) {
                ForEach(["Main", "Forest", "Purple", "Ocean", "Sunset", "Slate", "Crimson", "Pink"], id: \.self) { theme in
                    Button(action: {
                        selectedTheme = theme
                        UserDefaults.standard.set(theme, forKey: "selectedTheme")
                    }) {
                        VStack(spacing: 8) {
                            Circle()
                                .fill(
                                    LinearGradient(
                                        gradient: Gradient(colors: Color.themeGradientColors(theme: theme, colorScheme: colorScheme)),
                                        startPoint: .topLeading,
                                        endPoint: .bottomTrailing
                                    )
                                )
                                .frame(width: 60, height: 60)
                                .overlay(
                                    Circle()
                                        .stroke(Color.white, lineWidth: selectedTheme == theme ? 3 : 0)
                                )
                                .overlay(
                                    selectedTheme == theme
                                        ? Image(systemName: "checkmark")
                                            .foregroundColor(.white)
                                            .font(.title3)
                                        : nil
                                )
                            
                            Text(LocalizedStringKey(theme))
                                .font(.caption)
                                .foregroundColor(Color.textPrimary(for: colorScheme))
                        }
                    }
                }
            }
            
            // Color scheme selection
            VStack(alignment: .leading, spacing: 12) {
                Text(String(localized: "Color Scheme"))
                    .font(.headline)
                    .foregroundColor(Color.textPrimary(for: colorScheme))
                
                HStack(spacing: 16) {
                    ColorSchemeButton(
                        title: String(localized: "Light"),
                        icon: "sun.max.fill",
                        isSelected: selectedColorScheme == "light",
                        colorScheme: colorScheme,
                        action: {
                            selectedColorScheme = "light"
                            savedColorScheme = "light"
                        }
                    )
                    
                    ColorSchemeButton(
                        title: String(localized: "Dark"),
                        icon: "moon.fill",
                        isSelected: selectedColorScheme == "dark",
                        colorScheme: colorScheme,
                        action: {
                            selectedColorScheme = "dark"
                            savedColorScheme = "dark"
                        }
                    )
                    
                    ColorSchemeButton(
                        title: String(localized: "Auto"),
                        icon: "circle.lefthalf.filled",
                        isSelected: selectedColorScheme == "auto",
                        colorScheme: colorScheme,
                        action: {
                            selectedColorScheme = "auto"
                            savedColorScheme = "auto"
                        }
                    )
                }
            }
        }
    }
    
    // MARK: - Helper Functions
    
    private func goToNextStep() {
        if currentStep < totalSteps {
            
            // Step 1 -> 2 logic is handled by the Button action usually, but if standard nav:
            if currentStep == 1 {
                if motivationType != "sport" {
                    // Skip step 2 (sport selection)
                    currentStep += 2
                    updateStepIcon()
                    return
                }
            }
            
            // Start 1RM calculation when user proceeds from Training Level step (step 6) to 1RM step (step 7)
            // This ensures we have both goals (step 5) and level (step 6)
            if currentStep == 6 && !oneRmCalculated {
                // Check if we have all required data for 1RM calculation
                if age != nil && bodyWeight != nil && height != nil && !sex.isEmpty && !trainingLevel.isEmpty && !motivationType.isEmpty {
                    print("[Onboarding] 🚀 Starting 1RM calculation in background (user finished Level step)...")
                    print("[Onboarding] 📊 Data: level=\(trainingLevel), motivation=\(motivationType), info ready")
                    calculateSuggestedOneRm()
                } else {
                    print("[Onboarding] ⚠️ Missing data for 1RM calculation: level=\(trainingLevel), motivation=\(motivationType)")
                }
            }
            
            // Start Program AI query when user clicks "Continue"
            // This can now happen either from Gym Details (9) if skipped equipment,
            // or Equipment (10) if not skipped.
            if (currentStep == 9 && selectedNearbyGymId != nil) || (currentStep == 10) {
                print("[Onboarding] 🚀 Starting program generation...")
                startProgramGeneration()
            }
            
            // Skip logic for Equipment (step 10)
            if currentStep == 9 && selectedNearbyGymId != nil {
                // Populate gym data from selected gym before proceeding
                if let selectedGym = selectedNearbyGym {
                    gymName = selectedGym.name
                    gymAddress = selectedGym.address ?? ""
                    gymIsPublic = selectedGym.isRepCompanionGym
                }
                currentStep += 2 // Skip 10, go to 11
                updateStepIcon()
                return
            }
            
            currentStep += 1
            updateStepIcon()
        }
    }
    
    private func goToPreviousStep() {
        if currentStep > 1 {
            // Skip logic for back button
            if currentStep == 11 && selectedNearbyGymId != nil {
                currentStep = 9 // Go back from 11 to 9 if we skipped 10
                updateStepIcon()
                return
            }
            
            if currentStep == 3 { // Going back from Health Data (3)
                if motivationType != "sport" {
                    // Skip step 2, go to 1
                    currentStep = 1
                    updateStepIcon()
                    return
                }
            }
            currentStep -= 1
            updateStepIcon()
        }
    }
    
    // MARK: - Program Generation
    
    private func startProgramGeneration() {
        Task {
            let userId = authService.currentUserId ?? "dev-user-123"
            
            do {
                // Upsert gym: create if new, update if returning
                // Check if user selected a verified gym from the list
                if let verifiedGymId = selectedNearbyGymId {
                    print("[Onboarding] 🏋️ Using verified gym with ID: \(verifiedGymId)")
                    await MainActor.run {
                        lastCreatedGymId = verifiedGymId
                    }
                    print("[Onboarding] ✅ Verified gym associated")
                } else if let gymId = lastCreatedGymId {
                    print("[Onboarding] 🏋️ Updating existing gym '\(gymName)' (id: \(gymId))")
                    
                    // Fetch the gym object to update
                    let descriptor = FetchDescriptor<Gym>(
                        predicate: #Predicate { $0.id == gymId }
                    )
                    if let existingGym = try? modelContext.fetch(descriptor).first {
                        try await GymService.shared.updateGym(
                            gym: existingGym,
                            name: gymName,
                            location: gymAddress.isEmpty ? nil : gymAddress,
                            latitude: nil, 
                            longitude: nil,
                            equipmentIds: selectedEquipment,
                            isPublic: gymIsPublic,
                            modelContext: modelContext
                        )
                        print("[Onboarding] ✅ Gym updated successfully")
                    }
                } else {
                    print("[Onboarding] 🏋️ Creating gym '\(gymName)' with \(selectedEquipment.count) equipment items")
                    let newGym = try await GymService.shared.createGym(
                        name: gymName,
                        location: gymAddress.isEmpty ? nil : gymAddress,
                        equipmentIds: selectedEquipment,
                        isPublic: gymIsPublic,
                        userId: userId,
                        modelContext: modelContext
                    )
                    await MainActor.run {
                        lastCreatedGymId = newGym.id
                    }
                    print("[Onboarding] ✅ Gym created with ID: \(newGym.id)")
                }
                
                // Mark that generation started early
                await MainActor.run {
                    programGenerationStartedEarly = true
                    isGeneratingProgram = true
                }
                
                // Start the actual program generation in background
                print("[Onboarding] 🚀 Starting program generation in background from Gym Details step...")
                
                let profileData = APIService.OnboardingCompleteRequest.ProfileData(
                    motivationType: motivationType,
                    trainingLevel: trainingLevel,
                    specificSport: motivationType == "sport" ? specificSport : nil,
                    focusTags: focusTags,
                    selectedIntent: selectedIntent,
                    age: age,
                    sex: sex.isEmpty ? nil : sex,
                    bodyWeight: bodyWeight,
                    height: height,
                    goalStrength: goalStrength,
                    goalVolume: goalHypertrophy,
                    goalEndurance: goalEndurance,
                    goalCardio: goalCardio,
                    sessionsPerWeek: sessionsPerWeek,
                    sessionDuration: sessionDuration,
                    oneRmBench: oneRmBench,
                    oneRmOhp: oneRmOhp,
                    oneRmDeadlift: oneRmDeadlift,
                    oneRmSquat: oneRmSquat,
                    oneRmLatpull: oneRmLatpull,
                    theme: selectedTheme
                )
                
                print("[Onboarding] 📡 Calling APIService.shared.completeOnboarding...")
                let response = try await APIService.shared.completeOnboarding(
                    profile: profileData,
                    equipment: selectedEquipment,
                    selectedGymId: selectedNearbyGymId,
                    useV4: true
                )
                
                print("[Onboarding] ✅ Program generation started, response received")
                print("[Onboarding] 📋 Response: success=\(response.success), hasProgram=\(response.hasProgram ?? false), templatesCreated=\(response.templatesCreated ?? 0)")
                
                if let jobId = response.program?.jobId {
                    await MainActor.run {
                        generationJobId = jobId
                    }
                }
                
                if response.success && (response.hasProgram == true || (response.templatesCreated ?? 0) > 0) {
                    await MainActor.run {
                        programGenerationComplete = true
                        print("[Onboarding] ✅ Background program generation complete!")
                    }
                }
            } catch {
                print("[Onboarding] ❌ Error in startProgramGeneration: \(error.localizedDescription)")
                await MainActor.run {
                    isGeneratingProgram = false
                    programGenerationStartedEarly = false
                }
            }
        }
    }
    
    private func updateStepIcon() {
        switch currentStep {
        case 1:
            currentStepIcon = "heart.fill"
        case 2:
            currentStepIcon = motivationType == "sport" ? "sportscourt.fill" : "chart.bar.fill"
        case 3:
            currentStepIcon = "heart.text.square.fill" // Health Data
        case 4:
            currentStepIcon = "person.fill"
        case 5:
            currentStepIcon = "target"
        case 6:
            currentStepIcon = "chart.bar.fill" // Level
        case 7:
            currentStepIcon = "dumbbell.fill" // 1RM
        case 8:
            currentStepIcon = "calendar" // Frequency
        case 9:
            currentStepIcon = "square.grid.2x2.fill" // Equipment
        case 10:
            currentStepIcon = "mappin.and.ellipse" // Gym Details
        case 11:
            currentStepIcon = "figure.walk" // Step Goal
        case 12:
            currentStepIcon = "paintpalette.fill" // Theme
        default:
            currentStepIcon = "circle.fill"
        }
    }
    
    private func adjustGoals(changed: OnboardingGoalType, to newValue: Int) {
        // Clamp the new value to valid range
        let clampedNewValue = max(0, min(100, newValue))
        
        // Get the old value of the changed goal
        let oldValue: Int
        switch changed {
        case .statusStrength:
            oldValue = goalStrength
        case .statusHypertrophy:
            oldValue = goalHypertrophy
        case .statusEndurance:
            oldValue = goalEndurance
        case .statusCardio:
            oldValue = goalCardio
        }
        
        // Calculate the difference (delta)
        let delta = clampedNewValue - oldValue
        
        // If no change, return early
        guard delta != 0 else { return }
        
        // Update the changed goal first
        switch changed {
        case .statusStrength:
            goalStrength = clampedNewValue
        case .statusHypertrophy:
            goalHypertrophy = clampedNewValue
        case .statusEndurance:
            goalEndurance = clampedNewValue
        case .statusCardio:
            goalCardio = clampedNewValue
        }
        
        // Get current values of other goals
        let otherGoals: [(OnboardingGoalType, Int)] = [
            (.statusStrength, goalStrength),
            (.statusHypertrophy, goalHypertrophy),
            (.statusEndurance, goalEndurance),
            (.statusCardio, goalCardio)
        ].filter { $0.0 != changed }
        
        // Calculate total of other goals
        let otherTotal = otherGoals.map { $0.1 }.reduce(0, +)
        let targetTotal = 100 - clampedNewValue
        
        // If other goals need to be adjusted
        if otherTotal != targetTotal {
            let adjustmentNeeded = targetTotal - otherTotal
            
            if otherTotal == 0 {
                // If all other goals are 0, distribute equally
                let equalShare = targetTotal / otherGoals.count
                let remainder = targetTotal % otherGoals.count
                
                for (index, (goal, _)) in otherGoals.enumerated() {
                    let value = equalShare + (index < remainder ? 1 : 0)
                    switch goal {
                    case .statusStrength: goalStrength = value
                    case .statusHypertrophy: goalHypertrophy = value
                    case .statusEndurance: goalEndurance = value
                    case .statusCardio: goalCardio = value
                    }
                }
            } else {
                // Distribute the adjustment proportionally
                var adjustments: [Int] = []
                var totalAdjustment = 0
                
                // Calculate proportional adjustments
                for (_, currentValue) in otherGoals {
                    let proportion = Double(currentValue) / Double(otherTotal)
                    let adjustment = Int(round(proportion * Double(adjustmentNeeded)))
                    adjustments.append(adjustment)
                    totalAdjustment += adjustment
                }
                
                // Handle rounding errors
                let roundingError = adjustmentNeeded - totalAdjustment
                if roundingError != 0 && !adjustments.isEmpty {
                    adjustments[adjustments.count - 1] += roundingError
                }
                
                // Apply adjustments
                for (index, (goal, _)) in otherGoals.enumerated() {
                    let adjustment = adjustments[index]
                    let newValue: Int
                    switch goal {
                    case .statusStrength:
                        newValue = max(0, min(100, goalStrength + adjustment))
                        goalStrength = newValue
                    case .statusHypertrophy:
                        newValue = max(0, min(100, goalHypertrophy + adjustment))
                        goalHypertrophy = newValue
                    case .statusEndurance:
                        newValue = max(0, min(100, goalEndurance + adjustment))
                        goalEndurance = newValue
                    case .statusCardio:
                        newValue = max(0, min(100, goalCardio + adjustment))
                        goalCardio = newValue
                    }
                }
            }
        }
        
        // Final check: ensure exact 100% (handle any edge cases)
        let finalTotal = goalStrength + goalHypertrophy + goalEndurance + goalCardio
        if finalTotal != 100 {
            let difference = 100 - finalTotal
            // Apply difference to the changed goal (clamp if needed)
            switch changed {
            case .statusStrength:
                goalStrength = max(0, min(100, goalStrength + difference))
            case .statusHypertrophy:
                goalHypertrophy = max(0, min(100, goalHypertrophy + difference))
            case .statusEndurance:
                goalEndurance = max(0, min(100, goalEndurance + difference))
            case .statusCardio:
                goalCardio = max(0, min(100, goalCardio + difference))
            }
        }
    }
    
    private enum OnboardingGoalType {
        case statusStrength, statusHypertrophy, statusEndurance, statusCardio
    }
    
    /// Calculate preset goals based on motivationType and trainingLevel (local calculation)
    private func calculatePresetGoals() {
        print("[Onboarding] 🎯 Calculating preset training goals based on \(motivationType) + \(trainingLevel)...")
        
        var strength = 25
        var hypertrophy = 25
        var endurance = 25
        var cardio = 25
        
        // Base distribution on motivationType
        switch motivationType.lowercased() {
        case "lose_weight", "viktminskning":
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
            case "alpine_skiing":
                strength = 35; hypertrophy = 15; endurance = 25; cardio = 25
                focusTags = ["Explosiveness", "Mobility", "Rehab/Recovery"]
                selectedIntent = "strength_power"
            case "badminton":
                strength = 20; hypertrophy = 10; endurance = 30; cardio = 40
                focusTags = ["Explosiveness", "Technique", "Mobility"]
                selectedIntent = "agile"
            case "basketball":
                strength = 25; hypertrophy = 15; endurance = 25; cardio = 35
                focusTags = ["Explosiveness", "Conditioning/Metcon", "Mobility"]
                selectedIntent = "explosive"
            case "cycling":
                strength = 15; hypertrophy = 5; endurance = 40; cardio = 40
                focusTags = ["Conditioning/Metcon", "Rehab/Recovery", "Mobility"]
                selectedIntent = "endurance"
            case "floorball":
                strength = 25; hypertrophy = 10; endurance = 25; cardio = 40
                focusTags = ["Explosiveness", "Conditioning/Metcon", "Mobility"]
                selectedIntent = "agile"
            case "football":
                strength = 20; hypertrophy = 10; endurance = 25; cardio = 45
                focusTags = ["Explosiveness", "Conditioning/Metcon", "Rehab/Recovery"]
                selectedIntent = "explosive"
            case "track_and_field":
                strength = 30; hypertrophy = 10; endurance = 25; cardio = 35
                focusTags = ["Explosiveness", "Technique", "Mobility"]
                selectedIntent = "explosive"
            case "golf":
                strength = 30; hypertrophy = 10; endurance = 25; cardio = 35
                focusTags = ["Technique", "Mobility", "Explosiveness"]
                selectedIntent = "controlled"
            case "handball":
                strength = 25; hypertrophy = 15; endurance = 20; cardio = 40
                focusTags = ["Explosiveness", "Conditioning/Metcon", "Rehab/Recovery"]
                selectedIntent = "explosive"
            case "ice_hockey":
                strength = 30; hypertrophy = 15; endurance = 20; cardio = 35
                focusTags = ["Explosiveness", "Conditioning/Metcon", "Mobility"]
                selectedIntent = "explosive"
            case "martial_arts":
                strength = 25; hypertrophy = 10; endurance = 30; cardio = 35
                focusTags = ["Technique", "Mobility", "Conditioning/Metcon"]
                selectedIntent = "focused"
            case "cross_country_skiing":
                strength = 20; hypertrophy = 5; endurance = 40; cardio = 35
                focusTags = ["Conditioning/Metcon", "Mobility", "Rehab/Recovery"]
                selectedIntent = "endurance"
            case "padel":
                strength = 20; hypertrophy = 10; endurance = 25; cardio = 45
                focusTags = ["Technique", "Explosiveness", "Mobility"]
                selectedIntent = "agile"
            case "running":
                strength = 15; hypertrophy = 5; endurance = 45; cardio = 35
                focusTags = ["Rehab/Recovery", "Mobility", "Conditioning/Metcon"]
                selectedIntent = "endurance"
            case "swimming":
                strength = 20; hypertrophy = 5; endurance = 40; cardio = 35
                focusTags = ["Technique", "Mobility", "Rehab/Recovery"]
                selectedIntent = "endurance"
            case "tennis":
                strength = 20; hypertrophy = 10; endurance = 25; cardio = 45
                focusTags = ["Technique", "Explosiveness", "Mobility"]
                selectedIntent = "agile"
            case "other":
                strength = 25; hypertrophy = 25; endurance = 25; cardio = 25
                focusTags = []
                selectedIntent = "balanced"
            default:
                strength = 35; endurance = 30; hypertrophy = 20; cardio = 15
                focusTags = []
                selectedIntent = nil
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
        // Adjust based on training level
        // NOTE: Level might be empty if user hasn't reached that step yet (now step 6)
        // So we default to "intermediate" logic if empty for preset calculation
        let levelForCalc = trainingLevel.isEmpty ? "van" : trainingLevel
        
        switch levelForCalc.lowercased() {
        case "beginner", "beginner":
            // For "build_muscle", keep higher strength/hypertrophy even for beginners
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
        
        goalsCalculated = true
        
        print("[Onboarding] ✅ Preset goals calculated: Strength=\(goalStrength)%, Hypertrophy=\(goalHypertrophy)%, Endurance=\(goalEndurance)%, Cardio=\(goalCardio)%")
        
        // If sport is 'other' or unknown, fetch AI suggestions
        // Otherwise we use the hardcoded presets above to avoid API latency
        if motivationType == "sport" && specificSport == "other" {
            // Only fetch if we have a custom name entered, otherwise wait
            if !customSportName.isEmpty {
                calculateSuggestedGoals()
            }
        }
    }
    
    /// Calculate suggested goals via API (fallback or for refinement)
    private func calculateSuggestedGoals() {
        Task {
            do {
                print("[Onboarding] 🎯 Calculating suggested training goals via API...")
                
                // Use custom name if "other", otherwise specificSport (which shouldn't happen here due to optimization, but safe to keep)
                let sportToQuery = (specificSport == "other" && !customSportName.isEmpty) ? customSportName : specificSport
                
                let suggestedGoals = try await APIService.shared.suggestTrainingGoals(
                    motivationType: motivationType,
                    trainingLevel: trainingLevel.isEmpty ? "intermediate" : trainingLevel,
                    specificSport: motivationType == "sport" ? sportToQuery : nil,
                    age: age,
                    sex: sex.isEmpty ? nil : sex,
                    bodyWeight: bodyWeight,
                    height: height,
                    oneRmBench: nil, // Not used for goal calculation
                    oneRmOhp: nil,
                    oneRmDeadlift: nil,
                    oneRmSquat: nil,
                    oneRmLatpull: nil
                )
                
                await MainActor.run {
                    goalStrength = suggestedGoals.goalStrength
                    goalHypertrophy = suggestedGoals.goalHypertrophy
                    goalEndurance = suggestedGoals.goalEndurance
                    goalCardio = suggestedGoals.goalCardio
                    
                    if let tags = suggestedGoals.focusTags {
                        focusTags = tags
                    }
                    if let intent = suggestedGoals.selectedIntent {
                        selectedIntent = intent
                    }
                    
                    goalsCalculated = true
                    
                    print("[Onboarding] ✅ Suggested goals calculated: Strength=\(goalStrength)%, Hypertrophy=\(goalHypertrophy)%, Endurance=\(goalEndurance)%, Cardio=\(goalCardio)%, Tags=\(focusTags)")
                }
            } catch {
                print("[Onboarding] ⚠️ Error calculating suggested goals: \(error.localizedDescription)")
                // Keep default values if calculation fails
                await MainActor.run {
                    goalsCalculated = true // Mark as calculated to avoid retrying
                }
            }
        }
    }
    
    private func calculateSuggestedOneRm() {
        let taskStartTime = Date()
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print("[Onboarding] 💪 STARTING 1RM CALCULATION (LOCAL)")
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        
        Task {
            await calculateLocalFallbackOneRm()
            
            let totalDuration = Date().timeIntervalSince(taskStartTime)
            print("[Onboarding] ✅ 1RM Calculation Completed Locally")
            print("[Onboarding] 📊 Final Values:")
            print("  • Bench: \(oneRmBench ?? 0) kg")
            print("  • OHP: \(oneRmOhp ?? 0) kg")
            print("  • Deadlift: \(oneRmDeadlift ?? 0) kg")
            print("  • Squat: \(oneRmSquat ?? 0) kg")
            print("  • Latpull: \(oneRmLatpull ?? 0) kg")
            print("[Onboarding] ⏱️  Total time: \(String(format: "%.2f", totalDuration)) seconds")
            print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        }
    }
    
    private func calculateLocalFallbackOneRm() async {
        print("[Onboarding] ⚠️ Using local fallback for 1RM calculation")
        
        let userWeight = Double(bodyWeight ?? 75)
        let isMale = (sex == "male" || sex == "man" || sex.isEmpty)
        let isBeginner = (trainingLevel == "beginner" || trainingLevel == "beginner" || trainingLevel.isEmpty)
        
        // Multipliers based on sex and experience (very rough estimates)
        let benchMultiplier = isMale ? (isBeginner ? 0.6 : 0.9) : (isBeginner ? 0.4 : 0.6)
        let squatMultiplier = isMale ? (isBeginner ? 0.8 : 1.2) : (isBeginner ? 0.6 : 0.9)
        let deadliftMultiplier = isMale ? (isBeginner ? 1.0 : 1.4) : (isBeginner ? 0.7 : 1.1)
        let ohpMultiplier = isMale ? (isBeginner ? 0.4 : 0.6) : (isBeginner ? 0.3 : 0.45)
        let latpullMultiplier = isMale ? (isBeginner ? 0.5 : 0.7) : (isBeginner ? 0.4 : 0.6)
        
        await MainActor.run {
            oneRmBench = Int(userWeight * benchMultiplier)
            oneRmSquat = Int(userWeight * squatMultiplier)
            oneRmDeadlift = Int(userWeight * deadliftMultiplier)
            oneRmOhp = Int(userWeight * ohpMultiplier)
            oneRmLatpull = Int(userWeight * latpullMultiplier)
            
            oneRmCalculated = true
            print("[Onboarding] ✅ Local fallback calculation applied")
        }
    }
    
    
    private func fetchHealthData() {
        Task {
            do {
                let healthKitService = HealthKitService.shared
                try await healthKitService.requestAuthorization()
                
                // Try to fetch weight and height, but don't fail if they don't exist
                do {
                    let weight = try await healthKitService.getLatestBodyMass()
                    if weight > 0 {
                        await MainActor.run {
                            bodyWeight = Int(weight)
                        }
                    }
                } catch {
                    print("[Onboarding] No weight data available in HealthKit: \(error.localizedDescription)")
                }
                
                do {
                    let heightValue = try await healthKitService.getLatestHeight()
                    if heightValue > 0 {
                        await MainActor.run {
                            height = Int(heightValue * 100) // Convert to cm
                        }
                    }
                } catch {
                    print("[Onboarding] No height data available in HealthKit: \(error.localizedDescription)")
                }

                // Fetch biological sex
                do {
                    let biologicalSex = try healthKitService.getBiologicalSex()
                    await MainActor.run {
                        if biologicalSex == .male {
                            sex = "male"  // Match button value
                        } else if biologicalSex == .female {
                            sex = "female"  // Match button value
                        }
                    }
                } catch {
                    print("[Onboarding] No sex data available in HealthKit: \(error.localizedDescription)")
                }

                // Fetch date of birth
                do {
                    let dob = try healthKitService.getDateOfBirthComponents()
                    await MainActor.run {
                        if let year = dob.year { birthYear = year }
                        if let month = dob.month { birthMonth = month }
                        if let day = dob.day { birthDay = day }
                        calculateAgeFromBirthDate()
                    }
                } catch {
                    print("[Onboarding] No birth date data available in HealthKit: \(error.localizedDescription)")
                }
                
                // Mark as fetched even if no data was found (user can still proceed)
                await MainActor.run {
                    healthDataFetched = true
                }
            } catch {
                print("[Onboarding] Error fetching health data: \(error.localizedDescription)")
                // Still allow user to proceed - mark as attempted
                await MainActor.run {
                    healthDataFetched = true
                }
            }
        }
    }
    
    private func loadEquipmentCatalog() {
        print("[Onboarding] 🔄 loadEquipmentCatalog() called")
        Task {
            await MainActor.run {
                isLoadingEquipment = true
                print("[Onboarding] 📊 Set isLoadingEquipment = true")
            }
            
            do {
                print("[Onboarding] 🔍 Fetching equipment from local database...")
                let descriptor = FetchDescriptor<EquipmentCatalog>(
                    sortBy: [SortDescriptor(\.name)]
                )
                let equipment = try modelContext.fetch(descriptor)
                
                print("[Onboarding] 📊 Fetched \(equipment.count) items from database")
                if equipment.count > 0 {
                    print("[Onboarding] 📋 First 5 items:")
                    for (index, item) in equipment.prefix(5).enumerated() {
                        print("  \(index + 1). \(item.name) (id: \(item.id))")
                    }
                }
                
                await MainActor.run {
                    availableEquipment = equipment
                    isLoadingEquipment = false
                    
                    print("[Onboarding] 💾 Updated state:")
                    print("  • availableEquipment.count: \(availableEquipment.count)")
                    print("  • isLoadingEquipment: \(isLoadingEquipment)")
                    
                    if equipment.isEmpty {
                        print("[Onboarding] ⚠️ No equipment found in local database. Will retry sync when equipment step is reached.")
                    } else {
                        print("[Onboarding] ✅ Loaded \(equipment.count) equipment items from local database")
                    }
                }
            } catch {
                print("[Onboarding] ❌ Error loading equipment:")
                print("  • Error type: \(type(of: error))")
                print("  • Error description: \(error.localizedDescription)")
                if let nsError = error as NSError? {
                    print("  • Error domain: \(nsError.domain)")
                    print("  • Error code: \(nsError.code)")
                    print("  • Error userInfo: \(nsError.userInfo)")
                }
                await MainActor.run {
                    isLoadingEquipment = false
                    print("[Onboarding] 📊 Set isLoadingEquipment = false (after error)")
                }
            }
        }
    }
    
    private func completeOnboardingWithoutProgram() {
        Task {
            let userId = authService.currentUserId ?? "dev-user-123"
            
            // Sync profile from server to ensure all onboarding data is saved
            do {
                let syncService = SyncService.shared
                try await syncService.syncUserProfile(userId: userId, modelContext: modelContext)
                print("[Onboarding] ✅ Profile synced from server (no program generated)")
            } catch {
                print("[Onboarding] ⚠️ Warning: Failed to sync profile from server: \(error.localizedDescription)")
            }
            
            // Update profile to mark onboarding as completed
            let profileDescriptor = FetchDescriptor<UserProfile>(
                predicate: #Predicate { $0.userId == userId }
            )
            if let profile = try? modelContext.fetch(profileDescriptor).first {
                profile.onboardingCompleted = true
                profile.theme = selectedTheme
                try? modelContext.save()
                print("[Onboarding] ✅ Profile updated: onboardingCompleted=true (no program generated)")
            }
            
            // Save step goal to UserDefaults
            UserDefaults.standard.set(dailyStepGoal, forKey: "dailyStepGoal")
            print("[Onboarding] ✅ Step goal saved: \(dailyStepGoal) steps")
            
            await MainActor.run {
                isGeneratingProgram = false
                showGenerationProgress = false
                dismiss()
            }
        }
    }
    
    private func completeOnboarding() {
        Task {
            await MainActor.run {
                isGeneratingProgram = true
                showGenerationProgress = true
            }
            
            // capture state safely
            let startedEarly = await MainActor.run { programGenerationStartedEarly }
            let complete = await MainActor.run { programGenerationComplete }
            
            if startedEarly {
                if complete {
                    print("[Onboarding] ✅ Generation already complete, showing completion animation...")
                    await MainActor.run {
                        generationStatus = String(localized: "Finalizing...")
                    }
                    
                    // Show "fake" completion animation for 10s as requested to allow full sync/population
                    try? await Task.sleep(nanoseconds: 10_000_000_000) // 10 seconds
                    
                    finalizeOnboarding()
                } else {
                    print("[Onboarding] ⏳ Generation still in progress, waiting for completion...")
                    waitForGenerationCompletion()
                }
            } else {
                // Not started early (fallback or alternative flow)
                generationStatus = String(localized: "Generating your program...")
                
                do {
                    let profileData = APIService.OnboardingCompleteRequest.ProfileData(
                        motivationType: motivationType,
                        trainingLevel: trainingLevel,
                        specificSport: motivationType == "sport" ? specificSport : nil,
                        focusTags: focusTags,
                        selectedIntent: selectedIntent,
                        age: age,
                        sex: sex.isEmpty ? nil : sex,
                        bodyWeight: bodyWeight,
                        height: height,
                        goalStrength: goalStrength,
                        goalVolume: goalHypertrophy,
                        goalEndurance: goalEndurance,
                        goalCardio: goalCardio,
                        sessionsPerWeek: sessionsPerWeek,
                        sessionDuration: sessionDuration,
                        oneRmBench: oneRmBench,
                        oneRmOhp: oneRmOhp,
                        oneRmDeadlift: oneRmDeadlift,
                        oneRmSquat: oneRmSquat,
                        oneRmLatpull: oneRmLatpull,
                        theme: selectedTheme
                    )
                    
                    // Minimum animation duration of 10s
                    let minDuration = TimeInterval(10)
                    let startTime = Date()
                    
                    print("[Onboarding] 📡 Calling APIService.shared.completeOnboarding (late flow)...")
                    let response = try await APIService.shared.completeOnboarding(
                        profile: profileData,
                        equipment: selectedEquipment,
                        selectedGymId: selectedNearbyGymId,
                        useV4: true
                    )
                    
                    let elapsed = Date().timeIntervalSince(startTime)
                    let remaining = minDuration - elapsed
                    
                    if remaining > 0 {
                        print("[Onboarding] ⏳ Waiting \(remaining)s to meet minimum animation time...")
                        try await Task.sleep(nanoseconds: UInt64(remaining * 1_000_000_000))
                    }
                    
                    if response.success {
                        if let jobId = response.program?.jobId, let userId = authService.currentUserId {
                            print("[Onboarding] 🚀 Background generation started with jobId: \(jobId)")
                            await MainActor.run {
                                generationJobId = jobId
                            }
                            await pollGenerationStatus(jobId: jobId, userId: userId)
                            finalizeOnboarding()
                        } else if response.hasProgram == true || (response.templatesCreated ?? 0) > 0 {
                            print("[Onboarding] ✅ Immediate success! Passing response to finalize...")
                            finalizeOnboarding(response: response)
                        } else {
                            // Fallback to finalize if no jobId but success (should not happen in V4)
                            print("[Onboarding] ⚠️ Success but no program or jobId. Finalizing anyway...")
                            finalizeOnboarding(response: response)
                        }
                    } else {
                        await MainActor.run {
                            generationError = String(localized: "Program generation failed.")
                            showGenerationErrorAlert = true
                            isGeneratingProgram = false
                            showGenerationProgress = false
                        }
                    }
                } catch {
                    print("[Onboarding] ❌ Error completing onboarding: \(error.localizedDescription)")
                    await MainActor.run {
                        generationError = String(format: String(localized: "An unexpected error occurred: %@"), error.localizedDescription)
                        showGenerationErrorAlert = true
                        isGeneratingProgram = false
                        showGenerationProgress = false
                    }
                }
            }
        }
    }
    
    private func waitForGenerationCompletion() {
        Task {
            print("[Onboarding] 🕒 Waiting for background generation to complete...")
            var attempts = 0
            let userId = authService.currentUserId
            
            // Wait up to 5 minutes (300 attempts * 1s) to match API timeout
            while !programGenerationComplete && attempts < 300 {
                if let jobId = await MainActor.run({ generationJobId }), let userId = userId {
                    // If we have a jobId, we should be polling it
                    await pollGenerationStatus(jobId: jobId, userId: userId)
                    // If pollGenerationStatus finishes (either success or fail), it will update programGenerationComplete
                    if programGenerationComplete { break }
                }
                
                try? await Task.sleep(nanoseconds: 1_000_000_000)
                attempts += 1
                
                if attempts % 5 == 0 {
                    print("[Onboarding] ⏳ Still waiting for generation... (\(attempts)s)")
                }
            }
            
            await MainActor.run {
                if programGenerationComplete {
                    print("[Onboarding] ✅ Detected generation completion!")
                    finalizeOnboarding()
                } else {
                    print("[Onboarding] ❌ Generation wait timed out after 300s (5 minutes)")
                    generationError = String(localized: "Program generation took too long. Please try again.")
                    showGenerationErrorAlert = true
                    isGeneratingProgram = false
                    showGenerationProgress = false
                }
            }
        }
    }
    
    private func finalizeOnboarding(response: APIService.OnboardingCompleteResponse? = nil) {
        print("[Onboarding] 🏁 Finalizing onboarding...")
        
        Task {
            // Update profile
            if let userId = authService.currentUserId {
                let descriptor = FetchDescriptor<UserProfile>(
                    predicate: #Predicate { $0.userId == userId }
                )
                if let profile = try? modelContext.fetch(descriptor).first {
                    profile.onboardingCompleted = true
                    profile.theme = selectedTheme
                    
                    // Sync profile data from API response if available
                    if let apiProfile = response?.profile {
                        print("[Onboarding] 📥 Syncing profile data from API response...")
                        profile.age = apiProfile.age
                        profile.sex = apiProfile.sex
                        profile.bodyWeight = apiProfile.bodyWeight
                        profile.height = apiProfile.height
                        // Use coalescing for non-optional model properties
                        profile.trainingLevel = apiProfile.trainingLevel ?? "intermediate"
                        profile.motivationType = apiProfile.motivationType ?? "general_fitness"
                        profile.goalStrength = apiProfile.goalStrength ?? 25
                        profile.goalVolume = apiProfile.goalVolume ?? 25
                        profile.goalEndurance = apiProfile.goalEndurance ?? 25
                        profile.goalCardio = apiProfile.goalCardio ?? 25
                        profile.sessionsPerWeek = apiProfile.sessionsPerWeek ?? 3
                        profile.sessionDuration = apiProfile.sessionDuration ?? 60
                        profile.selectedGymId = apiProfile.selectedGymId
                    }
                    
                    try? modelContext.save()
                    print("[Onboarding] ✅ Profile marked as onboarding completed and synced")
                    
                    // Force a full profile sync from server to ensure all fields (including computed ones) are correct
                    print("[Onboarding] 🔄 Performing full profile sync from server...")
                    try? await SyncService.shared.syncUserProfile(userId: userId, modelContext: modelContext)
                    
                    // Fetch the generated program templates immediately so they appear on HomeView
                    print("[Onboarding] 🔄 Fetching generated program templates...")
                    try? await SyncService.shared.syncProgramTemplates(userId: userId, modelContext: modelContext)
                    try? await SyncService.shared.syncGymsAndEquipment(userId: userId, modelContext: modelContext)
                    print("[Onboarding] ✅ Program templates synced")
                }
            }
            
            await MainActor.run {
                isGeneratingProgram = false
                showGenerationProgress = false
                dismiss()
            }
        }
    }


    
    private func pollGenerationStatus(jobId: String, userId: String) async {
        var pollCount = 0
        let maxPolls = 300 // 5 minutes max (300 * 1 second)
        
        print("[Onboarding] 🔄 Starting to poll job status: \(jobId)")
        
        while pollCount < maxPolls {
            do {
                try await Task.sleep(nanoseconds: 1_000_000_000) // 1 second
                
                print("[Onboarding] 📡 Polling job status (attempt \(pollCount + 1)/\(maxPolls))...")
                let status = try await APIService.shared.getGenerationStatus(jobId: jobId)
                
                print("[Onboarding] 📊 Job status: \(status.status), progress: \(status.progress)%")
                
                await MainActor.run {
                    generationStatus = status.status
                    generationProgress = status.progress
                }
                
                if status.status == "completed" {
                    // Sync program templates
                    print("[Onboarding] ✅ Program generation completed, syncing...")
                    let syncService = SyncService.shared
                    
                    // Try syncing templates multiple times if needed
                    var syncAttempts = 0
                    var syncSuccess = false
                    while syncAttempts < 5 && !syncSuccess {
                        do {
                            try await syncService.syncProgramTemplates(userId: userId, modelContext: modelContext)
                            try await syncService.syncUserProfile(userId: userId, modelContext: modelContext)
                            let templates = try modelContext.fetch(FetchDescriptor<ProgramTemplate>())
                            if !templates.isEmpty {
                                print("[Onboarding] ✅ Templates synced successfully: \(templates.count) templates")
                                syncSuccess = true
                            } else {
                                print("[Onboarding] ⚠️ Sync completed but no templates found, attempt \(syncAttempts + 1)/5")
                                syncAttempts += 1
                                if syncAttempts < 5 {
                                    try await Task.sleep(nanoseconds: 1_000_000_000) // Wait 1 second before retry
                                }
                            }
                        } catch {
                            print("[Onboarding] ❌ Error syncing templates (attempt \(syncAttempts + 1)/5): \(error.localizedDescription)")
                            syncAttempts += 1
                            if syncAttempts < 5 {
                                try await Task.sleep(nanoseconds: 1_000_000_000) // Wait 1 second before retry
                            }
                        }
                    }
                    
                    if !syncSuccess {
                        print("[Onboarding] ❌ Failed to sync templates after 5 attempts")
                        await MainActor.run {
                            generationError = String(localized: "The program is ready but could not be loaded. Please try opening the app again.")
                            showGenerationErrorAlert = true
                            isGeneratingProgram = false
                            showGenerationProgress = false
                        }
                        return
                    }
                    
                    // Sync profile from server to ensure all onboarding data is saved
                    try await syncService.syncUserProfile(userId: userId, modelContext: modelContext)
                    
                    // Update profile
                    let profileDescriptor = FetchDescriptor<UserProfile>(
                        predicate: #Predicate { $0.userId == userId }
                    )
                    if let profile = try? modelContext.fetch(profileDescriptor).first {
                        profile.onboardingCompleted = true
                        profile.theme = selectedTheme
                        
                        // Create default gym with selected equipment from onboarding
                        print("[Onboarding] 🏋️ Creating default gym with \(selectedEquipment.count) equipment items")
                        _ = try await GymService.shared.createGym(
                            name: String(localized: "My Gym"),
                            location: String(localized: "Standard location"),
                            equipmentIds: selectedEquipment,
                            userId: userId,
                            modelContext: modelContext
                        )
                        
                        try? modelContext.save()
                        print("[Onboarding] ✅ Profile updated and Default Gym created")
                    }
                    
                    await MainActor.run {
                        isGeneratingProgram = false
                        showGenerationProgress = false
                        dismiss()
                    }
                    print("[Onboarding] ✅ Onboarding completed successfully!")
                    return
                } else if status.status == "failed" {
                    await MainActor.run {
                        generationError = status.error ?? String(localized: "Program generation failed")
                        showGenerationErrorAlert = true
                        isGeneratingProgram = false
                        showGenerationProgress = false
                    }
                    return
                }
                
                pollCount += 1
                
                // Show timeout message after 60 seconds
                if pollCount == 60 {
                    await MainActor.run {
                        showTimeoutMessage = true
                    }
                }
            } catch {
                print("[Onboarding] ❌ Error polling generation status: \(error.localizedDescription)")
                pollCount += 1
            }
        }
        
        // Timeout after max polls - JUST PROCEED
        print("[Onboarding] ⚠️ Polling timed out. Proceeding to home screen anyway.")
        await MainActor.run {
            // Instead of showing an error, we let the user into the app
            // The program might appear later if it finishes in background
            isGeneratingProgram = false
            showGenerationProgress = false
            
            // We finalize onboarding so they get to HomeView
            finalizeOnboarding()
        }
    }
    
    private func statusMessage(for status: String, progress: Int) -> String {
        switch status {
        case "queued":
            return String(localized: "Queuing program generation...")
        case "generating":
            if progress < 30 {
                return String(localized: "Preparing data...")
            } else if progress < 70 {
                return String(localized: "Generating workout program...")
            } else if progress < 90 {
                return String(localized: "Validating program...")
            } else {
                return String(localized: "Finalizing program...")
            }
        case "completed":
            return String(localized: "Program generated!")
        case "failed":
            return String(localized: "Generation failed")
        default:
            return String(localized: "Processing...")
        }
    }
    
    private func iconForStatus(_ status: String, progress: Int) -> String {
        switch status {
        case "queued":
            return "clock.fill"
        case "generating":
            if progress < 30 {
                return "gearshape.fill"
            } else if progress < 70 {
                return "sparkles"
            } else {
                return "checkmark.circle.fill"
            }
        case "completed":
            return "checkmark.circle.fill"
        case "failed":
            return "xmark.circle.fill"
        default:
            return "hourglass"
        }
    }
    
    private func syncEquipmentCatalogEarly() {
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print("[Onboarding] 🔄 syncEquipmentCatalogEarly() called")
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        
        Task {
            var retryCount = 0
            let maxRetries = 3
            
            while retryCount < maxRetries {
                do {
                    print("[Onboarding] 🔄 Syncing equipment catalog (attempt \(retryCount + 1)/\(maxRetries))...")
                    let syncStartTime = Date()
                    
                    try await ExerciseCatalogService.shared.syncEquipmentCatalog(modelContext: modelContext)
                    
                    let syncDuration = Date().timeIntervalSince(syncStartTime)
                    print("[Onboarding] ⏱️  Sync completed in \(String(format: "%.2f", syncDuration)) seconds")
                    
                    await MainActor.run {
                        print("[Onboarding] 📥 Calling loadEquipmentCatalog() after sync...")
                        loadEquipmentCatalog()
                    }
                    
                    // Check if we got equipment
                    let descriptor = FetchDescriptor<EquipmentCatalog>()
                    if let equipment = try? modelContext.fetch(descriptor), !equipment.isEmpty {
                        print("[Onboarding] ✅ Equipment catalog synced successfully (\(equipment.count) items)")
                        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
                        return
                    } else {
                        print("[Onboarding] ⚠️ Sync completed but no equipment found in database")
                        print("[Onboarding] 📊 Checking database state...")
                        let allEquipment = try? modelContext.fetch(descriptor)
                        print("[Onboarding] 📊 Total items in database: \(allEquipment?.count ?? 0)")
                    }
                } catch {
                    print("[Onboarding] ❌ Error syncing equipment catalog (attempt \(retryCount + 1)):")
                    print("  • Error type: \(type(of: error))")
                    print("  • Error description: \(error.localizedDescription)")
                    if let nsError = error as NSError? {
                        print("  • Error domain: \(nsError.domain)")
                        print("  • Error code: \(nsError.code)")
                    }
                    retryCount += 1
                    
                    if retryCount < maxRetries {
                        let waitTime = pow(2.0, Double(retryCount))
                        print("[Onboarding] ⏳ Waiting \(waitTime) seconds before retry...")
                        // Wait before retry (exponential backoff)
                        try? await Task.sleep(nanoseconds: UInt64(waitTime * 1_000_000_000))
                    }
                }
            }
            
            print("[Onboarding] ⚠️ All sync attempts failed, loading from cache...")
            // Final attempt to load from cache even if sync failed
            await MainActor.run {
                loadEquipmentCatalog()
            }
            print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        }
    }
}

// MARK: - Helper Views

struct MotivationOption: View {
    let title: String
    let description: String
    let isSelected: Bool
    let colorScheme: ColorScheme
    let selectedTheme: String
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 8) {
                Text(title)
                    .font(.headline)
                    .foregroundColor(Color.textPrimary(for: colorScheme))
                
                Text(description)
                    .font(.subheadline)
                    .foregroundColor(Color.textSecondary(for: colorScheme))
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding()
            .background(
                isSelected
                    ? Color.themePrimaryColor(theme: selectedTheme, colorScheme: colorScheme).opacity(0.2)
                    : Color.cardBackground(for: colorScheme)
            )
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(
                        isSelected
                            ? Color.themePrimaryColor(theme: selectedTheme, colorScheme: colorScheme)
                            : Color.textSecondary(for: colorScheme).opacity(0.2),
                        lineWidth: isSelected ? 2 : 1
                    )
            )
        }
    }
}

struct LevelOption: View {
    let title: String
    let description: String
    let isSelected: Bool
    let colorScheme: ColorScheme
    let selectedTheme: String
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 8) {
                Text(title)
                    .font(.headline)
                    .foregroundColor(Color.textPrimary(for: colorScheme))
                
                Text(description)
                    .font(.subheadline)
                    .foregroundColor(Color.textSecondary(for: colorScheme))
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding()
            .background(
                isSelected
                    ? Color.themePrimaryColor(theme: selectedTheme, colorScheme: colorScheme).opacity(0.2)
                    : Color.cardBackground(for: colorScheme)
            )
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(
                        isSelected
                            ? Color.themePrimaryColor(theme: selectedTheme, colorScheme: colorScheme)
                            : Color.textSecondary(for: colorScheme).opacity(0.2),
                        lineWidth: isSelected ? 2 : 1
                    )
            )
        }
    }
}



struct OneRmField: View {
    let title: String
    @Binding var value: Int?
    let colorScheme: ColorScheme
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(LocalizedStringKey(title))
                .font(.subheadline)
                .foregroundColor(Color.textPrimary(for: colorScheme))
            TextField("kg", value: $value, format: .number)
                .textFieldStyle(.roundedBorder)
                .keyboardType(.numberPad)
        }
    }
}

// Standalone GenerationProgressView and TimeoutMessageView now used from Components/



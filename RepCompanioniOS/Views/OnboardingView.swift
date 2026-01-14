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
    @State private var goalVolume = 25
    @State private var goalEndurance = 25
    @State private var goalCardio = 25
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
    @State private var gymName: String = "Mitt Gym"
    
    @StateObject private var locationService = LocationService.shared
    @State private var showNearbyGyms = false

    @State private var gymAddress: String = ""
    @State private var gymIsPublic: Bool = false
    
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
    
    // Equipment catalog
    @State private var availableEquipment: [EquipmentCatalog] = []
    @State private var isLoadingEquipment = false
    @State private var showCamera = false
    
    private var totalSteps: Int {
        // New order: Motivation → Training Level → Health Data → Personal Info → Goals → 1RM → Frequency → Equipment → Gym Details → Step Goal → Theme
        motivationType == "sport" ? 10 : 11
    }
    
    private var progressPercentage: Double {
        Double(currentStep) / Double(totalSteps)
    }
    
    private var canProceedToNextStep: Bool {
        switch currentStep {
        case 1:
            return !motivationType.isEmpty
        case 2:
            if motivationType == "sport" {
                return !specificSport.isEmpty
            }
            return !trainingLevel.isEmpty
        case 3:
            // Health data step is optional - user can proceed even if they skip it
            return true
        case 4:
            return age != nil && sex != "" && bodyWeight != nil && height != nil && birthDay != nil && birthMonth != nil && birthYear != nil
        case 5:
            return goalStrength + goalVolume + goalEndurance + goalCardio == 100
        case 6:
            return true // 1RM is optional (auto-calculated defaults)
        case 7:
            return sessionsPerWeek > 0 && sessionDuration > 0
        case 8:
            return !selectedEquipment.isEmpty
        case 9:
            return !gymName.isEmpty // Gym details - name is required
        case 10:
            return true // Step Goal (shown while Program AI works)
        case 11:
            return true // Theme selection (only if not sport)
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
                
                // Hide navigation buttons for Equipment step as it has its own Bottom overlay in the unified view
                if currentStep != 8 {
                    HStack {
                        if currentStep > 1 {
                            Button(action: goToPreviousStep) {
                                HStack {
                                    Image(systemName: "chevron.left")
                                    Text("Back", comment: "Back button")
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
            .alert("Programgenerering misslyckades", isPresented: $showGenerationErrorAlert) {
                Button(String(localized: "Försöka igen")) {
                    generationError = nil
                    showGenerationErrorAlert = false
                    // Retry program generation
                    completeOnboarding()
                }
                Button(String(localized: "Fortsätt utan program"), role: .cancel) {
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
                    Text(String(localized: "Programgenerering lyckades inte just nu. \(error)\n\nVill du försöka igen eller fortsätta utan program?"))
                } else {
                    Text(String(localized: "Programgenerering lyckades inte just nu.\n\nVill du försöka igen eller fortsätta utan program?"))
                }
            }
            .alert("Kontrollera värde", isPresented: $showValueValidationAlert) {
                Button(String(localized: "OK")) {
                    showValueValidationAlert = false
                }
            } message: {
                Text(valueValidationMessage)
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
                trainingLevelStep
            }
        case 3:
            // Always show Health Data step (optional, user can skip)
            healthDataStep
        case 4:
            // Personal Info (shows imported data if Health import was done)
            personalInfoStep
        case 5:
            // Training Goals → Starts 1RM AI query when user clicks "Continue"
            trainingGoalsStep
        case 6:
            // 1RM (shows standardized values while AI works)
            oneRmStep
        case 7:
            // Training Frequency
            trainingFrequencyStep
        case 8:
            // Equipment → Starts Program AI query when user clicks "Continue", saves gym as "Mitt Gym"
            equipmentStep
        case 9:
            // Gym Details → User enters gym name, address, and type
            gymDetailsStep
        case 10:
            // Step Goal (shown while Program AI works)
            stepGoalStep
        case 11:
            // Theme (if not sport)
            if motivationType == "sport" {
                EmptyView() // No theme step for sport
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
                    title: LocalizedStringKey("Lose weight"),
                    description: LocalizedStringKey("Lose weight and improve your health."),
                    isSelected: motivationType == "viktminskning",
                    colorScheme: colorScheme,
                    selectedTheme: selectedTheme,
                    action: { motivationType = "viktminskning" }
                )
                
                MotivationOption(
                    title: LocalizedStringKey("Rehabilitation"),
                    description: LocalizedStringKey("Recover from injury or illness."),
                    isSelected: motivationType == "rehabilitation",
                    colorScheme: colorScheme,
                    selectedTheme: selectedTheme,
                    action: { motivationType = "rehabilitation" }
                )
                
                MotivationOption(
                    title: LocalizedStringKey("Better health"),
                    description: LocalizedStringKey("Improve stamina, fitness and energy."),
                    isSelected: motivationType == "better_health",
                    colorScheme: colorScheme,
                    selectedTheme: selectedTheme,
                    action: { motivationType = "better_health" }
                )
                
                MotivationOption(
                    title: LocalizedStringKey("Build muscle"),
                    description: LocalizedStringKey("Build muscle mass and get stronger."),
                    isSelected: motivationType == "build_muscle",
                    colorScheme: colorScheme,
                    selectedTheme: selectedTheme,
                    action: { motivationType = "build_muscle" }
                )
                
                MotivationOption(
                    title: LocalizedStringKey("Sports performance"),
                    description: LocalizedStringKey("Train to perform better in your sport."),
                    isSelected: motivationType == "sport",
                    colorScheme: colorScheme,
                    selectedTheme: selectedTheme,
                    action: { motivationType = "sport" }
                )
                
                MotivationOption(
                    title: LocalizedStringKey("Mobility"),
                    description: LocalizedStringKey("Increase mobility, reduce stiffness and prevent injury."),
                    isSelected: motivationType == "mobility",
                    colorScheme: colorScheme,
                    selectedTheme: selectedTheme,
                    action: { motivationType = "mobility" }
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
            
            VStack(spacing: 16) {
                ForEach(["fotboll", "ishockey", "basket", "tennis", "löpning", "cykling", "simning", "annat"], id: \.self) { sport in
                    Button(action: { specificSport = sport }) {
                        HStack {
                            Text(sport.capitalized)
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
                                ? Color.themePrimaryColor(theme: selectedTheme, colorScheme: colorScheme).opacity(0.2)
                                : Color.cardBackground(for: colorScheme)
                        )
                        .cornerRadius(12)
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(
                                    specificSport == sport
                                        ? Color.themePrimaryColor(theme: selectedTheme, colorScheme: colorScheme)
                                        : Color.textSecondary(for: colorScheme).opacity(0.2),
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
                    title: "Beginner",
                    description: "New to training or returning after a long break",
                    isSelected: trainingLevel == "nybörjare",
                    colorScheme: colorScheme,
                    selectedTheme: selectedTheme,
                    action: { trainingLevel = "nybörjare" }
                )
                
                LevelOption(
                    title: "Intermediate",
                    description: "Trained regularly for 6+ months",
                    isSelected: trainingLevel == "van",
                    colorScheme: colorScheme,
                    selectedTheme: selectedTheme,
                    action: { trainingLevel = "van" }
                )
                
                LevelOption(
                    title: "Advanced",
                    description: "Trained consistently for 2+ years",
                    isSelected: trainingLevel == "mycket_van",
                    colorScheme: colorScheme,
                    selectedTheme: selectedTheme,
                    action: { trainingLevel = "mycket_van" }
                )
                
                LevelOption(
                    title: "Elite",
                    description: "Professional or competitive athlete",
                    isSelected: trainingLevel == "elit",
                    colorScheme: colorScheme,
                    selectedTheme: selectedTheme,
                    action: { trainingLevel = "elit" }
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
                    Text(healthDataFetched ? LocalizedStringKey("Health data imported") : LocalizedStringKey("Import from Apple Health"))
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
            
            Text("Vi behöver lite information om dig för att anpassa din träning")
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
                            sex = "man"
                        }) {
                            Text(String(localized: "Male"))
                                .font(.subheadline)
                                .foregroundColor(sex == "man" ? .white : Color.textPrimary(for: colorScheme))
                                .padding(.vertical, 10)
                                .frame(maxWidth: .infinity)
                                .background(
                                    Group {
                                        if sex == "man" {
                                            Color.themeGradient(theme: selectedTheme, colorScheme: colorScheme)
                                        } else {
                                            Color.cardBackground(for: colorScheme)
                                        }
                                    }
                                )
                                .cornerRadius(10)
                        }
                        
                        Button(action: {
                            sex = "kvinna"
                        }) {
                            Text(String(localized: "Female"))
                                .font(.subheadline)
                                .foregroundColor(sex == "kvinna" ? .white : Color.textPrimary(for: colorScheme))
                                .padding(.vertical, 10)
                                .frame(maxWidth: .infinity)
                                .background(
                                    Group {
                                        if sex == "kvinna" {
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
                            label: "Dag",
                            value: $birthDay,
                            range: 1...31,
                            colorScheme: colorScheme,
                            selectedTheme: selectedTheme
                        )
                        .frame(maxWidth: .infinity)
                        
                        ScrollablePicker(
                            label: "Månad",
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
                            label: "År",
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
            applyDefaultPersonalInfoIfNeeded(for: sex.isEmpty ? "man" : sex)
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
        case "kvinna":
            defaultHeight = 165
            defaultWeight = 65
        case "man":
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
        let months = ["Januari", "Februari", "Mars", "April", "Maj", "Juni",
                      "Juli", "Augusti", "September", "Oktober", "November", "December"]
        guard month >= 1 && month <= 12 else { return "" }
        return months[month - 1]
    }
    
    private var summaryText: String {
        var parts: [String] = []
        
        // Start with gender
        if !sex.isEmpty {
            parts.append(sex == "man" ? "Man" : "Kvinna")
        }
        
        // Add birth date with "född" (born)
        if let day = birthDay, let month = birthMonth, let year = birthYear {
            parts.append("född \(day) \(monthName(for: month)) \(year)")
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
                valueValidationMessage = "Age exceeds 110 years. Please check your value."
                showValueValidationAlert = true
                lastValidatedAge = 110
            }
        } else if ageValue < 9 {
            // Hard limit: 10% under min
            age = 9
            if shouldShowAlert {
                valueValidationMessage = "Age is below 9 years. Please check your value."
                showValueValidationAlert = true
                lastValidatedAge = 9
            }
        } else if ageValue > 100 {
            // Over normal max, but within 10% tolerance - show warning, don't change value
            if shouldShowAlert {
                valueValidationMessage = "Entered age (\(ageValue) years) is higher than normal. Please check your value."
                showValueValidationAlert = true
                lastValidatedAge = ageValue
            }
        } else if ageValue < 10 {
            // Under normal min, but within 10% tolerance - show warning, don't change value
            if shouldShowAlert {
                valueValidationMessage = "Entered age (\(ageValue) years) is lower than normal. Please check your value."
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
                valueValidationMessage = "Weight exceeds 330 kg. Please check your value."
                showValueValidationAlert = true
                lastValidatedWeight = 330
            }
        } else if weight < 18 {
            // Hard limit: 10% under min
            bodyWeight = 18
            if shouldShowAlert {
                valueValidationMessage = "Weight is below 18 kg. Please check your value."
                showValueValidationAlert = true
                lastValidatedWeight = 18
            }
        } else if weight > 300 {
            // Over normal max, but within 10% tolerance - show warning, don't change value
            if shouldShowAlert {
                valueValidationMessage = "Entered weight (\(weight) kg) is higher than normal. Please check your value."
                showValueValidationAlert = true
                lastValidatedWeight = weight
            }
        } else if weight < 20 {
            // Under normal min, but within 10% tolerance - show warning, don't change value
            if shouldShowAlert {
                valueValidationMessage = "Entered weight (\(weight) kg) is lower than normal. Please check your value."
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
                valueValidationMessage = "Height exceeds 253 cm. Please check your value."
                showValueValidationAlert = true
                lastValidatedHeight = 253
            }
        } else if heightValue < 90 {
            // Hard limit: 10% under min
            height = 90
            if shouldShowAlert {
                valueValidationMessage = "Längd understiger 90 cm. Vänligen kontrollera ditt angivna värde."
                showValueValidationAlert = true
                lastValidatedHeight = 90
            }
        } else if heightValue > 230 {
            // Over normal max, but within 10% tolerance - show warning, don't change value
            if shouldShowAlert {
                valueValidationMessage = "Angiven längd (\(heightValue) cm) är högre än normalt. Vänligen kontrollera ditt angivna värde."
                showValueValidationAlert = true
                lastValidatedHeight = heightValue
            }
        } else if heightValue < 100 {
            // Under normal min, but within 10% tolerance - show warning, don't change value
            if shouldShowAlert {
                valueValidationMessage = "Angiven längd (\(heightValue) cm) är lägre än normalt. Vänligen kontrollera ditt angivna värde."
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
                    title: "Strength",
                    value: Binding(
                        get: { goalStrength },
                        set: { newValue in
                            adjustGoals(changed: .strength, to: newValue)
                        }
                    ),
                    colorScheme: colorScheme,
                    selectedTheme: selectedTheme
                )
                
                GoalSlider(
                    title: "Volume",
                    value: Binding(
                        get: { goalVolume },
                        set: { newValue in
                            adjustGoals(changed: .volume, to: newValue)
                        }
                    ),
                    colorScheme: colorScheme,
                    selectedTheme: selectedTheme
                )
                
                GoalSlider(
                    title: "Endurance",
                    value: Binding(
                        get: { goalEndurance },
                        set: { newValue in
                            adjustGoals(changed: .endurance, to: newValue)
                        }
                    ),
                    colorScheme: colorScheme,
                    selectedTheme: selectedTheme
                )
                
                GoalSlider(
                    title: "Cardio",
                    value: Binding(
                        get: { goalCardio },
                        set: { newValue in
                            adjustGoals(changed: .cardio, to: newValue)
                        }
                    ),
                    colorScheme: colorScheme,
                    selectedTheme: selectedTheme
                )
            }
            
            let total = goalStrength + goalVolume + goalEndurance + goalCardio
            Text(String(localized: "Total: \(total)%%"))
                .font(.caption)
                .foregroundColor(
                    goalStrength + goalVolume + goalEndurance + goalCardio == 100
                        ? Color.green
                        : Color.red
                )
        }
        .onAppear {
            // Auto-calculate preset goals if not already calculated and we have required data
            if !goalsCalculated && !motivationType.isEmpty && !trainingLevel.isEmpty {
                calculatePresetGoals()
            }
            
            // 1RM calculation should already be started when user clicked "Fortsätt" on Personal Info step
            // Values should be ready by the time user reaches 1RM step
            if oneRmCalculated {
                print("[Onboarding] ✅ 1RM values already calculated and ready")
            }
        }
    }
    
    // MARK: - Step 6: Training Frequency
    
    private var trainingFrequencyStep: some View {
        VStack(spacing: 24) {
            Text(String(localized: "Training Frequency"))
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(Color.textPrimary(for: colorScheme))
                .multilineTextAlignment(.center)
            
            VStack(spacing: 24) {
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
                    ), in: 30...180, step: 15)
                    .tint(Color.themePrimaryColor(theme: selectedTheme, colorScheme: colorScheme))
                }
            }
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
                    title: "Bench Press",
                    value: Binding(
                        get: { oneRmBench },
                        set: { oneRmBench = $0 }
                    ),
                    colorScheme: colorScheme
                )
                
                OneRmField(
                    title: "Overhead Press",
                    value: Binding(
                        get: { oneRmOhp },
                        set: { oneRmOhp = $0 }
                    ),
                    colorScheme: colorScheme
                )
                
                OneRmField(
                    title: "Deadlift",
                    value: Binding(
                        get: { oneRmDeadlift },
                        set: { oneRmDeadlift = $0 }
                    ),
                    colorScheme: colorScheme
                )
                
                OneRmField(
                    title: "Squat",
                    value: Binding(
                        get: { oneRmSquat },
                        set: { oneRmSquat = $0 }
                    ),
                    colorScheme: colorScheme
                )
                
                OneRmField(
                    title: "Lat Pulldown",
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
            
            VStack(spacing: 20) {
                // Manual Entry Section
                VStack(alignment: .leading, spacing: 16) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(String(localized: "Gym Name"))
                            .font(.caption)
                            .foregroundColor(Color.textSecondary(for: colorScheme))
                        TextField("Enter gym name", text: $gymName)
                            .textFieldStyle(RoundedBorderTextFieldStyle())
                            .focused($focusedField, equals: .gymName)
                    }
                    
                    VStack(alignment: .leading, spacing: 8) {
                        Text(String(localized: "Address (Optional)"))
                            .font(.caption)
                            .foregroundColor(Color.textSecondary(for: colorScheme))
                        
                        HStack {
                            TextField("Enter address", text: $gymAddress)
                                .textFieldStyle(RoundedBorderTextFieldStyle())
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
                                Divider()
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
                                    Divider()
                                }
                            }
                            .padding(.vertical, 8)
                            .background(Color.cardBackground(for: colorScheme))
                            .cornerRadius(8)
                        }
                    }
                    
                    Toggle("Public Gym", isOn: $gymIsPublic)
                        .tint(Color.themePrimaryColor(theme: selectedTheme, colorScheme: colorScheme))
                }
                .padding()
                .background(
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color.cardBackground(for: colorScheme))
                )
                
                // Find Nearby Section
                Button(action: {
                    locationService.requestPermission()
                    locationService.searchNearbyGyms()
                    showNearbyGyms = true
                }) {
                    HStack {
                        Image(systemName: "location.fill")
                        if locationService.isSearching {
                            ProgressView()
                                .padding(.leading, 8)
                        } else {
                            Text("Sök gym i närheten")
                        }
                        Spacer()
                    }
                    .padding()
                    .background(Color.cardBackground(for: colorScheme))
                    .cornerRadius(12)
                    .foregroundColor(Color.themePrimaryColor(theme: selectedTheme, colorScheme: colorScheme))
                }
                
                // Nearby Gyms List
                if showNearbyGyms && !locationService.nearbyGyms.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Gym i närheten")
                            .font(.caption)
                            .foregroundColor(.gray)
                            .padding(.horizontal)
                        
                        ScrollView {
                            VStack(spacing: 8) {
                                ForEach(locationService.nearbyGyms.prefix(5)) { nearby in
                                    Button(action: {
                                        self.gymName = nearby.name
                                        self.gymAddress = nearby.address ?? ""
                                        // We don't have separate lat/long state in OnboardingView yet, 
                                        // but getting name/address is the main goal.
                                        self.showNearbyGyms = false
                                    }) {
                                        HStack {
                                            VStack(alignment: .leading) {
                                                Text(nearby.name)
                                                    .foregroundColor(Color.textPrimary(for: colorScheme))
                                                if let addr = nearby.address {
                                                    Text(addr)
                                                        .font(.caption)
                                                        .foregroundColor(.gray)
                                                        .lineLimit(1)
                                                }
                                            }
                                            Spacer()
                                            if nearby.distance < 1000 {
                                                Text("\(Int(nearby.distance)) m")
                                                    .font(.caption)
                                                    .foregroundColor(.gray)
                                            } else {
                                                Text(String(format: "%.1f km", nearby.distance / 1000.0))
                                                    .font(.caption)
                                                    .foregroundColor(.gray)
                                            }
                                        }
                                        .padding()
                                        .background(
                                            RoundedRectangle(cornerRadius: 12)
                                                .fill(Color.cardBackground(for: colorScheme).opacity(0.8))
                                        )
                                    }
                                }
                            }
                        }
                        .frame(maxHeight: 200)
                    }
                }
            }
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
                            
                            Text(theme)
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
                        title: "Light",
                        icon: "sun.max.fill",
                        isSelected: selectedColorScheme == "light",
                        colorScheme: colorScheme,
                        action: {
                            selectedColorScheme = "light"
                            savedColorScheme = "light"
                        }
                    )
                    
                    ColorSchemeButton(
                        title: "Dark",
                        icon: "moon.fill",
                        isSelected: selectedColorScheme == "dark",
                        colorScheme: colorScheme,
                        action: {
                            selectedColorScheme = "dark"
                            savedColorScheme = "dark"
                        }
                    )
                    
                    ColorSchemeButton(
                        title: "Auto",
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
            // Start 1RM calculation when user proceeds from Personal Info step (step 4) to Training Goals step (step 5)
            // This ensures the calculation runs in the background while user adjusts training goals
            if currentStep == 4 && !oneRmCalculated {
                // Check if we have all required data for 1RM calculation
                if age != nil && bodyWeight != nil && height != nil && !sex.isEmpty && !trainingLevel.isEmpty && !motivationType.isEmpty {
                    print("[Onboarding] 🚀 Starting 1RM calculation in background (user clicked Fortsätt on Personal Info step)...")
                    print("[Onboarding] 📊 Data: age=\(age!), weight=\(bodyWeight!), height=\(height!), sex=\(sex), level=\(trainingLevel), motivation=\(motivationType)")
                    calculateSuggestedOneRm()
                } else {
                    print("[Onboarding] ⚠️ Missing data for 1RM calculation: age=\(age?.description ?? "nil"), bodyWeight=\(bodyWeight?.description ?? "nil"), height=\(height?.description ?? "nil"), sex=\(sex.isEmpty ? "empty" : sex), trainingLevel=\(trainingLevel), motivationType=\(motivationType)")
                }
            }
            
            // Start Program AI query when user clicks "Continue" on Gym Details step (step 9)
            // Save gym and start program generation in background
            if currentStep == 9 {
                print("[Onboarding] 🚀 Starting program generation from Gym Details step...")
                startProgramGeneration()
            }
            
            // Handle Step Goal step (step 10) - just proceed to Theme
            if currentStep == 10 && currentStep < totalSteps {
                // Just proceed to next step (Theme)
                currentStep += 1
                updateStepIcon()
                return
            }
            
            currentStep += 1
            updateStepIcon()
        }
    }
    
    private func goToPreviousStep() {
        if currentStep > 1 {
            currentStep -= 1
            updateStepIcon()
        }
    }
    
    // MARK: - Program Generation
    
    private func startProgramGeneration() {
        Task {
            let userId = authService.currentUserId ?? "dev-user-123"
            
            // Save gym with user details
            print("[Onboarding] 🏋️ Creating gym '\(gymName)' with \(selectedEquipment.count) equipment items")
            _ = try await GymService.shared.createGym(
                name: gymName,
                location: gymAddress.isEmpty ? nil : gymAddress,
                equipmentIds: selectedEquipment,
                isPublic: gymIsPublic,
                userId: userId,
                modelContext: modelContext
            )
            
            // Mark that generation started early
            await MainActor.run {
                programGenerationStartedEarly = true
                isGeneratingProgram = true
            }
            
            // Start the actual program generation in background
            // This will run while user is on Step Goal step
            print("[Onboarding] 🚀 Starting program generation in background from Equipment step...")
            
            do {
                let profileData = APIService.OnboardingCompleteRequest.ProfileData(
                    motivationType: motivationType,
                    trainingLevel: trainingLevel,
                    specificSport: motivationType == "sport" ? specificSport : nil,
                    age: age,
                    sex: sex.isEmpty ? nil : sex,
                    bodyWeight: bodyWeight,
                    height: height,
                    goalStrength: goalStrength,
                    goalVolume: goalVolume,
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
                    useV4: true
                )
                
                print("[Onboarding] ✅ Program generation started, response received")
                print("[Onboarding] 📋 Response: success=\(response.success), hasProgram=\(response.hasProgram ?? false), templatesCreated=\(response.templatesCreated ?? 0)")
                
                // Store jobId if available
                if let jobId = response.program?.jobId {
                    await MainActor.run {
                        generationJobId = jobId
                    }
                }
                
                // Program generation is now running in background
                // User can proceed to Step Goal step while it generates
                
                if response.success && (response.hasProgram == true || (response.templatesCreated ?? 0) > 0) {
                    await MainActor.run {
                        programGenerationComplete = true
                        print("[Onboarding] ✅ Background program generation complete!")
                    }
                }
            } catch {
                print("[Onboarding] ❌ Error starting program generation: \(error.localizedDescription)")
                print("[Onboarding] ℹ️ User can continue onboarding - error will be shown if they wait for program")
                await MainActor.run {
                    isGeneratingProgram = false
                    programGenerationStartedEarly = false
                    // Don't show alert immediately - let user continue to next steps
                    // Error will be shown later if user tries to wait for program completion
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
            currentStepIcon = "dumbbell.fill"
        case 7:
            currentStepIcon = "calendar"
        case 8:
            currentStepIcon = "square.grid.2x2.fill"
        case 9:
            currentStepIcon = "figure.walk" // Step Goal
        case 10:
            currentStepIcon = "paintpalette.fill"
        default:
            currentStepIcon = "circle.fill"
        }
    }
    
    private func adjustGoals(changed: GoalType, to newValue: Int) {
        // Clamp the new value to valid range
        let clampedNewValue = max(0, min(100, newValue))
        
        // Get the old value of the changed goal
        let oldValue: Int
        switch changed {
        case .strength:
            oldValue = goalStrength
        case .volume:
            oldValue = goalVolume
        case .endurance:
            oldValue = goalEndurance
        case .cardio:
            oldValue = goalCardio
        }
        
        // Calculate the difference (delta)
        let delta = clampedNewValue - oldValue
        
        // If no change, return early
        guard delta != 0 else { return }
        
        // Update the changed goal first
        switch changed {
        case .strength:
            goalStrength = clampedNewValue
        case .volume:
            goalVolume = clampedNewValue
        case .endurance:
            goalEndurance = clampedNewValue
        case .cardio:
            goalCardio = clampedNewValue
        }
        
        // Get current values of other goals
        let otherGoals: [(GoalType, Int)] = [
            (.strength, goalStrength),
            (.volume, goalVolume),
            (.endurance, goalEndurance),
            (.cardio, goalCardio)
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
                    case .strength: goalStrength = value
                    case .volume: goalVolume = value
                    case .endurance: goalEndurance = value
                    case .cardio: goalCardio = value
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
                    case .strength:
                        newValue = max(0, min(100, goalStrength + adjustment))
                        goalStrength = newValue
                    case .volume:
                        newValue = max(0, min(100, goalVolume + adjustment))
                        goalVolume = newValue
                    case .endurance:
                        newValue = max(0, min(100, goalEndurance + adjustment))
                        goalEndurance = newValue
                    case .cardio:
                        newValue = max(0, min(100, goalCardio + adjustment))
                        goalCardio = newValue
                    }
                }
            }
        }
        
        // Final check: ensure exact 100% (handle any edge cases)
        let finalTotal = goalStrength + goalVolume + goalEndurance + goalCardio
        if finalTotal != 100 {
            let difference = 100 - finalTotal
            // Apply difference to the changed goal (clamp if needed)
            switch changed {
            case .strength:
                goalStrength = max(0, min(100, goalStrength + difference))
            case .volume:
                goalVolume = max(0, min(100, goalVolume + difference))
            case .endurance:
                goalEndurance = max(0, min(100, goalEndurance + difference))
            case .cardio:
                goalCardio = max(0, min(100, goalCardio + difference))
            }
        }
    }
    
    private enum GoalType {
        case strength, volume, endurance, cardio
    }
    
    /// Calculate preset goals based on motivationType and trainingLevel (local calculation)
    private func calculatePresetGoals() {
        print("[Onboarding] 🎯 Calculating preset training goals based on \(motivationType) + \(trainingLevel)...")
        
        var strength = 25
        var volume = 25
        var endurance = 25
        var cardio = 25
        
        // Base distribution on motivationType
        switch motivationType.lowercased() {
        case "viktminskning":
            cardio = 40
            endurance = 30
            strength = 20
            volume = 10
        case "rehabilitering":
            strength = 30
            endurance = 40
            volume = 20
            cardio = 10
        case "bättre_hälsa":
            endurance = 35
            cardio = 35
            strength = 20
            volume = 10
        case "sport":
            strength = 35
            endurance = 30
            volume = 20
            cardio = 15
        case "build_muscle", "bygga_muskler", "hypertrofi", "fitness":
            // Focus on strength and volume for muscle building
            strength = 30
            volume = 30
            endurance = 25
            cardio = 15
        case "mobility", "bli_rörligare":
            // Focus on mobility, flexibility, and injury prevention
            strength = 25
            volume = 20
            endurance = 30
            cardio = 25
        default:
            // Default balanced distribution
            strength = 30
            volume = 30
            endurance = 25
            cardio = 15
        }
        
        // Adjust based on training level
        switch trainingLevel.lowercased() {
        case "nybörjare":
            // For "bygga_muskler", keep higher strength/volume even for beginners
            if motivationType.lowercased() == "build_muscle" || motivationType.lowercased() == "bygga_muskler" || motivationType.lowercased() == "hypertrofi" || motivationType.lowercased() == "fitness" {
                // Smaller adjustment for muscle building - still prioritize strength/volume
                strength = max(25, strength - 5)
                volume = max(25, volume - 5)
                endurance += 5
                cardio += 5
            } else {
                // For other goals, larger adjustment for beginners
                strength = max(15, strength - 10)
                volume = max(10, volume - 10)
                endurance += 10
                cardio += 10
            }
        case "mycket_van", "elit":
            strength += 10
            volume += 5
            endurance = max(15, endurance - 10)
            cardio = max(10, cardio - 5)
        default:
            // "van" (intermediate) - no adjustment
            break
        }
        
        // Normalize to 100%
        let total = strength + volume + endurance + cardio
        let normalizedStrength = Int((Double(strength) / Double(total)) * 100)
        let normalizedVolume = Int((Double(volume) / Double(total)) * 100)
        let normalizedEndurance = Int((Double(endurance) / Double(total)) * 100)
        let normalizedCardio = Int((Double(cardio) / Double(total)) * 100)
        
        // Final check to ensure sum is exactly 100
        let sum = normalizedStrength + normalizedVolume + normalizedEndurance + normalizedCardio
        let diff = 100 - sum
        
        goalStrength = normalizedStrength
        goalVolume = normalizedVolume
        goalEndurance = normalizedEndurance
        goalCardio = normalizedCardio + diff // Add difference to cardio
        
        goalsCalculated = true
        
        print("[Onboarding] ✅ Preset goals calculated: Strength=\(goalStrength)%, Volume=\(goalVolume)%, Endurance=\(goalEndurance)%, Cardio=\(goalCardio)%")
    }
    
    /// Calculate suggested goals via API (fallback or for refinement)
    private func calculateSuggestedGoals() {
        Task {
            do {
                print("[Onboarding] 🎯 Calculating suggested training goals via API...")
                let suggestedGoals = try await APIService.shared.suggestTrainingGoals(
                    motivationType: motivationType,
                    trainingLevel: trainingLevel,
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
                    goalVolume = suggestedGoals.goalVolume
                    goalEndurance = suggestedGoals.goalEndurance
                    goalCardio = suggestedGoals.goalCardio
                    goalsCalculated = true
                    
                    print("[Onboarding] ✅ Suggested goals calculated: Strength=\(goalStrength)%, Volume=\(goalVolume)%, Endurance=\(goalEndurance)%, Cardio=\(goalCardio)%")
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
        let isMale = (sex == "man" || sex.isEmpty)
        let isBeginner = (trainingLevel == "nybörjare" || trainingLevel.isEmpty)
        
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
                            sex = "man"
                        } else if biologicalSex == .female {
                            sex = "kvinna"
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
            }
            
            // capture state safely
            let startedEarly = await MainActor.run { programGenerationStartedEarly }
            let complete = await MainActor.run { programGenerationComplete }
            
            if startedEarly {
                if complete {
                    print("[Onboarding] ✅ Generation already complete, showing completion animation...")
                    await MainActor.run {
                        showGenerationProgress = true
                        generationStatus = "Slutför..."
                    }
                    
                    // Show "fake" completion animation for 10s as requested to allow full sync/population
                    try? await Task.sleep(nanoseconds: 10_000_000_000) // 10 seconds
                    
                    finalizeOnboarding()
                } else {
                    print("[Onboarding] ⏳ Generation still in progress, waiting for completion...")
                    await MainActor.run {
                        showGenerationProgress = true
                    }
                    waitForGenerationCompletion()
                }
                return
            }
        
        Task {
            isGeneratingProgram = true
            showGenerationProgress = true
            generationStatus = "Genererar ditt program..."
            
            do {

                
                // Start program generation now (original flow)
                let profileData = APIService.OnboardingCompleteRequest.ProfileData(
                    motivationType: motivationType,
                    trainingLevel: trainingLevel,
                    specificSport: motivationType == "sport" ? specificSport : nil,
                    age: age,
                    sex: sex.isEmpty ? nil : sex,
                    bodyWeight: bodyWeight,
                    height: height,
                    goalStrength: goalStrength,
                    goalVolume: goalVolume,
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
                
                print("[Onboarding] 📡 Calling APIService.shared.completeOnboarding...")
                async let responseTask = APIService.shared.completeOnboarding(
                    profile: profileData,
                    equipment: selectedEquipment,
                    useV4: true // Use V4 AI architecture for program generation
                )
                
                // Wait for both the API call and the minimum duration
                let response = try await responseTask
                let elapsed = Date().timeIntervalSince(startTime)
                let remaining = minDuration - elapsed
                
                if remaining > 0 {
                    print("[Onboarding] ⏳ Waiting \(remaining)s to meet minimum animation time...")
                    try await Task.sleep(nanoseconds: UInt64(remaining * 1_000_000_000))
                }
                
                if response.success {
                    print("[Onboarding] ✅ Success! Passing response to finalize...")
                    finalizeOnboarding(response: response)
                } else {
                    await MainActor.run {
                        generationError = "Programgenerering misslyckades."
                        showGenerationErrorAlert = true
                        isGeneratingProgram = false
                        showGenerationProgress = false
                    }
                }
            } catch {
                print("[Onboarding] ❌ Error completing onboarding: \(error.localizedDescription)")
                await MainActor.run {
                    generationError = "Ett oväntat fel uppstod: \(error.localizedDescription)"
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
            // Wait up to 5 minutes (300 attempts * 1s) to match API timeout
            while !programGenerationComplete && attempts < 300 {
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
                    // If we timed out waiting, but the task is technically still running in background,
                    // we might want to check status explicitly or just show error.
                    // For now, assume it failed or got stuck.
                    generationError = "Programgenerering tog för lång tid. Vänligen försök igen."
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
                    }
                    
                    try? modelContext.save()
                    print("[Onboarding] ✅ Profile marked as onboarding completed and synced")
                    
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
                            generationError = "Programmet är klart men kunde inte laddas. Försök öppna appen igen."
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
                            name: "Mitt Gym",
                            location: "Standard plats",
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
                        generationError = status.error ?? "Programgenerering misslyckades"
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
            return "Köar programgenerering..."
        case "generating":
            if progress < 30 {
                return "Förbereder data..."
            } else if progress < 70 {
                return "Genererar träningsprogram..."
            } else if progress < 90 {
                return "Validerar program..."
            } else {
                return "Slutför program..."
            }
        case "completed":
            return "Program genererat!"
        case "failed":
            return "Generering misslyckades"
        default:
            return "Bearbetar..."
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
    let title: LocalizedStringKey
    let description: LocalizedStringKey
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
    let title: LocalizedStringKey
    let description: LocalizedStringKey
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
            Text(title)
                .font(.subheadline)
                .foregroundColor(Color.textPrimary(for: colorScheme))
            TextField("kg", value: $value, format: .number)
                .textFieldStyle(.roundedBorder)
                .keyboardType(.numberPad)
        }
    }
}

// Standalone GenerationProgressView and TimeoutMessageView now used from Components/



import SwiftUI
import SwiftData
import AVFoundation

struct OnboardingView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme
    
    @StateObject private var authService = AuthService.shared
    
    // Step management
    @State private var currentStep = 1
    @State private var currentStepIcon = "heart.fill"
    
    // Program generation
    @State private var isGeneratingProgram = false
    @State private var generationError: String?
    @State private var generationJobId: String?
    @State private var generationProgress = 0
    @State private var generationStatus = ""
    @State private var showGenerationProgress = false
    @State private var showTimeoutMessage = false
    
    // Onboarding data
    @State private var motivationType = ""
    @State private var specificSport = ""
    @State private var trainingLevel = ""
    @State private var age: Int?
    @State private var sex = ""
    @State private var bodyWeight: Int?
    @State private var height: Int?
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
    @State private var selectedTheme = "Main" // Default theme
    @State private var selectedColorScheme: String = "auto"
    @AppStorage("savedColorScheme") private var savedColorScheme: String = "auto"
    
    // Equipment catalog
    @State private var availableEquipment: [EquipmentCatalog] = []
    @State private var isLoadingEquipment = false
    @State private var showCamera = false
    
    private var totalSteps: Int {
        // New order: Motivation → Training Level → Personal Info → Goals → 1RM → Frequency → Equipment → Theme
        motivationType == "sport" ? 9 : 8
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
            if motivationType == "sport" {
                return !trainingLevel.isEmpty
            }
            // Health data step is optional - user can proceed even if they skip it
            return true
        case 4:
            return age != nil && sex != "" && bodyWeight != nil && height != nil
        case 5:
            return goalStrength + goalVolume + goalEndurance + goalCardio == 100
        case 6:
            return true // 1RM is optional (auto-calculated defaults)
        case 7:
            return sessionsPerWeek > 0 && sessionDuration > 0
        case 8:
            return !selectedEquipment.isEmpty
        case 9:
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
                    
                    // Navigation buttons
                    HStack {
                        if currentStep > 1 {
                            Button(action: goToPreviousStep) {
                                HStack {
                                    Image(systemName: "chevron.left")
                                    Text("Tillbaka")
                                }
                                .foregroundColor(Color.textPrimary(for: colorScheme))
                                .padding()
                                .frame(maxWidth: .infinity)
                                .background(Color.cardBackground(for: colorScheme))
                                .cornerRadius(12)
                            }
                        }
                        
                        Button(action: {
                            if currentStep == totalSteps {
                                completeOnboarding()
                            } else {
                                goToNextStep()
                            }
                        }) {
                            HStack {
                                Text(currentStep == totalSteps ? "Slutför" : "Fortsätt")
                                if currentStep < totalSteps {
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
            .alert("Fel", isPresented: .constant(generationError != nil)) {
                Button("OK") {
                    generationError = nil
                }
            } message: {
                if let error = generationError {
                    Text(error)
                }
            }
            .sheet(isPresented: $showCamera) {
                EquipmentCameraView { equipment in
                    selectedEquipment.append(contentsOf: equipment)
                    showCamera = false
                }
            }
            .task {
                if !authService.isAuthenticated {
                    await autoLoginForAlphaTesting()
                }
                syncEquipmentCatalogEarly()
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
            if motivationType == "sport" {
                trainingLevelStep
            } else {
                healthDataStep
            }
        case 4:
            personalInfoStep
        case 5:
            trainingGoalsStep
        case 6:
            oneRmStep
        case 7:
            trainingFrequencyStep
        case 8:
            equipmentStep
        case 9:
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
            Text("Vad motiverar dig att träna?")
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(Color.textPrimary(for: colorScheme))
                .multilineTextAlignment(.center)
            
            Text("Välj ditt primära träningsmål")
                .font(.subheadline)
                .foregroundColor(Color.textSecondary(for: colorScheme))
                .multilineTextAlignment(.center)
            
            VStack(spacing: 16) {
                MotivationOption(
                    title: "Viktminskning",
                    description: "Gå ner i vikt och förbättra hälsan",
                    isSelected: motivationType == "viktminskning",
                    colorScheme: colorScheme,
                    selectedTheme: selectedTheme,
                    action: { motivationType = "viktminskning" }
                )
                
                MotivationOption(
                    title: "Rehabilitering",
                    description: "Återhämta dig efter skada eller sjukdom",
                    isSelected: motivationType == "rehabilitering",
                    colorScheme: colorScheme,
                    selectedTheme: selectedTheme,
                    action: { motivationType = "rehabilitering" }
                )
                
                MotivationOption(
                    title: "Hälsa & Livsstil",
                    description: "Förbättra uthållighet och kondition",
                    isSelected: motivationType == "hälsa_livsstil",
                    colorScheme: colorScheme,
                    selectedTheme: selectedTheme,
                    action: { motivationType = "hälsa_livsstil" }
                )
                
                MotivationOption(
                    title: "Sport",
                    description: "Träna för en specifik sport",
                    isSelected: motivationType == "sport",
                    colorScheme: colorScheme,
                    selectedTheme: selectedTheme,
                    action: { motivationType = "sport" }
                )
            }
        }
    }
    
    // MARK: - Step 2: Sport Selection (if sport)
    
    private var sportSelectionStep: some View {
        VStack(spacing: 24) {
            Text("Vilken sport tränar du för?")
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
            Text("Vilken är din träningsnivå?")
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(Color.textPrimary(for: colorScheme))
                .multilineTextAlignment(.center)
            
            Text("Detta hjälper oss att anpassa programmet")
                .font(.subheadline)
                .foregroundColor(Color.textSecondary(for: colorScheme))
                .multilineTextAlignment(.center)
            
            VStack(spacing: 16) {
                LevelOption(
                    title: "Nybörjare",
                    description: "Ny till träning eller återkommer efter lång paus",
                    isSelected: trainingLevel == "nybörjare",
                    colorScheme: colorScheme,
                    selectedTheme: selectedTheme,
                    action: { trainingLevel = "nybörjare" }
                )
                
                LevelOption(
                    title: "Van",
                    description: "Tränat regelbundet i 6+ månader",
                    isSelected: trainingLevel == "van",
                    colorScheme: colorScheme,
                    selectedTheme: selectedTheme,
                    action: { trainingLevel = "van" }
                )
                
                LevelOption(
                    title: "Mycket van",
                    description: "Tränat konsekvent i 2+ år",
                    isSelected: trainingLevel == "mycket_van",
                    colorScheme: colorScheme,
                    selectedTheme: selectedTheme,
                    action: { trainingLevel = "mycket_van" }
                )
                
                LevelOption(
                    title: "Elit",
                    description: "Professionell eller tävlingsidrottare",
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
            Text("Hämta hälsodata")
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(Color.textPrimary(for: colorScheme))
                .multilineTextAlignment(.center)
            
            Text("Vi kan hämta din vikt, längd och ålder från Apple Health")
                .font(.subheadline)
                .foregroundColor(Color.textSecondary(for: colorScheme))
                .multilineTextAlignment(.center)
            
            Button(action: fetchHealthData) {
                HStack {
                    Image(systemName: healthDataFetched ? "checkmark.circle.fill" : "heart.fill")
                    Text(healthDataFetched ? "Hälsodata hämtat" : "Hämta från Apple Health")
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
                    Text("Hälsodata hämtat. Du kan ändra värdena manuellt på nästa steg")
                        .font(.caption)
                        .foregroundColor(Color.textSecondary(for: colorScheme))
                } else {
                    Text("Inga hälsodata hittades. Du kan fylla i värdena manuellt på nästa steg")
                        .font(.caption)
                        .foregroundColor(Color.textSecondary(for: colorScheme))
                }
            }
        }
    }
    
    // MARK: - Step 4: Personal Info
    
    private var personalInfoStep: some View {
        VStack(spacing: 24) {
            Text("Personlig information")
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(Color.textPrimary(for: colorScheme))
                .multilineTextAlignment(.center)
            
            VStack(spacing: 16) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Ålder")
                        .font(.subheadline)
                        .foregroundColor(Color.textPrimary(for: colorScheme))
                    TextField("Ålder", value: $age, format: .number)
                        .textFieldStyle(.roundedBorder)
                        .keyboardType(.numberPad)
                }
                
                VStack(alignment: .leading, spacing: 8) {
                    Text("Kön")
                        .font(.subheadline)
                        .foregroundColor(Color.textPrimary(for: colorScheme))
                    HStack(spacing: 16) {
                        Button(action: { sex = "man" }) {
                            Text("Man")
                                .foregroundColor(sex == "man" ? .white : Color.textPrimary(for: colorScheme))
                                .padding()
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
                                .cornerRadius(12)
                        }
                        
                        Button(action: { sex = "kvinna" }) {
                            Text("Kvinna")
                                .foregroundColor(sex == "kvinna" ? .white : Color.textPrimary(for: colorScheme))
                                .padding()
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
                                .cornerRadius(12)
                        }
                    }
                }
                
                VStack(alignment: .leading, spacing: 8) {
                    Text("Vikt (kg)")
                        .font(.subheadline)
                        .foregroundColor(Color.textPrimary(for: colorScheme))
                    TextField("Vikt", value: $bodyWeight, format: .number)
                        .textFieldStyle(.roundedBorder)
                        .keyboardType(.numberPad)
                }
                
                VStack(alignment: .leading, spacing: 8) {
                    Text("Längd (cm)")
                        .font(.subheadline)
                        .foregroundColor(Color.textPrimary(for: colorScheme))
                    TextField("Längd", value: $height, format: .number)
                        .textFieldStyle(.roundedBorder)
                        .keyboardType(.numberPad)
                }
            }
        }
    }
    
    // MARK: - Step 5: Training Goals
    
    private var trainingGoalsStep: some View {
        VStack(spacing: 24) {
            Text("Träningsmål")
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(Color.textPrimary(for: colorScheme))
                .multilineTextAlignment(.center)
            
            Text("Fördela 100% mellan dina träningsmål")
                .font(.subheadline)
                .foregroundColor(Color.textSecondary(for: colorScheme))
                .multilineTextAlignment(.center)
            
            VStack(spacing: 20) {
                GoalSlider(
                    title: "Styrka",
                    value: Binding(
                        get: { goalStrength },
                        set: { newValue in
                            adjustGoals(changed: .strength, to: newValue)
                        }
                    ),
                    colorScheme: colorScheme
                )
                
                GoalSlider(
                    title: "Volym",
                    value: Binding(
                        get: { goalVolume },
                        set: { newValue in
                            adjustGoals(changed: .volume, to: newValue)
                        }
                    ),
                    colorScheme: colorScheme
                )
                
                GoalSlider(
                    title: "Uthållighet",
                    value: Binding(
                        get: { goalEndurance },
                        set: { newValue in
                            adjustGoals(changed: .endurance, to: newValue)
                        }
                    ),
                    colorScheme: colorScheme
                )
                
                GoalSlider(
                    title: "Kondition",
                    value: Binding(
                        get: { goalCardio },
                        set: { newValue in
                            adjustGoals(changed: .cardio, to: newValue)
                        }
                    ),
                    colorScheme: colorScheme
                )
            }
            
            Text("Totalt: \(goalStrength + goalVolume + goalEndurance + goalCardio)%")
                .font(.caption)
                .foregroundColor(
                    goalStrength + goalVolume + goalEndurance + goalCardio == 100
                        ? Color.green
                        : Color.red
                )
        }
        .onAppear {
            // Auto-calculate goals if not already calculated and we have required data
            if !goalsCalculated && !motivationType.isEmpty && !trainingLevel.isEmpty {
                calculateSuggestedGoals()
            }
        }
    }
    
    // MARK: - Step 6: Training Frequency
    
    private var trainingFrequencyStep: some View {
        VStack(spacing: 24) {
            Text("Träningsfrekvens")
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(Color.textPrimary(for: colorScheme))
                .multilineTextAlignment(.center)
            
            VStack(spacing: 24) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Pass per vecka: \(sessionsPerWeek)")
                        .font(.headline)
                        .foregroundColor(Color.textPrimary(for: colorScheme))
                    Slider(value: Binding(
                        get: { Double(sessionsPerWeek) },
                        set: { sessionsPerWeek = Int($0) }
                    ), in: 1...7, step: 1)
                    .tint(Color.themePrimaryColor(theme: selectedTheme, colorScheme: colorScheme))
                }
                
                VStack(alignment: .leading, spacing: 8) {
                    Text("Passlängd: \(sessionDuration) minuter")
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
            Text("Maxvikt (1RM)")
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(Color.textPrimary(for: colorScheme))
                .multilineTextAlignment(.center)
            
            Text("Valfritt - hjälper oss att anpassa vikter")
                .font(.subheadline)
                .foregroundColor(Color.textSecondary(for: colorScheme))
                .multilineTextAlignment(.center)
            
            VStack(spacing: 16) {
                OneRmField(
                    title: "Bänkpress",
                    value: Binding(
                        get: { oneRmBench },
                        set: { oneRmBench = $0 }
                    ),
                    colorScheme: colorScheme
                )
                
                OneRmField(
                    title: "Stående press",
                    value: Binding(
                        get: { oneRmOhp },
                        set: { oneRmOhp = $0 }
                    ),
                    colorScheme: colorScheme
                )
                
                OneRmField(
                    title: "Marklyft",
                    value: Binding(
                        get: { oneRmDeadlift },
                        set: { oneRmDeadlift = $0 }
                    ),
                    colorScheme: colorScheme
                )
                
                OneRmField(
                    title: "Knäböj",
                    value: Binding(
                        get: { oneRmSquat },
                        set: { oneRmSquat = $0 }
                    ),
                    colorScheme: colorScheme
                )
                
                OneRmField(
                    title: "Lat pulldown",
                    value: Binding(
                        get: { oneRmLatpull },
                        set: { oneRmLatpull = $0 }
                    ),
                    colorScheme: colorScheme
                )
            }
            
            Text("Värdena ovan är förslag baserat på din profil. Du kan ändra dem om du vet dina exakta 1RM-värden.")
                .font(.caption)
                .foregroundColor(Color.textSecondary(for: colorScheme))
                .multilineTextAlignment(.center)
                .padding(.top, 8)
        }
        .onAppear {
            // Auto-calculate 1RM values when user reaches this step (after training goals)
            if !oneRmCalculated && age != nil && bodyWeight != nil && !trainingLevel.isEmpty {
                calculateSuggestedOneRm()
            }
        }
    }
    
    // MARK: - Step 8: Equipment
    
    private var equipmentStep: some View {
        VStack(spacing: 24) {
            Text("Tillgänglig utrustning")
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(Color.textPrimary(for: colorScheme))
                .multilineTextAlignment(.center)
            
            Button(action: { showCamera = true }) {
                HStack {
                    Image(systemName: "camera.fill")
                    Text("Skanna utrustning")
                }
                .foregroundColor(.white)
                .padding()
                .frame(maxWidth: .infinity)
                .background(Color.themeGradient(theme: selectedTheme, colorScheme: colorScheme))
                .cornerRadius(12)
            }
            
            Text("Eller välj manuellt")
                .font(.caption)
                .foregroundColor(Color.textSecondary(for: colorScheme))
            
            if isLoadingEquipment {
                ProgressView()
            } else if availableEquipment.isEmpty {
                Text("Laddar utrustningslista...")
                    .foregroundColor(Color.textSecondary(for: colorScheme))
            } else {
                ScrollView {
                    LazyVGrid(columns: [
                        GridItem(.flexible()),
                        GridItem(.flexible())
                    ], spacing: 16) {
                        ForEach(availableEquipment) { equipment in
                            Button(action: {
                                if selectedEquipment.contains(equipment.id) {
                                    selectedEquipment.removeAll { $0 == equipment.id }
                                } else {
                                    selectedEquipment.append(equipment.id)
                                }
                            }) {
                                VStack(alignment: .leading, spacing: 8) {
                                    Text(equipment.name)
                                        .font(.headline)
                                        .foregroundColor(Color.textPrimary(for: colorScheme))
                                        .lineLimit(2)
                                        .multilineTextAlignment(.leading)
                                    
                                    if let description = equipment.equipmentDescription {
                                        Text(description)
                                            .font(.caption)
                                            .foregroundColor(Color.textSecondary(for: colorScheme))
                                            .lineLimit(2)
                                            .multilineTextAlignment(.leading)
                                    }
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding()
                                .background(
                                    selectedEquipment.contains(equipment.id)
                                        ? Color.themePrimaryColor(theme: selectedTheme, colorScheme: colorScheme).opacity(0.2)
                                        : Color.cardBackground(for: colorScheme)
                                )
                                .cornerRadius(12)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 12)
                                        .stroke(
                                            selectedEquipment.contains(equipment.id)
                                                ? Color.themePrimaryColor(theme: selectedTheme, colorScheme: colorScheme)
                                                : Color.clear,
                                            lineWidth: 2
                                        )
                                )
                            }
                        }
                    }
                }
            }
        }
        .onAppear {
            loadEquipmentCatalog()
            
            // If no equipment loaded, try syncing again
            if availableEquipment.isEmpty && !isLoadingEquipment {
                Task {
                    try? await Task.sleep(nanoseconds: 500_000_000) // Wait 0.5 seconds
                    syncEquipmentCatalogEarly()
                }
            }
        }
    }
    
    // MARK: - Step 9: Theme
    
    private var themeStep: some View {
        VStack(spacing: 24) {
            Text("Välj tema")
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(Color.textPrimary(for: colorScheme))
                .multilineTextAlignment(.center)
            
            Text("Anpassa appens utseende")
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
                Text("Färgschema")
                    .font(.headline)
                    .foregroundColor(Color.textPrimary(for: colorScheme))
                
                HStack(spacing: 16) {
                    ColorSchemeButton(
                        title: "Ljus",
                        icon: "sun.max.fill",
                        isSelected: selectedColorScheme == "light",
                        colorScheme: colorScheme,
                        action: {
                            selectedColorScheme = "light"
                            savedColorScheme = "light"
                        }
                    )
                    
                    ColorSchemeButton(
                        title: "Mörk",
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
    
    private func updateStepIcon() {
        switch currentStep {
        case 1:
            currentStepIcon = "heart.fill"
        case 2:
            currentStepIcon = motivationType == "sport" ? "sportscourt.fill" : "chart.bar.fill"
        case 3:
            currentStepIcon = motivationType == "sport" ? "chart.bar.fill" : "heart.text.square.fill"
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
        var otherGoals: [(GoalType, Int)] = [
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
    
    private func calculateSuggestedGoals() {
        Task {
            do {
                print("[Onboarding] 🎯 Calculating suggested training goals...")
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
        Task {
            do {
                print("[Onboarding] 💪 Calculating suggested 1RM values...")
                let suggestedOneRm = try await APIService.shared.suggestOneRmValues(
                    motivationType: motivationType,
                    trainingLevel: trainingLevel,
                    age: age ?? 30,
                    sex: sex.isEmpty ? "man" : sex,
                    bodyWeight: bodyWeight ?? 70,
                    height: height ?? 175
                )
                
                await MainActor.run {
                    oneRmBench = suggestedOneRm.oneRmBench
                    oneRmOhp = suggestedOneRm.oneRmOhp
                    oneRmDeadlift = suggestedOneRm.oneRmDeadlift
                    oneRmSquat = suggestedOneRm.oneRmSquat
                    oneRmLatpull = suggestedOneRm.oneRmLatpull
                    oneRmCalculated = true
                    
                    print("[Onboarding] ✅ Suggested 1RM calculated: Bench=\(oneRmBench ?? 0)kg, OHP=\(oneRmOhp ?? 0)kg, Deadlift=\(oneRmDeadlift ?? 0)kg, Squat=\(oneRmSquat ?? 0)kg, Latpull=\(oneRmLatpull ?? 0)kg")
                }
            } catch {
                print("[Onboarding] ⚠️ Error calculating suggested 1RM: \(error.localizedDescription)")
                // Keep default values if calculation fails
                await MainActor.run {
                    oneRmCalculated = true // Mark as calculated to avoid retrying
                }
            }
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
        Task {
            await MainActor.run {
                isLoadingEquipment = true
            }
            
            do {
                let descriptor = FetchDescriptor<EquipmentCatalog>(
                    sortBy: [SortDescriptor(\.name)]
                )
                let equipment = try modelContext.fetch(descriptor)
                
                await MainActor.run {
                    availableEquipment = equipment
                    isLoadingEquipment = false
                    
                    if equipment.isEmpty {
                        print("[Onboarding] ⚠️ No equipment found in local database. Will retry sync when equipment step is reached.")
                    } else {
                        print("[Onboarding] ✅ Loaded \(equipment.count) equipment items from local database")
                    }
                }
            } catch {
                print("[Onboarding] ❌ Error loading equipment: \(error.localizedDescription)")
                await MainActor.run {
                    isLoadingEquipment = false
                }
            }
        }
    }
    
    private func completeOnboarding() {
        Task {
            await MainActor.run {
                isGeneratingProgram = true
                showGenerationProgress = true
                generationError = nil
            }
            
            do {
                let userId = authService.currentUserId ?? "dev-user-123"
                
                let profileData = APIService.OnboardingCompleteRequest.ProfileData(
                    motivationType: motivationType,
                    trainingLevel: trainingLevel,
                    specificSport: specificSport.isEmpty ? nil : specificSport,
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
                
                let response = try await APIService.shared.completeOnboarding(
                    profile: profileData,
                    equipment: selectedEquipment
                )
                
                // Handle program response
                if let programResponse = response.program {
                    if programResponse.cached == true {
                        // Program from cache - sync immediately
                        print("[Onboarding] ✅ Program from cache, syncing...")
                        let syncService = SyncService.shared
                        
                        // Poll for program templates if not immediately available (race condition fix)
                        var pollAttempts = 0
                        let maxPollAttempts = 5
                        while pollAttempts < maxPollAttempts {
                            do {
                                try await syncService.syncProgramTemplates(userId: userId, modelContext: modelContext)
                                let templates = try modelContext.fetch(FetchDescriptor<ProgramTemplate>())
                                if !templates.isEmpty {
                                    print("[Onboarding] ✅ Program templates synced and found after cache hit.")
                                    break
                                } else {
                                    print("[Onboarding] ⚠️ No program templates found after cache hit, retrying...")
                                    pollAttempts += 1
                                    try await Task.sleep(nanoseconds: 1_000_000_000)
                                }
                            } catch {
                                print("[Onboarding] ❌ Error syncing program templates after cache hit: \(error.localizedDescription)")
                                pollAttempts += 1
                                try await Task.sleep(nanoseconds: 1_000_000_000)
                            }
                        }
                        
                        if pollAttempts == maxPollAttempts {
                            print("[Onboarding] ❌ Failed to sync program templates after multiple retries for cached program.")
                            await MainActor.run {
                                generationError = "Kunde inte ladda ditt program. Försök igen senare."
                                isGeneratingProgram = false
                                showGenerationProgress = false
                            }
                            return
                        }
                        
                        // Update profile
                        let profileDescriptor = FetchDescriptor<UserProfile>(
                            predicate: #Predicate { $0.userId == userId }
                        )
                        if let profile = try? modelContext.fetch(profileDescriptor).first {
                            profile.onboardingCompleted = true
                            profile.theme = selectedTheme
                            try? modelContext.save()
                        }
                        
                        // Dismiss onboarding and go to home
                        await MainActor.run {
                            dismiss()
                        }
                    } else if let jobId = programResponse.jobId {
                        // Async generation - start polling
                        print("[Onboarding] ⏳ Starting async generation, jobId: \(jobId)")
                        await MainActor.run {
                            generationJobId = jobId
                            generationStatus = "queued"
                            generationProgress = 0
                        }
                        
                        // Start polling
                        await pollGenerationStatus(jobId: jobId, userId: userId)
                    }
                } else {
                    // No program response - just complete onboarding
                    await MainActor.run {
                        isGeneratingProgram = false
                        showGenerationProgress = false
                        dismiss()
                    }
                }
            } catch {
                print("[Onboarding] ❌ Error completing onboarding: \(error.localizedDescription)")
                await MainActor.run {
                    generationError = "Kunde inte slutföra onboarding: \(error.localizedDescription)"
                    isGeneratingProgram = false
                    showGenerationProgress = false
                }
            }
        }
    }
    
    private func pollGenerationStatus(jobId: String, userId: String) async {
        var pollCount = 0
        let maxPolls = 300 // 5 minutes max (300 * 1 second)
        
        while pollCount < maxPolls {
            do {
                try await Task.sleep(nanoseconds: 1_000_000_000) // 1 second
                
                let status = try await APIService.shared.getGenerationStatus(jobId: jobId)
                
                await MainActor.run {
                    generationStatus = status.status
                    generationProgress = status.progress
                }
                
                if status.status == "completed" {
                    // Sync program templates
                    print("[Onboarding] ✅ Program generation completed, syncing...")
                    let syncService = SyncService.shared
                    try await syncService.syncProgramTemplates(userId: userId, modelContext: modelContext)
                    
                    // Update profile
                    let profileDescriptor = FetchDescriptor<UserProfile>(
                        predicate: #Predicate { $0.userId == userId }
                    )
                    if let profile = try? modelContext.fetch(profileDescriptor).first {
                        profile.onboardingCompleted = true
                        profile.theme = selectedTheme
                        try? modelContext.save()
                    }
                    
                    await MainActor.run {
                        isGeneratingProgram = false
                        showGenerationProgress = false
                        dismiss()
                    }
                    return
                } else if status.status == "failed" {
                    await MainActor.run {
                        generationError = status.error ?? "Programgenerering misslyckades"
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
        
        // Timeout after max polls
        await MainActor.run {
            generationError = "Programgenerering tog för lång tid. Försök igen senare."
            isGeneratingProgram = false
            showGenerationProgress = false
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
    
    private func autoLoginForAlphaTesting() async {
        print("[Onboarding] 🔐 Auto-login for alpha testing...")
        do {
            let userId = authService.currentUserId ?? "dev-user-123"
            try await authService.signInWithEmail(
                email: "dev@recompute.it",
                password: "dev123",
                modelContext: modelContext
            )
            print("[Onboarding] ✅ Auto-login successful")
        } catch {
            print("[Onboarding] ⚠️ Auto-login failed (non-critical): \(error.localizedDescription)")
        }
    }
    
    private func syncEquipmentCatalogEarly() {
        Task {
            var retryCount = 0
            let maxRetries = 3
            
            while retryCount < maxRetries {
                do {
                    print("[Onboarding] 🔄 Syncing equipment catalog (attempt \(retryCount + 1)/\(maxRetries))...")
                    try await ExerciseCatalogService.shared.syncEquipmentCatalog(modelContext: modelContext)
                    
                    await MainActor.run {
                        loadEquipmentCatalog()
                    }
                    
                    // Check if we got equipment
                    let descriptor = FetchDescriptor<EquipmentCatalog>()
                    if let equipment = try? modelContext.fetch(descriptor), !equipment.isEmpty {
                        print("[Onboarding] ✅ Equipment catalog synced successfully (\(equipment.count) items)")
                        return
                    } else {
                        print("[Onboarding] ⚠️ Sync completed but no equipment found in database")
                    }
                } catch {
                    print("[Onboarding] ⚠️ Error syncing equipment catalog (attempt \(retryCount + 1)): \(error.localizedDescription)")
                    retryCount += 1
                    
                    if retryCount < maxRetries {
                        // Wait before retry (exponential backoff)
                        try? await Task.sleep(nanoseconds: UInt64(pow(2.0, Double(retryCount)) * 1_000_000_000))
                    }
                }
            }
            
            // Final attempt to load from cache even if sync failed
            await MainActor.run {
                loadEquipmentCatalog()
            }
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

struct GoalSlider: View {
    let title: String
    @Binding var value: Int
    let colorScheme: ColorScheme
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(title)
                    .font(.headline)
                    .foregroundColor(Color.textPrimary(for: colorScheme))
                Spacer()
                Text("\(value)%")
                    .font(.headline)
                    .foregroundColor(Color.primaryColor(for: colorScheme))
            }
            
            Slider(value: Binding(
                get: { Double(value) },
                set: { value = Int($0) }
            ), in: 0...100, step: 1)
            .tint(Color.primaryColor(for: colorScheme))
        }
        .padding()
        .background(Color.cardBackground(for: colorScheme))
        .cornerRadius(12)
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

struct GenerationProgressView: View {
    let progress: Int
    let status: String
    let iconName: String // Kept for compatibility but not used
    let onDismiss: () -> Void
    
    @State private var stepIndex = 0
    @State private var showTimeoutMessage = false
    @State private var animateIcon = false
    @State private var animateSparkles = false
    
    private let buildingSteps = [
        (text: "Analyserar dina mål...", icon: "target"),
        (text: "Väljer övningar...", icon: "dumbbell.fill"),
        (text: "Optimerar schema...", icon: "calendar"),
        (text: "Bygger ditt träningsprogram...", icon: "sparkles")
    ]
    
    var body: some View {
        ZStack {
            Color.black.opacity(0.7)
                .ignoresSafeArea()
            
            VStack(spacing: 32) {
                // Icon with animation
                ZStack {
                    // Pulsing background circle
                    Circle()
                        .fill(Color.white.opacity(0.1))
                        .frame(width: 80, height: 80)
                        .scaleEffect(animateIcon ? 1.2 : 1.0)
                        .opacity(animateIcon ? 0.3 : 0.5)
                        .animation(
                            Animation.easeInOut(duration: 1.5)
                                .repeatForever(autoreverses: true),
                            value: animateIcon
                        )
                    
                    // Main icon
                    Image(systemName: currentStep.icon)
                        .font(.system(size: 40))
                        .foregroundColor(.white)
                        .scaleEffect(animateIcon ? 1.1 : 1.0)
                        .animation(
                            Animation.easeInOut(duration: 1.0)
                                .repeatForever(autoreverses: true),
                            value: animateIcon
                        )
                    
                    // Sparkles icon rotating
                    Image(systemName: "sparkles")
                        .font(.system(size: 24))
                        .foregroundColor(.white.opacity(0.8))
                        .offset(x: 35, y: -35)
                        .rotationEffect(.degrees(animateSparkles ? 360 : 0))
                        .animation(
                            Animation.linear(duration: 3.0)
                                .repeatForever(autoreverses: false),
                            value: animateSparkles
                        )
                }
                .onAppear {
                    animateIcon = true
                    animateSparkles = true
                }
                
                // Text content
                VStack(spacing: 16) {
                    Text(currentStep.text)
                        .font(.title3)
                        .fontWeight(.semibold)
                        .foregroundColor(.white)
                        .multilineTextAlignment(.center)
                        .animation(.easeInOut(duration: 0.3), value: stepIndex)
                    
                    if !showTimeoutMessage {
                        Text("Detta kan ta upp till 2 minuter. Ha lite tålamod...")
                            .font(.subheadline)
                            .foregroundColor(.white.opacity(0.8))
                            .multilineTextAlignment(.center)
                    } else {
                        VStack(spacing: 12) {
                            HStack(spacing: 8) {
                                Image(systemName: "clock.fill")
                                    .font(.system(size: 16))
                                Text("Många tränar just nu – det tar lite längre tid än vanligt")
                                    .font(.subheadline)
                                    .fontWeight(.medium)
                            }
                            .foregroundColor(.orange)
                            .padding()
                            .background(Color.orange.opacity(0.1))
                            .cornerRadius(12)
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(Color.orange.opacity(0.3), lineWidth: 1)
                            )
                            
                            Text("Din träningsplan genereras fortfarande. Vi uppskattar ditt tålamod!")
                                .font(.caption)
                                .foregroundColor(.white.opacity(0.7))
                                .multilineTextAlignment(.center)
                        }
                    }
                    
                    // Progress dots
                    HStack(spacing: 8) {
                        ForEach(0..<buildingSteps.count, id: \.self) { index in
                            Capsule()
                                .fill(index == stepIndex ? Color.white : Color.white.opacity(0.3))
                                .frame(width: index == stepIndex ? 24 : 8, height: 8)
                                .animation(.easeInOut(duration: 0.3), value: stepIndex)
                        }
                    }
                    .padding(.top, 8)
                }
                .padding(.horizontal, 32)
            }
            .padding()
        }
        .task {
            // Rotate through steps every 2 seconds
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 2_000_000_000) // 2 seconds
                withAnimation(.easeInOut(duration: 0.3)) {
                    stepIndex = (stepIndex + 1) % buildingSteps.count
                }
            }
        }
        .onAppear {
            // Show timeout message after 60 seconds
            Task {
                try? await Task.sleep(nanoseconds: 60_000_000_000) // 60 seconds
                await MainActor.run {
                    withAnimation {
                        showTimeoutMessage = true
                    }
                }
            }
        }
    }
    
    private var currentStep: (text: String, icon: String) {
        buildingSteps[stepIndex]
    }
}

struct TimeoutMessageView: View {
    let onDismiss: () -> Void
    @State private var animate = false
    
    var body: some View {
        ZStack {
            Color.black.opacity(0.7)
                .ignoresSafeArea()
            
            VStack(spacing: 16) {
                Text("Många tränar just nu...")
                    .font(.headline)
                    .foregroundColor(.white)
                
                Text("Programmet genereras, vänta lite. Detta kan ta upp till 2 minuter.")
                    .font(.subheadline)
                    .foregroundColor(.white.opacity(0.9))
                    .multilineTextAlignment(.center)
                
                Button(action: onDismiss) {
                    Text("OK")
                        .foregroundColor(.white)
                        .padding(.horizontal, 32)
                        .padding(.vertical, 12)
                        .background(Color.primary)
                        .cornerRadius(12)
                }
            }
            .padding(24)
            .background(Color.secondary.opacity(0.9))
            .cornerRadius(16)
            .padding()
        }
        .onTapGesture {
            onDismiss()
        }
    }
}


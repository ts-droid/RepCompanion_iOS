import SwiftUI
import SwiftData

struct HomeView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.colorScheme) private var colorScheme
    @State private var selectedTab = 0 // 0: Kombinerad, 1: Aktivitet, 2: Återhämtning
    @State private var showWorkoutGeneration = false
    @State private var isGeneratingProgram = false
    @State private var showActiveWorkout = false
    @State private var activeSession: WorkoutSession?
    
    // Logic for refined workout initiation
    @State private var showStartConfirmation = false
    @State private var templateToStart: ProgramTemplate?
    
    @Query private var userProfiles: [UserProfile]
    @Query private var programTemplates: [ProgramTemplate]
    @Query private var workoutSessions: [WorkoutSession]
    @Query private var templateExercises: [ProgramTemplateExercise]
    @Query private var exerciseLogs: [ExerciseLog]
    
    @StateObject private var healthKitService = HealthKitService.shared
    
    @State private var workoutProgress: Double? = nil // Progress for today's workout
    @State private var sleepScore: Double? = nil // Sleep score for recovery
    
    private var currentProfile: UserProfile? {
        userProfiles.first
    }
    
    private var activeWorkoutSession: WorkoutSession? {
        let active = workoutSessions.first { $0.status == "active" || $0.status == "pending" }
        print("[DEBUG HomeView] Computing activeWorkoutSession. Total sessions: \(workoutSessions.count), active found: \(active != nil)")
        if let first = workoutSessions.first {
            print("[DEBUG HomeView] First session in list: \(first.id.uuidString), status: \(first.status)")
        }
        return active
    }
    
    // Get template for today (only if there's a planned workout today)
    private var todayTemplate: ProgramTemplate? {
        let calendar = Calendar.current
        let today = Date()
        let weekday = calendar.component(.weekday, from: today)
        // Calendar.weekday: 1 = Sunday, 2 = Monday, ..., 7 = Saturday
        // Our dayOfWeek: 1 = Monday, 2 = Tuesday, ..., 7 = Sunday
        let dayOfWeek: Int
        if weekday == 1 { // Sunday
            dayOfWeek = 7
        } else {
            dayOfWeek = weekday - 1
        }
        
        // Only return template if it matches today's weekday
        return programTemplates.first(where: { $0.dayOfWeek == dayOfWeek })
    }
    
    private func getExerciseCount(for template: ProgramTemplate) -> Int {
        templateExercises.filter { $0.templateId == template.id }.count
    }
    
    // Get next upcoming template (for bottom button when no workout today)
    private var nextTemplate: ProgramTemplate? {
        let calendar = Calendar.current
        let today = Date()
        let weekday = calendar.component(.weekday, from: today)
        // Calendar.weekday: 1 = Sunday, 2 = Monday, ..., 7 = Saturday
        // Our dayOfWeek: 1 = Monday, 2 = Tuesday, ..., 7 = Sunday
        let dayOfWeek: Int
        if weekday == 1 { // Sunday
            dayOfWeek = 7
        } else {
            dayOfWeek = weekday - 1
        }
        
        // If there's a template for today, return it
        if let todayTemplate = programTemplates.first(where: { $0.dayOfWeek == dayOfWeek }) {
            return todayTemplate
        }
        
        // If no template for today, find the next upcoming template
        let sortedTemplates = programTemplates.filter { $0.dayOfWeek != nil }
            .sorted { ($0.dayOfWeek ?? 0) < ($1.dayOfWeek ?? 0) }
        
        // Find next template after today
        if let nextTemplate = sortedTemplates.first(where: { ($0.dayOfWeek ?? 0) > dayOfWeek }) {
            return nextTemplate
        }
        
        // If no template after today, return first template (next week)
        return sortedTemplates.first
    }
    
    var body: some View {
        NavigationView {
            ZStack(alignment: .bottom) {
                Color.appBackground(for: colorScheme).ignoresSafeArea()
                
                ScrollView {
                    VStack(spacing: 24) {
                        // Header / Segmented Control
                        HStack(spacing: 12) {
                            FilterButton(title: "Kombinerad", isSelected: selectedTab == 0, colorScheme: colorScheme) { selectedTab = 0 }
                            FilterButton(title: "Aktivitet", icon: "waveform.path.ecg", isSelected: selectedTab == 1, colorScheme: colorScheme) { selectedTab = 1 }
                            FilterButton(title: "Återhämtning", icon: "heart", isSelected: selectedTab == 2, colorScheme: colorScheme) { selectedTab = 2 }
                        }
                        .padding(.horizontal)
                        
                        // Main CTA Card
                        if let activeSession = activeWorkoutSession {
                            // Resume active session
                            CTACard(
                                title: "Fortsätt ditt pass",
                                subtitle: activeSession.sessionName ?? "Träningspass",
                                icon: "play.circle.fill",
                                color: Color.primaryColor(for: colorScheme),
                                colorScheme: colorScheme,
                                action: {
                                    self.activeSession = activeSession
                                    showActiveWorkout = true
                                }
                            )
                        } else if programTemplates.isEmpty {
                            // Generate program
                            CTACard(
                                title: "Kom igång",
                                subtitle: "Generera ditt personliga träningsprogram",
                                icon: "sparkles",
                                color: Color.primaryColor(for: colorScheme),
                                isLoading: isGeneratingProgram,
                                colorScheme: colorScheme,
                                action: generateProgram
                            )
                        } else if let todayTemplate = todayTemplate {
                            // Only show "Dags att träna!" card if there's a workout planned for today
                            let dayName = getDayName(todayTemplate.dayOfWeek)
                            let dayPrefix = dayName.isEmpty ? "" : "\(dayName) • "
                            CTACard(
                                title: "Dags att träna!",
                                subtitle: "\(dayPrefix)\(todayTemplate.muscleFocus ?? todayTemplate.templateName) • \(getExerciseCount(for: todayTemplate)) övningar",
                                icon: "sparkles",
                                color: Color.primaryColor(for: colorScheme),
                                colorScheme: colorScheme,
                                action: startWorkout
                            )
                        }
                        // If no workout today, don't show CTA card - user can start via bottom button
                        
                        // Content based on selected tab
                        if selectedTab == 0 {
                            // Combined view - show both cards with inner rings
                            HStack(spacing: 16) {
                                StatusCard(
                                    title: "AKTIVITET",
                                    value: "\(activityPercent)%",
                                    subtitle: "av mål",
                                    color: .activityBlue,
                                    progress: Double(activityPercent) / 100.0,
                                    icon: "waveform.path.ecg",
                                    colorScheme: colorScheme,
                                    innerProgress: useTestData ? workoutProgress : (todayTemplate != nil ? (workoutProgress ?? 0.0) : nil),
                                    innerColor: .orange
                                )
                                StatusCard(
                                    title: "ÅTERHÄMTNING",
                                    value: "\(recoveryPercent)%",
                                    subtitle: "optimal",
                                    color: .recoveryPurple,
                                    progress: Double(recoveryPercent) / 100.0,
                                    icon: "heart",
                                    colorScheme: colorScheme,
                                    innerProgress: sleepScore,
                                    innerColor: .teal // Changed from indigo to teal for better differentiation
                                )
                            }
                            .padding(.horizontal)
                            
                            // Personal Tips Section
                            PersonalTipsSection()
                        } else if selectedTab == 1 {
                            // Activity detail view
                            ActivityDetailView(
                                activityPercent: activityPercent,
                                colorScheme: colorScheme,
                                healthKitService: healthKitService
                            )
                        } else if selectedTab == 2 {
                            // Recovery detail view
                            RecoveryDetailView(
                                recoveryPercent: recoveryPercent,
                                colorScheme: colorScheme,
                                healthKitService: healthKitService
                            )
                        }
                        
                        // Debug / Manual Sync
                        Button(action: {
                            WatchConnectivityManager.shared.forceSync()
                        }) {
                            Text("Synka till Watch (Debug)")
                                .font(.caption)
                                .foregroundColor(.gray)
                                .padding()
                        }
                        
                        Spacer(minLength: 120)
                    }
                    .padding(.top)
                }
                
                // Floating Action Button
                Button(action: {
                    print("[DEBUG HomeView] FAB Clicked. activeWorkoutSession: \(activeWorkoutSession?.id.uuidString ?? "nil")")
                    if let session = activeWorkoutSession {
                        print("[DEBUG HomeView] Resuming session: \(session.id.uuidString)")
                        self.activeSession = session
                        showActiveWorkout = true
                    } else if programTemplates.isEmpty {
                        print("[DEBUG HomeView] No templates, generating...")
                        generateProgram()
                    } else {
                        print("[DEBUG HomeView] Starting new workout from nextTemplate")
                        startWorkout()
                    }
                }) {
                    Text(getFloatingButtonText())
                        .font(.headline)
                        .fontWeight(.bold)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .themeGradientBackground(colorScheme: colorScheme)
                        .foregroundColor(.white)
                        .cornerRadius(12)
                }
                .padding(.horizontal)
                .padding(.bottom, 20)
                .disabled(isGeneratingProgram)
            }

            .navigationBarHidden(true)
            .alert("Starta pass", isPresented: $showStartConfirmation) {
                Button("Ja, kör!") {
                    confirmStartWorkout()
                }
                Button("Avbryt", role: .cancel) {}
            } message: {
                if let template = templateToStart {
                    Text("Vill du starta \(getFullDayName(template.dayOfWeek))s pass idag?")
                } else {
                    Text("Vill du starta passet idag?")
                }
            }
            .onAppear {
                print("[DEBUG HomeView] onAppear. workoutSessions count: \(workoutSessions.count)")
                for session in workoutSessions {
                    print("[DEBUG HomeView] Session: \(session.id.uuidString), Status: \(session.status), Started: \(session.startedAt)")
                }
                
                if useTestData {
                    // Set dummy data for testing
                    activityPercent = 65
                    recoveryPercent = 75
                    workoutProgress = 0.45 // 45% workout progress (inner ring for activity)
                    sleepScore = 0.93 // 93% sleep score (inner ring for recovery) - matches RecoveryDetailView
                } else {
                    updateActivityAndRecovery()
                    updateWorkoutProgress()
                    updateSleepScore()
                }
            }
            .onChange(of: workoutSessions.count) { _, _ in
                updateActivityAndRecovery()
                updateWorkoutProgress()
            }
            .onChange(of: exerciseLogs.count) { _, _ in
                updateWorkoutProgress()
            }
            .onChange(of: healthKitService.authorizationStatus) { _, _ in
                updateActivityAndRecovery()
                updateSleepScore()
            }
        }
        .sheet(item: $activeSession) { session in
            let template = programTemplates.first(where: { $0.id == session.templateId })
            let _ = print("[DEBUG HomeView] Opening sheet for session: \(session.id.uuidString), template found: \(template != nil)")
            ActiveWorkoutView(session: session, template: template)
        }
    }
    
    private func getFloatingButtonText() -> String {
        if isGeneratingProgram {
            return "Genererar..."
        } else if activeWorkoutSession != nil {
            return "Fortsätt pass"
        } else if programTemplates.isEmpty {
            return "Generera program"
        } else {
            return "Starta pass"
        }
    }
    
    @State private var activityPercent: Int = 0
    @State private var recoveryPercent: Int = 100
    @State private var isLoadingHealthData = false
    
    // TEST DATA FLAG
    #if DEBUG
    private let useTestData = false // Set to true to use dummy data
    #else
    private let useTestData = false
    #endif
    
    private func calculateActivityPercent() -> Int {
        return activityPercent
    }
    
    private func calculateRecoveryPercent() -> Int {
        return recoveryPercent
    }
    
    private func updateActivityAndRecovery() {
        guard !isLoadingHealthData else { return }
        isLoadingHealthData = true
        
        Task {
            // Calculate activity from workouts and HealthKit
            let activity = await calculateActivityFromData()
            
            // Calculate recovery from rest time and HealthKit
            let recovery = await calculateRecoveryFromData()
            
            await MainActor.run {
                activityPercent = activity
                recoveryPercent = recovery
                isLoadingHealthData = false
            }
        }
    }
    
    private func calculateActivityFromData() async -> Int {
        guard let profile = currentProfile else { return 0 }
        
        let now = Date()
        let calendar = Calendar.current
        let startOfWeek = calendar.dateInterval(of: .weekOfYear, for: now)?.start ?? now
        let startOfDay = calendar.startOfDay(for: now)
        
        // 1. Workout sessions (40% weight)
        let completedThisWeek = workoutSessions.filter { session in
            guard let completedAt = session.completedAt else { return false }
            return completedAt >= startOfWeek && session.status == "completed"
        }.count
        
        let targetSessions = profile.sessionsPerWeek
        let workoutScore = min((completedThisWeek * 100) / max(targetSessions, 1), 100)
        
        // 2. HealthKit data (60% weight)
        var healthKitScore = 0
        
        do {
            // Get today's steps
            let stepGoal = 10000 // Default goal
            if let steps = try? await HealthKitService.shared.getStepsCount(for: startOfDay, to: now) {
                let stepsPercent = min((steps * 100) / stepGoal, 100)
                healthKitScore += stepsPercent / 3 // 33% of health score
            }
            
            // Get today's active calories
            let calorieGoal = 500 // Default goal
            if let calories = try? await HealthKitService.shared.getActiveEnergyBurned(for: startOfDay, to: now) {
                let caloriesPercent = min((Int(calories) * 100) / calorieGoal, 100)
                healthKitScore += caloriesPercent / 3 // 33% of health score
            }
            
            // Get today's active minutes
            let activeMinutesGoal = 30 // Default goal
            if let activeMinutes = try? await HealthKitService.shared.getActiveMinutes(for: startOfDay, to: now) {
                let minutesPercent = min((activeMinutes * 100) / activeMinutesGoal, 100)
                healthKitScore += minutesPercent / 3 // 33% of health score
            }
        }
        
        // Combine: 40% workouts + 60% HealthKit
        let combinedScore = (workoutScore * 40 + healthKitScore * 60) / 100
        return min(combinedScore, 100)
    }
    
    private func calculateRecoveryFromData() async -> Int {
        let completedSessions = workoutSessions.filter { $0.status == "completed" && $0.completedAt != nil }
        
        guard let lastSession = completedSessions.max(by: { $0.completedAt! < $1.completedAt! }) else {
            // No sessions = check HealthKit for general recovery
            return await calculateRecoveryFromHealthKit(restDays: 999)
        }
        
        let now = Date()
        let hoursSinceLastSession = Calendar.current.dateComponents([.hour], from: lastSession.completedAt!, to: now).hour ?? 0
        let restDays = Double(hoursSinceLastSession) / 24.0
        
        // Base recovery from rest time (50% weight)
        var baseRecovery = 0
        if restDays >= 3 {
            baseRecovery = 100
        } else if restDays >= 2 {
            baseRecovery = 85
        } else if restDays >= 1 {
            baseRecovery = 60
        } else if restDays >= 0.5 {
            baseRecovery = 30
        } else {
            baseRecovery = 10
        }
        
        // HealthKit recovery factors (50% weight)
        let healthKitRecovery = await calculateRecoveryFromHealthKit(restDays: restDays)
        
        // Combine: 50% rest time + 50% HealthKit
        let combinedRecovery = (baseRecovery * 50 + healthKitRecovery * 50) / 100
        return min(combinedRecovery, 100)
    }
    
    private func calculateRecoveryFromHealthKit(restDays: Double) async -> Int {
        var recoveryScore = 50 // Default middle score
        
        do {
            let calendar = Calendar.current
            let now = Date()
            let yesterday = calendar.date(byAdding: .day, value: -1, to: now) ?? now
            let startOfYesterday = calendar.startOfDay(for: yesterday)
            let endOfYesterday = calendar.date(byAdding: .day, value: 1, to: startOfYesterday) ?? now
            
            // 1. Sleep quality (30% of recovery score)
            if let sleepHours = try? await HealthKitService.shared.getSleepHours(for: startOfYesterday, to: endOfYesterday) {
                let optimalSleep = 7.5
                let sleepScore: Int
                if sleepHours >= optimalSleep {
                    sleepScore = 100
                } else if sleepHours >= 6 {
                    sleepScore = 80
                } else if sleepHours >= 5 {
                    sleepScore = 60
                } else {
                    sleepScore = 40
                }
                recoveryScore = (recoveryScore * 70 + sleepScore * 30) / 100
            }
            
            // 2. Resting heart rate (20% of recovery score)
            if let restingHR = try? await HealthKitService.shared.getRestingHeartRate() {
                // Lower resting HR = better recovery (assuming normal range 50-70)
                let hrScore: Int
                if restingHR <= 55 {
                    hrScore = 100 // Excellent recovery
                } else if restingHR <= 60 {
                    hrScore = 85
                } else if restingHR <= 65 {
                    hrScore = 70
                } else if restingHR <= 70 {
                    hrScore = 55
                } else {
                    hrScore = 40 // May indicate stress/poor recovery
                }
                recoveryScore = (recoveryScore * 80 + hrScore * 20) / 100
            }
            
            // 3. Heart rate variability if available (20% of recovery score)
            // Note: HRV requires additional HealthKit setup
            
            // 4. Recent workout intensity (30% of recovery score)
            // More rest needed after intense workouts
            if restDays < 1 {
                recoveryScore = (recoveryScore * 70 + 30 * 30) / 100 // Low recovery if < 1 day
            } else if restDays < 2 {
                recoveryScore = (recoveryScore * 70 + 60 * 30) / 100
            } else {
                recoveryScore = (recoveryScore * 70 + 90 * 30) / 100
            }
        }
        
        return min(recoveryScore, 100)
    }
    
    private func generateProgram() {
        guard let profile = currentProfile else { return }
        
        isGeneratingProgram = true
        
        Task {
            do {
                let service = WorkoutGenerationService(modelContext: modelContext)
                if let input = service.getUserWorkoutData(userId: profile.userId) {
                    _ = try await service.generateProgram(for: input)
                }
                
                await MainActor.run {
                    isGeneratingProgram = false
                }
            } catch {
                await MainActor.run {
                    isGeneratingProgram = false
                    print("Error generating program: \(error)")
                }
            }
        }
    }
    
    private func getDayName(_ dayOfWeek: Int?) -> String {
        guard let dayOfWeek = dayOfWeek, dayOfWeek >= 1, dayOfWeek <= 7 else { return "" }
        let days = ["", "Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag", "Söndag"]
        return days[dayOfWeek]
    }
    
    private func getFullDayName(_ dayOfWeek: Int?) -> String {
        guard let dayOfWeek = dayOfWeek, dayOfWeek >= 1, dayOfWeek <= 7 else { return "nästa" }
        let days = ["", "Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag", "Söndag"]
        return days[dayOfWeek]
    }
    
    private func startWorkout() {
        guard let template = nextTemplate else { return }
        templateToStart = template
        
        let calendar = Calendar.current
        let today = Date()
        let weekday = calendar.component(.weekday, from: today)
        let dayOfWeek: Int
        if weekday == 1 { // Sunday
            dayOfWeek = 7
        } else {
            dayOfWeek = weekday - 1
        }
        
        // Only show confirmation if starting a workout for a DIFFERENT day than today
        if template.dayOfWeek == dayOfWeek {
            confirmStartWorkout()
        } else {
            showStartConfirmation = true
        }
    }
    
    private func confirmStartWorkout() {
        guard let template = templateToStart else { return }
        
        let session = WorkoutSession(
            userId: currentProfile?.userId ?? "default",
            templateId: template.id,
            sessionType: "strength",
            sessionName: template.templateName,
            status: "active"
        )
        
        modelContext.insert(session)
        try? modelContext.save()
        
        activeSession = session
        showActiveWorkout = true
    }
    
    // Calculate workout progress for today (same logic as ActivityDetailView)
    private func calculateWorkoutProgress() -> Double? {
        guard let template = todayTemplate else { return nil }
        
        let plannedExercises = templateExercises.filter { $0.templateId == template.id }
        
        var totalPlannedReps = 0
        for exercise in plannedExercises {
            let repsStr = exercise.targetReps
            let reps = parseRepsString(repsStr)
            totalPlannedReps += exercise.targetSets * reps
        }
        
        guard totalPlannedReps > 0 else { return nil }
        
        let calendar = Calendar.current
        let today = Date()
        let startOfDay = calendar.startOfDay(for: today)
        let endOfDay = calendar.date(byAdding: .day, value: 1, to: startOfDay)!
        
        let todaySession = workoutSessions.first { session in
            let startedAt = session.startedAt // non-optional Date
            return startedAt >= startOfDay && startedAt < endOfDay &&
                   (session.status == "active" || session.status == "completed") &&
                   session.templateId == template.id
        }
        
        guard let session = todaySession else { return 0.0 }
        
        let sessionLogs = exerciseLogs.filter { $0.workoutSessionId == session.id && $0.completed }
        var totalCompletedReps = 0
        for log in sessionLogs {
            if let reps = log.reps {
                totalCompletedReps += reps
            }
        }
        
        let progress = Double(totalCompletedReps) / Double(totalPlannedReps)
        print("[DEBUG HomeView] Workout progress calculated: \(progress) (\(totalCompletedReps)/\(totalPlannedReps))")
        return progress
    }
    
    // Parse reps string to get minimum number
    private func parseRepsString(_ repsStr: String) -> Int {
        if repsStr.contains("-") {
            let components = repsStr.split(separator: "-")
            if components.count == 2,
               let min = Int(components[0].trimmingCharacters(in: .whitespaces)) {
                return min
            }
        }
        
        if let reps = Int(repsStr.trimmingCharacters(in: .whitespaces)) {
            return reps
        }
        
        return 10
    }
    
    // Update workout progress
    private func updateWorkoutProgress() {
        let progress = calculateWorkoutProgress()
        print("[DEBUG HomeView] updateWorkoutProgress: \(progress?.description ?? "nil")")
        workoutProgress = progress
    }
    
    // Update sleep score asynchronously
    private func updateSleepScore() {
        guard healthKitService.isAuthorized else {
            print("[DEBUG HomeView] HealthKit not authorized, cannot calculate sleep score")
            return
        }
        
        Task {
            let calendar = Calendar.current
            let now = Date()
            let yesterday = calendar.date(byAdding: .day, value: -1, to: now) ?? now
            let startOfYesterday = calendar.startOfDay(for: yesterday)
            let endOfYesterday = calendar.date(byAdding: .day, value: 1, to: startOfYesterday) ?? now
            
            do {
                let sleep = try await healthKitService.getSleepHours(for: startOfYesterday, to: endOfYesterday)
                let restingHR = try? await healthKitService.getRestingHeartRate()
                let hrvValue = try? await healthKitService.getLatestHRV()
                
                print("[DEBUG HomeView] Sleep data: \(sleep)h, HRV: \(hrvValue?.description ?? "nil"), RestingHR: \(restingHR?.description ?? "nil")")
                
                // Calculate sleep score using same logic as RecoveryDetailView
                let score = calculateSleepScoreValue(sleep: sleep, hrv: hrvValue, restingHR: restingHR)
                
                print("[DEBUG HomeView] Calculated sleep score: \(score?.description ?? "nil")")
                
                await MainActor.run {
                    sleepScore = score
                }
            } catch {
                print("[DEBUG HomeView] Error calculating sleep score: \(error)")
                // Set to nil if error
                await MainActor.run {
                    sleepScore = nil
                }
            }
        }
    }
    
    // Calculate sleep score value (helper function)
    private func calculateSleepScoreValue(sleep: Double, hrv: Double?, restingHR: Double?) -> Double? {
        guard sleep > 0 else { return nil }
        
        var score: Double = 0.0
        var factors: Int = 0
        
        // 1. Sleep duration (50% weight)
        let sleepScore: Double
        if sleep >= 7.0 && sleep <= 9.0 {
            sleepScore = 100.0
        } else if sleep >= 6.0 && sleep < 7.0 {
            sleepScore = 80.0 - (7.0 - sleep) * 20.0
        } else if sleep > 9.0 && sleep <= 10.0 {
            sleepScore = 100.0 - (sleep - 9.0) * 10.0
        } else if sleep < 6.0 {
            sleepScore = max(0.0, 80.0 - (6.0 - sleep) * 20.0)
        } else {
            sleepScore = max(0.0, 90.0 - (sleep - 10.0) * 10.0)
        }
        score += sleepScore * 0.5
        factors += 1
        
        // 2. HRV (25% weight)
        if let hrvValue = hrv {
            let hrvScore: Double
            if hrvValue >= 60 {
                hrvScore = 100.0
            } else if hrvValue >= 50 {
                hrvScore = 80.0 + (hrvValue - 50) * 2.0
            } else if hrvValue >= 40 {
                hrvScore = 60.0 + (hrvValue - 40) * 2.0
            } else {
                hrvScore = max(0.0, 40.0 + (hrvValue - 20) * 1.0)
            }
            score += hrvScore * 0.25
            factors += 1
        }
        
        // 3. Resting heart rate (25% weight)
        if let restingHRValue = restingHR {
            let hrScore: Double
            if restingHRValue <= 55 {
                hrScore = 100.0
            } else if restingHRValue <= 60 {
                hrScore = 90.0 - (restingHRValue - 55) * 2.0
            } else if restingHRValue <= 65 {
                hrScore = 80.0 - (restingHRValue - 60) * 2.0
            } else if restingHRValue <= 70 {
                hrScore = 70.0 - (restingHRValue - 65) * 2.0
            } else {
                hrScore = max(0.0, 60.0 - (restingHRValue - 70) * 2.0)
            }
            score += hrScore * 0.25
            factors += 1
        }
        
        if factors == 0 {
            return nil
        }
        
        if factors == 1 {
            return sleepScore / 100.0
        }
        
        return min(1.0, max(0.0, score / 100.0))
    }
    
}

// MARK: - Subviews

struct FilterButton: View {
    let title: String
    var icon: String? = nil
    let isSelected: Bool
    let colorScheme: ColorScheme
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            HStack {
                if let icon = icon {
                    Image(systemName: icon)
                }
                Text(title)
            }
            .font(.caption)
            .fontWeight(.medium)
            .padding(.vertical, 8)
            .padding(.horizontal, 12)
            .background(isSelected ? Color.primaryColor(for: colorScheme) : Color.cardBackground(for: colorScheme))
            .foregroundColor(isSelected ? .white : Color.textSecondary(for: colorScheme))
            .cornerRadius(8)
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(Color.white.opacity(0.1), lineWidth: 1)
            )
        }
    }
}

enum StatusCardSize {
    case normal
    case large
}

struct StatusCard: View {
    let title: String
    let value: String
    let subtitle: String
    let color: Color
    let progress: Double
    let icon: String
    let colorScheme: ColorScheme
    var size: StatusCardSize = .normal
    var innerProgress: Double? = nil // Progress for inner ring (workout progress)
    var innerColor: Color? = nil // Color for inner ring
    
    private var circleSize: CGFloat {
        size == .large ? 150 : 100
    }
    
    private var innerCircleSize: CGFloat {
        size == .large ? 110 : 70 // Inner ring is smaller
    }
    
    private var lineWidth: CGFloat {
        size == .large ? 12 : 8
    }
    
    private var innerLineWidth: CGFloat {
        size == .large ? 8 : 5 // Inner ring is thinner
    }
    
    private var iconFont: Font {
        size == .large ? .largeTitle : .title2
    }
    
    private var valueFont: Font {
        size == .large ? .largeTitle : .title2
    }
    
    var body: some View {
        VStack(spacing: 20) {
            Text(title)
                .font(.caption)
                .fontWeight(.semibold)
                .foregroundStyle(Color.textSecondary(for: colorScheme))
                .tracking(1)
            
            ZStack {
                // Background Ring (outer) - rendered first (bottom layer)
                Circle()
                    .stroke(color.opacity(0.2), lineWidth: lineWidth)
                    .frame(width: circleSize, height: circleSize)
                
                // Progress Ring (outer) - rendered second
                Circle()
                    .trim(from: 0, to: progress)
                    .stroke(color, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                    .frame(width: circleSize, height: circleSize)
                    .rotationEffect(.degrees(-90))
                
                // Inner Background Ring (only if innerProgress is set) - rendered third
                if let innerProgress = innerProgress {
                    #if DEBUG
                    let _ = print("[DEBUG StatusCard] Rendering inner ring with progress: \(innerProgress), color: \(innerColor?.description ?? "default")")
                    #endif
                    
                    Circle()
                        .stroke((innerColor ?? color).opacity(0.2), lineWidth: innerLineWidth)
                        .frame(width: innerCircleSize, height: innerCircleSize)
                    
                    // Inner Progress Ring - rendered fourth
                    Circle()
                        .trim(from: 0, to: min(innerProgress, 1.0)) // Cap at 1.0 for visual, but allow >100% in calculation
                        .stroke(innerColor ?? color, style: StrokeStyle(lineWidth: innerLineWidth, lineCap: .round))
                        .frame(width: innerCircleSize, height: innerCircleSize)
                        .rotationEffect(.degrees(-90))
                } else {
                    #if DEBUG
                    let _ = print("[DEBUG StatusCard] innerProgress is nil - not rendering inner ring")
                    #endif
                }
                
                // Text and icon - rendered LAST (top layer) so it appears above rings
                VStack(spacing: 4) {
                    Image(systemName: icon)
                        .font(iconFont)
                        .foregroundStyle(color)
                        .shadow(color: Color.black.opacity(0.5), radius: 3, x: 0, y: 2)
                    Text(value)
                        .font(valueFont)
                        .fontWeight(.bold)
                        .foregroundStyle(Color.textPrimary(for: colorScheme))
                        .shadow(color: Color.black.opacity(0.5), radius: 3, x: 0, y: 2)
                    Text(subtitle)
                        .font(.caption2)
                        .foregroundStyle(Color.textSecondary(for: colorScheme))
                        .shadow(color: Color.black.opacity(0.4), radius: 2, x: 0, y: 1)
                }
                .zIndex(10) // Ensure text is on top
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 24)
        .background(Color.cardBackground(for: colorScheme))
        .cornerRadius(16)
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(Color.white.opacity(0.05), lineWidth: 1)
        )
    }
}

struct TipCard: View {
    let icon: String
    let iconColor: Color
    let title: String
    let content: String
    let colorScheme: ColorScheme
    
    var body: some View {
        HStack(alignment: .top, spacing: 16) {
            Circle()
                .fill(iconColor.opacity(0.2))
                .frame(width: 40, height: 40)
                .overlay(
                    Image(systemName: icon)
                        .foregroundColor(iconColor)
                )
            
            VStack(alignment: .leading, spacing: 8) {
                Text(title)
                    .font(.subheadline)
                    .foregroundStyle(Color.textSecondary(for: colorScheme))
                
                Text(content)
                    .font(.body)
                    .foregroundStyle(Color.textPrimary(for: colorScheme))
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding()
        .background(Color.cardBackground(for: colorScheme))
        .cornerRadius(12)
        .padding(.horizontal)
    }
}

import SwiftUI
import Combine
import WatchKit
import SwiftData
import WatchConnectivity

struct ActiveWorkoutView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @StateObject private var motionManager = MotionManager()
    
    // Simplified Query to avoid potential Predicate loop issues
    @Query(sort: \WorkoutSession.startedAt, order: .reverse)
    private var allSessions: [WorkoutSession]
    
    @Query private var allTemplates: [ProgramTemplate]
    
    @Query private var allTemplateExercises: [ProgramTemplateExercise]
    @Query private var userProfiles: [UserProfile]
    
    @State private var sessionExercises: [ProgramTemplateExercise] = []
    @State private var currentExerciseIndex = 0
    @State private var currentSetIndex = 0
    @State private var reps: Int = 10
    @State private var weight: Double = 60.0
    @State private var isResting: Bool = false
    @State private var restTimeRemaining = 90
    
    // Sync reps with motion manager when active
    @State private var autoCountEnabled = false
    
    // State for redesigned UI
    @State private var showApplyToAllAlert = false
    @State private var showingCompletion = false
    @State private var hadActiveSession = false // Track if we've ever seen a session in this view
    @State private var originalWeight: Double = 60.0
    @State private var originalReps: Int = 10
    
    init() {
        print("[ActiveWorkoutView] Init called")
    }
    
    private var activeSession: WorkoutSession? {
        // Filter in memory
        let session = allSessions.first(where: { $0.status == "active" })
        if let s = session {
             print("[ActiveWorkoutView] Found activeSession: \(s.id.uuidString)")
        }
        return session
    }
    
    private var currentExercise: ProgramTemplateExercise? {
        guard currentExerciseIndex < sessionExercises.count else { return nil }
        return sessionExercises[currentExerciseIndex]
    }
    
    private var currentSet: Int {
        currentSetIndex + 1
    }
    
    private var totalSetsForCurrentExercise: Int {
        currentExercise?.targetSets ?? 3
    }
    
    private var restTimeBetweenSets: Int {
        userProfiles.first?.restTimeBetweenSets ?? 90
    }
    
    private var restTimeBetweenExercises: Int {
        userProfiles.first?.restTimeBetweenExercises ?? 120
    }
    
    var body: some View {
        let _ = Self._printChanges()
        return ZStack {
            if showingCompletion {
                // Show celebration directly in the body for maximum stability
                WatchCompletionView()
                    .transition(.opacity)
            } else if activeSession == nil && !hadActiveSession {
                // Only show this if we haven't started a session yet
                VStack(spacing: 16) {
                    Image(systemName: "dumbbell")
                        .font(.largeTitle)
                        .foregroundColor(.gray)
                    Text("Inget aktivt pass")
                        .font(.headline)
                    Text("Starta ett pass på mobilen först.")
                        .font(.caption2)
                        .multilineTextAlignment(.center)
                        .foregroundColor(.secondary)
                    
                    // Manual Sync Button (Retry)
                    Button(action: {
                        WatchPersistenceManager.shared.requestSyncFromiPhone()
                    }) {
                        HStack {
                            Image(systemName: "arrow.triangle.2.circlepath")
                            Text("Hämta pass")
                        }
                    }
                    .buttonStyle(.bordered)
                    .tint(.blue)
                    
                    // Debug Info
                    VStack(spacing: 4) {
                         Text("Sessions: \(allSessions.count.description)")
                         Text("WCSession: \(WatchPersistenceManager.shared.sessionActivationState.rawValue.description)")
                         Text("Reachable: \(WatchPersistenceManager.shared.isReachable.description)")
                    }
                    .font(.system(size: 10))
                    .foregroundColor(.gray)
                }
                .padding()
            } else if isResting {
                RestView(
                    timeRemaining: $restTimeRemaining,
                    isResting: $isResting,
                    onComplete: completeRest
                )
            } else if activeSession != nil {
                // Main Workout View (Simplified to single page)
                WorkoutControlView(
                    exerciseName: currentExercise?.exerciseName ?? "Övning",
                    reps: $reps,
                    weight: $weight,
                    autoCountEnabled: $autoCountEnabled,
                    currentSet: currentSet,
                    totalSets: totalSetsForCurrentExercise,
                    onComplete: completeSet
                )
            } else {
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.black.ignoresSafeArea())
        .toolbar(.hidden, for: .navigationBar)
        .confirmationDialog("Uppdatera återstående set?", isPresented: $showApplyToAllAlert, titleVisibility: .visible) {
            Button("Ja, uppdatera alla") {
                applyToRemainingSets()
                completeSetActual()
            }
            Button("Nej, bara detta set") {
                completeSetActual()
            }
        } message: {
            Text("Tillämpa dessa värden på alla återstående set för denna övning?")
        }
        .onChange(of: autoCountEnabled) { _, enabled in
            if enabled && !isResting {
                motionManager.startDetecting()
            } else {
                motionManager.stopDetecting()
            }
        }
        .onChange(of: motionManager.repCount) { _, newCount in
            if autoCountEnabled {
                reps = newCount
            }
        }
        .onAppear {
            if activeSession != nil {
                hadActiveSession = true
                initializeSessionExercises()
                prefillValues()
            }
        }
        // Reset dialog and motion manager when resting
        .onChange(of: isResting) { _, resting in
            if resting {
                motionManager.stopDetecting()
            } else if autoCountEnabled {
                motionManager.startDetecting()
                motionManager.resetCount()
                reps = 0
                originalReps = 0
            }
        }
        .onChange(of: allSessions) { _, _ in
            if activeSession != nil {
                if !hadActiveSession {
                    hadActiveSession = true
                }
                initializeSessionExercises()
                prefillValues()
            }
        }
    }
    
    private func initializeSessionExercises() {
        guard let session = activeSession, let templateId = session.templateId else { return }
        
        // Find the template and its exercises
        if let template = allTemplates.first(where: { $0.id == templateId }) {
            sessionExercises = template.exercises.sorted { $0.orderIndex < $1.orderIndex }
        } else {
            // Fallback for cases where template might not be found in memory or for quick workouts
            sessionExercises = allTemplateExercises
                .filter { $0.template?.id == templateId }
                .sorted { $0.orderIndex < $1.orderIndex }
        }
        
        // Find first incomplete set
        updateCurrentProgressFromLogs()
    }
    
    private func updateCurrentProgressFromLogs() {
        guard let session = activeSession else { return }
        
        // Fetch existing logs for this session to see where we left off
        let sessionId = session.id
        let descriptor = FetchDescriptor<ExerciseLog>(
            predicate: #Predicate { $0.workoutSessionId == sessionId }
        )
        
        let _ = try? modelContext.fetch(descriptor)
        
        // This logic is a simplification. Ideally we find the first exercise/set that hasn't been logged.
        // For now, let's just use the current state or derive it if we want to support mid-workout resuming.
    }
    
    private func prefillValues() {
        guard let exercise = currentExercise else { return }
        
        // Set default weight/reps from target
        weight = exercise.targetWeight ?? 60.0
        
        // Parse targetReps (simple version)
        if let targetRepsInt = Int(exercise.targetReps) {
            reps = targetRepsInt
        } else if exercise.targetReps.contains("-") {
            let part = exercise.targetReps.split(separator: "-").first
            reps = Int(part?.trimmingCharacters(in: .whitespaces) ?? "") ?? 10
        } else {
            reps = 10
        }
        
        originalWeight = weight
        originalReps = reps
    }
    
    func applyToRemainingSets() {
        guard let exercise = currentExercise else { return }
        // Update template values - this persists to next week's workout
        exercise.targetWeight = weight
        exercise.targetReps = String(reps)
        
        try? modelContext.save()
        
        originalWeight = weight
        originalReps = reps
        showApplyToAllAlert = false
    }
    
    /// Called when user taps "Set klart" - checks if values changed
    func completeSet() {
        guard let exercise = currentExercise else { return }
        
        // Check if user has deviated from the original baseline
        let hasChanged = weight != originalWeight || reps != originalReps
        
        // Check conditions for showing dialog:
        // 1. Values have changed from expected
        // 2. Not the last set (no point updating remaining)
        // 3. Not the first set (Set 0)
        if hasChanged && currentSetIndex > 0 && currentSetIndex < exercise.targetSets - 1 {
            showApplyToAllAlert = true
        } else {
            completeSetActual()
        }
    }
    
    /// Actual completion logic after dialog decision
    func completeSetActual() {
        guard let session = activeSession, let exercise = currentExercise else { return }
        
        // Save using PersistenceControllerWatch for sync + local persistence
        WatchPersistenceManager.shared.logActiveSet(
            sessionId: session.id,
            exerciseName: exercise.exerciseName,
            exerciseOrderIndex: exercise.orderIndex,
            setNumber: currentSet,
            reps: reps,
            weight: weight
        )
        
        if currentSetIndex < (exercise.targetSets - 1) {
            // Next set of same exercise
            currentSetIndex += 1
            isResting = true
            restTimeRemaining = restTimeBetweenSets
        } else {
            // Move to next exercise
            if currentExerciseIndex < sessionExercises.count - 1 {
                currentExerciseIndex += 1
                currentSetIndex = 0
                isResting = true
                restTimeRemaining = restTimeBetweenExercises
                prefillValues()
            } else {
                // Workout complete!
                completeWorkout()
            }
        }
    }
    
    private func completeWorkout() {
        guard let session = activeSession else { return }
        
        // 1. Set showing celebration state first
        withAnimation {
            showingCompletion = true
        }
        
        // 2. Mark session as completed and notify iPhone
        session.status = "completed"
        session.completedAt = Date()
        WatchPersistenceManager.shared.sendWorkoutComplete(sessionId: session.id)
        
        // 3. Advance the workout cycle for the user
        if let profile = userProfiles.first {
            // Find the index of the completed template to determine the next pass
            let sortedTemplates = allTemplates.sorted { t1, t2 in
                let d1 = t1.dayOfWeek ?? 0
                let d2 = t2.dayOfWeek ?? 0
                if d1 != d2 { return d1 < d2 }
                return t1.templateName < t2.templateName
            }
            
            if let completedIndex = sortedTemplates.firstIndex(where: { $0.id == session.templateId }) {
                let nextIndex = (completedIndex + 1) % max(sortedTemplates.count, 1)
                profile.currentPassNumber = nextIndex + 1
                print("[Watch ActiveWorkoutView] Completed pass at index \(completedIndex). Set next pass to \(profile.currentPassNumber)")
            } else {
                profile.currentPassNumber += 1
            }
        }
        
        try? modelContext.save()
        
        print("[ActiveWorkoutView] Workout completed, showing celebration directly")
    }
    
    func completeRest() {
        isResting = false
    }
}

struct WorkoutControlView: View {
    @Environment(\.dismiss) private var dismiss
    let exerciseName: String
    @Binding var reps: Int
    @Binding var weight: Double
    @Binding var autoCountEnabled: Bool
    var currentSet: Int
    var totalSets: Int
    var onComplete: () -> Void
    
    @State private var showingVideoInfo = false
    
    // Picker options
    private let weightOptions: [Double] = stride(from: 0.0, through: 200.0, by: 0.5).map { $0 }
    private let repsOptions: [Int] = Array(1...50)
    
    var body: some View {
        VStack(spacing: 2) {
            // Header: Exercise and set info
            VStack(spacing: 0) {
                ZStack {
                    ScrollingText(text: exerciseName, color: .green)
                        // Removed horizontal padding to use full width
                    
                    HStack {
                        Spacer()
                        Button(action: { showingVideoInfo = true }) {
                            Image(systemName: "play.circle.fill")
                                .foregroundColor(.blue)
                                .font(.body)
                        }
                        .buttonStyle(.plain)
                        .padding(.trailing, 2)
                    }
                }
                
                Text("Set \(currentSet)/\(totalSets)")
                    .font(.system(size: 11, weight: .medium, design: .rounded))
                    .foregroundStyle(.secondary)
            }
            .padding(.top, -8)
            
            // Weight Row
            CompactCard(padding: 1) {
                HStack(spacing: 6) {
                    Text("Vikt")
                        .font(.system(size: 11, weight: .semibold))
                        .minimumScaleFactor(0.8)
                        .frame(maxWidth: .infinity, alignment: .trailing)
                    
                    CapsuleWheelPicker(
                        values: weightOptions,
                        selection: $weight,
                        text: { formatWeight($0) },
                        stroke: .green
                    )
                    .frame(width: 90, height: 38)
                    
                    Text("kg")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .frame(height: 40)

            // Reps Row
            CompactCard(padding: 1) {
                HStack(spacing: 6) {
                    Text("Reps")
                        .font(.system(size: 11, weight: .semibold))
                        .minimumScaleFactor(0.8)
                        .frame(maxWidth: .infinity, alignment: .trailing)
                    
                    CapsuleWheelPicker(
                        values: repsOptions,
                        selection: $reps,
                        text: { "\($0)" },
                        stroke: autoCountEnabled ? .green : .white.opacity(0.4)
                    )
                    .frame(width: 90, height: 38)
                    
                    Text("st")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .frame(height: 40)
            
            Spacer()
            
            // Complete Set Button
            Button(action: onComplete) {
                Text("Set klart")
            }
            .buttonStyle(PrimaryButtonStyle(height: 44))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.horizontal, 8)
        .padding(.bottom, 8)
        .ignoresSafeArea(edges: .bottom)
        .confirmationDialog("Video", isPresented: $showingVideoInfo, titleVisibility: .visible) {
            Button("Öppna video ändå") {
                let searchQuery = exerciseName.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? exerciseName
                if let url = URL(string: "https://www.youtube.com/results?search_query=\(searchQuery)+exercise") {
                    WKExtension.shared().openSystemURL(url)
                }
            }
            Button("Avbryt", role: .cancel) { }
        } message: {
            Text("Video ses bäst på iPhone. Vill du ändå fortsätta?")
        }
    }
    
    private func formatWeight(_ v: Double) -> String {
        if v.truncatingRemainder(dividingBy: 1) == 0 { return String(Int(v)) }
        return String(format: "%.1f", v)
    }
}

struct RestView: View {
    @Binding var timeRemaining: Int
    @Binding var isResting: Bool
    let onComplete: () -> Void
    
    @State private var timer: Timer?
    
    var body: some View {
        VStack(spacing: 4) {
            Text("Vila")
                .headerStyle(color: .orange)
                .padding(.top, -8)
            
            Text("\(timeRemaining)")
                .font(.system(size: 48, weight: .bold, design: .rounded))
                .foregroundStyle(.orange)
                .contentTransition(.numericText())
            
            Text("sekunder")
                .font(.system(size: 10))
                .foregroundStyle(.secondary)
            
            Spacer()
            
            Button("Skippa vila") {
                timer?.invalidate()
                isResting = false
                onComplete()
            }
            .buttonStyle(SubtleButtonStyle())
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.horizontal, 8)
        .padding(.bottom, 8)
        .ignoresSafeArea(edges: .bottom)
        .onAppear {
            startTimer()
        }
        .onDisappear {
            timer?.invalidate()
        }
    }
    
    private func startTimer() {
        timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { _ in
            if timeRemaining > 0 {
                timeRemaining -= 1
            } else {
                timer?.invalidate()
                WKInterfaceDevice.current().play(.notification)
                isResting = false
                onComplete()
            }
        }
    }
}

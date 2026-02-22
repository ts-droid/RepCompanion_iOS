import SwiftUI
import SwiftData

struct ActiveWorkoutView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.scenePhase) private var scenePhase
    
    @State private var currentExerciseIndex = 0
    @State private var currentSetIndex = 0
    @State private var isResting = false
    @State private var restTimeRemaining = 90
    @State private var weightValue: Double = 0
    @State private var repsValue: Int = 8
    @State private var showCompleteDialog = false
    
    let session: WorkoutSession
    let template: ProgramTemplate?
    
    @Query private var exerciseLogs: [ExerciseLog]
    @Query private var gyms: [Gym]
    @Query private var equipmentCatalog: [EquipmentCatalog]
    @Query private var profiles: [UserProfile]
    
    // Dynamic session state
    @State private var sessionExercises: [ProgramTemplateExercise] = []
    @State private var showingWarmup = true
    @State private var showApplyToAllDialog = false
    @State private var pendingWeight: Double = 0
    @State private var pendingReps: Int = 8
    @State private var showToast = false
    @State private var toastMessage = ""
    @State private var timer: Timer?
    @State private var showingCompletion = false
    @State private var isRestoringState = false
    @State private var forceUseTargetForNextSet = false
    
    // Weight picker values (0 to 200 in 0.5kg steps)
    private let weightOptions: [Double] = stride(from: 0.0, through: 200.0, by: 0.5).map { $0 }
    // Reps picker values (1 to 50)
    private let repsOptions: [Int] = Array(1...50)
    
    init(session: WorkoutSession, template: ProgramTemplate?) {
        self.session = session
        self.template = template
        #if DEBUG
        print("[DEBUG ActiveWorkoutView] Init. Session: \(session.id), Template: \(template?.id.uuidString ?? "nil")")
        #endif
        
        let sessionId = session.id
        self._exerciseLogs = Query(
            filter: #Predicate<ExerciseLog> { log in
                log.workoutSessionId == sessionId
            },
            sort: [SortDescriptor(\ExerciseLog.createdAt)]
        )
    }
    
    
    private var currentExercise: ProgramTemplateExercise? {
        guard currentExerciseIndex < exercises.count else { return nil }
        return exercises[currentExerciseIndex]
    }
    
    private var completedSets: Int {
        guard let exercise = currentExercise else { return 0 }
        return exerciseLogs.filter { log in
            log.exerciseTitle == exercise.exerciseName && log.completed
        }.count
    }
    
    private var totalSets: Int {
        exercises.reduce(0) { $0 + $1.targetSets }
    }
    
    private var completedTotalSets: Int {
        exerciseLogs.filter { $0.completed }.count
    }
    
    // Get previous set values for current exercise (to pre-fill inputs)
    private var previousSet: ExerciseLog? {
        guard let exercise = currentExercise else { return nil }
        // Get the most recent completed set for this specific exercise
        return exerciseLogs
            .filter { 
                $0.exerciseTitle == exercise.exerciseName && 
                $0.completed &&
                $0.workoutSessionId == session.id
            }
            .sorted { $0.setNumber > $1.setNumber }
            .first
    }
    
    // Extract minimum reps from reps string (e.g., "8-10" -> 8, "10" -> 10)
    private func getMinimumReps(from repsString: String) -> Int {
        // Handle ranges like "8-10" -> return 8
        if repsString.contains("-") {
            let components = repsString.split(separator: "-")
            if components.count == 2,
               let min = Int(components[0].trimmingCharacters(in: .whitespaces)) {
                return min
            }
        }
        
        // Handle single number like "10"
        if let reps = Int(repsString.trimmingCharacters(in: .whitespaces)) {
            return reps
        }
        
        // Default fallback
        return 8
    }
    
    // Get minimum weight from exercise (if multiple weights exist, use lowest)
    private func getMinimumWeight(from exercise: ProgramTemplateExercise) -> Double? {
        // If exercise has a target weight, use that
        if let targetWeight = exercise.targetWeight {
            return targetWeight
        }
        
        // Otherwise, check previous sets for this exercise
        if let previousSet = previousSet, let previousWeight = previousSet.weight {
            return previousWeight
        }
        
        return nil
    }
    
    
    // Pre-fill weight and reps when exercise or set changes
    private func prefillInputs() {
        guard let exercise = currentExercise else {
            weightValue = 0
            repsValue = 8
            return
        }
        
        // Check if we should explicitly force target values (e.g. user declined to update remaining sets)
        if forceUseTargetForNextSet {
            #if DEBUG
            print("[DEBUG ActiveWorkoutView] Forcing target values for next set")
            #endif
            weightValue = exercise.targetWeight ?? 0
            repsValue = getMinimumReps(from: exercise.targetReps)
            
            // Consume the flag
            forceUseTargetForNextSet = false
            return
        }
        
        // Check if there's a previous set for this exercise
        let previousSetForExercise = previousSet
        
        // Use previous set values if available, otherwise use minimum target values
        if let previousSet = previousSetForExercise {
            // Use previous set's values (user likely wants to repeat same weight/reps)
            weightValue = previousSet.weight ?? getMinimumWeight(from: exercise) ?? 0
            repsValue = previousSet.reps ?? getMinimumReps(from: exercise.targetReps)
        } else {
            // First set of this exercise - use AI-suggested target values
            weightValue = exercise.targetWeight ?? 0
            repsValue = getMinimumReps(from: exercise.targetReps)
        }
    }
    
    var body: some View {
        NavigationView {
            Group {
                if showingWarmup {
                    WarmupDashboardView()
                } else if isResting {
                    RestLoadingView()
                } else {
                    ExerciseDashboardView()
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button(action: { showCompleteDialog = true }) {
                        Text(String(localized: "Quit..."))
                            .fontWeight(.bold)
                            .foregroundColor(.red)
                    }
                }
                
                ToolbarItem(placement: .navigationBarTrailing) {
                    HStack(spacing: 4) {
                        Image(systemName: "timer")
                        Text("\(completedTotalSets)/\(totalSets)")
                    }
                    .font(.caption.bold())
                    .foregroundColor(.gray)
                }
            }
            .overlay(alignment: .top) {
                if showToast {
                    ToastView(message: toastMessage)
                        .transition(.move(edge: .top).combined(with: .opacity))
                        .padding(.top, 100)
                }
            }
            .onAppear {
                #if DEBUG
                print("[DEBUG ActiveWorkoutView] inner onAppear. Exercises count: \(exercises.count), sessionId: \(session.id), showingWarmup: \(showingWarmup)")
                #endif
                initializeSessionExercises()
                restoreStateFromLogs()
                
                // Sync to Watch
                WatchConnectivityManager.shared.sendWorkoutStart(
                    session: session,
                    template: template,
                    exercises: sessionExercises
                )
                
                prefillInputs()
                
                // Start session timer for this active period
                if session.status == "active" {
                    session.lastStartTime = Date()
                    try? modelContext.save()
                }
            }
        .onReceive(NotificationCenter.default.publisher(for: NSNotification.Name("WatchSyncRequested"))) { _ in
            print("[ActiveWorkoutView] Received sync request via notification")
            WatchConnectivityManager.shared.sendWorkoutStart(
                session: session,
                template: template,
                exercises: sessionExercises
            )
        }
        .onDisappear {
            #if DEBUG
            print("[DEBUG ActiveWorkoutView] onDisappear")
            #endif
            timer?.invalidate()
            timer = nil  // Release timer reference to prevent memory leak

            // Accumulate time if session is still active
            if session.status == "active" {
                let isWatchActive = WatchConnectivityManager.shared.isReachable

                if isWatchActive {
                    #if DEBUG
                    print("[DEBUG ActiveWorkoutView] onDisappear but Watch is reachable. Keeping timer alive.")
                    #endif
                } else {
                    if let start = session.lastStartTime {
                        let additional = Date().timeIntervalSince(start)
                        session.accumulatedTime += additional
                        #if DEBUG
                        print("[DEBUG ActiveWorkoutView] onDisappear: accumulating \(additional)s. Total: \(session.accumulatedTime)s")
                        #endif
                    }
                    session.lastStartTime = nil
                    try? modelContext.save()
                }
            }
        }
        .onChange(of: isResting) { _, newValue in
            if newValue {
                startTimer()
            } else {
                timer?.invalidate()
                timer = nil  // Release timer reference
            }
        }
        .onChange(of: scenePhase) { _, newPhase in
            if session.status == "active" {
                if newPhase == .active {
                    // App resumed: Start a new active period
                    session.lastStartTime = Date()
                    #if DEBUG
                    print("[DEBUG ActiveWorkoutView] App active, resuming timer")
                    #endif
                } else {
                    // App going to background or inactive: Accumulate time so far

                    // Check if they are using Apple Watch (reachable)
                    // Or if they have it installed, we can be more lenient to avoid accidental pauses
                    let isWatchActive = WatchConnectivityManager.shared.isReachable

                    if isWatchActive {
                        #if DEBUG
                        print("[DEBUG ActiveWorkoutView] App inactive but Watch is reachable. Keeping timer alive.")
                        #endif
                        // Don't clear lastStartTime, so it keeps calculating in background
                    } else {
                        if let start = session.lastStartTime {
                            let additional = Date().timeIntervalSince(start)
                            session.accumulatedTime += additional
                            #if DEBUG
                            print("[DEBUG ActiveWorkoutView] App inactive, accumulating \(additional)s. Total: \(session.accumulatedTime)s")
                            #endif
                        }
                        session.lastStartTime = nil
                    }
                }
                try? modelContext.save()
            }
        }
        .onChange(of: currentExerciseIndex) { _, _ in
            // Only reset set index if we are NOT restoring state
            if !isRestoringState {
                currentSetIndex = 0
            }
            prefillInputs()
        }
        .onChange(of: currentSetIndex) { _, _ in
            prefillInputs()
        }
        // Fix navigation loop: Dismiss this view when completion screen is dismissed
        .onChange(of: showingCompletion) { _, isPresented in
            if !isPresented && session.status == "completed" {
                dismiss()
            }
        }
        .alert(String(localized: "Update remaining sets?"), isPresented: $showApplyToAllDialog) {
            Button(String(localized: "Yes, update all")) {
                applyToRemainingSets()
                completeSetActual()
            }
            Button(String(localized: "No, just this set")) {
                // Ensure next set uses original target, not the modified values from this set
                forceUseTargetForNextSet = true
                completeSetActual()
            }
        } message: {
            Text(String(localized: "Do you want to apply these values to all remaining sets for this exercise in this session?"))
        }
        .alert(String(localized: "Manage workouts"), isPresented: $showCompleteDialog) {
            Button(String(localized: "Pause & Close"), role: .none) { 
                // Just dismiss the view, keeping the session active
                dismiss() 
            }
            Button(String(localized: "Finish & Save"), role: .destructive) { 
                completeSession() 
            }
            Button(String(localized: "Cancel"), role: .cancel) { }
        } message: {
            Text(String(localized: "Do you want to pause the session to continue later, or end it completely?"))
        }
        .fullScreenCover(isPresented: $showingCompletion) {
            WorkoutCompletionView(
                session: session, 
                isFullyCompleted: completedTotalSets >= totalSets
            )
        }
        }
    }
    
    private func initializeSessionExercises() {
        guard sessionExercises.isEmpty else { return }
        
        if let templateExercises = template?.exercises {
            sessionExercises = templateExercises.sorted { $0.orderIndex < $1.orderIndex }
        } else {
            // Fallback if template is nil (should not happen with regular flow)
            let targetTemplateId = session.templateId
            let descriptor = FetchDescriptor<ProgramTemplateExercise>(
                predicate: #Predicate { $0.template?.id == targetTemplateId }
            )
            if let fetched = try? modelContext.fetch(descriptor) {
                sessionExercises = fetched.sorted { $0.orderIndex < $1.orderIndex }
            }
        }
    }
    
    private func restoreStateFromLogs() {
        guard !exerciseLogs.isEmpty else { return }
        
        // Logs are sorted by createdAt ascending (from Query init)
        guard let lastLog = exerciseLogs.last else { return }
        
        // Flag to preventing onChange from resetting state
        isRestoringState = true
        defer { 
            // Small delay to ensure onChange fires first if it was going to
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                isRestoringState = false 
            }
        }
        
        var nextExerciseIndex = lastLog.exerciseOrderIndex
        var nextSetIndex = lastLog.setNumber // 1-based completed set becomes next 0-based index
        
        // Check if we need to advance to next exercise
        // We find the exercise corresponding to the last log to check its target sets
        // Note: We use the index from the log which should match the sorted order
        if nextExerciseIndex < sessionExercises.count {
            let exercise = sessionExercises[nextExerciseIndex]
            if nextSetIndex >= exercise.targetSets {
                nextExerciseIndex += 1
                nextSetIndex = 0
            }
        }
        
        // Bounds check to ensure we don't crash if calculation goes out of bounds
        if nextExerciseIndex < sessionExercises.count {
            currentExerciseIndex = nextExerciseIndex
            currentSetIndex = nextSetIndex
            showingWarmup = false
            #if DEBUG
            print("[DEBUG ActiveWorkoutView] Restored state to Exercise: \(nextExerciseIndex), Set: \(nextSetIndex)")
            #endif
        } else {
            #if DEBUG
            print("[DEBUG ActiveWorkoutView] All exercises appear complete based on logs")
            #endif
             // Optional: Handle case where workout is effectively done but not marked 'completed'
             // For now, capping at last info or similar could be better, but staying safe.
        }
    }
    
    private var exercises: [ProgramTemplateExercise] {
        sessionExercises
    }
    
    private func startTimer() {
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { _ in
            if restTimeRemaining > 0 {
                restTimeRemaining -= 1
            } else {
                handleRestComplete()
            }
        }
    }
    
    private func skipExercise() {
        guard !exercises.isEmpty else { return }
        let skipped = exercises[currentExerciseIndex]
        sessionExercises.remove(at: currentExerciseIndex)
        sessionExercises.append(skipped)
        // Keep currentExerciseIndex the same, it now points to the "new" exercise at this position
        // unless it was the last one and shifted.
        if currentExerciseIndex >= sessionExercises.count {
            currentExerciseIndex = 0
        }
        prefillInputs()
    }
    
    private func applyToRemainingSets() {
        guard let exercise = currentExercise else { return }
        
        // Update the target values in the model so prefill picks them up for next sets
        exercise.targetWeight = pendingWeight
        exercise.targetReps = String(pendingReps)
        
        try? modelContext.save()
        
        toastMessage = "Remaining sets updated"
        withAnimation {
            showToast = true
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            withAnimation { showToast = false }
        }
    }
    
    @ViewBuilder
    private func WarmupDashboardView() -> some View {
        #if DEBUG
        let _ = print("[DEBUG ActiveWorkoutView] Rendering WarmupDashboardView")
        #endif
        VStack(spacing: 30) {
            Spacer()
            
            VStack(spacing: 16) {
                Image(systemName: "figure.run")
                    .font(.system(size: 60))
                    .foregroundColor(.accentBlue)
                
                Text(String(localized: "Time for warm-up!"))
                    .font(.title2.bold())
                    .foregroundColor(Color.textPrimary(for: colorScheme))
            }
            
            if let warmup = template?.warmupDescription {
                Text(warmup)
                    .font(.body)
                    .foregroundColor(Color.textSecondary(for: colorScheme))
                    .multilineTextAlignment(.center)
                    .padding()
            }
            
            VStack(alignment: .leading, spacing: 12) {
                Text(String(localized: "EQUIPMENT NEEDED"))
                    .font(.caption.bold())
                    .foregroundColor(Color.textSecondary(for: colorScheme))
                
                let neededEquipment = Set(exercises.flatMap { $0.requiredEquipment }).filter { $0.lowercased() != "unknown" }
                
                ExerciseFlowLayout(spacing: 8) {
                    ForEach(Array(neededEquipment), id: \.self) { eq in
                        HStack(spacing: 4) {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.caption)
                            Text(eq)
                                .font(.caption.bold())
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(Color.accentBlue.opacity(0.1))
                        .foregroundColor(.accentBlue)
                        .cornerRadius(20)
                    }
                }
            }
            .padding()
            .background(Color.cardBackground(for: colorScheme))
            .cornerRadius(16)
            .padding(.horizontal)
            
            Spacer()
            
            Button(action: { showingWarmup = false }) {
                Text(String(localized: "Start training"))
                    .font(.headline.bold())
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.accentBlue)
                    .foregroundColor(.white)
                    .cornerRadius(15)
            }
            .padding(.horizontal, 30)
            .padding(.bottom, 40)
        }
        .background(Color.appBackground(for: colorScheme).ignoresSafeArea())
    }

    @ViewBuilder
    private func ExerciseDashboardView() -> some View {
        #if DEBUG
        let _ = print("[DEBUG ActiveWorkoutView] Rendering ExerciseDashboardView. exercises count: \(exercises.count)")
        #endif
        if exercises.isEmpty && (template != nil || session.templateId != nil) {
            VStack {
                ProgressView()
                Text(String(localized: "Loading exercises..."))
                    .font(.caption)
                    .foregroundColor(.gray)
                    .padding(.top)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color.appBackground(for: colorScheme).ignoresSafeArea())
        } else if let exercise = currentExercise {
            ScrollView {
                VStack(spacing: 20) {
                    // Exercise Title & Skip
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Text(exercise.exerciseName)
                                .font(.title.bold())
                                .foregroundColor(Color.textPrimary(for: colorScheme))
                            
                            // Video icon - only show if exercise has video in database
                            if let videoUrl = ExerciseCatalogService.shared.getVideoURL(for: exercise.exerciseName, modelContext: modelContext),
                               !videoUrl.isEmpty {
                                Button(action: {
                                    openExerciseVideo(exerciseName: exercise.exerciseName)
                                }) {
                                    Image(systemName: "play.circle.fill")
                                        .font(.title2)
                                        .foregroundColor(.red)
                                }
                                .buttonStyle(.plain)
                            }
                            
                            Spacer()
                            Text(String(localized: "Set") + " \(currentSetIndex + 1)/\(exercise.targetSets)")
                                .font(.subheadline.bold())
                                .padding(.horizontal, 12)
                                .padding(.vertical, 6)
                                .background(Color.textSecondary(for: colorScheme).opacity(0.2))
                                .cornerRadius(10)
                        }
                        .onAppear {
                            // Debug: Log if exercise is missing video
                            #if DEBUG
                            if ExerciseCatalogService.shared.getVideoURL(for: exercise.exerciseName, modelContext: modelContext) == nil {
                                print("[DEBUG] ⚠️ Exercise missing video: \(exercise.exerciseName)")
                            }
                            #endif
                        }
                        
                        Text(String(localized: "Exercise") + " \(currentExerciseIndex + 1) " + String(localized: "of") + " \(exercises.count)")
                            .font(.subheadline)
                            .foregroundColor(Color.textSecondary(for: colorScheme))
                        
                        Button(action: skipExercise) {
                            HStack {
                                Image(systemName: "chevron.right.2")
                                Text(String(localized: "Skip to next exercise"))
                            }
                            .font(.subheadline.bold())
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                            .background(Color.textPrimary(for: colorScheme).opacity(0.05))
                            .foregroundColor(Color.textPrimary(for: colorScheme))
                            .cornerRadius(10)
                            .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.textPrimary(for: colorScheme).opacity(0.1), lineWidth: 1))
                        }
                    }
                    .padding()
                    .background(Color.cardBackground(for: colorScheme))
                    .cornerRadius(20)
                    .padding(.horizontal)

                    // Goals Section
                    VStack(alignment: .leading, spacing: 15) {
                        HStack {
                            Image(systemName: "target")
                            Text(String(localized: "Goal"))
                                .font(.headline)
                        }
                        .foregroundColor(Color.textPrimary(for: colorScheme))
                        
                        Divider().background(Color.textPrimary(for: colorScheme).opacity(0.1))
                        
                        HStack {
                            Text(String(localized: "Repetitions"))
                                .foregroundColor(Color.textSecondary(for: colorScheme))
                            Spacer()
                            Text(exercise.targetReps)
                                .bold()
                        }
                        
                        HStack {
                            Text(String(localized: "AI suggestions"))
                                .foregroundColor(Color.textSecondary(for: colorScheme))
                            Spacer()
                            Text("\(String(format: "%.1f", exercise.targetWeight ?? 0))kg")
                                .bold()
                        }
                    }
                    .padding()
                    .background(Color.cardBackground(for: colorScheme))
                    .cornerRadius(20)
                    .padding(.horizontal)

                    // Log Section
                    VStack(alignment: .leading, spacing: 15) {
                        Text(String(localized: "Log set"))
                            .font(.headline)
                            .foregroundColor(Color.textPrimary(for: colorScheme))
                        
                        HStack(spacing: 0) {
                            // Weight Picker
                            VStack(spacing: 4) {
                                Text(String(localized: "Weight (kg)"))
                                    .font(.caption.bold())
                                    .foregroundColor(Color.textSecondary(for: colorScheme))
                                
                                Picker(String(localized: "Weight"), selection: $weightValue) {
                                    ForEach(weightOptions, id: \.self) { value in
                                        Text(value.truncatingRemainder(dividingBy: 1) == 0
                                             ? String(format: "%.0f", value)
                                             : String(format: "%.1f", value))
                                            .tag(value)
                                    }
                                }
                                .pickerStyle(.wheel)
                                .frame(width: 100, height: 120)
                                .clipped()
                            }
                            
                            Spacer()
                            
                            // Reps Picker
                            VStack(spacing: 4) {
                                Text(String(localized: "Reps"))
                                    .font(.caption.bold())
                                    .foregroundColor(Color.textSecondary(for: colorScheme))
                                
                                Picker(String(localized: "Reps"), selection: $repsValue) {
                                    ForEach(repsOptions, id: \.self) { value in
                                        Text("\(value)")
                                            .tag(value)
                                    }
                                }
                                .pickerStyle(.wheel)
                                .frame(width: 80, height: 120)
                                .clipped()
                            }
                        }
                        .padding(.vertical, 8)
                        .background(Color.textSecondary(for: colorScheme).opacity(0.05))
                        .cornerRadius(16)
                        
                        HStack(spacing: 12) {
                            Button(action: completeSet) {
                                Text(String(localized: "Set completed"))
                                    .font(.headline.bold())
                                    .frame(maxWidth: .infinity)
                                    .padding()
                                    .background(Color.accentBlue.opacity(0.6))
                                    .foregroundColor(.white)
                                    .cornerRadius(12)
                            }
                            
                            Button(action: {}) {
                                Image(systemName: "plus")
                                    .font(.title3.bold())
                                    .padding()
                                    .background(Color.accentBlue.opacity(0.4))
                                    .foregroundColor(.white)
                                    .cornerRadius(12)
                            }
                        }
                    }
                    .padding()
                    .background(Color.cardBackground(for: colorScheme))
                    .cornerRadius(20)
                    .padding(.horizontal)
                }
                .padding(.vertical)
            }
            .background(Color.appBackground(for: colorScheme).ignoresSafeArea())
        } else if exercises.isEmpty {
            EmptyWorkoutView()
        }
    }

    @ViewBuilder
    private func RestLoadingView() -> some View {
        VStack(spacing: 30) {
            Text(String(localized: "Great job!"))
                .font(.title.bold())
                .foregroundColor(Color.textPrimary(for: colorScheme))
            Text(String(localized: "Rest before next set"))
                .foregroundColor(Color.textSecondary(for: colorScheme))
            
            ZStack {
                Circle()
                    .stroke(Color.textPrimary(for: colorScheme).opacity(0.1), lineWidth: 10)
                    .frame(width: 200, height: 200)
                
                VStack(spacing: 4) {
                    Image(systemName: "clock")
                        .foregroundColor(Color.textSecondary(for: colorScheme))
                    Text(timeString(from: restTimeRemaining))
                        .font(.system(size: 60, weight: .bold, design: .rounded))
                        .foregroundColor(Color.textPrimary(for: colorScheme))
                    Text(String(localized: "seconds remaining"))
                        .font(.caption)
                        .foregroundColor(Color.textSecondary(for: colorScheme))
                }
            }
            
            Button(action: handleSkipRest) {
                HStack {
                    Image(systemName: "forward.end.fill")
                    Text(String(localized: "Skip"))
                }
                .font(.headline.bold())
                .padding(.horizontal, 30)
                .padding(.vertical, 15)
                .background(Color.textPrimary(for: colorScheme).opacity(0.05))
                .foregroundColor(Color.textPrimary(for: colorScheme))
                .cornerRadius(15)
                .overlay(RoundedRectangle(cornerRadius: 15).stroke(Color.textPrimary(for: colorScheme).opacity(0.1), lineWidth: 1))
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.appBackground(for: colorScheme).ignoresSafeArea())
    }

    @ViewBuilder
    private func EmptyWorkoutView() -> some View {
        VStack(spacing: 20) {
            Image(systemName: "dumbbell.fill")
                .font(.system(size: 60))
                .foregroundColor(.gray)
            Text(String(localized: "No exercises found"))
                .font(.headline)
            Text(String(localized: "This session appears to have no exercises. End the session and try syncing again."))
                .multilineTextAlignment(.center)
                .font(.subheadline)
                .foregroundColor(.textSecondary)
            
            Button(String(localized: "Finish session")) {
                completeSession()
            }
            .padding()
            .background(Color.red.opacity(0.1))
            .foregroundColor(.red)
            .cornerRadius(10)
        }
        .padding(40)
        .frame(maxWidth: .infinity)
    }

    private func timeString(from totalSeconds: Int) -> String {
        let minutes = totalSeconds / 60
        let seconds = totalSeconds % 60
        return String(format: "%02d:%02d", minutes, seconds)
    }
    
    private func completeSet() {
        guard let exercise = currentExercise else { return }
        
        // Determine baseline (expected) values for this set
        var baselineWeight = exercise.targetWeight ?? 0
        var baselineReps = getMinimumReps(from: exercise.targetReps)
        
        if let prev = previousSet, let prevWeight = prev.weight, let prevReps = prev.reps {
            baselineWeight = prevWeight
            baselineReps = prevReps
        }
        
        // Check if user has deviated from the baseline
        let hasChanged = weightValue != baselineWeight || repsValue != baselineReps
        
        // Check conditions for showing dialog:
        // 1. Values have changed from expected
        // 2. Not the last set (no point updating remaining)
        // 3. Not the first set (Set 0)
        if hasChanged && currentSetIndex > 0 && currentSetIndex < exercise.targetSets - 1 {
            pendingWeight = weightValue
            pendingReps = repsValue
            showApplyToAllDialog = true
        } else {
            completeSetActual()
        }
    }
    
    private func completeSetActual() {
        guard let exercise = currentExercise else { return }
    

        
        // Create exercise log
        let log = ExerciseLog(
            workoutSessionId: session.id,
            exerciseKey: exercise.exerciseKey,
            exerciseTitle: exercise.exerciseName,
            exerciseOrderIndex: currentExerciseIndex,
            setNumber: currentSetIndex + 1,
            weight: weightValue, // Passed directly as Double
            reps: repsValue,
            completed: true
        )
        
        modelContext.insert(log)
        
        // Update exercise stats
        do {
            try ExerciseStatsService.shared.updateStats(
                from: log,
                session: session,
                modelContext: modelContext
            )
        } catch {
            print("Error updating exercise stats: \(error)")
        }
        
        // Check if this was the last set of the exercise
        if currentSetIndex >= exercise.targetSets - 1 {
            // Move to next exercise or finish
            if currentExerciseIndex < exercises.count - 1 {
                currentExerciseIndex += 1
                currentSetIndex = 0
                isResting = true
                restTimeRemaining = profiles.first?.restTimeBetweenExercises ?? 120
                // Pre-fill inputs for new exercise (will be called after rest)
            } else {
                // Workout complete!
                completeSession()
                return
            }
        } else {
            // Next set of same exercise
            currentSetIndex += 1
            isResting = true
            restTimeRemaining = profiles.first?.restTimeBetweenSets ?? 90
            // Pre-fill inputs for next set (will be called after rest)
        }
    }
    
    private func handleRestComplete() {
        isResting = false
        // prefillInputs is already called via onChange(of: currentSetIndex)
    }
    
    private func handleSkipRest() {
        isResting = false
        // prefillInputs is already called via onChange(of: currentSetIndex)
    }
    
    private func openExerciseVideo(exerciseName: String) {
        // Only open if video URL exists in database
        if let videoUrl = ExerciseCatalogService.shared.getVideoURL(for: exerciseName, modelContext: modelContext),
           let url = URL(string: videoUrl) {
            UIApplication.shared.open(url)
        }
    }
    
    private func completeSession() {
        // Update session status
        session.status = "completed"
        session.completedAt = Date()
        
        // Final duration update
        if let start = session.lastStartTime {
            session.accumulatedTime += Date().timeIntervalSince(start)
        }
        session.lastStartTime = nil
        
        try? modelContext.save()
        showingCompletion = true
    }
}

struct ToastView: View {
    @Environment(\.colorScheme) private var colorScheme
    let message: String
    var body: some View {
        HStack {
            Image(systemName: "checkmark.circle.fill")
                .foregroundColor(.green)
            Text(message)
                .font(.headline)
                .foregroundColor(Color.textPrimary(for: colorScheme))
            Spacer()
            Button(action: {}) {
                Image(systemName: "xmark")
                    .foregroundColor(Color.textSecondary(for: colorScheme))
            }
        }
        .padding()
        .background(Color.cardBackground(for: colorScheme))
        .cornerRadius(12)
        .padding(.horizontal)
        .shadow(radius: 10)
    }
}

struct ExerciseFlowLayout: Layout {
    var spacing: CGFloat
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = subviews.reduce(into: FlowResult(width: proposal.width ?? 0, spacing: spacing)) { res, sub in
            let size = sub.sizeThatFits(.unspecified)
            if res.currentX + size.width > res.width {
                res.currentX = 0
                res.currentY += res.maxHeight + spacing
                res.maxHeight = 0
            }
            res.currentX += size.width + spacing
            res.maxHeight = max(res.maxHeight, size.height)
            res.totalHeight = res.currentY + res.maxHeight
        }
        return CGSize(width: proposal.width ?? 0, height: result.totalHeight)
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var currentX = bounds.minX
        var currentY = bounds.minY
        var maxHeight: CGFloat = 0
        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if currentX + size.width > bounds.maxX {
                currentX = bounds.minX
                currentY += maxHeight + spacing
                maxHeight = 0
            }
            subview.place(at: CGPoint(x: currentX, y: currentY), proposal: .unspecified)
            currentX += size.width + spacing
            maxHeight = max(maxHeight, size.height)
        }
    }
    struct FlowResult {
        var width: CGFloat
        var spacing: CGFloat
        var currentX: CGFloat = 0
        var currentY: CGFloat = 0
        var maxHeight: CGFloat = 0
        var totalHeight: CGFloat = 0
    }
}


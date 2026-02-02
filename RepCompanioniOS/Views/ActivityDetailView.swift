import SwiftUI
import SwiftData
import HealthKit

struct ActivityDetailView: View {
    let activityPercent: Int
    let colorScheme: ColorScheme
    let healthKitService: HealthKitService
    @Environment(\.modelContext) private var modelContext
    
    @Query private var workoutSessions: [WorkoutSession]
    @Query private var programTemplates: [ProgramTemplate]
    @Query private var exerciseLogs: [ExerciseLog]
    
    @State private var stepsToday: Int = 0
    @State private var activeMinutes: Int = 0
    @State private var activeCalories: Double = 0.0
    @State private var distanceKm: Double = 0.0
    @State private var flightsClimbed: Int = 0
    @State private var workoutsThisWeek: Int = 0
    @State private var workoutProgress: Double? = nil // Progress for today's workout (0.0-1.0+)
    @State private var isLoading = true
    
    // TEST: Force test data for debugging
    #if DEBUG
    private let useTestData = false
    #else
    private let useTestData = false
    #endif
    
    // Computed property for inner progress that always returns test value in DEBUG
    private var innerProgressValue: Double? {
        if useTestData {
            return workoutProgress ?? 0.45 // Use workoutProgress if set, otherwise 45% for testing
        }
        return todayTemplate != nil ? (workoutProgress ?? 0.0) : nil
    }
    
    private let stepGoal = 10000
    
    // Check if today is a training day and get the template
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
        
        return programTemplates.first { $0.dayOfWeek == dayOfWeek }
    }
    
    // Calculate workout progress based on completed reps vs planned reps
    private func calculateWorkoutProgress() -> Double? {
        guard let template = todayTemplate else { return nil }
        
        // Get planned exercises for today's template
        let plannedExercises = template.exercises
        
        // Calculate total planned reps
        var totalPlannedReps = 0
        for exercise in plannedExercises {
            // Parse reps string (e.g., "8-12" -> use average, "10" -> use 10)
            let repsStr = exercise.targetReps
            let reps = parseRepsString(repsStr)
            totalPlannedReps += exercise.targetSets * reps
        }
        
        guard totalPlannedReps > 0 else { return nil }
        
        // Get today's workout session
        let calendar = Calendar.current
        let today = Date()
        let startOfDay = calendar.startOfDay(for: today)
        let endOfDay = calendar.date(byAdding: .day, value: 1, to: startOfDay)!
        
        // Find active or completed session for today
        let todaySession = workoutSessions.first { session in
            let startedAt = session.startedAt // non-optional in model
            return startedAt >= startOfDay && startedAt < endOfDay &&
                   (session.status == "active" || session.status == "completed") &&
                   session.templateId == template.id
        }
        
        guard let session = todaySession else {
            // No session started yet, but it's a training day - return 0.0 to show empty ring
            return 0.0
        }
        
        // Calculate completed reps from exercise logs
        let sessionLogs = exerciseLogs.filter { $0.workoutSessionId == session.id && $0.completed }
        var totalCompletedReps = 0
        for log in sessionLogs {
            if let reps = log.reps {
                totalCompletedReps += reps
            }
        }
        
        // Calculate progress (can exceed 100% if user adds extra exercises/reps)
        let progress = Double(totalCompletedReps) / Double(totalPlannedReps)
        return progress
    }
    
    // Parse reps string to get average number
    private func parseRepsString(_ repsStr: String) -> Int {
        // Handle ranges like "8-12" -> average = 10
        if repsStr.contains("-") {
            let components = repsStr.split(separator: "-")
            if components.count == 2,
               let min = Int(components[0].trimmingCharacters(in: .whitespaces)),
               let max = Int(components[1].trimmingCharacters(in: .whitespaces)) {
                return (min + max) / 2
            }
        }
        
        // Handle single number like "10"
        if let reps = Int(repsStr.trimmingCharacters(in: .whitespaces)) {
            return reps
        }
        
        // Default fallback
        return 10
    }
    
    var body: some View {
        VStack(spacing: 24) {
            // Large Activity Circle
            VStack(spacing: 16) {
                StatusCard(
                    title: "AKTIVITET",
                    value: "\(activityPercent)%",
                    subtitle: "of goal",
                    color: .activityBlue,
                    progress: Double(activityPercent) / 100.0,
                    icon: "waveform.path.ecg",
                    colorScheme: colorScheme,
                    size: .large,
                    innerProgress: innerProgressValue, // Only show inner ring on training days, default to 0.0 if no progress yet
                    innerColor: .orange // Orange color for workout ring
                )
            }
            .padding(.horizontal)
            
            // Activity Specifications
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("Total activity:")
                        .font(.subheadline)
                        .foregroundStyle(Color.textSecondary(for: colorScheme))
                    Spacer()
                    Text("\(activityPercent)%")
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundStyle(Color.textPrimary(for: colorScheme))
                }
                
                if let workoutProgress = workoutProgress {
                    HStack {
                        Text("Workout:")
                            .font(.subheadline)
                            .foregroundStyle(Color.textSecondary(for: colorScheme))
                        Spacer()
                        Text("\(Int(workoutProgress * 100))%")
                            .font(.subheadline)
                            .fontWeight(.semibold)
                            .foregroundStyle(Color.orange)
                    }
                } else if todayTemplate != nil || useTestData {
                    // Show 0% if it's a training day but no progress yet, or show test data
                    HStack {
                        Text("Workout:")
                            .font(.subheadline)
                            .foregroundStyle(Color.textSecondary(for: colorScheme))
                        Spacer()
                        Text(useTestData ? "45%" : "0%")
                            .font(.subheadline)
                            .fontWeight(.semibold)
                            .foregroundStyle(Color.orange)
                    }
                }
            }
            .padding()
            .background(Color.cardBackground(for: colorScheme))
            .cornerRadius(12)
            .padding(.horizontal)
            
            // Activity Details Card
            VStack(alignment: .leading, spacing: 16) {
                Text("AKTIVITETSDETALJER")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(Color.textSecondary(for: colorScheme))
                    .tracking(1)
                
                if isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .padding()
                } else {
                    // Steps
                    HStack {
                        HStack(spacing: 8) {
                            Image(systemName: "figure.walk")
                                .foregroundStyle(Color.textSecondary(for: colorScheme))
                            Text("Steg idag")
                                .font(.subheadline)
                                .foregroundStyle(Color.textSecondary(for: colorScheme))
                        }
                        Spacer()
                        VStack(alignment: .trailing, spacing: 2) {
                            Text("\(stepsToday.formatted())")
                                .font(.subheadline)
                                .fontWeight(.semibold)
                                .foregroundStyle(Color.textPrimary(for: colorScheme))
                            Text("av \(stepGoal.formatted())")
                                .font(.caption)
                                .foregroundStyle(Color.textSecondary(for: colorScheme))
                        }
                    }
                    
                    Divider()
                    
                    // Training Pulse (Active Minutes)
                    HStack {
                        HStack(spacing: 8) {
                            Image(systemName: "clock")
                                .foregroundStyle(Color.textSecondary(for: colorScheme))
                            Text("Training heart rate")
                                .font(.subheadline)
                                .foregroundStyle(Color.textSecondary(for: colorScheme))
                        }
                        Spacer()
                        if activeMinutes > 0 {
                            Text("\(activeMinutes) min")
                                .font(.subheadline)
                                .fontWeight(.semibold)
                                .foregroundStyle(Color.textPrimary(for: colorScheme))
                        } else {
                            Text("—")
                                .font(.subheadline)
                                .foregroundStyle(Color.textSecondary(for: colorScheme))
                        }
                    }
                    
                    Text("Requires Apple Watch for workout")
                        .font(.caption2)
                        .foregroundStyle(Color.textSecondary(for: colorScheme).opacity(0.7))
                        .padding(.leading, 32)
                    
                    Divider()
                    
                    // Active Calories
                    HStack {
                        HStack(spacing: 8) {
                            Image(systemName: "flame.fill")
                                .foregroundStyle(Color.textSecondary(for: colorScheme))
                            Text("Active calories")
                                .font(.subheadline)
                                .foregroundStyle(Color.textSecondary(for: colorScheme))
                        }
                        Spacer()
                        if activeCalories > 0 {
                            Text("\(Int(activeCalories)) kcal")
                                .font(.subheadline)
                                .fontWeight(.semibold)
                                .foregroundStyle(Color.textPrimary(for: colorScheme))
                        } else {
                            Text("—")
                                .font(.subheadline)
                                .foregroundStyle(Color.textSecondary(for: colorScheme))
                        }
                    }
                    
                    Text("Requires Apple Watch for activity")
                        .font(.caption2)
                        .foregroundStyle(Color.textSecondary(for: colorScheme).opacity(0.7))
                        .padding(.leading, 32)
                    
                    Divider()
                    
                    // Distance
                    HStack {
                        HStack(spacing: 8) {
                            Image(systemName: "figure.run")
                                .foregroundStyle(Color.textSecondary(for: colorScheme))
                            Text("Distans")
                                .font(.subheadline)
                                .foregroundStyle(Color.textSecondary(for: colorScheme))
                        }
                        Spacer()
                        Text(String(format: "%.2f km", distanceKm))
                            .font(.subheadline)
                            .fontWeight(.semibold)
                            .foregroundStyle(Color.textPrimary(for: colorScheme))
                    }
                    
                    Divider()
                    
                    // Flights Climbed
                    HStack {
                        HStack(spacing: 8) {
                            Image(systemName: "stairs")
                                .foregroundStyle(Color.textSecondary(for: colorScheme))
                            Text("Trappor")
                                .font(.subheadline)
                                .foregroundStyle(Color.textSecondary(for: colorScheme))
                        }
                        Spacer()
                        Text("\(flightsClimbed)")
                            .font(.subheadline)
                            .fontWeight(.semibold)
                            .foregroundStyle(Color.textPrimary(for: colorScheme))
                    }
                    
                    Divider()
                    
                    // Workouts This Week
                    HStack {
                        HStack(spacing: 8) {
                            Image(systemName: "dumbbell.fill")
                                .foregroundStyle(Color.textSecondary(for: colorScheme))
                            Text("Sessions this week")
                                .font(.subheadline)
                                .foregroundStyle(Color.textSecondary(for: colorScheme))
                        }
                        Spacer()
                        Text("\(workoutsThisWeek)")
                            .font(.subheadline)
                            .fontWeight(.semibold)
                            .foregroundStyle(Color.textPrimary(for: colorScheme))
                    }
                }
            }
            .padding()
            .background(Color.cardBackground(for: colorScheme))
            .cornerRadius(12)
            .padding(.horizontal)
            
            // Personal Tips Section
            PersonalTipsSection()
        }
        .onAppear {
            loadActivityData()
            updateWorkoutProgress()
            
            #if DEBUG
            print("[DEBUG ActivityDetailView] onAppear - innerProgressValue: \(innerProgressValue?.description ?? "nil"), useTestData: \(useTestData)")
            #endif
        }
        .onChange(of: exerciseLogs.count) { _, _ in
            updateWorkoutProgress()
        }
        .onChange(of: workoutSessions.count) { _, _ in
            updateWorkoutProgress()
        }
    }
    
    private func updateWorkoutProgress() {
        let calculated = calculateWorkoutProgress()
        workoutProgress = calculated
        print("[DEBUG] Workout progress calculated: \(calculated?.description ?? "nil"), todayTemplate: \(todayTemplate != nil ? "exists" : "nil")")
    }
    
    private func loadActivityData() {
        if useTestData {
            // Set dummy data for testing
            stepsToday = 8500
            activeCalories = 420.0
            activeMinutes = 45
            distanceKm = 6.2
            flightsClimbed = 12
            workoutsThisWeek = 3
            workoutProgress = 0.45 // 45% workout progress
            isLoading = false
            return
        }
        
        guard healthKitService.isAuthorized else {
            isLoading = false
            return
        }
        
        Task {
            let calendar = Calendar.current
            let now = Date()
            let startOfDay = calendar.startOfDay(for: now)
            let tomorrow = calendar.date(byAdding: .day, value: 1, to: startOfDay)!
            let startOfWeek = calendar.dateInterval(of: .weekOfYear, for: now)?.start ?? now
            
            do {
                let steps = try await healthKitService.getStepsCount(for: startOfDay, to: tomorrow)
                let calories = try await healthKitService.getActiveEnergyBurned(for: startOfDay, to: tomorrow)
                let minutes = try await healthKitService.getActiveMinutes(for: startOfDay, to: tomorrow)
                let distance = try await healthKitService.getDistanceWalkingRunning(for: startOfDay, to: tomorrow)
                let flights = try await healthKitService.getFlightsClimbed(for: startOfDay, to: tomorrow)
                
                // Count workouts this week
                let workouts = workoutSessions.filter { session in
                    guard let completedAt = session.completedAt else { return false }
                    return completedAt >= startOfWeek && session.status == "completed"
                }.count
                
                await MainActor.run {
                    stepsToday = steps
                    activeCalories = calories
                    activeMinutes = minutes
                    distanceKm = distance
                    flightsClimbed = flights
                    workoutsThisWeek = workouts
                    isLoading = false
                }
            } catch {
                await MainActor.run {
                    isLoading = false
                    print("Error loading activity data: \(error)")
                }
            }
        }
    }
}

import SwiftUI
import SwiftData

struct WorkoutCompletionView: View {
    let session: WorkoutSession
    let isFullyCompleted: Bool
    
    @Query private var exerciseLogs: [ExerciseLog]
    @Query private var allTemplates: [ProgramTemplate]
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme
    
    @State private var notes: String = ""
    @State private var animateIcon = false
    
    init(session: WorkoutSession, isFullyCompleted: Bool) {
        self.session = session
        self.isFullyCompleted = isFullyCompleted
        
        let sessionId = session.id
        self._exerciseLogs = Query(
            filter: #Predicate<ExerciseLog> { log in
                log.workoutSessionId == sessionId
            },
            sort: [SortDescriptor(\ExerciseLog.createdAt)]
        )
    }
    
    var stats: WorkoutStats {
        let completedLogs = exerciseLogs.filter { $0.completed }
        let duration = Int(Date().timeIntervalSince(session.startedAt) / 60)
        let totalVolume = completedLogs.reduce(0.0) { $0 + (Double($1.reps ?? 0) * ($1.weight ?? 0.0)) }
        // Use exerciseOrderIndex to count unique "slots" in the workout, 
        // ensuring duplicate exercise types are counted individually.
        let exerciseCount = Set(completedLogs.map { $0.exerciseOrderIndex }).count
        let setCount = completedLogs.count
        
        return WorkoutStats(
            durationMinutes: duration,
            exerciseCount: exerciseCount,
            setCount: setCount,
            totalVolumeKg: totalVolume
        )
    }
    
    var body: some View {
        ZStack {
            Color.appBackground(for: colorScheme).ignoresSafeArea()
            
            ScrollView {
                VStack(spacing: 32) {
                    // Celebration Header (Conditional)
                    if isFullyCompleted {
                        VStack(spacing: 20) {
                            ZStack {
                                // Confetti background
                                ForEach(0..<15, id: \.self) { i in
                                    Circle()
                                        .fill([Color.red, Color.blue, Color.green, Color.yellow, Color.purple].randomElement()!)
                                        .frame(width: CGFloat.random(in: 4...10))
                                        .offset(
                                            x: animateIcon ? CGFloat.random(in: -100...100) : 0,
                                            y: animateIcon ? CGFloat.random(in: -150...50) : 0
                                        )
                                        .opacity(animateIcon ? 0 : 0.8)
                                }
                                
                                Image(systemName: "trophy.fill")
                                    .font(.system(size: 80))
                                    .foregroundStyle(
                                        LinearGradient(
                                            colors: [.yellow, .orange],
                                            startPoint: .topLeading,
                                            endPoint: .bottomTrailing
                                        )
                                    )
                                    .scaleEffect(animateIcon ? 1.1 : 0.9)
                                    .rotationEffect(.degrees(animateIcon ? 5 : -5))
                            }
                            .padding(.top, 40)
                            
                            VStack(spacing: 8) {
                                Text("Great job!")
                                    .font(.largeTitle)
                                    .fontWeight(.bold)
                                    .foregroundStyle(Color.textPrimary(for: colorScheme))
                                
                                Text("You have completed your entire workout!")
                                    .font(.headline)
                                    .foregroundStyle(Color.textSecondary(for: colorScheme))
                                    .multilineTextAlignment(.center)
                            }
                        }
                    } else {
                        // Partial Completion / Quit Header
                        VStack(spacing: 20) {
                            Image(systemName: "figure.walk")
                                .font(.system(size: 60))
                                .foregroundColor(.gray)
                                .padding(.top, 40)
                            
                            VStack(spacing: 8) {
                                Text("Session completed")
                                    .font(.largeTitle)
                                    .fontWeight(.bold)
                                    .foregroundStyle(Color.textPrimary(for: colorScheme))
                                
                                Text("Here is a summary of what you accomplished.")
                                    .font(.headline)
                                    .foregroundStyle(Color.textSecondary(for: colorScheme))
                                    .multilineTextAlignment(.center)
                            }
                        }
                    }
                    
                    // Summary Grid
                    VStack(alignment: .leading, spacing: 16) {
                        Text("Sammanfattning")
                            .font(.headline)
                            .foregroundStyle(Color.textPrimary(for: colorScheme))
                        
                        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 16) {
                            SummaryStatCard(
                                icon: "clock",
                                value: "\(stats.durationMinutes)",
                                label: "minuter",
                                colorScheme: colorScheme
                            )
                            SummaryStatCard(
                                icon: "dumbbell.fill",
                                value: "\(stats.exerciseCount)",
                                label: "exercises",
                                colorScheme: colorScheme
                            )
                            SummaryStatCard(
                                icon: "checkmark.circle.fill",
                                value: "\(stats.setCount)",
                                label: "set",
                                colorScheme: colorScheme
                            )
                            SummaryStatCard(
                                icon: "bolt.fill",
                                value: stats.totalVolumeKg.formattedWeight,
                                label: "kg total",
                                colorScheme: colorScheme
                            )
                        }
                    }
                    .padding()
                    .background(Color.cardBackground(for: colorScheme))
                    .cornerRadius(16)
                    .padding(.horizontal)
                    
                    // Notes Section
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Anteckningar (valfritt)")
                            .font(.headline)
                            .foregroundStyle(Color.textPrimary(for: colorScheme))
                        
                        TextField("How did the session feel? Anything to remember for next time?", text: $notes, axis: .vertical)
                            .lineLimit(3...6)
                            .padding(12)
                            .background(Color.appBackground(for: colorScheme))
                            .cornerRadius(8)
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(Color.textSecondary(for: colorScheme).opacity(0.2), lineWidth: 1)
                            )
                            // Toolbar for keyboard dismissal
                            .toolbar {
                                ToolbarItemGroup(placement: .keyboard) {
                                    Spacer()
                                    Button("Done") {
                                        UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
                                    }
                                }
                            }
                    }
                    .padding()
                    .background(Color.cardBackground(for: colorScheme))
                    .cornerRadius(16)
                    .padding(.horizontal)
                    
                    // Finalize Button
                    Button(action: finalizeSession) {
                        Text("Complete workout")
                            .font(.headline)
                            .fontWeight(.bold)
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .themeGradientBackground(colorScheme: colorScheme)
                            .cornerRadius(12)
                            .shadow(color: Color.black.opacity(0.2), radius: 5, x: 0, y: 3)
                    }
                    .padding(.horizontal)
                    .padding(.top, 10)
                }
                .padding(.bottom, 40)
            }
        }
        .onAppear {
            withAnimation(.spring(response: 0.5, dampingFraction: 0.6).repeatForever(autoreverses: true)) {
                animateIcon = true
            }
            // Check for pre-existing notes. 
            // Sanitize if it looks like debug logs (e.g., contains "Init called" or "[ActiveWorkoutView]")
            let initialNotes = session.notes ?? ""
            if initialNotes.contains("[ActiveWorkoutView]") || initialNotes.contains("Init called") {
                notes = "" 
            } else {
                notes = initialNotes
            }
        }
    }
    
    private func finalizeSession() {
        session.notes = notes
        session.status = "completed"
        session.completedAt = Date()
        
        // Advance the workout cycle for the user
        let userId = session.userId
        let descriptor = FetchDescriptor<UserProfile>(
            predicate: #Predicate { $0.userId == userId }
        )
        if let profile = (try? modelContext.fetch(descriptor))?.first {
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
                print("[WorkoutCompletionView] Completed pass at index \(completedIndex). Set next pass to \(profile.currentPassNumber)")
            } else {
                // Fallback to simple increment if template not found
                profile.currentPassNumber += 1
            }
        }
        
        try? modelContext.save()
        dismiss()
    }
}

struct SummaryStatCard: View {
    let icon: String
    let value: String
    let label: String
    let colorScheme: ColorScheme
    
    var body: some View {
        HStack(spacing: 12) {
            Circle()
                .fill(Color.primaryColor(for: colorScheme).opacity(0.1))
                .frame(width: 40, height: 40)
                .overlay(
                    Image(systemName: icon)
                        .foregroundStyle(Color.primaryColor(for: colorScheme))
                )
            
            VStack(alignment: .leading, spacing: 2) {
                Text(value)
                    .font(.title3)
                    .fontWeight(.bold)
                    .foregroundStyle(Color.textPrimary(for: colorScheme))
                Text(label)
                    .font(.caption)
                    .foregroundStyle(Color.textSecondary(for: colorScheme))
            }
            Spacer()
        }
        .padding()
        .background(Color.appBackground(for: colorScheme))
        .cornerRadius(12)
    }
}

struct WorkoutStats {
    let durationMinutes: Int
    let exerciseCount: Int
    let setCount: Int
    let totalVolumeKg: Double
}

#Preview {
    WorkoutCompletionView(
        session: WorkoutSession(userId: "test", sessionType: "strength"),
        isFullyCompleted: true
    )
}

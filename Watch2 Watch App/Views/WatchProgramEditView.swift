import SwiftUI
import SwiftData

/// View for editing a program's exercises on Watch
struct WatchProgramEditView: View {
    let template: ProgramTemplate
    @Environment(\.modelContext) private var modelContext
    
    private var sortedExercises: [ProgramTemplateExercise] {
        template.exercises?.sorted { $0.orderIndex < $1.orderIndex } ?? []
    }
    
    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                if sortedExercises.isEmpty {
                    VStack(spacing: 8) {
                        Image(systemName: "dumbbell.fill")
                            .font(.title2)
                            .foregroundColor(.gray)
                        Text("Inga övningar")
                            .font(.caption2)
                            .foregroundColor(.gray)
                    }
                    .padding(.top, 30)
                } else {
                    ForEach(sortedExercises) { exercise in
                        NavigationLink(destination: WatchExerciseEditView(exercise: exercise)) {
                            ExerciseEditRow(exercise: exercise)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding(.horizontal)
        }
        .navigationTitle(template.templateName)
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct ExerciseEditRow: View {
    let exercise: ProgramTemplateExercise
    
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(exercise.exerciseName)
                .font(.headline)
                .lineLimit(1)
            
            HStack(spacing: 10) {
                // Weight
                HStack(spacing: 3) {
                    Image(systemName: "scalemass.fill")
                    Text("\(exercise.targetWeight ?? 0, specifier: "%.0f") kg")
                }
                
                // Reps
                HStack(spacing: 3) {
                    Image(systemName: "repeat")
                    Text("\(exercise.targetReps ?? "8") reps")
                }
                
                // Sets
                HStack(spacing: 3) {
                    Image(systemName: "square.stack.3d.up.fill")
                    Text("\(exercise.targetSets) set")
                }
            }
            .font(.system(size: 10, weight: .medium))
            .foregroundColor(.secondary)
        }
        .padding(.vertical, 12)
        .padding(.horizontal, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.gray.opacity(0.15))
        .cornerRadius(18)
    }
}

/// View for editing a single exercise
struct WatchExerciseEditView: View {
    @Bindable var exercise: ProgramTemplateExercise
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    
    @State private var weight: Double
    @State private var reps: Int
    @State private var sets: Int
    
    private let weightOptions: [Double] = stride(from: 0.0, through: 200.0, by: 0.5).map { $0 }
    private let repsOptions: [Int] = Array(1...50)
    private let setsOptions: [Int] = Array(1...10)
    
    
    init(exercise: ProgramTemplateExercise) {
        self.exercise = exercise
        _weight = State(initialValue: exercise.targetWeight ?? 0)
        _reps = State(initialValue: Int(exercise.targetReps ?? "8") ?? 8)
        _sets = State(initialValue: exercise.targetSets)
    }
    
    var body: some View {
        VStack(spacing: 6) {
            // Custom Header (owns the top) - INCREASED SIZE
            ScrollingText(text: exercise.exerciseName, color: .green)
                .padding(.top, -4)

            CompactCard {
                HStack(spacing: 8) {
                    Text("Vikt")
                        .font(.subheadline.weight(.semibold))
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                        .frame(maxWidth: .infinity, alignment: .trailing)

                    CapsuleWheelPicker(
                        values: weightOptions,
                        selection: $weight,
                        text: { formatWeight($0) },
                        stroke: .green
                    )
                    .frame(width: 100, height: 44) 

                    Text("kg")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .frame(height: 64) 

            // Reps + Set Section (Centered) - REDUCED HEIGHT
            HStack(spacing: 8) {
                CompactCard {
                    VStack(spacing: 4) {
                        Text("Reps")
                            .font(.subheadline.weight(.semibold))
                            .frame(maxWidth: .infinity, alignment: .center)

                        CapsuleWheelPicker(
                            values: repsOptions,
                            selection: $reps,
                            text: { "\($0)" },
                            stroke: .white.opacity(0.45)
                        )
                        .frame(width: 86, height: 38) // Reduced from 50
                        .frame(maxWidth: .infinity, alignment: .center)
                    }
                }
                .frame(height: 70) // Reduced from 86

                CompactCard {
                    VStack(spacing: 4) {
                        Text("Set")
                            .font(.subheadline.weight(.semibold))
                            .frame(maxWidth: .infinity, alignment: .center)

                        CapsuleWheelPicker(
                            values: setsOptions,
                            selection: $sets,
                            text: { "\($0)" },
                            stroke: .white.opacity(0.45)
                        )
                        .frame(width: 86, height: 38) // Reduced from 50
                        .frame(maxWidth: .infinity, alignment: .center)
                    }
                }
                .frame(height: 70) // Reduced from 86
            }

            Spacer()
            
            // Spara Button
            Button(action: saveChanges) {
                Text("Spara")
            }
            .buttonStyle(PrimaryButtonStyle(height: 44))
        }
        .frame(maxHeight: .infinity)
        .padding(.horizontal, 8)
        .padding(.top, 4)
        .padding(.bottom, 8)
        .ignoresSafeArea(edges: .bottom)
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarBackButtonHidden(true)
    }

    private func saveChanges() {
        exercise.targetWeight = weight
        exercise.targetReps = String(reps)
        exercise.targetSets = sets
        
        try? modelContext.save()
        
        // Haptic feedback
        WKInterfaceDevice.current().play(.success)
        dismiss()
    }
    
    private func formatWeight(_ v: Double) -> String {
        if v.truncatingRemainder(dividingBy: 1) == 0 { return String(Int(v)) }
        return String(format: "%.1f", v)
    }
}



#Preview {
    WatchProgramEditView(template: ProgramTemplate(
        userId: "test",
        templateName: "Test Pass",
        dayOfWeek: 1
    ))
}

import SwiftUI
import SwiftData

/// Exercise personal bests list view
struct ExercisePBsView: View {
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.modelContext) private var modelContext
    
    private var exercises: [StatsCalculator.ExercisePB] {
        StatsCalculator.shared.getExercisePBs(modelContext: modelContext)
    }
    
    var body: some View {
        ZStack {
            Color.appBackground(for: colorScheme).ignoresSafeArea()
            
            ScrollView {
                VStack(spacing: 12) {
                    if exercises.isEmpty {
                        VStack(spacing: 16) {
                            Image(systemName: "trophy")
                                .font(.largeTitle)
                                .foregroundColor(.gray)
                            Text("No personal bests yet")
                                .font(.headline)
                                .foregroundColor(Color.textSecondary(for: colorScheme))
                            Text("Log exercises to see your PBs here")
                                .font(.caption)
                                .foregroundColor(Color.textSecondary(for: colorScheme))
                                .multilineTextAlignment(.center)
                        }
                        .padding(.top, 60)
                    } else {
                        ForEach(exercises) { exercise in
                            ExercisePBRow(exercise: exercise, colorScheme: colorScheme)
                        }
                    }
                }
                .padding(.horizontal)
                .padding(.top)
            }
        }
        .navigationTitle("Personal best")
        .navigationBarTitleDisplayMode(.large)
    }
}

struct ExercisePBRow: View {
    let exercise: StatsCalculator.ExercisePB
    let colorScheme: ColorScheme
    
    var body: some View {
        HStack {
            // Exercise info
            VStack(alignment: .leading, spacing: 4) {
                Text(exercise.exerciseName)
                    .font(.headline)
                    .foregroundColor(Color.textPrimary(for: colorScheme))
                
                Text("Total volym: \(formatWeight(exercise.totalVolume))")
                    .font(.caption)
                    .foregroundColor(Color.textSecondary(for: colorScheme))
            }
            
            Spacer()
            
            // Max weight
            VStack(alignment: .trailing, spacing: 4) {
                HStack(spacing: 4) {
                    Image(systemName: "trophy.fill")
                        .foregroundColor(.orange)
                        .font(.caption)
                    Text("\(exercise.maxWeight, specifier: "%.1f") kg")
                        .font(.title3.bold())
                        .foregroundColor(Color.textPrimary(for: colorScheme))
                }
                Text("Max weight")
                    .font(.caption2)
                    .foregroundColor(Color.textSecondary(for: colorScheme))
            }
        }
        .padding()
        .background(Color.cardBackground(for: colorScheme))
        .cornerRadius(12)
    }
    
    private func formatWeight(_ weight: Double) -> String {
        if weight >= 1000 {
            return String(format: "%.1fk kg", weight / 1000)
        } else {
            return String(format: "%.0f kg", weight)
        }
    }
}

#Preview {
    NavigationView {
        ExercisePBsView()
    }
}

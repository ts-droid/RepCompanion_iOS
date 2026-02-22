import SwiftUI
import SwiftData

/// View for listing all exercise statistics
struct ExerciseStatsListView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.colorScheme) private var colorScheme
    
    @Query private var userProfiles: [UserProfile]
    @StateObject private var statsService = ExerciseStatsService.shared
    
    private var userId: String {
        userProfiles.first?.userId ?? "default-user"
    }
    
    private var allStats: [ExerciseStats] {
        statsService.getAllStats(userId: userId, modelContext: modelContext)
    }
    
    var body: some View {
        List {
            ForEach(allStats) { stats in
                NavigationLink(destination: ExerciseProgressionView(
                    exerciseKey: stats.exerciseKey,
                    exerciseName: stats.exerciseName,
                    userId: userId
                )) {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(stats.exerciseName)
                                .font(.headline)
                                .foregroundStyle(Color.textPrimary(for: colorScheme))
                            
                            HStack(spacing: 16) {
                                if let maxWeight = stats.maxWeight {
                                    Label("Max: \(maxWeight.formattedWeight) kg", systemImage: "arrow.up.circle")
                                        .font(.caption)
                                        .foregroundStyle(Color.textSecondary(for: colorScheme))
                                }
                                if let avgWeight = stats.avgWeight {
                                    Label(String(localized: "Average:") + " \(avgWeight.formattedWeight) kg", systemImage: "chart.bar")
                                        .font(.caption)
                                        .foregroundStyle(Color.textSecondary(for: colorScheme))
                                }
                            }
                        }
                        
                        Spacer()
                        
                        VStack(alignment: .trailing, spacing: 4) {
                            Text("\(stats.totalSessions)")
                                .font(.title3)
                                .fontWeight(.bold)
                                .foregroundStyle(Color.accentBlue)
                            Text(String(localized: "sessions"))
                                .font(.caption)
                                .foregroundStyle(Color.textSecondary(for: colorScheme))
                        }
                    }
                    .padding(.vertical, 4)
                }
            }
        }
        .listStyle(PlainListStyle())
        .background(Color.appBackground(for: colorScheme))
        .navigationTitle(String(localized: "Exercise statistics"))
        .navigationBarTitleDisplayMode(.large)
    }
}


import SwiftUI
import SwiftData

/// Statistics dashboard for watchOS - compact 4-card grid matching iOS
struct WatchStatsView: View {
    @Environment(\.modelContext) private var modelContext
    
    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                Text("Statistik")
                    .headerStyle(color: .white)
                    .padding(.top, -4)
                
                // 2x2 Grid of stats
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                    // Total Sessions - Tappable
                    NavigationLink(destination: WatchHistoryView()) {
                        WatchStatCard(
                            icon: "calendar",
                            value: "\(StatsCalculator.shared.totalSessions(modelContext: modelContext))",
                            label: "Pass",
                            showChevron: true
                        )
                    }
                    .buttonStyle(.plain)
                    
                    // Total Volume
                    WatchStatCard(
                        icon: "flame",
                        value: StatsCalculator.shared.formattedTotalVolume(modelContext: modelContext),
                        label: "Volym"
                    )
                    
                    // Unique Exercises - Tappable
                    NavigationLink(destination: WatchPBsView()) {
                        WatchStatCard(
                            icon: "dumbbell.fill",
                            value: "\(StatsCalculator.shared.uniqueExercises(modelContext: modelContext))",
                            label: "Övningar",
                            showChevron: true
                        )
                    }
                    .buttonStyle(.plain)
                    
                    // Average Duration
                    WatchStatCard(
                        icon: "clock",
                        value: StatsCalculator.shared.formattedAverageDuration(modelContext: modelContext),
                        label: "Snitt"
                    )
                }
            }
            .padding(.horizontal, 4)
        }
    }
}

// MARK: - Watch Stat Card
struct WatchStatCard: View {
    let icon: String
    let value: String
    let label: String
    var showChevron: Bool = false
    
    var body: some View {
        VStack(spacing: 4) {
            HStack(spacing: 2) {
                Image(systemName: icon)
                    .font(.system(size: 10))
                    .foregroundColor(.gray)
                if showChevron {
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.system(size: 8))
                        .foregroundColor(.gray)
                }
            }
            
            Text(value)
                .font(.system(size: 18, weight: .bold, design: .rounded))
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            
            Text(label)
                .font(.system(size: 9))
                .foregroundColor(.gray)
        }
        .padding(8)
        .frame(maxWidth: .infinity)
        .cardStyle(cornerRadius: 14)
    }
}

// MARK: - Watch History View
struct WatchHistoryView: View {
    @Environment(\.modelContext) private var modelContext
    
    private var history: [StatsCalculator.WorkoutHistoryItem] {
        Array(StatsCalculator.shared.getWorkoutHistory(modelContext: modelContext).prefix(10))
    }
    
    var body: some View {
        VStack(spacing: 8) {
            Text("Historik")
                .headerStyle(color: .white)
                .padding(.top, -14) // Pull up to meet top edge
            
            ScrollView {
                VStack(spacing: 8) {
                    if history.isEmpty {
                        VStack(spacing: 8) {
                            Image(systemName: "calendar.badge.clock")
                                .font(.title2)
                                .foregroundColor(.gray)
                            Text("Ingen historik")
                                .font(.caption)
                                .foregroundColor(.gray)
                        }
                        .padding(.top, 40)
                    } else {
                        ForEach(history) { item in
                            WatchHistoryRow(item: item)
                        }
                    }
                }
                .padding(.horizontal, 4)
            }
        }
        .toolbar(.hidden, for: .navigationBar)
    }
}

struct WatchHistoryRow: View {
    let item: StatsCalculator.WorkoutHistoryItem
    
    private var dateFormatter: DateFormatter {
        let df = DateFormatter()
        df.dateFormat = "d MMM"
        df.locale = Locale(identifier: "sv_SE")
        return df
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(item.name)
                    .font(.system(size: 12, weight: .semibold))
                    .lineLimit(1)
                Spacer()
                WatchStatusBadge(status: item.status)
            }
            
            HStack(spacing: 8) {
                Label(dateFormatter.string(from: item.date), systemImage: "calendar")
                Label("\(item.duration)m", systemImage: "clock")
            }
            .font(.system(size: 9))
            .foregroundColor(.gray)
            
            HStack {
                Text("\(item.totalReps) reps")
                Spacer()
                Text(formatWeight(item.totalWeight))
            }
            .font(.system(size: 10))
        }
        .padding(8)
        .frame(maxWidth: .infinity)
        .cardStyle(cornerRadius: 12)
    }
    
    private func formatWeight(_ weight: Double) -> String {
        if weight >= 1000 {
            return String(format: "%.1fk kg", weight / 1000)
        } else {
            return String(format: "%.0f kg", weight)
        }
    }
}

struct WatchStatusBadge: View {
    let status: String
    
    private var color: Color {
        status == "completed" ? .green : .red
    }
    
    private var text: String {
        status == "completed" ? "✓" : "✗"
    }
    
    var body: some View {
        Text(text)
            .font(.system(size: 10, weight: .bold))
            .foregroundColor(.white)
            .padding(4)
            .background(color)
            .clipShape(Circle())
    }
}

// MARK: - Watch PBs View
struct WatchPBsView: View {
    @Environment(\.modelContext) private var modelContext
    
    private var exercises: [StatsCalculator.ExercisePB] {
        Array(StatsCalculator.shared.getExercisePBs(modelContext: modelContext).prefix(15))
    }
    
    var body: some View {
        VStack(spacing: 8) {
            Text("Personbästa")
                .headerStyle(color: .orange)
                 .padding(.top, -14)
            
            ScrollView {
                VStack(spacing: 6) {
                    if exercises.isEmpty {
                        VStack(spacing: 8) {
                            Image(systemName: "trophy")
                                .font(.title2)
                                .foregroundColor(.gray)
                            Text("Inga PBs")
                                .font(.caption)
                                .foregroundColor(.gray)
                        }
                        .padding(.top, 40)
                    } else {
                        ForEach(exercises) { exercise in
                            WatchPBRow(exercise: exercise)
                        }
                    }
                }
                .padding(.horizontal, 4)
            }
        }
        .toolbar(.hidden, for: .navigationBar)
    }
}

struct WatchPBRow: View {
    let exercise: StatsCalculator.ExercisePB
    
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(exercise.exerciseName)
                    .font(.system(size: 11, weight: .semibold))
                    .lineLimit(1)
                Text(formatWeight(exercise.totalVolume))
                    .font(.system(size: 9))
                    .foregroundColor(.gray)
            }
            
            Spacer()
            
            HStack(spacing: 2) {
                Image(systemName: "trophy.fill")
                    .font(.system(size: 8))
                    .foregroundColor(.orange)
                Text("\(exercise.maxWeight, specifier: "%.0f") kg")
                    .font(.system(size: 13, weight: .bold))
            }
        }
        .padding(8)
        .frame(maxWidth: .infinity)
        .cardStyle(cornerRadius: 12)
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
    WatchStatsView()
}

import SwiftUI
import SwiftData

/// Detailed workout history list view
struct WorkoutHistoryView: View {
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.modelContext) private var modelContext
    
    private var history: [StatsCalculator.WorkoutHistoryItem] {
        StatsCalculator.shared.getWorkoutHistory(modelContext: modelContext)
    }
    
    var body: some View {
        ZStack {
            Color.appBackground(for: colorScheme).ignoresSafeArea()
            
            ScrollView {
                VStack(spacing: 12) {
                    if history.isEmpty {
                        VStack(spacing: 16) {
                            Image(systemName: "calendar.badge.clock")
                                .font(.largeTitle)
                                .foregroundColor(.gray)
                            Text("No training history yet")
                                .font(.headline)
                                .foregroundColor(Color.textSecondary(for: colorScheme))
                            Text("Complete your first session to see history here")
                                .font(.caption)
                                .foregroundColor(Color.textSecondary(for: colorScheme))
                                .multilineTextAlignment(.center)
                        }
                        .padding(.top, 60)
                    } else {
                        ForEach(history) { item in
                            HistoryDetailRow(item: item, colorScheme: colorScheme)
                        }
                    }
                }
                .padding(.horizontal)
                .padding(.top)
            }
        }
        .navigationTitle("Training history")
        .navigationBarTitleDisplayMode(.large)
    }
}

struct HistoryDetailRow: View {
    let item: StatsCalculator.WorkoutHistoryItem
    let colorScheme: ColorScheme
    
    private var dateFormatter: DateFormatter {
        let df = DateFormatter()
        df.dateStyle = .medium
        df.locale = Locale(identifier: "sv_SE")
        return df
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header with name and status
            HStack {
                Text(item.name)
                    .font(.headline)
                    .foregroundColor(Color.textPrimary(for: colorScheme))
                Spacer()
                StatusBadge(status: item.status)
            }
            
            // Date and duration
            HStack(spacing: 16) {
                Label(dateFormatter.string(from: item.date), systemImage: "calendar")
                Label("\(item.duration) min", systemImage: "clock")
            }
            .font(.caption)
            .foregroundColor(Color.textSecondary(for: colorScheme))
            
            Divider()
            
            // Stats row
            HStack {
                StatMiniCard(icon: "repeat", label: "Reps", value: "\(item.totalReps)")
                Spacer()
                StatMiniCard(icon: "scalemass", label: "Volym", value: formatWeight(item.totalWeight))
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

struct StatMiniCard: View {
    let icon: String
    let label: String
    let value: String
    
    var body: some View {
        VStack(spacing: 4) {
            Image(systemName: icon)
                .font(.caption)
                .foregroundColor(.gray)
            Text(value)
                .font(.subheadline.bold())
            Text(label)
                .font(.caption2)
                .foregroundColor(.gray)
        }
    }
}

struct StatusBadge: View {
    let status: String
    
    private var color: Color {
        status == "completed" ? .green : .red
    }
    
    private var text: String {
        status == "completed" ? "Klart" : "Avbrutet"
    }
    
    var body: some View {
        Text(text)
            .font(.caption)
            .fontWeight(.bold)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(color.opacity(0.8))
            .foregroundColor(.white)
            .cornerRadius(4)
    }
}

#Preview {
    NavigationView {
        WorkoutHistoryView()
    }
}

import SwiftUI
import Charts
import SwiftData

struct StatisticsView: View {
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.modelContext) private var modelContext
    
    var body: some View {
        NavigationView {
            ZStack {
                Color.appBackground(for: colorScheme).ignoresSafeArea()
                
                ScrollView {
                    VStack(spacing: 20) {
                        // Header
                        HStack {
                            VStack(alignment: .leading) {
                                Text("Träningsstatistik")
                                    .font(.title2)
                                    .fontWeight(.bold)
                                    .foregroundStyle(Color.textPrimary(for: colorScheme))
                                Text("Övervaka din utveckling över tid")
                                    .font(.subheadline)
                                    .foregroundStyle(Color.textSecondary(for: colorScheme))
                            }
                            Spacer()
                        }
                        .padding(.horizontal)
                        
                        // Key Stats Grid - Dynamic data with NavigationLinks
                        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 16) {
                            NavigationLink(destination: WorkoutHistoryView()) {
                                ClickableStatCard(
                                    icon: "calendar",
                                    title: "Totala Sessioner",
                                    value: "\(StatsCalculator.shared.totalSessions(modelContext: modelContext))",
                                    subtitle: "Genomförda träningspass",
                                    colorScheme: colorScheme
                                )
                            }
                            .buttonStyle(.plain)
                            
                            StatCard(
                                icon: "flame",
                                title: "Total Volym",
                                value: StatsCalculator.shared.formattedTotalVolume(modelContext: modelContext),
                                subtitle: "Lyftat i totalt",
                                colorScheme: colorScheme
                            )
                            
                            NavigationLink(destination: ExercisePBsView()) {
                                ClickableStatCard(
                                    icon: "dumbbell.fill",
                                    title: "Unika Övningar",
                                    value: "\(StatsCalculator.shared.uniqueExercises(modelContext: modelContext))",
                                    subtitle: "Olika träningsövningar",
                                    colorScheme: colorScheme
                                )
                            }
                            .buttonStyle(.plain)
                            
                            StatCard(
                                icon: "clock",
                                title: "Snitt Pass",
                                value: StatsCalculator.shared.formattedAverageDuration(modelContext: modelContext),
                                subtitle: "Per träningspass",
                                colorScheme: colorScheme
                            )
                        }
                        .padding(.horizontal)
                        
                        // Weekly Sessions Chart
                        ChartCard(title: "Veckovisa Sessioner", subtitle: "Dina träningspass per vecka över tid", colorScheme: colorScheme) {
                            WeeklySessionsChart(data: StatsCalculator.shared.getWeeklySessionCounts(modelContext: modelContext))
                        }
                        
                        // Top Exercises Chart
                        ChartCard(title: "Toppövningar", subtitle: "Dina mest tränade övningar efter volym", colorScheme: colorScheme) {
                            TopExercisesChart(data: StatsCalculator.shared.getTopExercises(modelContext: modelContext))
                        }
                        
                        // Muscle Distribution Chart
                        NavigationLink(destination: MuscleBalanceView()) {
                            ChartCard(title: "Muskelfördelning", subtitle: "Fördelning av set per muskelgrupp", colorScheme: colorScheme) {
                                ExerciseDistributionChart(data: StatsCalculator.shared.getMuscleDistribution(modelContext: modelContext))
                            }
                        }
                        .buttonStyle(.plain)
                        
                        // Strength Development Charts
                        VStack(alignment: .leading, spacing: 16) {
                            HStack {
                                Text("Styrkeutveckling")
                                    .font(.title3)
                                    .fontWeight(.bold)
                                    .foregroundStyle(Color.textPrimary(for: colorScheme))
                                Spacer()
                                NavigationLink(destination: ExerciseStatsListView()) {
                                    Text("Visa alla")
                                        .font(.caption)
                                        .foregroundStyle(Color.accentBlue)
                                }
                            }
                            .padding(.horizontal)
                            
                            StrengthChartCard(title: "Squat", current: "70 kg max", average: "38.0 kg snitt", colorScheme: colorScheme)
                            StrengthChartCard(title: "Bänkpress", current: "70 kg max", average: "60.0 kg snitt", colorScheme: colorScheme)
                        }
                        
                        // Health Trends
                        NavigationLink(destination: HealthTrendsView()) {
                            HStack {
                                Image(systemName: "heart.text.square.fill")
                                    .foregroundColor(.red)
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("Hälsotrender")
                                        .font(.headline)
                                        .foregroundStyle(Color.textPrimary(for: colorScheme))
                                    Text("Se dina hälsomätvärden över tid")
                                        .font(.caption)
                                        .foregroundStyle(Color.textSecondary(for: colorScheme))
                                }
                                Spacer()
                                Image(systemName: "chevron.right")
                                    .foregroundStyle(Color.textSecondary(for: colorScheme))
                            }
                            .padding()
                            .background(Color.cardBackground(for: colorScheme))
                            .cornerRadius(12)
                        }
                        .padding(.horizontal)
                        
                        // History Section
                        VStack(alignment: .leading) {
                            Text("Träningshistorik")
                                .font(.title3)                                .fontWeight(.bold)
                                .foregroundStyle(Color.textPrimary(for: colorScheme))
                                .padding(.horizontal)
                            
                            let history = StatsCalculator.shared.getWorkoutHistory(modelContext: modelContext).prefix(5)
                            if history.isEmpty {
                                Text("Ingen historik än")
                                    .font(.subheadline)
                                    .foregroundStyle(Color.textSecondary(for: colorScheme))
                                    .padding()
                            } else {
                                ForEach(history) { item in
                                    HistoryRow(
                                        title: item.name,
                                        date: item.date.formatted(date: .abbreviated, time: .omitted),
                                        time: "\(item.duration)m",
                                        status: item.status == "completed" ? "Slutfört" : "Avbrutet",
                                        isCompleted: item.status == "completed",
                                        colorScheme: colorScheme
                                    )
                                }
                            }
                        }
                        .padding(.bottom, 20)
                    }
                    .padding(.top)
                }
            }
            .navigationBarHidden(true)
        }
    }
}

// MARK: - Components

struct StatCard: View {
    let icon: String
    let title: String
    let value: String
    let subtitle: String
    let colorScheme: ColorScheme
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: icon)
                    .foregroundStyle(Color.textSecondary(for: colorScheme))
                Text(title)
                    .font(.caption)
                    .foregroundStyle(Color.textSecondary(for: colorScheme))
            }
            
            Text(value)
                .font(.title)
                .fontWeight(.bold)
                .foregroundStyle(Color.textPrimary(for: colorScheme))
            
            Text(subtitle)
                .font(.caption2)
                .foregroundStyle(Color.textSecondary(for: colorScheme))
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.cardBackground(for: colorScheme))
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.white.opacity(0.05), lineWidth: 1)
        )
    }
}

/// Clickable version of StatCard with chevron indicator
struct ClickableStatCard: View {
    let icon: String
    let title: String
    let value: String
    let subtitle: String
    let colorScheme: ColorScheme
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: icon)
                    .foregroundStyle(Color.textSecondary(for: colorScheme))
                Text(title)
                    .font(.caption)
                    .foregroundStyle(Color.textSecondary(for: colorScheme))
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption2)
                    .foregroundStyle(Color.textSecondary(for: colorScheme))
            }
            
            Text(value)
                .font(.title)
                .fontWeight(.bold)
                .foregroundStyle(Color.textPrimary(for: colorScheme))
            
            Text(subtitle)
                .font(.caption2)
                .foregroundStyle(Color.textSecondary(for: colorScheme))
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.cardBackground(for: colorScheme))
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.white.opacity(0.05), lineWidth: 1)
        )
    }
}

struct ChartCard<Content: View>: View {
    let title: String
    let subtitle: String
    let colorScheme: ColorScheme
    let content: Content
    
    init(title: String, subtitle: String, colorScheme: ColorScheme, @ViewBuilder content: () -> Content) {
        self.title = title
        self.subtitle = subtitle
        self.colorScheme = colorScheme
        self.content = content()
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.headline)
                    .foregroundStyle(Color.textPrimary(for: colorScheme))
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(Color.textSecondary(for: colorScheme))
            }
            
            content
                .frame(height: 200)
        }
        .padding()
        .background(Color.cardBackground(for: colorScheme))
        .cornerRadius(16)
        .padding(.horizontal)
    }
}

struct WeeklySessionsChart: View {
    let data: [StatsCalculator.WeeklySessionData]
    
    var body: some View {
        Chart {
            ForEach(data) { item in
                LineMark(
                    x: .value("Week", item.weekLabel),
                    y: .value("Sessions", item.count)
                )
                .interpolationMethod(.catmullRom)
                .foregroundStyle(Color.accentBlue)
                
                PointMark(
                    x: .value("Week", item.weekLabel),
                    y: .value("Sessions", item.count)
                )
                .foregroundStyle(Color.accentBlue)
            }
        }
        .chartYAxis {
            AxisMarks(position: .leading)
        }
    }
}

struct TopExercisesChart: View {
    let data: [StatsCalculator.TopExerciseData]
    
    var body: some View {
        Chart {
            ForEach(data) { item in
                BarMark(
                    x: .value("Name", item.name),
                    y: .value("Volume", item.volume)
                )
                .foregroundStyle(Color(hex: "00C896")) // Greenish
            }
        }
        .chartYAxis {
            AxisMarks(position: .leading)
        }
        .chartXAxis {
            AxisMarks { value in
                AxisValueLabel() {
                    if let stringValue = value.as(String.self) {
                        Text(stringValue.prefix(6)) // Truncate long names
                            .font(.system(size: 10))
                    }
                }
            }
        }
    }
}

struct ExerciseDistributionChart: View {
    let data: [StatsCalculator.MuscleDistributionData]
    
    // Cycle through a few nice colors
    private let colors: [Color] = [
        Color(hex: "00C896"), // Emerald
        .blue,
        .red,
        .orange,
        .purple,
        .yellow,
        .cyan
    ]
    
    var body: some View {
        HStack {
            Chart {
                ForEach(Array(data.enumerated()), id: \.offset) { index, item in
                    SectorMark(
                        angle: .value("Value", item.value),
                        innerRadius: .ratio(0.6), // Doughnut style
                        angularInset: 1.5
                    )
                    .foregroundStyle(colors[index % colors.count])
                    .cornerRadius(4)
                }
            }
            .frame(width: 150)
            
            // Legend
            VStack(alignment: .leading, spacing: 4) {
                ForEach(Array(data.prefix(6).enumerated()), id: \.offset) { index, item in
                    HStack(spacing: 8) {
                        Circle()
                            .fill(colors[index % colors.count])
                            .frame(width: 8, height: 8)
                        Text(item.name)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                        Spacer()
                    }
                }
                if data.count > 6 {
                    Text("+ \(data.count - 6) till")
                        .font(.system(size: 8))
                        .foregroundStyle(.tertiary)
                }
            }
            .padding(.leading, 8)
        }
    }
}

struct StrengthChartCard: View {
    let title: String
    let current: String
    let average: String
    let colorScheme: ColorScheme
    
    var body: some View {
        VStack(alignment: .leading) {
            HStack {
                Text(title)
                    .font(.headline)
                    .foregroundStyle(Color.textPrimary(for: colorScheme))
                Spacer()
                VStack(alignment: .trailing) {
                    Text(current)
                        .font(.caption)
                        .fontWeight(.bold)
                        .foregroundStyle(Color.textSecondary(for: colorScheme))
                    Text(average)
                        .font(.caption2)
                        .foregroundStyle(Color.textSecondary(for: colorScheme))
                }
            }
            
            Chart {
                ForEach(0..<10, id: \.self) { i in
                    LineMark(
                        x: .value("Date", i),
                        y: .value("Weight", [25, 25, 30, 30, 10, 10, 10, 10, 20, 20][i])
                    )
                    .interpolationMethod(.stepCenter)
                    .foregroundStyle(Color.accentBlue)
                    
                    PointMark(
                        x: .value("Date", i),
                        y: .value("Weight", [25, 25, 30, 30, 10, 10, 10, 10, 20, 20][i])
                    )
                    .foregroundStyle(Color.accentBlue)
                }
            }
            .frame(height: 150)
            .chartYAxis {
                AxisMarks(position: .leading)
            }
            .chartXAxis(.hidden)
        }
        .padding()
        .background(Color.cardBackground(for: colorScheme))
        .cornerRadius(16)
        .padding(.horizontal)
    }
}

struct HistoryRow: View {
    let title: String
    let date: String
    let time: String
    let status: String
    let isCompleted: Bool
    let colorScheme: ColorScheme
    
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.headline)
                    .foregroundStyle(Color.textPrimary(for: colorScheme))
                HStack(spacing: 12) {
                    Label(date, systemImage: "calendar")
                    Label(time, systemImage: "clock")
                }
                .font(.caption)
                .foregroundStyle(Color.textSecondary(for: colorScheme))
            }
            
            Spacer()
            
            Text(status)
                .font(.caption)
                .fontWeight(.bold)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(isCompleted ? Color.green.opacity(0.8) : Color.red.opacity(0.8))
                .foregroundColor(.white)
                .cornerRadius(4)
        }
        .padding()
        .background(Color.cardBackground(for: colorScheme))
        .cornerRadius(12)
        .padding(.horizontal)
    }
}

import SwiftUI
import SwiftData
import Charts

/// View for displaying health metrics trends over time
struct HealthTrendsView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.colorScheme) private var colorScheme
    
    @StateObject private var healthService = HealthMetricsService.shared
    @State private var selectedMetric = "steps"
    @State private var selectedDays = 30
    @State private var isLoading = false
    
    @Query private var userProfiles: [UserProfile]
    
    private var userId: String {
        userProfiles.first?.userId ?? "default-user"
    }
    
    private var metrics: [(String, String, String)] {
        [
            ("steps", String(localized: "Steps"), "figure.walk"),
            ("calories_burned", String(localized: "Calories"), "flame.fill"),
            ("sleep_duration_minutes", String(localized: "Sleep"), "moon.fill"),
            ("heart_rate_avg", String(localized: "Heart rate"), "heart.fill")
        ]
    }
    
    private var trend: HealthTrend {
        healthService.getTrend(
            userId: userId,
            metricType: selectedMetric,
            days: selectedDays,
            modelContext: modelContext
        )
    }
    
    private var weeklySummary: WeeklyHealthSummary {
        healthService.getWeeklySummary(userId: userId, modelContext: modelContext)
    }
    
    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Weekly Summary
                VStack(alignment: .leading, spacing: 16) {
                    Text(String(localized: "Weekly summary"))
                        .font(.headline)
                        .foregroundStyle(Color.textPrimary(for: colorScheme))
                        .padding(.horizontal)
                    
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 16) {
                        SummaryCard(
                            title: String(localized: "Total steps"),
                            value: "\(weeklySummary.totalSteps)",
                            icon: "figure.walk",
                            color: .blue,
                            colorScheme: colorScheme
                        )
                        SummaryCard(
                            title: String(localized: "Total calories"),
                            value: "\(weeklySummary.totalCalories) kcal",
                            icon: "flame.fill",
                            color: .orange,
                            colorScheme: colorScheme
                        )
                        SummaryCard(
                            title: String(localized: "Average sleep"),
                            value: String(format: "%.1f h", weeklySummary.avgSleepHours),
                            icon: "moon.fill",
                            color: .purple,
                            colorScheme: colorScheme
                        )
                        SummaryCard(
                            title: String(localized: "Active days"),
                            value: "\(weeklySummary.activeDays)",
                            icon: "calendar",
                            color: .green,
                            colorScheme: colorScheme
                        )
                    }
                    .padding(.horizontal)
                }
                
                // Metric Selector
                VStack(alignment: .leading, spacing: 12) {
                    Text(String(localized: "Select metric"))
                        .font(.headline)
                        .foregroundStyle(Color.textPrimary(for: colorScheme))
                        .padding(.horizontal)
                    
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 12) {
                            ForEach(metrics, id: \.0) { metric in
                                MetricButton(
                                    title: metric.1,
                                    icon: metric.2,
                                    isSelected: selectedMetric == metric.0,
                                    colorScheme: colorScheme
                                ) {
                                    selectedMetric = metric.0
                                }
                            }
                        }
                        .padding(.horizontal)
                    }
                }
                
                // Trend Indicator
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        Text(String(localized: "Trend"))
                            .font(.headline)
                            .foregroundStyle(Color.textPrimary(for: colorScheme))
                        Spacer()
                        TrendIndicator(trend: trend.trend, changePercent: trend.changePercent)
                    }
                    .padding(.horizontal)
                    
                    HStack {
                        VStack(alignment: .leading) {
                            Text(String(localized: "Current"))
                                .font(.caption)
                                .foregroundStyle(Color.textSecondary(for: colorScheme))
                            Text("\(trend.current)")
                                .font(.title2)
                                .fontWeight(.bold)
                                .foregroundStyle(Color.textPrimary(for: colorScheme))
                        }
                        Spacer()
                        VStack(alignment: .trailing) {
                            Text(String(localized: "Average"))
                                .font(.caption)
                                .foregroundStyle(Color.textSecondary(for: colorScheme))
                            Text("\(trend.average)")
                                .font(.title2)
                                .fontWeight(.bold)
                                .foregroundStyle(Color.textPrimary(for: colorScheme))
                        }
                    }
                    .padding()
                    .background(Color.cardBackground(for: colorScheme))
                    .cornerRadius(12)
                    .padding(.horizontal)
                }
                
                // Chart
                VStack(alignment: .leading, spacing: 16) {
                    HStack {
                        Text(String(localized: "History"))
                            .font(.headline)
                            .foregroundStyle(Color.textPrimary(for: colorScheme))
                        
                        Spacer()
                        
                        Picker("Period", selection: $selectedDays) {
                            Text("7 days").tag(7)
                            Text("30 days").tag(30)
                            Text("90 days").tag(90)
                        }
                        .pickerStyle(.segmented)
                        .frame(width: 200)
                    }
                    .padding(.horizontal)
                    
                    HealthChartView(
                        userId: userId,
                        metricType: selectedMetric,
                        days: selectedDays,
                        colorScheme: colorScheme,
                        modelContext: modelContext
                    )
                }
                
                // Sync Button
                Button(action: syncHealthData) {
                    HStack {
                        if isLoading {
                            ProgressView()
                        } else {
                            Image(systemName: "arrow.clockwise")
                        }
                        Text(String(localized: "Sync health data"))
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.accentBlue)
                    .foregroundColor(.white)
                    .cornerRadius(12)
                }
                .padding(.horizontal)
                .disabled(isLoading)
            }
            .padding(.vertical)
        }
        .background(Color.appBackground(for: colorScheme))
        .navigationTitle(String(localized: "Health trends"))
        .navigationBarTitleDisplayMode(.large)
    }
    
    private func syncHealthData() {
        Task {
            isLoading = true
            do {
                try await healthService.syncFromHealthKit(userId: userId, modelContext: modelContext)
            } catch {
                print("Error syncing health data: \(error)")
            }
            isLoading = false
        }
    }
}

struct SummaryCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color
    let colorScheme: ColorScheme
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(color)
            
            Text(title)
                .font(.caption)
                .foregroundStyle(Color.textSecondary(for: colorScheme))
            
            Text(value)
                .font(.title3)
                .fontWeight(.bold)
                .foregroundStyle(Color.textPrimary(for: colorScheme))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color.cardBackground(for: colorScheme))
        .cornerRadius(12)
    }
}

struct MetricButton: View {
    let title: String
    let icon: String
    let isSelected: Bool
    let colorScheme: ColorScheme
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Image(systemName: icon)
                Text(title)
            }
            .font(.subheadline)
            .fontWeight(.medium)
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(isSelected ? Color.accentBlue : Color.cardBackground(for: colorScheme))
            .foregroundColor(isSelected ? .white : Color.textPrimary(for: colorScheme))
            .cornerRadius(20)
        }
    }
}

struct TrendIndicator: View {
    let trend: TrendDirection
    let changePercent: Double
    
    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: trendIcon)
                .foregroundColor(trendColor)
            Text(String(format: "%.1f%%", abs(changePercent)))
                .font(.caption)
                .foregroundColor(trendColor)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(trendColor.opacity(0.1))
        .cornerRadius(8)
    }
    
    private var trendIcon: String {
        switch trend {
        case .increasing: return "arrow.up.right"
        case .decreasing: return "arrow.down.right"
        case .stable: return "arrow.right"
        }
    }
    
    private var trendColor: Color {
        switch trend {
        case .increasing: return .green
        case .decreasing: return .red
        case .stable: return .gray
        }
    }
}

struct HealthChartView: View {
    let userId: String
    let metricType: String
    let days: Int
    let colorScheme: ColorScheme
    let modelContext: ModelContext
    
    @StateObject private var healthService = HealthMetricsService.shared
    
    private var metrics: [HealthMetric] {
        healthService.getMetrics(userId: userId, metricType: metricType, days: days, modelContext: modelContext)
    }
    
    var body: some View {
        if metrics.isEmpty {
            VStack(spacing: 16) {
                Image(systemName: "chart.line.uptrend.xyaxis")
                    .font(.system(size: 60))
                    .foregroundColor(.gray)
                Text(String(localized: "No data yet"))
                    .font(.headline)
                    .foregroundStyle(Color.textSecondary(for: colorScheme))
                Text(String(localized: "Sync with HealthKit to see data"))
                    .font(.subheadline)
                    .foregroundStyle(Color.textSecondary(for: colorScheme))
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 60)
        } else {
            Chart {
                ForEach(metrics, id: \.id) { metric in
                    LineMark(
                        x: .value("Date", metric.date, unit: .day),
                        y: .value("Value", metric.value)
                    )
                    .foregroundStyle(Color.accentBlue)
                    .interpolationMethod(.catmullRom)
                    
                    AreaMark(
                        x: .value("Date", metric.date, unit: .day),
                        y: .value("Value", metric.value)
                    )
                    .foregroundStyle(
                        LinearGradient(
                            colors: [Color.accentBlue.opacity(0.3), Color.accentBlue.opacity(0.0)],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                }
            }
            .frame(height: 250)
            .chartXAxis {
                AxisMarks(values: .stride(by: .day, count: max(1, days / 7))) { _ in
                    AxisGridLine()
                    AxisValueLabel(format: .dateTime.month().day())
                }
            }
            .chartYAxis {
                AxisMarks { _ in
                    AxisGridLine()
                    AxisValueLabel()
                }
            }
            .padding()
        }
    }
}


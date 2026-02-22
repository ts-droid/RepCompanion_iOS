import SwiftUI
import SwiftData
import Charts

/// View for displaying exercise weight progression over time
struct ExerciseProgressionView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.colorScheme) private var colorScheme
    
    let exerciseKey: String
    let exerciseName: String
    let userId: String
    
    @StateObject private var statsService = ExerciseStatsService.shared
    @State private var selectedDays = 30
    @State private var progressionData: [WeightDataPoint] = []
    
    private var stats: ExerciseStats? {
        statsService.getStats(for: exerciseKey, userId: userId, modelContext: modelContext)
    }
    
    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Stats Overview
                if let stats = stats {
                    VStack(spacing: 16) {
                        HStack(spacing: 20) {
                            StatBox(
                                title: String(localized: "Max weight"),
                                value: "\(stats.maxWeight?.formattedWeight ?? "0") kg",
                                colorScheme: colorScheme
                            )
                            StatBox(
                                title: String(localized: "Average weight"),
                                value: "\(stats.avgWeight?.formattedWeight ?? "0") kg",
                                colorScheme: colorScheme
                            )
                            StatBox(
                                title: String(localized: "Latest"),
                                value: "\(stats.lastWeight?.formattedWeight ?? "0") kg",
                                colorScheme: colorScheme
                            )
                        }

                        HStack(spacing: 20) {
                            StatBox(
                                title: String(localized: "Total volume"),
                                value: "\(stats.totalVolume.formattedWeight) kg",
                                colorScheme: colorScheme
                            )
                            StatBox(
                                title: String(localized: "Total sets"),
                                value: "\(stats.totalSets)",
                                colorScheme: colorScheme
                            )
                            StatBox(
                                title: String(localized: "Sessions"),
                                value: "\(stats.totalSessions)",
                                colorScheme: colorScheme
                            )
                        }
                    }
                    .padding()
                }
                
                // Progression Chart
                VStack(alignment: .leading, spacing: 16) {
                    HStack {
                        Text(String(localized: "Weight progression"))
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
                    
                    if progressionData.isEmpty {
                        VStack(spacing: 16) {
                            Image(systemName: "chart.line.uptrend.xyaxis")
                                .font(.system(size: 60))
                                .foregroundColor(.gray)
                            Text(String(localized: "No data yet"))
                                .font(.headline)
                                .foregroundStyle(Color.textSecondary(for: colorScheme))
                            Text(String(localized: "Log exercises to see progression"))
                                .font(.subheadline)
                                .foregroundStyle(Color.textSecondary(for: colorScheme))
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 60)
                    } else {
                        Chart {
                            ForEach(progressionData) { point in
                                LineMark(
                                    x: .value("Date", point.date, unit: .day),
                                    y: .value(String(localized: "Weight"), point.weight)
                                )
                                .foregroundStyle(Color.accentBlue)
                                .interpolationMethod(.catmullRom)
                                
                                PointMark(
                                    x: .value("Date", point.date, unit: .day),
                                    y: .value(String(localized: "Weight"), point.weight)
                                )
                                .foregroundStyle(Color.accentBlue)
                            }
                        }
                        .frame(height: 250)
                        .chartXAxis {
                            AxisMarks(values: .stride(by: .day, count: selectedDays / 7)) { _ in
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
                .padding()
                .background(Color.cardBackground(for: colorScheme))
                .cornerRadius(16)
                .padding(.horizontal)
            }
            .padding(.vertical)
        }
        .background(Color.appBackground(for: colorScheme))
        .navigationTitle(exerciseName)
        .navigationBarTitleDisplayMode(.large)
        .onAppear {
            loadProgression()
        }
        .onChange(of: selectedDays) { oldValue, newValue in
            loadProgression()
        }
    }
    
    private func loadProgression() {
        progressionData = statsService.getWeightProgression(
            for: exerciseKey,
            userId: userId,
            days: selectedDays,
            modelContext: modelContext
        )
    }
}

struct StatBox: View {
    let title: String
    let value: String
    let colorScheme: ColorScheme
    
    var body: some View {
        VStack(spacing: 8) {
            Text(title)
                .font(.caption)
                .foregroundStyle(Color.textSecondary(for: colorScheme))
            Text(value)
                .font(.title3)
                .fontWeight(.bold)
                .foregroundStyle(Color.textPrimary(for: colorScheme))
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(Color.cardBackground(for: colorScheme))
        .cornerRadius(12)
    }
}


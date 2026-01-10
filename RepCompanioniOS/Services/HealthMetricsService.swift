import Foundation
import SwiftData
import Combine

/// Service for managing health metrics history and trends
@MainActor
class HealthMetricsService: ObservableObject {
    static let shared = HealthMetricsService()
    
    @Published var isLoading = false
    
    private init() {}
    
    // MARK: - Sync from HealthKit
    
    func syncFromHealthKit(
        userId: String,
        modelContext: ModelContext
    ) async throws {
        isLoading = true
        defer { isLoading = false }
        
        let today = Date()
        let calendar = Calendar.current
        let startOfDay = calendar.startOfDay(for: today)
        
        // Get today's data from HealthKit
        let steps = try await HealthKitService.shared.getTodaySteps()
        let activeEnergy = try await HealthKitService.shared.getTodayActiveEnergy()
        let heartRate = try? await HealthKitService.shared.getAverageHeartRate(for: today)
        let startOfToday = calendar.startOfDay(for: today)
        let endOfToday = calendar.date(byAdding: .day, value: 1, to: startOfToday) ?? today
        let sleepHours = try? await HealthKitService.shared.getSleepHours(for: startOfToday, to: endOfToday)
        
        // Save or update metrics
        if steps > 0 {
            try saveOrUpdateMetric(
                userId: userId,
                metricType: "steps",
                value: steps,
                unit: "steps",
                date: startOfDay,
                modelContext: modelContext
            )
        }
        
        if activeEnergy > 0 {
            try saveOrUpdateMetric(
                userId: userId,
                metricType: "calories_burned",
                value: Int(activeEnergy),
                unit: "kcal",
                date: startOfDay,
                modelContext: modelContext
            )
        }
        
        if let heartRate = heartRate, heartRate > 0 {
            try saveOrUpdateMetric(
                userId: userId,
                metricType: "heart_rate_avg",
                value: Int(heartRate.rounded()),
                unit: "bpm",
                date: startOfDay,
                modelContext: modelContext
            )
        }
        
        if let sleepHours = sleepHours, sleepHours > 0 {
            try saveOrUpdateMetric(
                userId: userId,
                metricType: "sleep_duration_minutes",
                value: Int(sleepHours * 60),
                unit: "minutes",
                date: startOfDay,
                modelContext: modelContext
            )
        }
        
        // Sync to server
        try await HealthKitService.shared.syncToServer()
    }
    
    private func saveOrUpdateMetric(
        userId: String,
        metricType: String,
        value: Int,
        unit: String,
        date: Date,
        modelContext: ModelContext
    ) throws {
        let descriptor = FetchDescriptor<HealthMetric>(
            predicate: #Predicate { metric in
                metric.userId == userId &&
                metric.metricType == metricType &&
                metric.date == date
            }
        )
        
        var metric = try? modelContext.fetch(descriptor).first
        
        if metric == nil {
            metric = HealthMetric(
                id: UUID().uuidString,
                userId: userId,
                metricType: metricType,
                value: value,
                unit: unit,
                date: date
            )
            modelContext.insert(metric!)
        } else {
            metric!.value = value
            metric!.collectedAt = Date()
        }
        
        try modelContext.save()
    }
    
    // MARK: - Get Metrics
    
    func getMetrics(
        userId: String,
        metricType: String,
        days: Int = 30,
        modelContext: ModelContext
    ) -> [HealthMetric] {
        let cutoffDate = Calendar.current.date(byAdding: .day, value: -days, to: Date()) ?? Date()
        
        let descriptor = FetchDescriptor<HealthMetric>(
            predicate: #Predicate { metric in
                metric.userId == userId &&
                metric.metricType == metricType &&
                metric.date >= cutoffDate
            },
            sortBy: [SortDescriptor(\.date)]
        )
        
        return (try? modelContext.fetch(descriptor)) ?? []
    }
    
    func getTodayMetric(
        userId: String,
        metricType: String,
        modelContext: ModelContext
    ) -> HealthMetric? {
        let today = Calendar.current.startOfDay(for: Date())
        
        let descriptor = FetchDescriptor<HealthMetric>(
            predicate: #Predicate { metric in
                metric.userId == userId &&
                metric.metricType == metricType &&
                metric.date == today
            }
        )
        
        return try? modelContext.fetch(descriptor).first
    }
    
    // MARK: - Get Trends
    
    func getTrend(
        userId: String,
        metricType: String,
        days: Int = 7,
        modelContext: ModelContext
    ) -> HealthTrend {
        let metrics = getMetrics(userId: userId, metricType: metricType, days: days, modelContext: modelContext)
        
        guard !metrics.isEmpty else {
            return HealthTrend(
                current: 0,
                average: 0,
                trend: .stable,
                changePercent: 0
            )
        }
        
        let current = metrics.last?.value ?? 0
        let average = metrics.map { $0.value }.reduce(0, +) / metrics.count
        
        // Calculate trend (compare last 3 days vs previous 3 days)
        let recent = Array(metrics.suffix(3))
        let previous = Array(metrics.prefix(max(0, metrics.count - 3)))
        
        let recentAvg = recent.isEmpty ? 0.0 : Double(recent.map { $0.value }.reduce(0, +)) / Double(recent.count)
        let previousAvg = previous.isEmpty ? 0.0 : Double(previous.map { $0.value }.reduce(0, +)) / Double(previous.count)
        
        let changePercent = previousAvg > 0 ? ((recentAvg - previousAvg) / previousAvg) * 100.0 : 0.0
        
        let trend: TrendDirection
        if changePercent > 5 {
            trend = .increasing
        } else if changePercent < -5 {
            trend = .decreasing
        } else {
            trend = .stable
        }
        
        return HealthTrend(
            current: current,
            average: average,
            trend: trend,
            changePercent: changePercent
        )
    }
    
    // MARK: - Get Weekly Summary
    
    func getWeeklySummary(
        userId: String,
        modelContext: ModelContext
    ) -> WeeklyHealthSummary {
        let steps = getMetrics(userId: userId, metricType: "steps", days: 7, modelContext: modelContext)
        let calories = getMetrics(userId: userId, metricType: "calories_burned", days: 7, modelContext: modelContext)
        let sleep = getMetrics(userId: userId, metricType: "sleep_duration_minutes", days: 7, modelContext: modelContext)
        
        return WeeklyHealthSummary(
            totalSteps: steps.map { $0.value }.reduce(0, +),
            totalCalories: calories.map { $0.value }.reduce(0, +),
            avgSleepHours: sleep.isEmpty ? 0 : Double(sleep.map { $0.value }.reduce(0, +)) / 60.0 / Double(sleep.count),
            activeDays: steps.filter { $0.value > 0 }.count
        )
    }
}

struct HealthTrend {
    let current: Int
    let average: Int
    let trend: TrendDirection
    let changePercent: Double
}

enum TrendDirection {
    case increasing
    case decreasing
    case stable
}

struct WeeklyHealthSummary {
    let totalSteps: Int
    let totalCalories: Int
    let avgSleepHours: Double
    let activeDays: Int
}


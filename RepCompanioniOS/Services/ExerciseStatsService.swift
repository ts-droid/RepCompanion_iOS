import Foundation
import SwiftData
import Combine

/// Service for managing exercise statistics and progression tracking
@MainActor
class ExerciseStatsService: ObservableObject {
    static let shared = ExerciseStatsService()
    
    private init() {}
    
    // MARK: - Update Stats from Exercise Log
    
    func updateStats(
        from exerciseLog: ExerciseLog,
        session: WorkoutSession,
        modelContext: ModelContext
    ) throws {
        let userId = session.userId
        let exerciseKey = exerciseLog.exerciseKey
        let descriptor = FetchDescriptor<ExerciseStats>(
            predicate: #Predicate<ExerciseStats> { stats in
                stats.userId == userId &&
                stats.exerciseKey == exerciseKey
            }
        )
        
        var stats = try? modelContext.fetch(descriptor).first
        
        if stats == nil {
            // Create new stats entry
            stats = ExerciseStats(
                id: UUID().uuidString,
                userId: userId,
                exerciseKey: exerciseLog.exerciseKey,
                exerciseName: exerciseLog.exerciseTitle
            )
            modelContext.insert(stats!)
        }
        
        guard let stats = stats else { return }
        
        // Update stats
        if let weight = exerciseLog.weight {
            // Update weight statistics
            if stats.maxWeight == nil || weight > (stats.maxWeight ?? 0) {
                stats.maxWeight = weight
            }
            stats.lastWeight = weight
            
            // Update recent weights (keep last 10)
            var recentWeights = stats.recentWeightsArray
            recentWeights.append(weight)
            if recentWeights.count > 10 {
                recentWeights.removeFirst()
            }
            stats.setRecentWeights(recentWeights)
            
            // Calculate average
            let sum = recentWeights.reduce(0, +)
            stats.avgWeight = sum / Double(recentWeights.count)
            
            // Calculate and update 1RM (Epley formula)
            if let reps = exerciseLog.reps, reps > 0 {
                let calculated1RM = calculateEpley1RM(weight: weight, reps: reps)
                if stats.estimatedOneRm == nil || calculated1RM > (stats.estimatedOneRm ?? 0) {
                    stats.estimatedOneRm = calculated1RM
                }
            }
        }
        
        // Update volume and sets
        if let weight = exerciseLog.weight, let reps = exerciseLog.reps {
            stats.totalVolume += weight * Double(reps)
        }
        stats.totalSets += 1
        
        if exerciseLog.completed {
            stats.totalSessions += 1
        }
        
        stats.updatedAt = Date()
        
        try modelContext.save()
    }
    
    // MARK: - Get Stats
    
    func getStats(
        for exerciseKey: String,
        userId: String,
        modelContext: ModelContext
    ) -> ExerciseStats? {
        let descriptor = FetchDescriptor<ExerciseStats>(
            predicate: #Predicate { stats in
                stats.userId == userId &&
                stats.exerciseKey == exerciseKey
            }
        )
        return try? modelContext.fetch(descriptor).first
    }
    
    func getAllStats(
        userId: String,
        modelContext: ModelContext
    ) -> [ExerciseStats] {
        let descriptor = FetchDescriptor<ExerciseStats>(
            predicate: #Predicate { stats in
                stats.userId == userId
            },
            sortBy: [SortDescriptor(\.updatedAt, order: .reverse)]
        )
        return (try? modelContext.fetch(descriptor)) ?? []
    }
    
    // MARK: - Get Weight Progression
    
    func getWeightProgression(
        for exerciseKey: String,
        userId: String,
        days: Int = 30,
        modelContext: ModelContext
    ) -> [WeightDataPoint] {
        // Get exercise logs for this exercise
        let cutoffDate = Calendar.current.date(byAdding: .day, value: -days, to: Date()) ?? Date()
        
        let descriptor = FetchDescriptor<ExerciseLog>(
            predicate: #Predicate { log in
                log.exerciseKey == exerciseKey &&
                log.createdAt >= cutoffDate &&
                log.completed == true &&
                log.weight != nil
            },
            sortBy: [SortDescriptor(\.createdAt)]
        )
        
        guard let logs = try? modelContext.fetch(descriptor) else {
            return []
        }
        
        // Group by date and get max weight per day
        var dailyWeights: [Date: Double] = [:]
        for log in logs {
            guard let weight = log.weight else { continue }
            let date = log.createdAt
            
            let dayStart = Calendar.current.startOfDay(for: date)
            if let existing = dailyWeights[dayStart] {
                dailyWeights[dayStart] = max(existing, weight)
            } else {
                dailyWeights[dayStart] = weight
            }
        }
        
        return dailyWeights.map { date, weight in
            WeightDataPoint(date: date, weight: weight)
        }.sorted { $0.date < $1.date }
    }
    
    // MARK: - Get Suggested Starting Weight
    
    func getSuggestedWeight(
        for exerciseKey: String,
        userId: String,
        targetReps: Int,
        modelContext: ModelContext
    ) -> Double? {
        // Prefer estimatedOneRm if available for better accuracy
        if let stats = getStats(for: exerciseKey, userId: userId, modelContext: modelContext),
           let oneRm = stats.estimatedOneRm {
            
            let percentage: Double
            switch targetReps {
            case 1...5: percentage = 0.85 // Strength
            case 6...8: percentage = 0.75
            case 9...12: percentage = 0.65 // Hypertrophy
            case 13...15: percentage = 0.55
            default: percentage = 0.45
            }
            
            return oneRm * percentage
        }
        
        guard let stats = getStats(for: exerciseKey, userId: userId, modelContext: modelContext),
              let maxWeight = stats.maxWeight else {
            return nil
        }
        
        // Fallback to maxWeight percentage if 1RM not available
        let percentage: Double
        switch targetReps {
        case 1...5: percentage = 0.90 // Strength range
        case 6...8: percentage = 0.80
        case 9...12: percentage = 0.70 // Hypertrophy range
        case 13...15: percentage = 0.60
        default: percentage = 0.50 // Endurance range
        }
        
        return maxWeight * percentage
    }
    
    // MARK: - 1RM Calculation (Epley Formula)
    
    /// Calculate 1RM using the Epley formula: 1RM = weight * (1 + reps/30)
    func calculateEpley1RM(weight: Double, reps: Int) -> Double {
        guard reps > 0 else { return weight }
        if reps == 1 { return weight }
        
        return weight * (1.0 + Double(reps) / 30.0)
    }
}

struct WeightDataPoint: Identifiable {
    let id = UUID()
    let date: Date
    let weight: Double
}


import Foundation
import SwiftData

/// Service for calculating workout statistics from SwiftData
@MainActor
class StatsCalculator {
    static let shared = StatsCalculator()
    private init() {}
    
    // MARK: - Summary Stats
    
    /// Total number of workout sessions (completed or cancelled)
    func totalSessions(modelContext: ModelContext) -> Int {
        let descriptor = FetchDescriptor<WorkoutSession>(
            predicate: #Predicate { $0.status == "completed" || $0.status == "cancelled" }
        )
        return (try? modelContext.fetchCount(descriptor)) ?? 0
    }
    
    /// Total volume lifted (weight × reps for all exercises)
    func totalVolume(modelContext: ModelContext) -> Double {
        let descriptor = FetchDescriptor<ExerciseLog>(
            predicate: #Predicate { $0.completed == true }
        )
        guard let logs = try? modelContext.fetch(descriptor) else { return 0 }
        
        return logs.reduce(0) { total, log in
            let weight = log.weight ?? 0
            let reps = log.reps ?? 0
            return total + (weight * Double(reps))
        }
    }
    
    /// Number of unique exercises performed
    func uniqueExercises(modelContext: ModelContext) -> Int {
        let descriptor = FetchDescriptor<ExerciseLog>(
            predicate: #Predicate { $0.completed == true }
        )
        guard let logs = try? modelContext.fetch(descriptor) else { return 0 }
        
        let uniqueKeys = Set(logs.map { $0.exerciseKey })
        return uniqueKeys.count
    }
    
    /// Average session duration in minutes
    func averageDuration(modelContext: ModelContext) -> Int {
        let descriptor = FetchDescriptor<WorkoutSession>(
            predicate: #Predicate { $0.status == "completed" }
        )
        guard let sessions = try? modelContext.fetch(descriptor), !sessions.isEmpty else { return 0 }
        
        let totalMinutes = sessions.reduce(0) { total, session in
            // startedAt is non-optional, completedAt is optional
            guard let completed = session.completedAt else { return total }
            let duration = completed.timeIntervalSince(session.startedAt)
            return total + Int(duration / 60)
        }
        
        return totalMinutes / sessions.count
    }
    
    // MARK: - Formatted Stats
    
    func formattedTotalVolume(modelContext: ModelContext) -> String {
        let volume = totalVolume(modelContext: modelContext)
        if volume >= 1000 {
            return String(format: "%.1fk kg", volume / 1000)
        } else {
            return String(format: "%.0f kg", volume)
        }
    }
    
    func formattedAverageDuration(modelContext: ModelContext) -> String {
        let minutes = averageDuration(modelContext: modelContext)
        return "\(minutes)m"
    }
    
    // MARK: - Workout History
    
    struct WorkoutHistoryItem: Identifiable {
        let id: UUID
        let name: String
        let date: Date
        let duration: Int // minutes
        let totalReps: Int
        let totalWeight: Double
        let status: String // "completed" or "cancelled"
    }
    
    func getWorkoutHistory(modelContext: ModelContext) -> [WorkoutHistoryItem] {
        let sessionDescriptor = FetchDescriptor<WorkoutSession>(
            predicate: #Predicate { $0.status == "completed" || $0.status == "cancelled" },
            sortBy: [SortDescriptor(\WorkoutSession.startedAt, order: .reverse)]
        )
        guard let sessions = try? modelContext.fetch(sessionDescriptor) else { return [] }
        
        return sessions.map { session in
            // startedAt is non-optional, completedAt is optional
            let startDate = session.startedAt
            
            // Calculate duration
            let endDate = session.completedAt ?? Date()
            let duration = Int(endDate.timeIntervalSince(startDate) / 60)
            
            // Fetch logs for this session
            let sessionId = session.id
            let logDescriptor = FetchDescriptor<ExerciseLog>(
                predicate: #Predicate { $0.workoutSessionId == sessionId && $0.completed == true }
            )
            let logs = (try? modelContext.fetch(logDescriptor)) ?? []
            
            let totalReps = logs.reduce(0) { $0 + ($1.reps ?? 0) }
            let totalWeight = logs.reduce(0.0) { $0 + (($1.weight ?? 0) * Double($1.reps ?? 0)) }
            
            return WorkoutHistoryItem(
                id: session.id,
                name: session.sessionName ?? "Träningspass",
                date: startDate,
                duration: duration,
                totalReps: totalReps,
                totalWeight: totalWeight,
                status: session.status
            )
        }
    }
    
    // MARK: - Exercise Personal Bests
    
    struct ExercisePB: Identifiable {
        var id: String { exerciseKey }
        let exerciseKey: String
        let exerciseName: String
        let maxWeight: Double
        let totalVolume: Double
    }
    
    func getExercisePBs(modelContext: ModelContext) -> [ExercisePB] {
        let descriptor = FetchDescriptor<ExerciseLog>(
            predicate: #Predicate { $0.completed == true }
        )
        guard let logs = try? modelContext.fetch(descriptor) else { return [] }
        
        // Group by exercise key
        var exerciseData: [String: (name: String, maxWeight: Double, totalVolume: Double)] = [:]
        
        for log in logs {
            let key = log.exerciseKey
            let weight = log.weight ?? 0
            let reps = log.reps ?? 0
            let volume = weight * Double(reps)
            
            if var data = exerciseData[key] {
                data.maxWeight = max(data.maxWeight, weight)
                data.totalVolume += volume
                exerciseData[key] = data
            } else {
                exerciseData[key] = (name: log.exerciseTitle, maxWeight: weight, totalVolume: volume)
            }
        }
        
        return exerciseData.map { key, data in
            ExercisePB(
                exerciseKey: key,
                exerciseName: data.name,
                maxWeight: data.maxWeight,
                totalVolume: data.totalVolume
            )
        }
        .sorted { $0.totalVolume > $1.totalVolume }
    }
}

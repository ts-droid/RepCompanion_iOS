import Foundation
import SwiftData

/// Service for calculating workout statistics from SwiftData
@MainActor
class StatsCalculator {
    static let shared = StatsCalculator()
    private init() {}
    
    // MARK: - Data Models for Charts
    
    struct WeeklySessionData: Identifiable {
        let id = UUID()
        let weekLabel: String
        let count: Int
        let date: Date
    }
    
    struct TopExerciseData: Identifiable {
        let id = UUID()
        let name: String
        let volume: Double
    }
    
    struct MuscleDistributionData: Identifiable {
        let id = UUID()
        let name: String
        let value: Double
    }
    
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
    
    // MARK: - Dynamic Chart Data
    
    /// Get session counts per week for the last 12 weeks
    func getWeeklySessionCounts(modelContext: ModelContext) -> [WeeklySessionData] {
        let calendar = Calendar.current
        let now = Date()
        
        // Fetch sessions from the last 12 weeks
        let twelveWeeksAgo = calendar.date(byAdding: .weekOfYear, value: -11, to: now) ?? now
        let startOfTargetWeek = calendar.date(from: calendar.dateComponents([.yearForWeekOfYear, .weekOfYear], from: twelveWeeksAgo)) ?? twelveWeeksAgo
        
        let descriptor = FetchDescriptor<WorkoutSession>(
            predicate: #Predicate { $0.status == "completed" && $0.startedAt >= startOfTargetWeek },
            sortBy: [SortDescriptor(\.startedAt)]
        )
        
        guard let sessions = try? modelContext.fetch(descriptor) else { return [] }
        
        // Initialize 12 weeks of empty data
        var weeklyData: [WeeklySessionData] = []
        for i in 0..<12 {
            if let date = calendar.date(byAdding: .weekOfYear, value: i, to: startOfTargetWeek) {
                let formatter = DateFormatter()
                formatter.dateFormat = "d MMM"
                let label = formatter.string(from: date)
                weeklyData.append(WeeklySessionData(weekLabel: label, count: 0, date: date))
            }
        }
        
        // Aggregate sessions into weeks
        for session in sessions {
            let sessionWeekStart = calendar.date(from: calendar.dateComponents([.yearForWeekOfYear, .weekOfYear], from: session.startedAt)) ?? session.startedAt
            
            if let index = weeklyData.firstIndex(where: { calendar.isDate($0.date, inSameDayAs: sessionWeekStart) }) {
                weeklyData[index] = WeeklySessionData(weekLabel: weeklyData[index].weekLabel, count: weeklyData[index].count + 1, date: weeklyData[index].date)
            }
        }
        
        return weeklyData
    }
    
    /// Get top exercises by total volume
    func getTopExercises(limit: Int = 5, modelContext: ModelContext) -> [TopExerciseData] {
        let pbs = getExercisePBs(modelContext: modelContext)
        return pbs.prefix(limit).map { pb in
            TopExerciseData(name: pb.exerciseName, volume: pb.totalVolume)
        }
    }
    
    /// Get distribution of muscle groups trained (based on primary muscles in catalog)
    func getMuscleDistribution(modelContext: ModelContext) -> [MuscleDistributionData] {
        let descriptor = FetchDescriptor<ExerciseLog>(
            predicate: #Predicate { $0.completed == true }
        )
        guard let logs = try? modelContext.fetch(descriptor) else { return [] }
        
        // Fetch all exercise catalog once to avoid multiple hits
        let catalogDescriptor = FetchDescriptor<ExerciseCatalog>()
        let catalogItems = (try? modelContext.fetch(catalogDescriptor)) ?? []
        let catalogMap = Dictionary(uniqueKeysWithValues: catalogItems.map { ($0.id, $0) })
        
        var muscleCounts: [String: Double] = [:]
        
        for log in logs {
            // Match by exerciseKey (which is the catalog ID)
            if let catalogEntry = catalogMap[log.exerciseKey] {
                // We count each set towards the primary muscles
                for muscle in catalogEntry.primaryMuscles {
                    muscleCounts[muscle, default: 0] += 1
                }
                // Secondary muscles count for half weight in distribution
                for muscle in catalogEntry.secondaryMuscles {
                    muscleCounts[muscle, default: 0] += 0.5
                }
            }
        }
        
        return muscleCounts.map { MuscleDistributionData(name: $0.key, value: $0.value) }
            .sorted { $0.value > $1.value }
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

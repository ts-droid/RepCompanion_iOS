import Foundation
import SwiftData

/// Exercise stats - tracks weight history and performance for smart suggestions
@Model
final class ExerciseStats {
    @Attribute(.unique) var id: String
    var userId: String
    var exerciseKey: String
    var exerciseName: String
    var muscles: [String]
    var avgWeight: Double?
    var maxWeight: Double?
    var lastWeight: Double?
    var estimatedOneRm: Double?
    var totalVolume: Double
    var totalSets: Int
    var totalSessions: Int
    var recentWeights: Data? // JSON encoded array of recent weights
    var updatedAt: Date
    
    init(
        id: String,
        userId: String,
        exerciseKey: String,
        exerciseName: String,
        muscles: [String] = [],
        avgWeight: Double? = nil,
        maxWeight: Double? = nil,
        lastWeight: Double? = nil,
        estimatedOneRm: Double? = nil,
        totalVolume: Double = 0,
        totalSets: Int = 0,
        totalSessions: Int = 0,
        recentWeights: [Double] = [],
        updatedAt: Date = Date()
    ) {
        self.id = id
        self.userId = userId
        self.exerciseKey = exerciseKey
        self.exerciseName = exerciseName
        self.muscles = muscles
        self.avgWeight = avgWeight
        self.maxWeight = maxWeight
        self.lastWeight = lastWeight
        self.estimatedOneRm = estimatedOneRm
        self.totalVolume = totalVolume
        self.totalSets = totalSets
        self.totalSessions = totalSessions
        // Encode recent weights as JSON
        if let jsonData = try? JSONEncoder().encode(recentWeights) {
            self.recentWeights = jsonData
        }
        self.updatedAt = updatedAt
    }
    
    // Helper to get recent weights array
    var recentWeightsArray: [Double] {
        guard let data = recentWeights else { return [] }
        return (try? JSONDecoder().decode([Double].self, from: data)) ?? []
    }
    
    // Helper to set recent weights array
    func setRecentWeights(_ weights: [Double]) {
        if let jsonData = try? JSONEncoder().encode(weights) {
            self.recentWeights = jsonData
        }
    }
}


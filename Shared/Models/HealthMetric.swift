import Foundation
import SwiftData

/// Health metrics - Daily aggregated health data from connected platforms
@Model
final class HealthMetric {
    @Attribute(.unique) var id: String
    var userId: String
    var connectionId: String?
    var metricType: String // "steps", "calories_burned", "sleep_duration_minutes", etc.
    var value: Int
    var unit: String // "steps", "kcal", "minutes", "bpm", etc.
    var date: Date // Date of the metric (start of day)
    var collectedAt: Date
    var metadata: Data? // JSON encoded metadata
    var createdAt: Date
    
    init(
        id: String,
        userId: String,
        connectionId: String? = nil,
        metricType: String,
        value: Int,
        unit: String,
        date: Date,
        collectedAt: Date = Date(),
        metadata: [String: Any]? = nil,
        createdAt: Date = Date()
    ) {
        self.id = id
        self.userId = userId
        self.connectionId = connectionId
        self.metricType = metricType
        self.value = value
        self.unit = unit
        self.date = date
        self.collectedAt = collectedAt
        // Encode metadata as JSON
        if let metadata = metadata,
           let jsonData = try? JSONSerialization.data(withJSONObject: metadata) {
            self.metadata = jsonData
        }
        self.createdAt = createdAt
    }
    
    // Helper to get metadata dictionary
    var metadataDict: [String: Any]? {
        guard let data = metadata else { return nil }
        return try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    }
    
    // Helper to set metadata dictionary
    func setMetadata(_ metadata: [String: Any]) {
        if let jsonData = try? JSONSerialization.data(withJSONObject: metadata) {
            self.metadata = jsonData
        }
    }
}


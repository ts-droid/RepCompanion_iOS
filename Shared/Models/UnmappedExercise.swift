import Foundation
import SwiftData

/// Unmapped exercises - tracks AI-generated exercises not found in catalog
@Model
final class UnmappedExercise {
    @Attribute(.unique) var id: String
    var aiName: String
    var suggestedMatch: String?
    var count: Int
    var firstSeen: Date
    var lastSeen: Date
    var createdAt: Date
    
    init(
        id: String,
        aiName: String,
        suggestedMatch: String? = nil,
        count: Int = 1,
        firstSeen: Date = Date(),
        lastSeen: Date = Date(),
        createdAt: Date = Date()
    ) {
        self.id = id
        self.aiName = aiName
        self.suggestedMatch = suggestedMatch
        self.count = count
        self.firstSeen = firstSeen
        self.lastSeen = lastSeen
        self.createdAt = createdAt
    }
}


import Foundation
import SwiftData

/// Gym programs - AI-generated workout programs per gym
@Model
final class GymProgram {
    @Attribute(.unique) var id: String
    var userId: String
    var gymId: String
    var programData: Data // JSON encoded program data
    var templateSnapshot: Data? // JSON encoded snapshot of templates
    var snapshotCreatedAt: Date?
    var createdAt: Date
    var updatedAt: Date
    
    init(
        id: String,
        userId: String,
        gymId: String,
        programData: Data,
        templateSnapshot: Data? = nil,
        snapshotCreatedAt: Date? = nil,
        createdAt: Date = Date(),
        updatedAt: Date = Date()
    ) {
        self.id = id
        self.userId = userId
        self.gymId = gymId
        self.programData = programData
        self.templateSnapshot = templateSnapshot
        self.snapshotCreatedAt = snapshotCreatedAt
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}


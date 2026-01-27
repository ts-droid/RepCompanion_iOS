import Foundation
import SwiftData

@Model
final class WorkoutSession {
    var id: UUID
    var userId: String
    var templateId: UUID?
    var sessionType: String
    var sessionName: String?
    var status: String
    var startedAt: Date
    var completedAt: Date?
    var notes: String?
    var movergyScore: Int?
    var snapshotData: Data? // Store JSON as Data for SwiftData compatibility
    
    // Timer persistence fields
    var accumulatedTime: TimeInterval = 0
    var lastStartTime: Date? = nil
    
    init(
        id: UUID = UUID(),
        userId: String,
        templateId: UUID? = nil,
        sessionType: String,
        sessionName: String? = nil,
        status: String = "pending",
        startedAt: Date = Date(),
        completedAt: Date? = nil,
        notes: String? = nil,
        movergyScore: Int? = nil,
        snapshotData: Data? = nil
    ) {
        self.id = id
        self.userId = userId
        self.templateId = templateId
        self.sessionType = sessionType
        self.sessionName = sessionName
        self.status = status
        self.startedAt = startedAt
        self.completedAt = completedAt
        self.notes = notes
        self.movergyScore = movergyScore
        self.snapshotData = snapshotData
    }
    
    // Helper methods for snapshot data
    func setSnapshotData(_ dict: [String: Any]) {
        if let jsonData = try? JSONSerialization.data(withJSONObject: dict) {
            self.snapshotData = jsonData
        }
    }
    
    func getSnapshotData() -> [String: Any]? {
        guard let data = snapshotData,
              let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }
        return dict
    }
}

@Model
final class ExerciseLog {
    var id: UUID
    var workoutSessionId: UUID
    var exerciseKey: String
    var exerciseTitle: String
    var exerciseOrderIndex: Int
    var setNumber: Int
    var weight: Double?
    var reps: Int?
    var completed: Bool
    var createdAt: Date
    
    init(
        id: UUID = UUID(),
        workoutSessionId: UUID,
        exerciseKey: String,
        exerciseTitle: String,
        exerciseOrderIndex: Int,
        setNumber: Int,
        weight: Double? = nil,
        reps: Int? = nil,
        completed: Bool = false
    ) {
        self.id = id
        self.workoutSessionId = workoutSessionId
        self.exerciseKey = exerciseKey
        self.exerciseTitle = exerciseTitle
        self.exerciseOrderIndex = exerciseOrderIndex
        self.setNumber = setNumber
        self.weight = weight
        self.reps = reps
        self.completed = completed
        self.createdAt = Date()
    }
}

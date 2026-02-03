import Foundation
import SwiftData

@Model
final class ProgramTemplate {
    @Attribute(.unique) var id: UUID
    var userId: String
    var gymId: String? // Linked to a specific gym
    var templateName: String
    var muscleFocus: String?
    var dayOfWeek: Int? // 1=Monday, 7=Sunday
    var weekNumber: Int? // 1, 2, 3, 4 etc.
    var estimatedDurationMinutes: Int?
    var warmupDescription: String? // New field for warm-up suggestions
    @Relationship(deleteRule: .cascade, inverse: \ProgramTemplateExercise.template) 
    var exercises: [ProgramTemplateExercise] = []
    var createdAt: Date
    var updatedAt: Date
    
    init(
        id: UUID = UUID(),
        userId: String,
        gymId: String? = nil,
        templateName: String,
        muscleFocus: String? = nil,
        dayOfWeek: Int? = nil,
        weekNumber: Int? = nil,
        estimatedDurationMinutes: Int? = nil,
        warmupDescription: String? = nil,
        exercises: [ProgramTemplateExercise] = []
    ) {
        self.id = id
        self.userId = userId
        self.gymId = gymId
        self.templateName = templateName
        self.muscleFocus = muscleFocus
        self.dayOfWeek = dayOfWeek
        self.weekNumber = weekNumber
        self.estimatedDurationMinutes = estimatedDurationMinutes
        self.warmupDescription = warmupDescription
        self.exercises = exercises
        self.createdAt = Date()
        self.updatedAt = Date()
    }
}

@Model
final class ProgramTemplateExercise {
    @Attribute(.unique) var id: UUID
    var template: ProgramTemplate?
    var gymId: String? // Cached gymId for easier filtering
    var exerciseKey: String
    var exerciseName: String
    var orderIndex: Int
    var targetSets: Int
    var targetReps: String
    var targetWeight: Double?
    var requiredEquipment: [String]
    var muscles: [String]
    var notes: String?
    
    init(
        id: UUID = UUID(),
        gymId: String? = nil,
        exerciseKey: String,
        exerciseName: String,
        orderIndex: Int,
        targetSets: Int,
        targetReps: String,
        targetWeight: Double? = nil,
        requiredEquipment: [String] = [],
        muscles: [String] = [],
        notes: String? = nil
    ) {
        self.id = id
        self.gymId = gymId
        self.exerciseKey = exerciseKey
        self.exerciseName = exerciseName
        self.orderIndex = orderIndex
        self.targetSets = targetSets
        self.targetReps = targetReps
        self.targetWeight = targetWeight
        self.requiredEquipment = requiredEquipment
        self.muscles = muscles
        self.notes = notes
    }
}

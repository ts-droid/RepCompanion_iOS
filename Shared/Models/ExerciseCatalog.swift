import Foundation
import SwiftData

/// Exercise catalog - master list of all exercises with metadata and video links
@Model
final class ExerciseCatalog {
    @Attribute(.unique) var id: String
    var name: String
    var nameEn: String?
    var exerciseDescription: String? // Renamed from 'description' (reserved in SwiftData)
    var category: String
    var difficulty: String
    var primaryMuscles: [String]
    var secondaryMuscles: [String]
    var requiredEquipment: [String]
    var movementPattern: String?
    var isCompound: Bool
    var youtubeUrl: String?
    var videoType: String?
    var instructions: String?
    var createdAt: Date
    
    init(
        id: String,
        name: String,
        nameEn: String? = nil,
        exerciseDescription: String? = nil,
        category: String,
        difficulty: String,
        primaryMuscles: [String],
        secondaryMuscles: [String] = [],
        requiredEquipment: [String],
        movementPattern: String? = nil,
        isCompound: Bool = false,
        youtubeUrl: String? = nil,
        videoType: String? = nil,
        instructions: String? = nil,
        createdAt: Date = Date()
    ) {
        self.id = id
        self.name = name
        self.nameEn = nameEn
        self.exerciseDescription = exerciseDescription
        self.category = category
        self.difficulty = difficulty
        self.primaryMuscles = primaryMuscles
        self.secondaryMuscles = secondaryMuscles
        self.requiredEquipment = requiredEquipment
        self.movementPattern = movementPattern
        self.isCompound = isCompound
        self.youtubeUrl = youtubeUrl
        self.videoType = videoType
        self.instructions = instructions
        self.createdAt = createdAt
    }
}

/// Equipment catalog - master list of all equipment types
@Model
final class EquipmentCatalog {
    @Attribute(.unique) var id: String
    var name: String
    var nameEn: String?
    var category: String
    var type: String
    var equipmentDescription: String? // Renamed from 'description' (reserved in SwiftData)
    var createdAt: Date
    
    init(
        id: String,
        name: String,
        nameEn: String? = nil,
        category: String,
        type: String,
        equipmentDescription: String? = nil,
        createdAt: Date = Date()
    ) {
        self.id = id
        self.name = name
        self.nameEn = nameEn
        self.category = category
        self.type = type
        self.equipmentDescription = equipmentDescription
        self.createdAt = createdAt
    }
}



/// Equipment available at user's gym
@Model
final class UserEquipment {
    @Attribute(.unique) var id: String
    var userId: String
    var gymId: String
    var equipmentType: String
    var equipmentName: String
    var available: Bool
    var createdAt: Date
    
    init(
        id: String,
        userId: String,
        gymId: String,
        equipmentType: String,
        equipmentName: String,
        available: Bool = true,
        createdAt: Date = Date()
    ) {
        self.id = id
        self.userId = userId
        self.gymId = gymId
        self.equipmentType = equipmentType
        self.equipmentName = equipmentName
        self.available = available
        self.createdAt = createdAt
    }
}


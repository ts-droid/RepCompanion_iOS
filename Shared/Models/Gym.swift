import Foundation
import SwiftData

@Model
final class Gym {
    @Attribute(.unique) var id: String
    var name: String
    var location: String?
    var equipmentIds: [String] // Store IDs of owned equipment
    var isSelected: Bool
    var userId: String
    var createdAt: Date
    var updatedAt: Date
    
    init(
        id: String = UUID().uuidString,
        name: String,
        location: String? = nil,
        equipmentIds: [String] = [],
        isSelected: Bool = false,
        userId: String,
        createdAt: Date = Date(),
        updatedAt: Date = Date()
    ) {
        self.id = id
        self.name = name
        self.location = location
        self.equipmentIds = equipmentIds
        self.isSelected = isSelected
        self.userId = userId
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

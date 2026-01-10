import Foundation
import SwiftData

@Model
final class Exercise {
    var id: UUID
    var name: String
    var sets: [WorkoutSet]
    var notes: String?
    
    // Relationship back to Workout is optional or inferred in SwiftData depending on usage,
    // but typically we just nest them.
    
    init(id: UUID = UUID(), name: String, sets: [WorkoutSet] = [], notes: String? = nil) {
        self.id = id
        self.name = name
        self.sets = sets
        self.notes = notes
    }
}

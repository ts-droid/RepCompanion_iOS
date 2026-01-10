import Foundation
import SwiftData

@Model
final class WorkoutSet {
    var id: UUID
    var reps: Int
    var weight: Double
    var isCompleted: Bool
    
    init(id: UUID = UUID(), reps: Int, weight: Double, isCompleted: Bool = false) {
        self.id = id
        self.reps = reps
        self.weight = weight
        self.isCompleted = isCompleted
    }
}

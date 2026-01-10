import Foundation
import SwiftData
import Combine

/// Service for tracking unmapped exercises (admin/debugging)
@MainActor
class UnmappedExerciseService: ObservableObject {
    static let shared = UnmappedExerciseService()
    
    private init() {}
    
    // MARK: - Track Unmapped Exercise
    
    func trackUnmappedExercise(
        aiName: String,
        suggestedMatch: String? = nil,
        modelContext: ModelContext
    ) throws {
        let descriptor = FetchDescriptor<UnmappedExercise>(
            predicate: #Predicate { exercise in
                exercise.aiName == aiName
            }
        )
        
        var exercise = try? modelContext.fetch(descriptor).first
        
        if exercise == nil {
            exercise = UnmappedExercise(
                id: UUID().uuidString,
                aiName: aiName,
                suggestedMatch: suggestedMatch
            )
            modelContext.insert(exercise!)
        } else {
            exercise!.count += 1
            exercise!.lastSeen = Date()
            if let suggestedMatch = suggestedMatch {
                exercise!.suggestedMatch = suggestedMatch
            }
        }
        
        try modelContext.save()
    }
    
    // MARK: - Get Unmapped Exercises
    
    func getUnmappedExercises(
        modelContext: ModelContext,
        limit: Int = 50
    ) -> [UnmappedExercise] {
        let descriptor = FetchDescriptor<UnmappedExercise>(
            sortBy: [
                SortDescriptor(\.count, order: .reverse),
                SortDescriptor(\.lastSeen, order: .reverse)
            ]
        )
        
        let all = (try? modelContext.fetch(descriptor)) ?? []
        return Array(all.prefix(limit))
    }
    
    // MARK: - Get Most Common Unmapped
    
    func getMostCommonUnmapped(
        modelContext: ModelContext,
        limit: Int = 10
    ) -> [UnmappedExercise] {
        let descriptor = FetchDescriptor<UnmappedExercise>(
            sortBy: [SortDescriptor(\.count, order: .reverse)]
        )
        
        let all = (try? modelContext.fetch(descriptor)) ?? []
        return Array(all.prefix(limit))
    }
    
    // MARK: - Sync to Server
    
    func syncToServer(
        modelContext: ModelContext
    ) async throws {
        let unmapped = getUnmappedExercises(modelContext: modelContext, limit: 100)
        
        for exercise in unmapped {
            try await APIService.shared.reportUnmappedExercise(
                aiName: exercise.aiName,
                suggestedMatch: exercise.suggestedMatch,
                count: exercise.count
            )
        }
    }
}


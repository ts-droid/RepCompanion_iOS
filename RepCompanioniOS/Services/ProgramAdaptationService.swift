import Foundation
import SwiftData
import Combine

/// Service for adapting workout programs between different gyms using internal logic
@MainActor
class ProgramAdaptationService: ObservableObject {
    static let shared = ProgramAdaptationService()
    
    private init() {}
    
    /// Adapts the active program from a source gym to a target gym's equipment
    func adaptProgram(
        userId: String,
        sourceGymId: String?,
        targetGymId: String,
        modelContext: ModelContext
    ) async throws {
        print("[ProgramAdaptation] 🔄 Adapting program from \(sourceGymId ?? "Global") to \(targetGymId)")
        
        // 1. Fetch source templates
        let sourceDescriptor = FetchDescriptor<ProgramTemplate>(
            predicate: #Predicate { $0.userId == userId && $0.gymId == sourceGymId }
        )
        let sourceTemplates = try modelContext.fetch(sourceDescriptor)
        
        if sourceTemplates.isEmpty {
            print("[ProgramAdaptation] ⚠️ No source templates found to adapt.")
            return
        }
        
        // 2. Clear existing templates for the target gym
        let targetDescriptor = FetchDescriptor<ProgramTemplate>(
            predicate: #Predicate { $0.userId == userId && $0.gymId == targetGymId }
        )
        let existingTargetTemplates = try modelContext.fetch(targetDescriptor)
        for template in existingTargetTemplates {
            modelContext.delete(template)
        }
        
        // 3. Get target gym equipment
        let gymDescriptor = FetchDescriptor<Gym>(
            predicate: #Predicate { $0.id == targetGymId }
        )
        guard let targetGym = try modelContext.fetch(gymDescriptor).first else {
            print("[ProgramAdaptation] ❌ Target gym not found.")
            return
        }
        let targetEquipment = Set(targetGym.equipmentIds)
        
        // 4. Copy and adapt templates
        for sourceTemplate in sourceTemplates {
            let newTemplate = ProgramTemplate(
                userId: userId,
                gymId: targetGymId,
                templateName: sourceTemplate.templateName,
                muscleFocus: sourceTemplate.muscleFocus,
                dayOfWeek: sourceTemplate.dayOfWeek,
                estimatedDurationMinutes: sourceTemplate.estimatedDurationMinutes,
                warmupDescription: sourceTemplate.warmupDescription
            )
            modelContext.insert(newTemplate)
            
            // Adapt exercises
            var newExercises: [ProgramTemplateExercise] = []
            let sourceExercises = sourceTemplate.exercises.sorted { $0.orderIndex < $1.orderIndex }
            
            for sourceEx in sourceExercises {
                // Check if equipment is available
                let needsEquipment = sourceEx.requiredEquipment
                let isAvailable = needsEquipment.allSatisfy { targetEquipment.contains($0) }
                
                if isAvailable {
                    // Copy exactly
                    let newEx = copyExercise(sourceEx, template: newTemplate, gymId: targetGymId)
                    modelContext.insert(newEx)
                    newExercises.append(newEx)
                } else {
                    // Find alternative
                    print("[ProgramAdaptation] 🔍 Finding alternative for \(sourceEx.exerciseName) (Needs: \(needsEquipment.joined(separator: ", ")))")
                    if let alternative = await findAlternative(for: sourceEx, availableEquipment: targetEquipment, modelContext: modelContext) {
                        print("[ProgramAdaptation] ✅ Found alternative: \(alternative.name)")
                        let newEx = ProgramTemplateExercise(
                            gymId: targetGymId,
                            exerciseKey: alternative.id,
                            exerciseName: alternative.name,
                            orderIndex: sourceEx.orderIndex,
                            targetSets: sourceEx.targetSets,
                            targetReps: sourceEx.targetReps,
                            targetWeight: calculateAdaptedWeight(sourceWeight: sourceEx.targetWeight, sourceEx: sourceEx, targetEx: alternative),
                            requiredEquipment: alternative.requiredEquipment,
                            muscles: alternative.primaryMuscles,
                            notes: "Adapted from \(sourceEx.exerciseName)"
                        )
                        newEx.template = newTemplate
                        modelContext.insert(newEx)
                        newExercises.append(newEx)
                    } else {
                        // Fallback: Copy anyway but add a note (or skip? let's copy and note)
                        print("[ProgramAdaptation] ⚠️ No alternative found for \(sourceEx.exerciseName). Keeping original with note.")
                        let newEx = copyExercise(sourceEx, template: newTemplate, gymId: targetGymId)
                        newEx.notes = (newEx.notes ?? "") + " (⚠️ Utrustning saknas)"
                        modelContext.insert(newEx)
                        newExercises.append(newEx)
                    }
                }
            }
            newTemplate.exercises = newExercises
        }
        
        try modelContext.save()
        print("[ProgramAdaptation] ✅ Program adaptation completed.")
    }
    
    private func copyExercise(_ source: ProgramTemplateExercise, template: ProgramTemplate, gymId: String) -> ProgramTemplateExercise {
        let newEx = ProgramTemplateExercise(
            gymId: gymId,
            exerciseKey: source.exerciseKey,
            exerciseName: source.exerciseName,
            orderIndex: source.orderIndex,
            targetSets: source.targetSets,
            targetReps: source.targetReps,
            targetWeight: source.targetWeight,
            requiredEquipment: source.requiredEquipment,
            muscles: source.muscles,
            notes: source.notes
        )
        newEx.template = template
        return newEx
    }
    
    private func findAlternative(
        for sourceEx: ProgramTemplateExercise,
        availableEquipment: Set<String>,
        modelContext: ModelContext
    ) async -> ExerciseCatalog? {
        // Search criteria:
        // 1. Same muscle groups (primaryMuscles)
        // 2. Equipment must be available
        // 3. Prefer same category
        
        let primaryMuscle = sourceEx.muscles.first
        
        let descriptor = FetchDescriptor<ExerciseCatalog>()
        guard let allExercises = try? modelContext.fetch(descriptor) else { return nil }
        
        let alternatives = allExercises.filter { ex in
            // Must not be the same exercise
            if ex.name == sourceEx.exerciseName { return false }
            
            // Check muscle overlap
            let muscleOverlap = !Set(ex.primaryMuscles).isDisjoint(with: Set(sourceEx.muscles))
            if !muscleOverlap { return false }
            
            // Check equipment
            let exEquipment = Set(ex.requiredEquipment)
            if !exEquipment.isSubset(of: availableEquipment) { return false }
            
            return true
        }
        
        // Sort by relevance
        // 1. Same muscle
        // 2. Category match
        // 3. Simplicity (prefer bodyweight if multiple options?)
        
        return alternatives.sorted { a, b in
            let aMuscleMatch = a.primaryMuscles.contains(primaryMuscle ?? "")
            let bMuscleMatch = b.primaryMuscles.contains(primaryMuscle ?? "")
            if aMuscleMatch != bMuscleMatch { return aMuscleMatch }
            
            return a.name < b.name
        }.first
    }
    
    private func calculateAdaptedWeight(sourceWeight: Double?, sourceEx: ProgramTemplateExercise, targetEx: ExerciseCatalog) -> Double? {
        guard let weight = sourceWeight else { return nil }
        // Simple heuristic: If moving from barbell to dumbbell, reduce weight?
        // Or if moving to bodyweight, nil.
        if targetEx.requiredEquipment.isEmpty || targetEx.requiredEquipment.contains("Bodyweight") {
            return nil
        }
        
        // For now, keep the same weight and let the user adjust
        return weight
    }
}

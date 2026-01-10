import Foundation
import SwiftData
import Combine

/// Service for syncing exercise catalog and equipment from server
@MainActor
class ExerciseCatalogService: ObservableObject {
    static let shared = ExerciseCatalogService()
    
    @Published var isLoading = false
    @Published var lastSyncDate: Date?
    
    private init() {}
    
    // MARK: - Sync Exercises
    
    func syncExercises(modelContext: ModelContext) async throws {
        isLoading = true
        defer { isLoading = false }
        
        // Fetch exercises from server
        let exercises = try await APIService.shared.fetchExerciseCatalog()
        
        // Clear existing exercises
        let descriptor = FetchDescriptor<ExerciseCatalog>()
        let existing = try modelContext.fetch(descriptor)
        for exercise in existing {
            modelContext.delete(exercise)
        }
        
        // Insert new exercises
        for exerciseData in exercises {
            let exercise = ExerciseCatalog(
                id: exerciseData.id,
                name: exerciseData.name,
                nameEn: exerciseData.nameEn,
                exerciseDescription: exerciseData.description,
                category: exerciseData.category,
                difficulty: exerciseData.difficulty,
                primaryMuscles: exerciseData.primaryMuscles,
                secondaryMuscles: exerciseData.secondaryMuscles ?? [],
                requiredEquipment: exerciseData.requiredEquipment ?? [],
                movementPattern: exerciseData.movementPattern,
                isCompound: exerciseData.isCompound,
                youtubeUrl: exerciseData.youtubeUrl,
                videoType: exerciseData.videoType,
                instructions: exerciseData.instructions,
                createdAt: exerciseData.createdAt
            )
            modelContext.insert(exercise)
        }
        
        try modelContext.save()
        lastSyncDate = Date()
    }
    
    // MARK: - Sync Equipment Catalog
    
    func syncEquipmentCatalog(modelContext: ModelContext) async throws {
        let syncStartTime = Date()
        isLoading = true
        defer { isLoading = false }
        
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print("[ExerciseCatalogService] 🔄 STARTING EQUIPMENT CATALOG SYNC")
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        
        // Fetch equipment from server
        print("[ExerciseCatalogService] 📡 Calling APIService.shared.fetchEquipmentCatalog()...")
        let fetchStartTime = Date()
        let equipment = try await APIService.shared.fetchEquipmentCatalog()
        let fetchDuration = Date().timeIntervalSince(fetchStartTime)
        print("[ExerciseCatalogService] ⏱️  Fetch completed in \(String(format: "%.2f", fetchDuration)) seconds")
        print("[ExerciseCatalogService] ✅ Fetched \(equipment.count) equipment items from server")
        
        if equipment.isEmpty {
            print("[ExerciseCatalogService] ⚠️ WARNING: Server returned empty equipment list!")
        } else {
            print("[ExerciseCatalogService] 📋 First 5 items:")
            for (index, item) in equipment.prefix(5).enumerated() {
                print("  \(index + 1). \(item.name) (id: \(item.id), category: \(item.category))")
            }
        }
        
        // Get existing equipment for upsert logic
        let descriptor = FetchDescriptor<EquipmentCatalog>()
        let existing = try modelContext.fetch(descriptor)
        let existingById = Dictionary(uniqueKeysWithValues: existing.map { ($0.id, $0) })
        
        print("[ExerciseCatalogService] 📊 Found \(existing.count) existing equipment items in database")
        
        // Upsert: Update existing or insert new
        var updatedCount = 0
        var insertedCount = 0
        var processedIds = Set<String>()
        
        for equipmentData in equipment {
            processedIds.insert(equipmentData.id)
            
            if let existingItem = existingById[equipmentData.id] {
                // Update existing item
                existingItem.name = equipmentData.name
                existingItem.nameEn = equipmentData.nameEn
                existingItem.category = equipmentData.category
                existingItem.type = equipmentData.type
                existingItem.equipmentDescription = equipmentData.description
                existingItem.createdAt = equipmentData.createdAt
                updatedCount += 1
            } else {
                // Insert new item
                let catalogItem = EquipmentCatalog(
                    id: equipmentData.id,
                    name: equipmentData.name,
                    nameEn: equipmentData.nameEn,
                    category: equipmentData.category,
                    type: equipmentData.type,
                    equipmentDescription: equipmentData.description,
                    createdAt: equipmentData.createdAt
                )
                modelContext.insert(catalogItem)
                insertedCount += 1
            }
        }
        
        // Delete items that no longer exist on server (but keep them if server sync fails)
        // Only delete if we successfully processed all items from server
        if equipment.count > 0 {
            let itemsToDelete = existing.filter { !processedIds.contains($0.id) }
            if !itemsToDelete.isEmpty {
                print("[ExerciseCatalogService] 🗑️ Deleting \(itemsToDelete.count) obsolete equipment items...")
                for item in itemsToDelete {
                    modelContext.delete(item)
                }
            }
        }
        
        print("[ExerciseCatalogService] 💾 Updated \(updatedCount) and inserted \(insertedCount) equipment items...")
        print("[ExerciseCatalogService] 📊 Processed IDs: \(processedIds.count) unique items")
        
        print("[ExerciseCatalogService] 💾 Saving to database...")
        let saveStartTime = Date()
        try modelContext.save()
        let saveDuration = Date().timeIntervalSince(saveStartTime)
        print("[ExerciseCatalogService] ⏱️  Save completed in \(String(format: "%.2f", saveDuration)) seconds")
        
        // Verify what's in database now
        let verifyDescriptor = FetchDescriptor<EquipmentCatalog>()
        if let savedEquipment = try? modelContext.fetch(verifyDescriptor) {
            print("[ExerciseCatalogService] ✅ Verification: \(savedEquipment.count) items now in database")
        }
        
        let totalDuration = Date().timeIntervalSince(syncStartTime)
        print("[ExerciseCatalogService] ⏱️  Total sync time: \(String(format: "%.2f", totalDuration)) seconds")
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print("[ExerciseCatalogService] ✅ EQUIPMENT CATALOG SYNC COMPLETED SUCCESSFULLY")
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        
        lastSyncDate = Date()
    }
    
    // MARK: - Get Exercise by Name
    
    func getExercise(by name: String, modelContext: ModelContext) -> ExerciseCatalog? {
        let descriptor = FetchDescriptor<ExerciseCatalog>(
            predicate: #Predicate { $0.name == name }
        )
        return try? modelContext.fetch(descriptor).first
    }
    
    // MARK: - Get Video URL
    
    func getVideoURL(for exerciseName: String, modelContext: ModelContext) -> String? {
        return getExercise(by: exerciseName, modelContext: modelContext)?.youtubeUrl
    }
    
    // MARK: - Search Exercises
    
    func searchExercises(
        query: String,
        category: String? = nil,
        equipment: [String]? = nil,
        modelContext: ModelContext
    ) -> [ExerciseCatalog] {
        var predicate: Predicate<ExerciseCatalog>?
        
        if let category = category {
            predicate = #Predicate { exercise in
                exercise.name.localizedStandardContains(query) &&
                exercise.category == category
            }
        } else {
            predicate = #Predicate { exercise in
                exercise.name.localizedStandardContains(query) ||
                (exercise.nameEn?.localizedStandardContains(query) ?? false)
            }
        }
        
        let descriptor = FetchDescriptor<ExerciseCatalog>(
            predicate: predicate,
            sortBy: [SortDescriptor(\.name)]
        )
        
        guard let exercises = try? modelContext.fetch(descriptor) else {
            return []
        }
        
        // Filter by equipment if provided
        if let equipment = equipment, !equipment.isEmpty {
            return exercises.filter { exercise in
                !Set(exercise.requiredEquipment).isDisjoint(with: Set(equipment))
            }
        }
        
        return exercises
    }
    
    // MARK: - Get Exercises by Category
    
    func getExercises(by category: String, modelContext: ModelContext) -> [ExerciseCatalog] {
        let descriptor = FetchDescriptor<ExerciseCatalog>(
            predicate: #Predicate { $0.category == category },
            sortBy: [SortDescriptor(\.name)]
        )
        return (try? modelContext.fetch(descriptor)) ?? []
    }
    
    // MARK: - Get Exercises by Equipment
    
    func getExercises(for equipment: [String], modelContext: ModelContext) -> [ExerciseCatalog] {
        let descriptor = FetchDescriptor<ExerciseCatalog>()
        guard let allExercises = try? modelContext.fetch(descriptor) else {
            return []
        }
        
        let equipmentSet = Set(equipment)
        return allExercises.filter { exercise in
            !Set(exercise.requiredEquipment).isDisjoint(with: equipmentSet)
        }
    }
}

// MARK: - API Response Models

struct ExerciseCatalogResponse: Codable {
    let id: String
    let name: String
    let nameEn: String?
    let description: String?
    let category: String
    let difficulty: String
    let primaryMuscles: [String]
    let secondaryMuscles: [String]?
    let requiredEquipment: [String]?
    let movementPattern: String?
    let isCompound: Bool
    let youtubeUrl: String?
    let videoType: String?
    let instructions: String?
    let createdAt: Date
}

// EquipmentCatalogResponse is defined in APIService.swift (canonical)

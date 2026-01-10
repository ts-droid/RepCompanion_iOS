import Foundation
import SwiftData
import Combine

/// Service for managing gym-specific programs
@MainActor
class GymProgramService: ObservableObject {
    static let shared = GymProgramService()
    
    private init() {}
    
    // MARK: - Get Gym Program
    
    func getGymProgram(
        userId: String,
        gymId: String,
        modelContext: ModelContext
    ) -> GymProgram? {
        let descriptor = FetchDescriptor<GymProgram>(
            predicate: #Predicate { program in
                program.userId == userId &&
                program.gymId == gymId
            }
        )
        return try? modelContext.fetch(descriptor).first
    }
    
    // MARK: - Create/Update Gym Program
    
    func saveGymProgram(
        userId: String,
        gymId: String,
        programData: [String: Any],
        templateSnapshot: [String: Any]? = nil,
        modelContext: ModelContext
    ) throws {
        // Check if program exists
        var program = getGymProgram(userId: userId, gymId: gymId, modelContext: modelContext)
        
        if program == nil {
            program = GymProgram(
                id: UUID().uuidString,
                userId: userId,
                gymId: gymId,
                programData: try JSONSerialization.data(withJSONObject: programData)
            )
            modelContext.insert(program!)
        } else {
            program!.programData = try JSONSerialization.data(withJSONObject: programData)
            program!.updatedAt = Date()
        }
        
        // Save template snapshot if provided
        if let snapshot = templateSnapshot {
            program!.templateSnapshot = try JSONSerialization.data(withJSONObject: snapshot)
            program!.snapshotCreatedAt = Date()
        }
        
        try modelContext.save()
    }
    
    // MARK: - Get Program Data
    
    func getProgramData(
        userId: String,
        gymId: String,
        modelContext: ModelContext
    ) -> [String: Any]? {
        guard let program = getGymProgram(userId: userId, gymId: gymId, modelContext: modelContext) else {
            return nil
        }
        
        return try? JSONSerialization.jsonObject(with: program.programData) as? [String: Any]
    }
    
    func getTemplateSnapshot(
        userId: String,
        gymId: String,
        modelContext: ModelContext
    ) -> [String: Any]? {
        guard let program = getGymProgram(userId: userId, gymId: gymId, modelContext: modelContext),
              let snapshotData = program.templateSnapshot else {
            return nil
        }
        
        return try? JSONSerialization.jsonObject(with: snapshotData) as? [String: Any]
    }
    
    // MARK: - Sync from Server
    
    func syncGymPrograms(
        userId: String,
        modelContext: ModelContext
    ) async throws {
        // Fetch from server
        let programs = try await APIService.shared.fetchGymPrograms(userId: userId)
        
        for programData in programs {
            let descriptor = FetchDescriptor<GymProgram>(
                predicate: #Predicate { program in
                    program.id == programData.id
                }
            )
            
            var program = try? modelContext.fetch(descriptor).first
            
            // Convert dictionaries to Data
            let programDataJSON = try JSONSerialization.data(withJSONObject: programData.programDataDict)
            let snapshotJSON = programData.templateSnapshotDict != nil ? try JSONSerialization.data(withJSONObject: programData.templateSnapshotDict!) : nil
            
            if program == nil {
                program = GymProgram(
                    id: programData.id,
                    userId: programData.userId,
                    gymId: programData.gymId,
                    programData: programDataJSON,
                    templateSnapshot: snapshotJSON,
                    snapshotCreatedAt: programData.snapshotCreatedAt,
                    createdAt: programData.createdAt,
                    updatedAt: programData.updatedAt
                )
                modelContext.insert(program!)
            } else {
                program!.programData = programDataJSON
                if let snapshot = snapshotJSON {
                    program!.templateSnapshot = snapshot
                }
                program!.updatedAt = programData.updatedAt
            }
        }
        
        try modelContext.save()
    }
}


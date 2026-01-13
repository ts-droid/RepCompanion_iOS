import Foundation
import SwiftData
import Combine

/// Service for managing user gyms and equipment
@MainActor
class GymService: ObservableObject {
    static let shared = GymService()
    
    @Published var isLoading = false
    @Published var errorMessage: String?
    
    private init() {}
    
    // MARK: - Fetch Gyms
    
    func fetchUserGyms(userId: String) -> [Gym] {
        // Since we are using SwiftData, this is mostly for convenience
        // Views should use @Query where possible
        return [] 
    }
    
    // MARK: - Create Gym
    
    func createGym(
        name: String,
        location: String?,
        latitude: Double? = nil,
        longitude: Double? = nil,
        equipmentIds: [String],
        isPublic: Bool = false,
        userId: String,
        modelContext: ModelContext
    ) async throws -> Gym {
        // Build coordinate strings if present
        let latStr = latitude != nil ? String(format: "%.6f", latitude!) : nil
        let lonStr = longitude != nil ? String(format: "%.6f", longitude!) : nil
        
        var serverId: String?
        
        // Sync to server if public
        if isPublic {
            do {
                let response = try await APIService.shared.createGym(
                    name: name,
                    location: location,
                    latitude: latStr,
                    longitude: lonStr,
                    equipmentIds: equipmentIds,
                    isPublic: true
                )
                serverId = response.id
            } catch {
                print("Failed to sync public gym to server: \(error)")
                // we still save locally
            }
        }
        
        // Create new gym
        let gym = Gym(
            id: serverId ?? UUID().uuidString,
            name: name,
            location: location,
            latitude: latitude,
            longitude: longitude,
            equipmentIds: equipmentIds,
            isPublic: isPublic,
            userId: userId
        )
        
        // If this is the first gym, select it automatically logic handled by caller or here?
        // Let's verify if any other gyms exist for this user first
        let descriptor = FetchDescriptor<Gym>(
            predicate: #Predicate { $0.userId == userId }
        )
        
        let existingGyms = (try? modelContext.fetch(descriptor)) ?? []
        if existingGyms.isEmpty {
            gym.isSelected = true
            updateSelectedGymInProfile(gymId: gym.id, userId: userId, modelContext: modelContext)
        }
        
        modelContext.insert(gym)
        try? modelContext.save()
        
        return gym
    }
    
    // MARK: - Update Gym
    
    func updateGym(
        gym: Gym,
        name: String,
        location: String?,
        latitude: Double?,
        longitude: Double?,
        equipmentIds: [String],
        isPublic: Bool,
        modelContext: ModelContext
    ) async throws {
        // Sync to server if public (or becoming public)
        if isPublic {
            let latStr = latitude != nil ? String(format: "%.6f", latitude!) : nil
            let lonStr = longitude != nil ? String(format: "%.6f", longitude!) : nil
            
            do {
                _ = try await APIService.shared.updateGym(
                    id: gym.id,
                    name: name,
                    location: location,
                    latitude: latStr,
                    longitude: lonStr,
                    equipmentIds: equipmentIds,
                    isPublic: true
                )
            } catch {
                print("Failed to sync gym update to server: \(error)")
            }
        }
        
        gym.name = name
        gym.location = location
        gym.latitude = latitude
        gym.longitude = longitude
        gym.equipmentIds = equipmentIds
        gym.isPublic = isPublic
        gym.updatedAt = Date()
        
        try? modelContext.save()
    }
    
    // MARK: - Delete Gym
    
    func deleteGym(gym: Gym, modelContext: ModelContext) {
        // If deleting selected gym, select another one if available
        if gym.isSelected {
            let userId = gym.userId
            let gymID = gym.id
            let descriptor = FetchDescriptor<Gym>(
                predicate: #Predicate { $0.userId == userId && $0.id != gymID }
            )
            
            if let nextGym = try? modelContext.fetch(descriptor).first {
                selectGym(gym: nextGym, modelContext: modelContext)
            } else {
                // No more gyms, clear selection in profile
                 updateSelectedGymInProfile(gymId: nil, userId: userId, modelContext: modelContext)
            }
        }
        
        modelContext.delete(gym)
        try? modelContext.save()
    }
    
    // MARK: - Select Gym
    
    func selectGym(gym: Gym, modelContext: ModelContext) {
        let userId = gym.userId
        
        // Deselect all others
        let descriptor = FetchDescriptor<Gym>(
            predicate: #Predicate { $0.userId == userId }
        )
        
        if let userGyms = try? modelContext.fetch(descriptor) {
            for g in userGyms {
                g.isSelected = (g.id == gym.id)
            }
        }
        
        // Update profile
        updateSelectedGymInProfile(gymId: gym.id, userId: userId, modelContext: modelContext)
        
        try? modelContext.save()
    }
    
    // MARK: - Helper
    
    private func updateSelectedGymInProfile(gymId: String?, userId: String, modelContext: ModelContext) {
        let descriptor = FetchDescriptor<UserProfile>(
            predicate: #Predicate { $0.userId == userId }
        )
        
        if let profile = try? modelContext.fetch(descriptor).first {
            profile.selectedGymId = gymId
            profile.updatedAt = Date()
        }
    }
}

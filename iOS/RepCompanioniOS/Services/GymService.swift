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
        isVerified: Bool = false,
        userId: String,
        modelContext: ModelContext
    ) async throws -> Gym {
        let normalizedName = name.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let normalizedLocation = (location ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let existingDescriptor = FetchDescriptor<Gym>(
            predicate: #Predicate { $0.userId == userId }
        )
        let existingGyms = (try? modelContext.fetch(existingDescriptor)) ?? []
        if let existing = existingGyms.first(where: {
            $0.name.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == normalizedName &&
            ($0.location ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == normalizedLocation
        }) {
            // Ensure selection updated if needed
            if existing.isSelected == false {
                selectGym(gym: existing, modelContext: modelContext)
            }
            return existing
        }
        // Build coordinate strings if present
        let latStr = latitude != nil ? String(format: "%.6f", latitude!) : nil
        let lonStr = longitude != nil ? String(format: "%.6f", longitude!) : nil
        
        var serverId: String?
        
        // Sync to server (private or public)
        do {
            let response = try await APIService.shared.createGym(
                name: name,
                location: location,
                latitude: latStr,
                longitude: lonStr,
                equipmentIds: equipmentIds,
                isPublic: isPublic,
                isVerified: isVerified
            )
            serverId = response.id
        } catch {
            print("Failed to sync gym to server: \(error)")
            // we still save locally
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
            isVerified: isVerified,
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

        // Persist equipment to server for this gym (if we have a server id)
        if let serverGymId = serverId, !equipmentIds.isEmpty {
            for equipmentName in equipmentIds {
                do {
                    _ = try await APIService.shared.addEquipment(
                        gymId: serverGymId,
                        equipmentType: "gym",
                        equipmentName: equipmentName
                    )
                } catch {
                    print("Failed to sync equipment '\(equipmentName)' for gym \(serverGymId): \(error)")
                }
            }
        }
        
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

    // MARK: - Cleanup
    
    func cleanupDuplicateGyms(userId: String, modelContext: ModelContext) async {
        let gymsDescriptor = FetchDescriptor<Gym>(
            predicate: #Predicate { $0.userId == userId }
        )
        let userGyms = (try? modelContext.fetch(gymsDescriptor)) ?? []
        guard userGyms.count > 1 else { return }
        
        // Group by normalized name + location
        var groups: [String: [Gym]] = [:]
        for gym in userGyms {
            let key = "\(gym.name.trimmingCharacters(in: .whitespacesAndNewlines).lowercased())|\((gym.location ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased())"
            groups[key, default: []].append(gym)
        }
        
        let profileDescriptor = FetchDescriptor<UserProfile>(
            predicate: #Predicate { $0.userId == userId }
        )
        let profile = try? modelContext.fetch(profileDescriptor).first
        let selectedGymId = profile?.selectedGymId
        
        for (_, gyms) in groups where gyms.count > 1 {
            // Pick keeper
            let keeper = gyms.sorted {
                if $0.id == selectedGymId { return true }
                if $1.id == selectedGymId { return false }
                if $0.isVerified != $1.isVerified { return $0.isVerified }
                if $0.equipmentIds.count != $1.equipmentIds.count { return $0.equipmentIds.count > $1.equipmentIds.count }
                return $0.updatedAt > $1.updatedAt
            }.first!
            
            // Move equipment from duplicates to keeper
            let equipmentDescriptor = FetchDescriptor<UserEquipment>(
                predicate: #Predicate { $0.userId == userId }
            )
            let allEquipment = (try? modelContext.fetch(equipmentDescriptor)) ?? []
            
            for duplicate in gyms where duplicate.id != keeper.id {
                for item in allEquipment where item.gymId == duplicate.id {
                    item.gymId = keeper.id
                }
                
                keeper.equipmentIds = Array(Set(keeper.equipmentIds + duplicate.equipmentIds))
                
                if profile?.selectedGymId == duplicate.id {
                    profile?.selectedGymId = keeper.id
                }
                
                // Delete duplicate locally
                modelContext.delete(duplicate)
                
                // Best-effort delete on server
                try? await APIService.shared.deleteGym(id: duplicate.id)
            }
        }
        
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

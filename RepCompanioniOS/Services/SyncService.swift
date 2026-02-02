import Foundation
import SwiftData
import Combine

/// Service for syncing data from backend to local SwiftData store
@MainActor
class SyncService: ObservableObject {
    static let shared = SyncService()
    
    @Published var isSyncing = false
    @Published var syncProgress: Double = 0.0
    @Published var lastSyncDate: Date?
    
    private let apiService = APIService.shared
    
    private init() {}
    
    // MARK: - Full Sync
    
    /// Syncs all user data from backend to local SwiftData store
    func syncAllData(userId: String, modelContext: ModelContext) async throws {
        isSyncing = true
        syncProgress = 0.0
        
        defer {
            isSyncing = false
            syncProgress = 1.0
            lastSyncDate = Date()
        }
        
        do {
            // 1. Sync user profile (10%)
            syncProgress = 0.1
            try await syncUserProfile(userId: userId, modelContext: modelContext)
            
            // 2. Sync program templates (30%)
            syncProgress = 0.3
            try await syncProgramTemplates(userId: userId, modelContext: modelContext)
            
            // 3. Sync workout sessions (50%)
            syncProgress = 0.5
            try await syncWorkoutSessions(userId: userId, modelContext: modelContext)
            
            // 4. Sync gyms and equipment (70%)
            syncProgress = 0.7
            try await syncGymsAndEquipment(userId: userId, modelContext: modelContext)
            
            // 5. Sync training tips (85%)
            syncProgress = 0.85
            try await syncTrainingTips(modelContext: modelContext)
            
            // 6. Sync exercise catalog (95%)
            syncProgress = 0.95
            try await syncExerciseCatalog(modelContext: modelContext)
            
            syncProgress = 1.0
        } catch {
            print("Error syncing data: \(error)")
            throw error
        }
    }
    
    // MARK: - Individual Sync Methods
    
    func syncUserProfile(userId: String, modelContext: ModelContext) async throws {
        // Fetch profile from API
        let profileData = try await apiService.fetchUserProfile()
        
        // Check if profile exists locally
        let descriptor = FetchDescriptor<UserProfile>(
            predicate: #Predicate { $0.userId == userId }
        )
        let existingProfiles = try modelContext.fetch(descriptor)
        
        if let existing = existingProfiles.first {
            // Update existing profile
            updateProfile(existing, with: profileData)
        } else {
            // Create new profile
            let profile = createProfile(from: profileData, userId: userId)
            modelContext.insert(profile)
        }
        
        try modelContext.save()
    }
    
    func syncProgramTemplates(userId: String, modelContext: ModelContext) async throws {
        print("[SYNC] 🔄 Starting template sync for user: \(userId)")
        
        // Fetch templates from API
        var templatesData: [ProgramTemplateResponse]
        do {
            templatesData = try await apiService.fetchProgramTemplates()
            print("[SYNC] ✅ Fetched \(templatesData.count) templates from API")
        } catch let error as URLError {
            print("[SYNC] ❌ Network error: \(error.localizedDescription)")
            print("[SYNC] ❌ Error code: \(error.code.rawValue)")
            print("[SYNC] ❌ Failed to connect to server - is it running on port 5001?")
            print("[SYNC] ❌ URL error details:")
            print("[SYNC]    - Code: \(error.code)")
            if let url = error.failingURL {
                print("[SYNC]    - Failed URL: \(url)")
            }
            throw error
        } catch {
            print("[SYNC] ❌ Error fetching templates from API: \(error.localizedDescription)")
            print("[SYNC] ❌ Error type: \(type(of: error))")
            if let nsError = error as NSError? {
                print("[SYNC] ❌ NSError domain: \(nsError.domain)")
                print("[SYNC] ❌ NSError code: \(nsError.code)")
                print("[SYNC] ❌ NSError userInfo: \(nsError.userInfo)")
            }
            throw error
        }
        
        if templatesData.isEmpty {
            print("[SYNC] ⚠️ No templates returned from API - server may still be generating")
            print("[SYNC] ⚠️ This is normal during program generation, continuing to poll...")
            // Don't throw error - allow calling code to continue polling
            return
        }

        // Get current gym ID from profile
        let profileDescriptor = FetchDescriptor<UserProfile>(predicate: #Predicate { $0.userId == userId })
        let profile = try? modelContext.fetch(profileDescriptor).first
        let activeGymId = profile?.selectedGymId

        // SAFE UPSERT: Fetch existing templates BEFORE making any changes
        let descriptor = FetchDescriptor<ProgramTemplate>(
            predicate: #Predicate { $0.userId == userId && $0.gymId == activeGymId }
        )
        let existingTemplates = try modelContext.fetch(descriptor)

        // Create lookup maps for efficient upsert
        let newTemplateIds = Set(templatesData.map { $0.id })
        var existingTemplateMap: [String: ProgramTemplate] = [:]
        for template in existingTemplates {
            existingTemplateMap[template.id.uuidString] = template
        }

        print("[SYNC] 🔄 Starting safe upsert: \(existingTemplates.count) existing, \(templatesData.count) from API")

        // Step 1: Delete templates that no longer exist on server (safe - data is gone from server anyway)
        for template in existingTemplates {
            if !newTemplateIds.contains(template.id.uuidString) {
                print("[SYNC] 🗑️ Removing obsolete template: \(template.templateName)")
                modelContext.delete(template)
            }
        }

        // Step 2: Upsert - update existing or create new
        for templateData in templatesData {
            if let existingTemplate = existingTemplateMap[templateData.id] {
                // UPDATE existing template
                print("[SYNC] 📝 Updating existing template: \(templateData.templateName)")
                updateTemplate(existingTemplate, with: templateData)

                // Update exercises - remove old ones for this template and add new
                for exercise in existingTemplate.exercises {
                    modelContext.delete(exercise)
                }

                var templateExercises: [ProgramTemplateExercise] = []
                var insertedDescriptions = Set<String>()

                for exerciseData in templateData.exercises ?? [] {
                    let uniqueKey = "\(exerciseData.exerciseName.lowercased())-\(exerciseData.orderIndex)"

                    if !insertedDescriptions.contains(uniqueKey) {
                        let exercise = createTemplateExercise(from: exerciseData, template: existingTemplate)
                        exercise.gymId = activeGymId
                        modelContext.insert(exercise)
                        templateExercises.append(exercise)
                        insertedDescriptions.insert(uniqueKey)
                    }
                }
                existingTemplate.exercises = templateExercises

            } else {
                // CREATE new template
                print("[SYNC] ➕ Creating new template: \(templateData.templateName)")
                let template = createTemplate(from: templateData, userId: userId)
                template.gymId = activeGymId
                modelContext.insert(template)

                var templateExercises: [ProgramTemplateExercise] = []
                var insertedDescriptions = Set<String>()

                for exerciseData in templateData.exercises ?? [] {
                    let uniqueKey = "\(exerciseData.exerciseName.lowercased())-\(exerciseData.orderIndex)"

                    if !insertedDescriptions.contains(uniqueKey) {
                        let exercise = createTemplateExercise(from: exerciseData, template: template)
                        exercise.gymId = activeGymId
                        modelContext.insert(exercise)
                        templateExercises.append(exercise)
                        insertedDescriptions.insert(uniqueKey)
                    }
                }
                template.exercises = templateExercises
            }
        }

        // Step 3: Save all changes in one transaction
        do {
            try modelContext.save()
            print("[SYNC] ✅ Successfully synced \(templatesData.count) templates to local database")

            // Verify templates were saved
            let verifyDescriptor = FetchDescriptor<ProgramTemplate>(
                predicate: #Predicate { $0.userId == userId && $0.gymId == activeGymId }
            )
            let savedTemplates = try modelContext.fetch(verifyDescriptor)
            print("[SYNC] ✅ Verification: \(savedTemplates.count) templates now in local database for current gym")
        } catch {
            print("[SYNC] ❌ Error saving templates to database: \(error.localizedDescription)")
            throw error
        }
    }
    
    private func syncWorkoutSessions(userId: String, modelContext: ModelContext) async throws {
        // Fetch sessions from API
        let sessionsData = try await apiService.fetchWorkoutSessions()
        
        // Get existing sessions
        let descriptor = FetchDescriptor<WorkoutSession>(
            predicate: #Predicate { $0.userId == userId }
        )
        let existingSessions = try modelContext.fetch(descriptor)
        
        // Create a map of existing sessions by ID
        var existingMap: [String: WorkoutSession] = [:]
        for session in existingSessions {
            existingMap[session.id.uuidString] = session
        }
        
        // Update or create sessions
        for sessionData in sessionsData {
            if let existing = existingMap[sessionData.id] {
                // Update existing session
                updateSession(existing, with: sessionData)
            } else {
                // Create new session
                let session = createSession(from: sessionData, userId: userId)
                modelContext.insert(session)
            }
        }
        
        try modelContext.save()
    }
    
    func syncGymsAndEquipment(userId: String, modelContext: ModelContext) async throws {
        // Fetch gyms from API
        let gymsData = try await apiService.fetchUserGyms()
        
        // Get existing gyms
        let gymDescriptor = FetchDescriptor<Gym>(
            predicate: #Predicate { $0.userId == userId }
        )
        let existingGyms = try modelContext.fetch(gymDescriptor)
        
        // Create a map of existing gyms by ID
        var existingGymMap: [String: Gym] = [:]
        for gym in existingGyms {
            existingGymMap[gym.id] = gym
        }
        
        // Update or create gyms
        for gymData in gymsData {
            if let existing = existingGymMap[gymData.id] {
                // Update existing gym
                existing.name = gymData.name
                existing.location = gymData.location
                existing.isVerified = gymData.isVerified ?? false
            } else {
                // Create new gym
                let gym = Gym(
                    id: gymData.id,
                    name: gymData.name,
                    location: gymData.location,
                    isVerified: gymData.isVerified ?? false,
                    userId: userId
                )
                modelContext.insert(gym)
            }
        }
        
        // Fetch equipment from API
        let equipmentData = try await apiService.fetchUserEquipment()
        
        // Get existing equipment
        let equipmentDescriptor = FetchDescriptor<UserEquipment>(
            predicate: #Predicate { $0.userId == userId }
        )
        let existingEquipment = try modelContext.fetch(equipmentDescriptor)
        
        // Create a map of existing equipment by ID
        var existingEquipmentMap: [String: UserEquipment] = [:]
        for equipment in existingEquipment {
            existingEquipmentMap[equipment.id] = equipment
        }
        
        // Update or create equipment
        for equipmentData in equipmentData {
            if let existing = existingEquipmentMap[equipmentData.id] {
                // Update existing equipment
                existing.equipmentName = equipmentData.equipmentName
                existing.equipmentType = equipmentData.equipmentType
                existing.available = equipmentData.available
            } else {
                // Create new equipment
                let equipment = UserEquipment(
                    id: equipmentData.id,
                    userId: userId,
                    gymId: equipmentData.gymId,
                    equipmentType: equipmentData.equipmentType,
                    equipmentName: equipmentData.equipmentName,
                    available: equipmentData.available
                )
                modelContext.insert(equipment)
            }
        }
        
        try modelContext.save()
        
        // RECONCILE: Update Gym.equipmentIds from UserEquipment
        print("[SYNC] 🔄 Reconciling Gym equipment collections...")
        let allGyms = (try? modelContext.fetch(FetchDescriptor<Gym>(predicate: #Predicate { $0.userId == userId }))) ?? []
        let allEquipment = (try? modelContext.fetch(FetchDescriptor<UserEquipment>(predicate: #Predicate { $0.userId == userId }))) ?? []
        
        for gym in allGyms {
            let gymEquipIds = allEquipment
                .filter { $0.gymId == gym.id && $0.available }
                .map { $0.equipmentName }
            
            if !gymEquipIds.isEmpty {
                gym.equipmentIds = gymEquipIds
                print("[SYNC] ✅ Updated gym '\(gym.name)' with \(gymEquipIds.count) units of equipment")
            }
        }
        
        try modelContext.save()
    }
    
    private func syncTrainingTips(modelContext: ModelContext) async throws {
        // Use TrainingTipService to sync both general and profile-based tips
        try await TrainingTipService.shared.syncTrainingTips(modelContext: modelContext)
        try await TrainingTipService.shared.syncProfileTrainingTips(modelContext: modelContext)
    }
    
    private func syncExerciseCatalog(modelContext: ModelContext) async throws {
        // Use ExerciseCatalogService to sync catalog
        try await ExerciseCatalogService.shared.syncExercises(modelContext: modelContext)
        try await ExerciseCatalogService.shared.syncEquipmentCatalog(modelContext: modelContext)
    }
    
    // MARK: - Helper Methods
    
    private func createProfile(from data: UserProfileResponse, userId: String) -> UserProfile {
        return UserProfile(
            userId: userId,
            age: data.age,
            sex: data.sex,
            bodyWeight: data.bodyWeight,
            height: data.height,
            oneRmBench: data.oneRmBench,
            oneRmOhp: data.oneRmOhp,
            oneRmDeadlift: data.oneRmDeadlift,
            oneRmSquat: data.oneRmSquat,
            oneRmLatpull: data.oneRmLatpull,
            motivationType: data.motivationType,
            trainingLevel: data.trainingLevel,
            specificSport: data.specificSport,
            goalStrength: data.goalStrength ?? 25,
            goalVolume: data.goalVolume ?? 25,
            goalEndurance: data.goalEndurance ?? 25,
            goalCardio: data.goalCardio ?? 25,
            sessionsPerWeek: data.sessionsPerWeek ?? 3,
            sessionDuration: data.sessionDuration ?? 60,
            onboardingCompleted: data.onboardingCompleted ?? false,
            selectedGymId: data.selectedGymId
        )
    }
    
    private func updateProfile(_ profile: UserProfile, with data: UserProfileResponse) {
        profile.age = data.age
        profile.sex = data.sex
        profile.bodyWeight = data.bodyWeight
        profile.height = data.height
        profile.oneRmBench = data.oneRmBench
        profile.oneRmOhp = data.oneRmOhp
        profile.oneRmDeadlift = data.oneRmDeadlift
        profile.oneRmSquat = data.oneRmSquat
        profile.oneRmLatpull = data.oneRmLatpull
        profile.motivationType = data.motivationType
        profile.trainingLevel = data.trainingLevel
        profile.specificSport = data.specificSport
        profile.goalStrength = data.goalStrength ?? profile.goalStrength
        profile.goalVolume = data.goalVolume ?? profile.goalVolume
        profile.goalEndurance = data.goalEndurance ?? profile.goalEndurance
        profile.goalCardio = data.goalCardio ?? profile.goalCardio
        profile.sessionsPerWeek = data.sessionsPerWeek ?? profile.sessionsPerWeek
        profile.sessionDuration = data.sessionDuration ?? profile.sessionDuration
        profile.onboardingCompleted = data.onboardingCompleted ?? profile.onboardingCompleted
        profile.selectedGymId = data.selectedGymId
    }
    
    private func createTemplate(from data: ProgramTemplateResponse, userId: String) -> ProgramTemplate {
        // Use server ID if available, otherwise generate new UUID
        let templateId = UUID(uuidString: data.id) ?? UUID()
        let template = ProgramTemplate(
            id: templateId,
            userId: userId,
            templateName: data.templateName,
            muscleFocus: data.muscleFocus,
            dayOfWeek: data.dayOfWeek,
            estimatedDurationMinutes: data.estimatedDurationMinutes
        )
        return template
    }
    
    private func updateTemplate(_ template: ProgramTemplate, with data: ProgramTemplateResponse) {
        template.templateName = data.templateName
        template.muscleFocus = data.muscleFocus
        template.dayOfWeek = data.dayOfWeek
        template.estimatedDurationMinutes = data.estimatedDurationMinutes
    }
    
    private func updateTemplateExercise(_ exercise: ProgramTemplateExercise, with data: ProgramTemplateExerciseResponse) {
        exercise.exerciseKey = data.exerciseKey
        exercise.exerciseName = data.exerciseName
        exercise.orderIndex = data.orderIndex
        exercise.targetSets = data.targetSets
        exercise.targetReps = data.targetReps
        exercise.targetWeight = data.targetWeight
        exercise.requiredEquipment = data.requiredEquipment
        exercise.muscles = data.muscles
        exercise.notes = data.notes
    }
    
    private func createTemplateExercise(from data: ProgramTemplateExerciseResponse, template: ProgramTemplate) -> ProgramTemplateExercise {
        let exerciseId = UUID(uuidString: data.id) ?? UUID()
        let exercise = ProgramTemplateExercise(
            id: exerciseId,
            gymId: template.gymId,
            exerciseKey: data.exerciseKey,
            exerciseName: data.exerciseName,
            orderIndex: data.orderIndex,
            targetSets: data.targetSets,
            targetReps: data.targetReps,
            targetWeight: data.targetWeight,
            requiredEquipment: data.requiredEquipment,
            muscles: data.muscles,
            notes: data.notes
        )
        exercise.template = template
        return exercise
    }
    
    private func createSession(from data: WorkoutSessionResponse, userId: String) -> WorkoutSession {
        return WorkoutSession(
            id: UUID(uuidString: data.id) ?? UUID(),
            userId: userId,
            templateId: data.templateId != nil ? UUID(uuidString: data.templateId!) : nil,
            sessionType: data.sessionType,
            sessionName: data.sessionName,
            status: data.status,
            startedAt: data.startedAt,
            completedAt: data.completedAt
        )
    }
    
    private func updateSession(_ session: WorkoutSession, with data: WorkoutSessionResponse) {
        session.templateId = data.templateId != nil ? UUID(uuidString: data.templateId!) : nil
        session.sessionType = data.sessionType
        session.sessionName = data.sessionName
        session.status = data.status
        session.startedAt = data.startedAt
        session.completedAt = data.completedAt
    }
}

// Response models are defined in APIService.swift


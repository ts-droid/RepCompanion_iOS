import Foundation
import SwiftData

@Model
final class UserProfile {
    var id: UUID
    var userId: String
    
    // Physical metrics
    var age: Int?
    var sex: String?
    var bodyWeight: Int?
    var height: Int?
    var bodyFatPercent: Int?
    var muscleMassPercent: Int?
    
    // Strength benchmarks (1RM in kg)
    var oneRmBench: Int?
    var oneRmOhp: Int?
    var oneRmDeadlift: Int?
    var oneRmSquat: Int?
    var oneRmLatpull: Int?
    
    // Training preferences
    var motivationType: String?
    var trainingGoals: String?
    var trainingLevel: String?
    var specificSport: String?
    var focusTags: [String] = []
    var selectedIntent: String?
    var language: String = "en"
    var goalStrength: Int
    var goalVolume: Int
    var goalEndurance: Int
    var goalCardio: Int
    
    var goalHypertrophy: Int {
        get { goalVolume }
        set { goalVolume = newValue }
    }
    
    var sessionsPerWeek: Int
    var sessionDuration: Int
    var restTime: Int // Deprecated - use restTimeBetweenSets instead
    var restTimeBetweenSets: Int // Rest time between sets in seconds (60-120, default: 90)
    var restTimeBetweenExercises: Int? // Rest time between exercises in seconds (60-180, default: 120) - Optional to support migration
    
    // UI preferences
    var theme: String
    var avatarType: String
    var avatarEmoji: String
    var avatarImageUrl: String?
    
    // Onboarding tracking
    var onboardingCompleted: Bool
    var appleHealthConnected: Bool
    var equipmentRegistered: Bool
    
    // Program tracking
    var lastCompletedTemplateId: String?
    var lastSessionType: String?
    var currentPassNumber: Int
    
    // Program generation rate limiting
    var programGenerationsThisWeek: Int
    var weekStartDate: Date?
    
    // Gym tracking
    var selectedGymId: String? // Currently selected gym for program generation
    
    var createdAt: Date
    var updatedAt: Date
    
    init(
        id: UUID = UUID(),
        userId: String,
        age: Int? = nil,
        sex: String? = nil,
        bodyWeight: Int? = nil,
        height: Int? = nil,
        bodyFatPercent: Int? = nil,
        muscleMassPercent: Int? = nil,
        oneRmBench: Int? = nil,
        oneRmOhp: Int? = nil,
        oneRmDeadlift: Int? = nil,
        oneRmSquat: Int? = nil,
        oneRmLatpull: Int? = nil,
        motivationType: String? = nil,
        trainingGoals: String? = nil,
        trainingLevel: String? = nil,
        specificSport: String? = nil,
        goalStrength: Int = 50,
        goalVolume: Int = 50,
        goalEndurance: Int = 50,
        goalCardio: Int = 50,
        sessionsPerWeek: Int = 3,
        sessionDuration: Int = 60,
        restTime: Int = 60,
        restTimeBetweenSets: Int = 90,
        restTimeBetweenExercises: Int? = 120,
        theme: String = "main",
        avatarType: String = "emoji",
        avatarEmoji: String = "💪",
        avatarImageUrl: String? = nil,
        onboardingCompleted: Bool = false,
        appleHealthConnected: Bool = false,
        equipmentRegistered: Bool = false,
        lastCompletedTemplateId: String? = nil,
        lastSessionType: String? = nil,
        currentPassNumber: Int = 1,
        programGenerationsThisWeek: Int = 0,
        weekStartDate: Date? = nil,
        selectedGymId: String? = nil,
        focusTags: [String] = [],
        selectedIntent: String? = nil
    ) {
        self.id = id
        self.userId = userId
        self.age = age
        self.sex = sex
        self.bodyWeight = bodyWeight
        self.height = height
        self.bodyFatPercent = bodyFatPercent
        self.muscleMassPercent = muscleMassPercent
        self.oneRmBench = oneRmBench
        self.oneRmOhp = oneRmOhp
        self.oneRmDeadlift = oneRmDeadlift
        self.oneRmSquat = oneRmSquat
        self.oneRmLatpull = oneRmLatpull
        self.motivationType = motivationType
        self.trainingGoals = trainingGoals
        self.trainingLevel = trainingLevel
        self.specificSport = specificSport
        self.goalStrength = goalStrength
        self.goalVolume = goalVolume
        self.goalEndurance = goalEndurance
        self.goalCardio = goalCardio
        self.focusTags = focusTags
        self.selectedIntent = selectedIntent
        self.sessionsPerWeek = sessionsPerWeek
        self.sessionDuration = sessionDuration
        self.restTime = restTime
        self.restTimeBetweenSets = restTimeBetweenSets
        self.restTimeBetweenExercises = restTimeBetweenExercises
        self.theme = theme
        self.avatarType = avatarType
        self.avatarEmoji = avatarEmoji
        self.avatarImageUrl = avatarImageUrl
        self.onboardingCompleted = onboardingCompleted
        self.appleHealthConnected = appleHealthConnected
        self.equipmentRegistered = equipmentRegistered
        self.lastCompletedTemplateId = lastCompletedTemplateId
        self.lastSessionType = lastSessionType
        self.currentPassNumber = currentPassNumber
        self.programGenerationsThisWeek = programGenerationsThisWeek
        self.weekStartDate = weekStartDate
        self.selectedGymId = selectedGymId
        self.createdAt = Date()
        self.updatedAt = Date()
    }
    
    // MARK: - Computed Properties
    
    /// Returns a user-friendly Swedish label for the motivation type
    var derivedTrainingFocus: String {
        guard let motivation = motivationType else {
            return "Allround"
        }
        
        // Use LocalizationService for consistent localization
        let localizedMotivation = LocalizationService.localizeMotivationType(motivation)
        
        // Add sport name if applicable
        if motivation.lowercased() == "sport", let sport = specificSport, !sport.isEmpty {
            let localizedSport = LocalizationService.localizeSpecificSport(sport)
            return "\(localizedMotivation): \(localizedSport)"
        }
        
        return localizedMotivation
    }
}

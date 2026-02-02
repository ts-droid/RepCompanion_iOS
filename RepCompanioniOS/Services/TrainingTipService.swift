import Foundation
import SwiftData
import Combine

/// Service for syncing and managing training tips
@MainActor
class TrainingTipService: ObservableObject {
    static let shared = TrainingTipService()
    
    @Published var isLoading = false
    @Published var lastSyncDate: Date?
    
    private init() {}
    
    // MARK: - Sync Tips
    
    func syncTrainingTips(modelContext: ModelContext) async throws {
        isLoading = true
        defer { isLoading = false }
        
        // Fetch tips from server
        let tips = try await APIService.shared.fetchTrainingTips()
        
        // Clear existing tips
        let descriptor = FetchDescriptor<TrainingTip>()
        let existing = try modelContext.fetch(descriptor)
        for tip in existing {
            modelContext.delete(tip)
        }
        
        // Insert new tips
        for tipData in tips {
            let tip = TrainingTip(
                id: tipData.id,
                message: tipData.message,
                category: tipData.category,
                workoutTypes: tipData.workoutTypes,
                icon: tipData.icon,
                relatedPromoPlacement: tipData.relatedPromoPlacement,
                isActive: tipData.isActive,
                priority: tipData.priority,
                createdAt: tipData.createdAt
            )
            modelContext.insert(tip)
        }
        
        try modelContext.save()
        lastSyncDate = Date()
    }
    
    func syncProfileTrainingTips(modelContext: ModelContext) async throws {
        isLoading = true
        defer { isLoading = false }
        
        // Fetch profile tips from server
        let tips = try await APIService.shared.fetchProfileTrainingTips()
        
        // Clear existing tips
        let descriptor = FetchDescriptor<ProfileTrainingTip>()
        let existing = try modelContext.fetch(descriptor)
        for tip in existing {
            modelContext.delete(tip)
        }
        
        // Insert new tips
        for tipData in tips {
            let tip = ProfileTrainingTip(
                id: tipData.id,
                tipText: tipData.tipText,
                ageGroup: tipData.ageGroup,
                sport: tipData.sport,
                category: tipData.category,
                gender: tipData.gender,
                trainingLevel: tipData.trainingLevel,
                affiliateLink: tipData.affiliateLink,
                wordCount: tipData.wordCount,
                createdAt: tipData.createdAt
            )
            modelContext.insert(tip)
        }
        
        try modelContext.save()
        lastSyncDate = Date()
    }
    
    // MARK: - Get Personalized Tips
    
    func getPersonalizedTips(
        for profile: UserProfile,
        category: String? = nil,
        limit: Int = 5,
        modelContext: ModelContext
    ) -> [ProfileTrainingTip] {
        // Map user profile to tip filters
        let ageGroup = getAgeGroup(age: profile.age)
        let gender = mapGender(sex: profile.sex)
        let trainingLevel = mapTrainingLevel(level: profile.trainingLevel)
        let motivation = profile.motivationType?.lowercased()
        let genderBoth = "both"
        
        // Strategy:
        // Use a simple predicate for the most restrictive fields (ageGroup, trainingLevel)
        // and filter the rest (gender, category/motivation) in memory.
        // This avoids the "compiler unable to type-check in reasonable time" error
        // caused by complex #Predicate macros.
        
        let predicate = #Predicate<ProfileTrainingTip> { tip in
            tip.ageGroup == ageGroup &&
            tip.trainingLevel == trainingLevel
        }
        
        var descriptor = FetchDescriptor<ProfileTrainingTip>(
            predicate: predicate,
            sortBy: [SortDescriptor(\.createdAt, order: .reverse)]
        )
        // Fetch more than limit to allow for in-memory filtering
        descriptor.fetchLimit = limit * 5
        
        guard let candidates = try? modelContext.fetch(descriptor) else {
            return []
        }
        
        // 1. Specific match (Gender + Motivation/Category)
        let filtered = candidates.filter { tip in
            let isGenderMatch = tip.gender == gender || tip.gender == genderBoth
            guard isGenderMatch else { return false }
            
            if let category = category {
                return tip.category.lowercased() == category.lowercased()
            } else if let motivation = motivation {
                let targetCategories = mapMotivationToCategories(motivation)
                return tip.category.lowercased() == motivation.lowercased() || targetCategories.contains(tip.category.lowercased())
            }
            return true
        }
        
        if !filtered.isEmpty {
            return Array(filtered.prefix(limit))
        }
        
        // 2. Fallback: Just Gender + Age + Level (without motivation focus)
        let fallback = candidates.filter { tip in
            tip.gender == gender || tip.gender == genderBoth
        }
        
        return Array(fallback.prefix(limit))
    }
    
    private func mapMotivationToCategories(_ motivation: String) -> [String] {
        switch motivation.lowercased() {
        case "build_muscle", "bygga_muskler", "hypertrophy", "hypertrofi", "fitness":
            return ["nutrition", "recovery", "periodization", "strength", "volume"]
        case "lose_weight", "weight_loss", "viktminskning":
            return ["nutrition", "cardio"]
        case "better_health", "better_health":
            return ["cardio", "recovery", "nutrition"]
        case "rehabilitation", "rehabilitering":
            return ["recovery", "rehabilitation", "mobility"]
        case "sport":
            return ["cardio", "periodization", "athleticism"]
        case "mobility", "become_more_flexible":
            return ["mobility", "recovery", "stretching"]
        default:
            return ["mixed_training"]
        }
    }
    
    func getTrainingTips(
        category: String? = nil,
        workoutType: String? = nil,
        modelContext: ModelContext
    ) -> [TrainingTip] {
        var predicate: Predicate<TrainingTip>?
        
        if let category = category, let workoutType = workoutType {
            predicate = #Predicate { tip in
                tip.isActive == true &&
                tip.category == category &&
                tip.workoutTypes.contains(workoutType)
            }
        } else if let category = category {
            predicate = #Predicate { tip in
                tip.isActive == true &&
                tip.category == category
            }
        } else if let workoutType = workoutType {
            predicate = #Predicate { tip in
                tip.isActive == true &&
                tip.workoutTypes.contains(workoutType)
            }
        } else {
            predicate = #Predicate { tip in
                tip.isActive == true
            }
        }
        
        let descriptor = FetchDescriptor<TrainingTip>(
            predicate: predicate,
            sortBy: [
                SortDescriptor(\.priority, order: .reverse),
                SortDescriptor(\.createdAt, order: .reverse)
            ]
        )
        
        return (try? modelContext.fetch(descriptor)) ?? []
    }
    
    // MARK: - Helper Methods
    
    private func getAgeGroup(age: Int?) -> String {
        guard let age = age else { return "18–29" }
        
        switch age {
        case 13...17: return "13–17"
        case 18...29: return "18–29"
        case 30...39: return "30–39"
        case 40...59: return "40–59"
        default: return "60+"
        }
    }
    
    private func mapGender(sex: String?) -> String {
        guard let sex = sex?.lowercased() else { return "both" }
        
        switch sex {
        case "male", "man": return "male"
        case "female", "kvinna": return "female"
        default: return "both"
        }
    }
    
    private func mapTrainingLevel(level: String?) -> String {
        guard let level = level?.lowercased() else { return "intermediate" }
        
        switch level {
        case "beginner", "beginner": return "beginner"
        case "intermediate", "van": return "intermediate"
        case "advanced", "mycket_van", "avancerad": return "advanced"
        case "elite", "elit": return "elite"
        default: return "intermediate"
        }
    }
}

// MARK: - API Response Models

struct TrainingTipResponse: Codable {
    let id: String
    let message: String
    let category: String
    let workoutTypes: [String]
    let icon: String
    let relatedPromoPlacement: String?
    let isActive: Bool
    let priority: Int
    let createdAt: Date
}

struct ProfileTrainingTipResponse: Codable {
    let id: String
    let tipText: String
    let ageGroup: String
    let sport: String?
    let category: String
    let gender: String
    let trainingLevel: String
    let affiliateLink: String?
    let wordCount: Int?
    let createdAt: Date
}


import Foundation
import SwiftData

/// Training tips - database-stored training advice
@Model
final class TrainingTip {
    @Attribute(.unique) var id: String
    var message: String
    var category: String // "recovery", "progression", "safety", "hydration", "nutrition", "motivation"
    var workoutTypes: [String]
    var icon: String
    var relatedPromoPlacement: String?
    var isActive: Bool
    var priority: Int
    var createdAt: Date
    
    init(
        id: String,
        message: String,
        category: String,
        workoutTypes: [String] = [],
        icon: String,
        relatedPromoPlacement: String? = nil,
        isActive: Bool = true,
        priority: Int = 0,
        createdAt: Date = Date()
    ) {
        self.id = id
        self.message = message
        self.category = category
        self.workoutTypes = workoutTypes
        self.icon = icon
        self.relatedPromoPlacement = relatedPromoPlacement
        self.isActive = isActive
        self.priority = priority
        self.createdAt = createdAt
    }
}

/// Profile-based training tips - granular advice filtered by age, sport, gender, level
@Model
final class ProfileTrainingTip {
    @Attribute(.unique) var id: String
    var tipText: String
    var ageGroup: String // "13–17", "18–29", "30–39", "40–59", "60+"
    var sport: String? // "fotboll", "golf", "allmän", etc. (null = general)
    var category: String // "kost", "återhämtning", "blandad träning", "kondition", "periodisering", etc.
    var gender: String // "både", "man", "kvinna"
    var trainingLevel: String // "helt nybörjare", "nybörjare", "medel", "van", "avancerad", "elit"
    var affiliateLink: String?
    var wordCount: Int?
    var createdAt: Date
    
    init(
        id: String,
        tipText: String,
        ageGroup: String,
        sport: String? = nil,
        category: String,
        gender: String,
        trainingLevel: String,
        affiliateLink: String? = nil,
        wordCount: Int? = nil,
        createdAt: Date = Date()
    ) {
        self.id = id
        self.tipText = tipText
        self.ageGroup = ageGroup
        self.sport = sport
        self.category = category
        self.gender = gender
        self.trainingLevel = trainingLevel
        self.affiliateLink = affiliateLink
        self.wordCount = wordCount
        self.createdAt = createdAt
    }
}


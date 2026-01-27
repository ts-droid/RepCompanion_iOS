import Foundation

/// Centralized localization service for mapping backend English keys to localized Swedish strings
enum LocalizationService {
    
    // MARK: - Motivation Type Localization
    
    /// Maps English motivation type keys to Swedish labels
    static func localizeMotivationType(_ key: String?) -> String {
        guard let key = key else { return "Allround" }
        
        switch key.lowercased() {
        case "build_muscle", "bygga_muskler":
            return String(localized: "Build Muscle")
        case "better_health", "bättre_hälsa":
            return String(localized: "Better Health")
        case "sport":
            return String(localized: "Specific Sport")
        case "mobility", "bli_rörligare":
            return String(localized: "Improve Mobility")
        case "rehabilitation", "rehabilitering":
            return String(localized: "Rehabilitation")
        case "fitness":
            return String(localized: "Fitness")
        case "lose_weight", "weight_loss", "viktminskning":
            return String(localized: "Weight Loss")
        case "hälsa_livsstil":
            return String(localized: "Health & Lifestyle")
        default:
            return key.capitalized.replacingOccurrences(of: "_", with: " ")
        }
    }
    
    /// Maps Swedish UI selection to English backend key
    static func motivationTypeToBackendKey(_ selection: String) -> String {
        switch selection.lowercased() {
        case "bygga muskler", "bygga_muskler", "build_muscle":
            return "build_muscle"
        case "bättre hälsa", "bättre_hälsa", "better_health":
            return "better_health"
        case "sport", "specifik idrott":
            return "sport"
        case "bli rörligare", "bli_rörligare", "mobility":
            return "mobility"
        case "rehabilitering", "rehabilitation":
            return "rehabilitation"
        case "viktminskning", "weight_loss", "lose_weight":
            return "lose_weight"
        default:
            return selection
        }
    }
    
    // MARK: - Training Level Localization
    
    /// Maps English training level keys to Swedish labels
    static func localizeTrainingLevel(_ key: String?) -> String {
        guard let key = key else { return "Nybörjare" }
        
        switch key.lowercased() {
        case "beginner", "nybörjare":
            return String(localized: "Beginner")
        case "intermediate", "van":
            return String(localized: "Intermediate")
        case "advanced", "mycket_van":
            return String(localized: "Advanced")
        case "elite", "elit":
            return String(localized: "Elite")
        default:
            return key.capitalized
        }
    }
    
    /// Maps Swedish UI selection to English backend key
    static func trainingLevelToBackendKey(_ selection: String) -> String {
        switch selection.lowercased() {
        case "nybörjare":
            return "beginner"
        case "van":
            return "intermediate"
        case "mycket van", "mycket_van":
            return "advanced"
        case "elit":
            return "elite"
        default:
            return selection
        }
    }
    
    // MARK: - Sex Localization
    
    /// Maps English sex keys to Swedish labels
    static func localizeSex(_ key: String?) -> String {
        guard let key = key else { return "Ej angivet" }
        
        switch key.lowercased() {
        case "male", "man":
            return String(localized: "Male")
        case "female", "kvinna":
            return String(localized: "Female")
        case "other", "annat":
            return String(localized: "Other")
        default:
            return key.capitalized
        }
    }
    
    /// Maps Swedish UI selection to English backend key
    static func sexToBackendKey(_ selection: String) -> String {
        switch selection.lowercased() {
        case "man":
            return "male"
        case "kvinna":
            return "female"
        case "annat":
            return "other"
        default:
            return selection
        }
    }
    
    // MARK: - Sport Localization
    
    /// Maps English sport keys to Swedish labels
    static func localizeSpecificSport(_ key: String?) -> String {
        guard let key = key else { return "Ej angivet" }
        
        switch key.lowercased() {
        case "football": return "Fotboll"
        case "ice_hockey": return "Ishockey"
        case "basketball": return "Basket"
        case "tennis": return "Tennis"
        case "running": return "Löpning"
        case "cycling": return "Cykling"
        case "swimming": return "Simning"
        case "badminton": return "Badminton"
        case "floorball": return "Innebandy"
        case "golf": return "Golf"
        case "handball": return "Handboll"
        case "track_and_field": return "Friidrott"
        case "cross_country_skiing": return "Längdskidor"
        case "martial_arts": return "Kampsporter"
        case "padel": return "Padel"
        case "alpine_skiing": return "Alpin skidåkning"
        case "other": return "Annat"
        default: return key.capitalized.replacingOccurrences(of: "_", with: " ")
        }
    }
    
    /// Maps Swedish UI selection to English backend key
    static func specificSportToBackendKey(_ selection: String) -> String {
        switch selection.lowercased() {
        case "fotboll": return "football"
        case "ishockey": return "ice_hockey"
        case "basket": return "basketball"
        case "tennis": return "tennis"
        case "löpning": return "running"
        case "cykling": return "cycling"
        case "simning": return "swimming"
        case "badminton": return "badminton"
        case "innebandy": return "floorball"
        case "golf": return "golf"
        case "handboll": return "handball"
        case "friidrott": return "track_and_field"
        case "längdskidor": return "cross_country_skiing"
        case "kampsporter": return "martial_arts"
        case "padel": return "padel"
        case "alpin skidåkning": return "alpine_skiing"
        case "annat": return "other"
        default: return selection
        }
    }
    
    // MARK: - Focus Localization
    
    /// Maps English focus tags to Swedish labels
    static func localizeFocusTag(_ key: String) -> String {
        switch key.lowercased() {
        case "power", "explosiveness": return String(localized: "Explosiveness")
        case "skill", "technique": return String(localized: "Technique")
        case "mobility": return String(localized: "Mobility")
        case "recovery", "rehab/recovery": return String(localized: "Rehab/Recovery")
        case "conditioning", "conditioning/metcon": return String(localized: "Conditioning/Metcon")
        default: return key.capitalized
        }
    }
    
    /// Maps English intent keys to Swedish labels
    static func localizeIntent(_ key: String?) -> String {
        guard let key = key else { return "Normal" }
        switch key.lowercased() {
        case "explosive": return "Explosivt"
        case "controlled": return "Kontrollerat"
        case "quality": return "Kvalitet"
        case "grindy": return "Tungt"
        default: return key.capitalized
        }
    }
    
    /// Maps English primary focus keys to Swedish labels
    static func localizePrimaryFocus(_ key: String) -> String {
        switch key.lowercased() {
        case "strength": return "Styrka"
        case "hypertrophy", "volume": return "Hypertrofi"
        case "endurance": return "Uthållighet"
        case "cardio": return "Cardio"
        default: return key.capitalized
        }
    }
}

import Foundation

/// Centralized localization service for mapping backend English keys to localized Swedish strings
enum LocalizationService {
    
    // MARK: - Motivation Type Localization
    
    /// Maps English motivation type keys to Swedish labels
    static func localizeMotivationType(_ key: String?) -> String {
        guard let key = key else { return String(localized: "All-round") }
        
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
        guard let key = key else { return String(localized: "Beginner") }
        
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
        guard let key = key else { return String(localized: "Not specified") }
        
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
        guard let key = key else { return String(localized: "Not specified") }
        
        switch key.lowercased() {
        case "football": return String(localized: "Football")
        case "ice_hockey": return String(localized: "Ice Hockey")
        case "basketball": return String(localized: "Basketball")
        case "tennis": return String(localized: "Tennis")
        case "running": return String(localized: "Running")
        case "cycling": return String(localized: "Cycling")
        case "swimming": return String(localized: "Swimming")
        case "badminton": return String(localized: "Badminton")
        case "floorball": return String(localized: "Floorball")
        case "golf": return String(localized: "Golf")
        case "handball": return String(localized: "Handball")
        case "track_and_field": return String(localized: "Track and Field")
        case "cross_country_skiing": return String(localized: "Cross-country Skiing")
        case "martial_arts": return String(localized: "Martial Arts")
        case "padel": return String(localized: "Padel")
        case "alpine_skiing": return String(localized: "Alpine Skiing")
        case "other": return String(localized: "Other")
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
        case "handball": return "handball"
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
        guard let key = key else { return String(localized: "Normal") }
        switch key.lowercased() {
        case "explosive": return String(localized: "Explosive")
        case "controlled": return String(localized: "Controlled")
        case "quality": return String(localized: "Quality")
        case "grindy": return String(localized: "Heavy")
        default: return key.capitalized
        }
    }
    
    /// Maps English primary focus keys to Swedish labels
    static func localizePrimaryFocus(_ key: String) -> String {
        switch key.lowercased() {
        case "strength": return String(localized: "Strength")
        case "hypertrophy", "volume": return String(localized: "Hypertrophy")
        case "endurance": return String(localized: "Endurance")
        case "cardio": return String(localized: "Cardio")
        default: return key.capitalized
        }
    }
}

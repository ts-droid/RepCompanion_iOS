import Foundation

/// Centralized localization service for mapping backend English keys to localized Swedish strings
enum LocalizationService {
    
    // MARK: - Motivation Type Localization
    
    /// Maps English motivation type keys to Swedish labels
    static func localizeMotivationType(_ key: String?) -> String {
        guard let key = key else { return "Allround" }
        
        switch key.lowercased() {
        case "build_muscle", "bygga_muskler":
            return "Bygga muskler"
        case "better_health", "bättre_hälsa":
            return "Bättre hälsa"
        case "sport":
            return "Specifik idrott"
        case "mobility", "bli_rörligare":
            return "Bli rörligare"
        case "rehabilitation", "rehabilitering":
            return "Rehabilitering"
        case "fitness":
            return "Fitness"
        case "viktminskning":
            return "Viktminskning"
        case "hälsa_livsstil":
            return "Hälsa & Livsstil"
        default:
            return key.capitalized
        }
    }
    
    /// Maps Swedish UI selection to English backend key
    static func motivationTypeToBackendKey(_ selection: String) -> String {
        switch selection.lowercased() {
        case "bygga muskler", "bygga_muskler":
            return "build_muscle"
        case "bättre hälsa", "bättre_hälsa":
            return "better_health"
        case "sport", "specifik idrott":
            return "sport"
        case "bli rörligare", "bli_rörligare":
            return "mobility"
        case "rehabilitering":
            return "rehabilitation"
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
            return "Nybörjare"
        case "intermediate", "van":
            return "Van"
        case "advanced", "mycket_van":
            return "Mycket van"
        case "elite", "elit":
            return "Elit"
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
            return "Man"
        case "female", "kvinna":
            return "Kvinna"
        case "other", "annat":
            return "Annat"
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
}

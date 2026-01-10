import Foundation
import SwiftUI
import Combine

@MainActor
class AppLanguageService: ObservableObject {
    static let shared = AppLanguageService()
    
    @AppStorage("appLanguage") private var storedLanguage: String = "en"
    
    @Published var currentLanguage: String = "en"
    
    private init() {
        self.currentLanguage = storedLanguage
    }
    
    func setLanguage(_ language: String) {
        guard ["en", "sv"].contains(language) else { return }
        
        // Update local state
        self.currentLanguage = language
        self.storedLanguage = language
        
        // Update UserDefaults for standard localization mechanism if we were using it fully
        // But for now we are handling it manually/via internal state for content
        UserDefaults.standard.set([language], forKey: "AppleLanguages")
        UserDefaults.standard.synchronize()
    }
    
    func getLanguage() -> String {
        return currentLanguage
    }
    
    // Helper to get localized string for simple cases where we don't use the system mechanism yet
    func localizedString(_ key: String) -> String {
        // This is a temporary helper until we fully implement String Catalogs
        if currentLanguage == "sv" {
            switch key {
            case "Weight": return "Vikt"
            case "Reps": return "Reps"
            case "Sets": return "Set"
            case "Rest": return "Vila"
            case "Notes": return "Anteckningar"
            default: return key
            }
        }
        return key
    }
}

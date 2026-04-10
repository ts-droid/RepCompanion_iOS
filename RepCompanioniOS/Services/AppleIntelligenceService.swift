import Foundation
import SwiftUI
#if canImport(Darwin)
import Darwin
#endif

/// Service for generating workout programs using Apple Intelligence (on-device AI)
/// Falls back to server-side generation if Apple Intelligence is not available
@available(iOS 18.0, *)
@MainActor
class AppleIntelligenceService {
    static let shared = AppleIntelligenceService()
    
    private init() {}
    
    /// Check if Apple Intelligence is available on this device
    func isAvailable() -> Bool {
        #if os(iOS)
        // Check device model for Apple Intelligence compatibility
        // Apple Intelligence requires A17 Pro or newer (iPhone 15 Pro series and later)
        // or M1+ Macs
        let deviceModel = modelIdentifier
        _ = deviceModel // Silence unused warning
        
        // Compatible devices:
        // iPhone 15 Pro (iPhone16,1), iPhone 15 Pro Max (iPhone16,2)
        // iPhone 16 series and newer
        // iPad with M1 or newer
        // All Macs with M1 or newer
        let compatibleModels = [
            "iPhone16,1", // iPhone 15 Pro
            "iPhone16,2", // iPhone 15 Pro Max
            "iPhone17,",  // iPhone 16 series (starts with)
            "iPhone18,",  // iPhone 17 series (starts with)
            "iPad13,",    // iPad Pro M1 (starts with)
            "iPad14,",    // iPad Air M1 (starts with)
            "Mac",        // All Macs (M1+)
        ]
        
        // Check if device model matches compatible models
        let modelId = modelIdentifier
        for compatibleModel in compatibleModels {
            if modelId.hasPrefix(compatibleModel) {
                // Additional check: Verify Apple Intelligence is enabled
                // This would check system settings in production
                #if DEBUG
                print("[Apple Intelligence] ✅ Device \(modelId) is compatible")
                #endif
                return true
            }
        }
        
        #if DEBUG
        print("[Apple Intelligence] ⚠️ Device \(modelId) is not compatible")
        #endif
        
        // For development/testing, allow on simulator if iOS 18+
        #if targetEnvironment(simulator)
        #if DEBUG
        print("[Apple Intelligence] ✅ Simulator detected, allowing for testing")
        #endif
        return true
        #endif
        #endif
        return false
    }
    
    /// Get device model identifier for compatibility checking
    private var modelIdentifier: String {
        #if canImport(Darwin)
        var systemInfo = utsname()
        uname(&systemInfo)
        let modelCode = withUnsafePointer(to: &systemInfo.machine) {
            $0.withMemoryRebound(to: CChar.self, capacity: 1) {
                String(validatingUTF8: $0)
            }
        }
        return modelCode ?? "unknown"
        #else
        return "unknown"
        #endif
    }
    
    /// Generate workout program using Apple Intelligence Foundation Models
    /// This uses on-device AI processing for privacy and speed
    func generateWorkoutProgram(
        for input: WorkoutGenerationInput
    ) async throws -> WorkoutProgram {
        guard isAvailable() else {
            throw AppleIntelligenceError.notAvailable
        }
        
        #if DEBUG
        print("[Apple Intelligence] 🧠 Generating workout program on-device...")
        #endif
        
        // Build prompt for Apple Intelligence
        let systemPrompt = buildSystemPrompt()
        let userPrompt = buildUserPrompt(for: input)
        _ = systemPrompt // Silence unused warning
        _ = userPrompt   // Silence unused warning
        
        // Use Apple Intelligence Foundation Models API
        // Note: This is a placeholder - actual implementation would use
        // the Foundation Models framework when it becomes available
        // For now, we'll simulate the call structure
        
        do {
            // TODO: Replace with actual Apple Intelligence API call when available
            throw AppleIntelligenceError.apiNotAvailable
            
        } catch {
            #if DEBUG
            print("[Apple Intelligence] ⚠️ On-device generation failed: \(error)")
            #endif
            throw error
        }
    }
    
    private func buildSystemPrompt() -> String {
        return """
        Du är en licensierad träningsfysiolog och expert på styrketräning, nutrition och periodisering. 
        Du skapar individuellt anpassade, säkra och effektiva träningsscheman baserat på personens profil och utrustning.
        
        VIKTIGT:
        - Svara ENDAST med valid JSON enligt schemat.
        - Varje pass MÅSTE ha estimated_duration_minutes inom ±10% från användarens max passlängd.
        - Varje pass MÅSTE ha minst 4-6 övningar i main_work för att fylla passlängden.
        - Varje pass MÅSTE ha ett "muscle_focus" värde som beskriver huvudsaklig muskelgrupp/fokus.
        - Använd repetitioner (inte tid) för dynamiska övningar, tid endast för statiska hållövningar.
        """
    }
    
    private func buildUserPrompt(for input: WorkoutGenerationInput) -> String {
        let equipmentList = input.availableEquipment.joined(separator: ", ")
        let oneRMInfo = input.oneRMValues.map { values in
            var info = ""
            if let bench = values.bench { info += "Bench: \(bench)kg, " }
            if let squat = values.squat { info += "Squat: \(squat)kg, " }
            if let deadlift = values.deadlift { info += "Deadlift: \(deadlift)kg, " }
            if let ohp = values.ohp { info += "OHP: \(ohp)kg, " }
            if let latpull = values.latpull { info += "Lat Pull: \(latpull)kg" }
            return info.isEmpty ? "No 1RM values" : String(info.dropLast(2))
        } ?? "No 1RM values"
        
        return """
        Skapa ett personligt träningsprogram med följande specifikationer:
        
        Profil:
        - Kön: \(input.gender)
        - Ålder: \(input.age) år
        - Vikt: \(input.weightKg) kg
        - Längd: \(input.heightCm) cm
        - Träningsnivå: \(input.trainingLevel)
        - Huvudmål: \(input.mainGoal)
        - Specifik sport: \(input.specificSport ?? "Ingen")
        
        Målfördelning:
        - Styrka: \(input.distribution.strengthPercent)%
        - Muskelökning: \(input.distribution.hypertrophyPercent)%
        - Uthållighet: \(input.distribution.endurancePercent)%
        - Kardio: \(input.distribution.cardioPercent)%
        
        Träningsschema:
        - \(input.sessionsPerWeek) pass per vecka
        - \(input.sessionLengthMinutes) minuter per pass
        
        Tillgänglig utrustning: \(equipmentList)
        
        1RM-värden: \(oneRMInfo)
        
        Generera \(input.sessionsPerWeek) träningspass med varierad muskelgruppsfokus.
        """
    }
}

enum AppleIntelligenceError: LocalizedError {
    case notAvailable
    case apiNotAvailable
    case generationFailed(String)
    
    var errorDescription: String? {
        switch self {
        case .notAvailable:
            return "Apple Intelligence is not available on this device"
        case .apiNotAvailable:
            return "Apple Intelligence API is not available yet"
        case .generationFailed(let reason):
            return "Programgenerering misslyckades: \(reason)"
        }
    }
}

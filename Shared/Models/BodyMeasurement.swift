import Foundation
import SwiftData

/// Represents a single body measurement log entry.
/// All circumference values are stored in centimetres; weight in kilograms.
@Model
final class BodyMeasurement {

    @Attribute(.unique) var id: UUID
    var userId: String
    var date: Date

    // ── Alltid relevant ────────────────────────────────────────
    var weight: Double?         // kg

    // ── Viktnedgång / hälsofokus (Priority 1) ─────────────────
    /// Midja — mäts vid den smalaste punkten, ca 2 cm ovanför naveln
    var waist: Double?
    /// Höfter/Stuss — mäts vid den bredaste punkten
    var hips: Double?
    /// Hals — mäts strax under struphuvudet; används i Navy body-fat-formeln
    var neck: Double?
    /// Bröst — mäts vid bröstvårtelinjen
    var chest: Double?
    /// Lår höger — mitten av låret, vid avslappnad muskel
    var thighRight: Double?
    /// Lår vänster
    var thighLeft: Double?

    // ── Muskeluppbyggnad / bodybuilding (Priority 2) ───────────
    /// Bicep höger (flexat)
    var bicepRight: Double?
    /// Bicep vänster (flexat)
    var bicepLeft: Double?
    /// Vader höger — vid den bredaste punkten
    var calfRight: Double?
    /// Vader vänster
    var calfLeft: Double?
    /// Underarm höger — vid den bredaste punkten
    var forearmRight: Double?
    /// Underarm vänster
    var forearmLeft: Double?
    /// Axlar — vid den bredaste punkten (typiskt axelnivå)
    var shoulders: Double?
    /// Mage — vid naveln (separerat från midja)
    var abdomen: Double?

    var createdAt: Date

    init(
        id: UUID = UUID(),
        userId: String,
        date: Date = Date(),
        weight: Double? = nil,
        waist: Double? = nil,
        hips: Double? = nil,
        neck: Double? = nil,
        chest: Double? = nil,
        thighRight: Double? = nil,
        thighLeft: Double? = nil,
        bicepRight: Double? = nil,
        bicepLeft: Double? = nil,
        calfRight: Double? = nil,
        calfLeft: Double? = nil,
        forearmRight: Double? = nil,
        forearmLeft: Double? = nil,
        shoulders: Double? = nil,
        abdomen: Double? = nil
    ) {
        self.id = id
        self.userId = userId
        self.date = date
        self.weight = weight
        self.waist = waist
        self.hips = hips
        self.neck = neck
        self.chest = chest
        self.thighRight = thighRight
        self.thighLeft = thighLeft
        self.bicepRight = bicepRight
        self.bicepLeft = bicepLeft
        self.calfRight = calfRight
        self.calfLeft = calfLeft
        self.forearmRight = forearmRight
        self.forearmLeft = forearmLeft
        self.shoulders = shoulders
        self.abdomen = abdomen
        self.createdAt = Date()
    }

    // MARK: - Convenience

    /// True om minst ett mätvärde (utöver vikt) är ifyllt
    var hasMeasurements: Bool {
        [waist, hips, neck, chest, thighRight, thighLeft,
         bicepRight, bicepLeft, calfRight, calfLeft,
         forearmRight, forearmLeft, shoulders, abdomen].contains(where: { $0 != nil })
    }
}

// MARK: - Measurement Focus

enum MeasurementFocus {
    case weightLoss
    case muscleBuild

    /// Etiketter för mätningar i prioritetsordning för detta fokus
    var primaryFields: [(label: String, keyPath: KeyPath<BodyMeasurement, Double?>)] {
        switch self {
        case .weightLoss:
            return [
                (String(localized: "Midja"), \BodyMeasurement.waist),
                (String(localized: "Höfter"), \BodyMeasurement.hips),
                (String(localized: "Hals"), \BodyMeasurement.neck),
                (String(localized: "Bröst"), \BodyMeasurement.chest),
                (String(localized: "Lår höger"), \BodyMeasurement.thighRight),
                (String(localized: "Lår vänster"), \BodyMeasurement.thighLeft)
            ]
        case .muscleBuild:
            return [
                (String(localized: "Bicep höger"), \BodyMeasurement.bicepRight),
                (String(localized: "Bicep vänster"), \BodyMeasurement.bicepLeft),
                (String(localized: "Bröst"), \BodyMeasurement.chest),
                (String(localized: "Axlar"), \BodyMeasurement.shoulders),
                (String(localized: "Vader höger"), \BodyMeasurement.calfRight),
                (String(localized: "Vader vänster"), \BodyMeasurement.calfLeft),
                (String(localized: "Underarm höger"), \BodyMeasurement.forearmRight),
                (String(localized: "Underarm vänster"), \BodyMeasurement.forearmLeft)
            ]
        }
    }

    var secondaryFields: [(label: String, keyPath: KeyPath<BodyMeasurement, Double?>)] {
        switch self {
        case .weightLoss:
            return [
                (String(localized: "Bicep höger"), \BodyMeasurement.bicepRight),
                (String(localized: "Bicep vänster"), \BodyMeasurement.bicepLeft),
                (String(localized: "Axlar"), \BodyMeasurement.shoulders),
                (String(localized: "Vader höger"), \BodyMeasurement.calfRight),
                (String(localized: "Vader vänster"), \BodyMeasurement.calfLeft),
                (String(localized: "Underarm höger"), \BodyMeasurement.forearmRight),
                (String(localized: "Underarm vänster"), \BodyMeasurement.forearmLeft),
                (String(localized: "Mage"), \BodyMeasurement.abdomen)
            ]
        case .muscleBuild:
            return [
                (String(localized: "Midja"), \BodyMeasurement.waist),
                (String(localized: "Höfter"), \BodyMeasurement.hips),
                (String(localized: "Hals"), \BodyMeasurement.neck),
                (String(localized: "Lår höger"), \BodyMeasurement.thighRight),
                (String(localized: "Lår vänster"), \BodyMeasurement.thighLeft),
                (String(localized: "Mage"), \BodyMeasurement.abdomen)
            ]
        }
    }
}

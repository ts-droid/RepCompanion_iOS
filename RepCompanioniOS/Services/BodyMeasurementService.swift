import Foundation
import SwiftData

/// Service for creating, fetching and syncing BodyMeasurement records.
final class BodyMeasurementService {

    static let shared = BodyMeasurementService()
    private init() {}

    // MARK: - Local (SwiftData)

    /// Sparar en ny mätning lokalt. Anropa efter att `BodyMeasurement` är konfigurerad.
    func save(_ measurement: BodyMeasurement, modelContext: ModelContext) {
        modelContext.insert(measurement)
        try? modelContext.save()
    }

    /// Hämtar alla mätningar för en användare, sorterade med nyast först.
    func fetchAll(userId: String, modelContext: ModelContext) -> [BodyMeasurement] {
        let descriptor = FetchDescriptor<BodyMeasurement>(
            predicate: #Predicate { $0.userId == userId },
            sortBy: [SortDescriptor(\BodyMeasurement.date, order: .reverse)]
        )
        return (try? modelContext.fetch(descriptor)) ?? []
    }

    /// Hämtar den senaste mätningen för en användare.
    func latest(userId: String, modelContext: ModelContext) -> BodyMeasurement? {
        fetchAll(userId: userId, modelContext: modelContext).first
    }

    /// Hämtar mätningar inom ett visst tidsintervall.
    func fetchInRange(userId: String, from startDate: Date, to endDate: Date, modelContext: ModelContext) -> [BodyMeasurement] {
        let all = fetchAll(userId: userId, modelContext: modelContext)
        return all.filter { $0.date >= startDate && $0.date <= endDate }
    }

    /// Tar bort en mätning lokalt.
    func delete(_ measurement: BodyMeasurement, modelContext: ModelContext) {
        modelContext.delete(measurement)
        try? modelContext.save()
    }

    // MARK: - Delta helpers

    /// Returnerar skillnaden i ett givet mätvärde (KeyPath) jämfört med en mätning för ca 30 dagar sedan.
    func delta30d<V: BinaryFloatingPoint>(
        userId: String,
        keyPath: KeyPath<BodyMeasurement, V?>,
        modelContext: ModelContext
    ) -> V? {
        let all = fetchAll(userId: userId, modelContext: modelContext)
        guard let latest = all.first,
              let latestVal = latest[keyPath: keyPath] else { return nil }

        let thirtyDaysAgo = Calendar.current.date(byAdding: .day, value: -30, to: Date()) ?? Date()
        let old = all.last(where: { $0.date <= thirtyDaysAgo && $0[keyPath: keyPath] != nil })
        guard let oldVal = old?[keyPath: keyPath] else { return nil }
        return latestVal - oldVal
    }

    // MARK: - Server sync

    /// Hämtar mätningar från servern och upserterar lokalt.
    func syncFromServer(userId: String, modelContext: ModelContext) async {
        guard let data = try? await APIService.shared.fetchBodyMeasurements() else { return }

        let existing = fetchAll(userId: userId, modelContext: modelContext)
        let existingIds = Set(existing.map { $0.id })

        for item in data {
            guard !existingIds.contains(item.id) else { continue }
            let m = BodyMeasurement(
                id: item.id,
                userId: userId,
                date: item.date,
                weight: item.weight,
                waist: item.waist,
                hips: item.hips,
                neck: item.neck,
                chest: item.chest,
                thighRight: item.thighRight,
                thighLeft: item.thighLeft,
                bicepRight: item.bicepRight,
                bicepLeft: item.bicepLeft,
                calfRight: item.calfRight,
                calfLeft: item.calfLeft,
                forearmRight: item.forearmRight,
                forearmLeft: item.forearmLeft,
                shoulders: item.shoulders,
                abdomen: item.abdomen
            )
            modelContext.insert(m)
        }
        try? modelContext.save()
    }

    /// Skickar en ny mätning till servern och sparar svaret lokalt.
    func createOnServer(_ measurement: BodyMeasurement, modelContext: ModelContext) async {
        _ = try? await APIService.shared.createBodyMeasurement(measurement)
    }

    // MARK: - Notification helper

    /// Returnerar antalet dagar sedan senaste loggning, eller nil om aldrig loggat.
    func daysSinceLastLog(userId: String, modelContext: ModelContext) -> Int? {
        guard let last = latest(userId: userId, modelContext: modelContext) else { return nil }
        return Calendar.current.dateComponents([.day], from: last.date, to: Date()).day
    }
}

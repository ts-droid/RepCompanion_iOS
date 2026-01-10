import Foundation
import HealthKit
import Combine

/// Service for syncing with Apple HealthKit
@MainActor
class HealthKitService: ObservableObject {
    static let shared = HealthKitService()
    
    private let healthStore = HKHealthStore()
    
    // Types we want to read
    private let readTypes: Set<HKObjectType> = [
        HKObjectType.quantityType(forIdentifier: .stepCount)!,
        HKObjectType.quantityType(forIdentifier: .activeEnergyBurned)!,
        HKObjectType.quantityType(forIdentifier: .heartRate)!,
        HKObjectType.categoryType(forIdentifier: .sleepAnalysis)!,
        HKObjectType.quantityType(forIdentifier: .bodyMass)!,
        HKObjectType.quantityType(forIdentifier: .leanBodyMass)!,
        HKObjectType.quantityType(forIdentifier: .height)!,
        HKObjectType.quantityType(forIdentifier: .heartRateVariabilitySDNN)!,
        HKObjectType.quantityType(forIdentifier: .distanceWalkingRunning)!,
        HKObjectType.quantityType(forIdentifier: .flightsClimbed)!,
        HKObjectType.quantityType(forIdentifier: .vo2Max)!
    ]
    
    // Types we want to write
    private let writeTypes: Set<HKSampleType> = [
        HKObjectType.workoutType(),
        HKObjectType.quantityType(forIdentifier: .activeEnergyBurned)!,
        HKObjectType.quantityType(forIdentifier: .heartRate)!
    ]
    
    @Published var isAuthorized = false
    @Published var authorizationStatus: HKAuthorizationStatus = .notDetermined
    
    private init() {
        checkAuthorizationStatus()
    }
    
    // MARK: - Authorization
    
    func requestAuthorization() async throws {
        guard HKHealthStore.isHealthDataAvailable() else {
            throw HealthKitError.notAvailable
        }
        
        try await healthStore.requestAuthorization(toShare: writeTypes, read: readTypes)
        
        await MainActor.run {
            checkAuthorizationStatus()
        }
    }
    
    private func checkAuthorizationStatus() {
        guard let stepType = HKQuantityType.quantityType(forIdentifier: .stepCount) else {
            isAuthorized = false
            return
        }
        
        let status = healthStore.authorizationStatus(for: stepType)
        authorizationStatus = status
        isAuthorized = status == .sharingAuthorized || status == .sharingDenied
    }
    
    // MARK: - Read Data
    
    func getTodaySteps() async throws -> Int {
        guard let stepType = HKQuantityType.quantityType(forIdentifier: .stepCount) else {
            throw HealthKitError.invalidType
        }
        
        let calendar = Calendar.current
        let now = Date()
        let startOfDay = calendar.startOfDay(for: now)
        let predicate = HKQuery.predicateForSamples(
            withStart: startOfDay,
            end: now,
            options: .strictStartDate
        )
        
        return try await withCheckedThrowingContinuation { continuation in
            let query = HKStatisticsQuery(
                quantityType: stepType,
                quantitySamplePredicate: predicate,
                options: .cumulativeSum
            ) { _, result, error in
                if let error = error {
                    continuation.resume(throwing: error)
                    return
                }
                
                guard let result = result,
                      let sum = result.sumQuantity() else {
                    continuation.resume(returning: 0)
                    return
                }
                
                let steps = Int(sum.doubleValue(for: HKUnit.count()))
                continuation.resume(returning: steps)
            }
            
            healthStore.execute(query)
        }
    }
    
    func getTodayActiveEnergy() async throws -> Double {
        guard let energyType = HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned) else {
            throw HealthKitError.invalidType
        }
        
        let calendar = Calendar.current
        let now = Date()
        let startOfDay = calendar.startOfDay(for: now)
        let predicate = HKQuery.predicateForSamples(
            withStart: startOfDay,
            end: now,
            options: .strictStartDate
        )
        
        return try await withCheckedThrowingContinuation { continuation in
            let query = HKStatisticsQuery(
                quantityType: energyType,
                quantitySamplePredicate: predicate,
                options: .cumulativeSum
            ) { _, result, error in
                if let error = error {
                    continuation.resume(throwing: error)
                    return
                }
                
                guard let result = result,
                      let sum = result.sumQuantity() else {
                    continuation.resume(returning: 0.0)
                    return
                }
                
                let energy = sum.doubleValue(for: HKUnit.kilocalorie())
                continuation.resume(returning: energy)
            }
            
            healthStore.execute(query)
        }
    }
    
    func getAverageHeartRate(for date: Date) async throws -> Double {
        guard let heartRateType = HKQuantityType.quantityType(forIdentifier: .heartRate) else {
            throw HealthKitError.invalidType
        }
        
        let calendar = Calendar.current
        let startOfDay = calendar.startOfDay(for: date)
        let endOfDay = calendar.date(byAdding: .day, value: 1, to: startOfDay)!
        let predicate = HKQuery.predicateForSamples(
            withStart: startOfDay,
            end: endOfDay,
            options: .strictStartDate
        )
        
        return try await withCheckedThrowingContinuation { continuation in
            let query = HKStatisticsQuery(
                quantityType: heartRateType,
                quantitySamplePredicate: predicate,
                options: .discreteAverage
            ) { _, result, error in
                if let error = error {
                    continuation.resume(throwing: error)
                    return
                }
                
                guard let result = result,
                      let avg = result.averageQuantity() else {
                    continuation.resume(returning: 0.0)
                    return
                }
                
                let heartRate = avg.doubleValue(for: HKUnit(from: "count/min"))
                continuation.resume(returning: heartRate)
            }
            
            healthStore.execute(query)
        }
    }
    
    func getLatestBodyMass() async throws -> Double {
        guard let bodyMassType = HKQuantityType.quantityType(forIdentifier: .bodyMass) else {
            throw HealthKitError.invalidType
        }
        
        return try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: bodyMassType,
                predicate: nil,
                limit: 1,
                sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)]
            ) { _, samples, error in
                if let error = error {
                    continuation.resume(throwing: error)
                    return
                }
                
                guard let sample = samples?.first as? HKQuantitySample else {
                    continuation.resume(throwing: HealthKitError.invalidType)
                    return
                }
                
                let weight = sample.quantity.doubleValue(for: HKUnit.gramUnit(with: .kilo))
                continuation.resume(returning: weight)
            }
            
            healthStore.execute(query)
        }
    }
    
    func getLatestHeight() async throws -> Double {
        guard let heightType = HKQuantityType.quantityType(forIdentifier: .height) else {
            throw HealthKitError.invalidType
        }
        
        return try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: heightType,
                predicate: nil,
                limit: 1,
                sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)]
            ) { _, samples, error in
                if let error = error {
                    continuation.resume(throwing: error)
                    return
                }
                
                guard let sample = samples?.first as? HKQuantitySample else {
                    continuation.resume(throwing: HealthKitError.invalidType)
                    return
                }
                
                let height = sample.quantity.doubleValue(for: HKUnit.meter())
                continuation.resume(returning: height)
            }
            
            healthStore.execute(query)
        }
    }
    
    func getSleepHours(for date: Date) async throws -> Double {
        guard let sleepType = HKCategoryType.categoryType(forIdentifier: .sleepAnalysis) else {
            throw HealthKitError.invalidType
        }
        
        let calendar = Calendar.current
        let startOfDay = calendar.startOfDay(for: date)
        let endOfDay = calendar.date(byAdding: .day, value: 1, to: startOfDay)!
        let predicate = HKQuery.predicateForSamples(
            withStart: startOfDay,
            end: endOfDay,
            options: .strictStartDate
        )
        
        return try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: sleepType,
                predicate: predicate,
                limit: HKObjectQueryNoLimit,
                sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)]
            ) { _, samples, error in
                if let error = error {
                    continuation.resume(throwing: error)
                    return
                }
                
                guard let samples = samples as? [HKCategorySample] else {
                    continuation.resume(returning: 0.0)
                    return
                }
                
                var totalSleep: TimeInterval = 0
                for sample in samples {
                    // Use the new enum values (iOS 16+)
                    if sample.value == HKCategoryValueSleepAnalysis.asleepUnspecified.rawValue ||
                       sample.value == HKCategoryValueSleepAnalysis.asleepCore.rawValue ||
                       sample.value == HKCategoryValueSleepAnalysis.asleepDeep.rawValue ||
                       sample.value == HKCategoryValueSleepAnalysis.asleepREM.rawValue {
                        totalSleep += sample.endDate.timeIntervalSince(sample.startDate)
                    }
                }
                
                let hours = totalSleep / 3600.0
                continuation.resume(returning: hours)
            }
            
            healthStore.execute(query)
        }
    }
    
    // MARK: - Additional Health Data Queries
    
    /// Get steps count for a date range
    func getStepsCount(for startDate: Date, to endDate: Date) async throws -> Int {
        guard let stepType = HKQuantityType.quantityType(forIdentifier: .stepCount) else {
            throw HealthKitError.invalidType
        }
        
        let predicate = HKQuery.predicateForSamples(
            withStart: startDate,
            end: endDate,
            options: .strictStartDate
        )
        
        return try await withCheckedThrowingContinuation { continuation in
            let query = HKStatisticsQuery(
                quantityType: stepType,
                quantitySamplePredicate: predicate,
                options: .cumulativeSum
            ) { _, result, error in
                if let error = error {
                    continuation.resume(throwing: error)
                    return
                }
                
                guard let result = result,
                      let sum = result.sumQuantity() else {
                    continuation.resume(returning: 0)
                    return
                }
                
                let steps = Int(sum.doubleValue(for: HKUnit.count()))
                continuation.resume(returning: steps)
            }
            
            healthStore.execute(query)
        }
    }
    
    /// Get active energy burned for a date range
    func getActiveEnergyBurned(for startDate: Date, to endDate: Date) async throws -> Double {
        guard let energyType = HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned) else {
            throw HealthKitError.invalidType
        }
        
        let predicate = HKQuery.predicateForSamples(
            withStart: startDate,
            end: endDate,
            options: .strictStartDate
        )
        
        return try await withCheckedThrowingContinuation { continuation in
            let query = HKStatisticsQuery(
                quantityType: energyType,
                quantitySamplePredicate: predicate,
                options: .cumulativeSum
            ) { _, result, error in
                if let error = error {
                    continuation.resume(throwing: error)
                    return
                }
                
                guard let result = result,
                      let sum = result.sumQuantity() else {
                    continuation.resume(returning: 0.0)
                    return
                }
                
                let energy = sum.doubleValue(for: HKUnit.kilocalorie())
                continuation.resume(returning: energy)
            }
            
            healthStore.execute(query)
        }
    }
    
    /// Get workouts for a date range
    func getWorkouts(from startDate: Date, to endDate: Date) async throws -> [HKWorkout] {
        let workoutType = HKObjectType.workoutType()
        let predicate = HKQuery.predicateForSamples(
            withStart: startDate,
            end: endDate,
            options: .strictStartDate
        )
        
        return try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: workoutType,
                predicate: predicate,
                limit: HKObjectQueryNoLimit,
                sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)]
            ) { _, samples, error in
                if let error = error {
                    continuation.resume(throwing: error)
                    return
                }
                
                let workouts = samples?.compactMap { $0 as? HKWorkout } ?? []
                continuation.resume(returning: workouts)
            }
            
            healthStore.execute(query)
        }
    }
    
    /// Get active minutes (time in heart rate zone) for a date range
    func getActiveMinutes(for startDate: Date, to endDate: Date) async throws -> Int {
        // Calculate active minutes from workouts in the date range
        let workouts = try await getWorkouts(from: startDate, to: endDate)
        let totalMinutes = workouts.reduce(0) { total, workout in
            let duration = workout.endDate.timeIntervalSince(workout.startDate)
            return total + Int(duration / 60)
        }
        return totalMinutes
    }
    
    /// Get resting heart rate (average of lowest heart rate samples)
    func getRestingHeartRate() async throws -> Double? {
        guard let heartRateType = HKQuantityType.quantityType(forIdentifier: .heartRate) else {
            throw HealthKitError.invalidType
        }
        
        // Get heart rate samples from last 7 days, during rest periods (typically night/early morning)
        let calendar = Calendar.current
        let now = Date()
        let weekAgo = calendar.date(byAdding: .day, value: -7, to: now)!
        
        return try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: heartRateType,
                predicate: HKQuery.predicateForSamples(
                    withStart: weekAgo,
                    end: now,
                    options: .strictStartDate
                ),
                limit: 100,
                sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)]
            ) { _, samples, error in
                if let error = error {
                    continuation.resume(throwing: error)
                    return
                }
                
                guard let samples = samples as? [HKQuantitySample] else {
                    continuation.resume(returning: nil)
                    return
                }
                
                // Filter for resting periods (typically 2-6 AM) and get average
                let calendar = Calendar.current
                let restingSamples = samples.filter { sample in
                    let hour = calendar.component(.hour, from: sample.startDate)
                    return hour >= 2 && hour <= 6
                }
                
                guard !restingSamples.isEmpty else {
                    // If no resting samples, use overall average
                    let allValues = samples.compactMap { $0.quantity.doubleValue(for: HKUnit(from: "count/min")) }
                    guard !allValues.isEmpty else {
                        continuation.resume(returning: nil)
                        return
                    }
                    let avg = allValues.reduce(0, +) / Double(allValues.count)
                    continuation.resume(returning: avg)
                    return
                }
                
                let restingValues = restingSamples.compactMap { $0.quantity.doubleValue(for: HKUnit(from: "count/min")) }
                let avgResting = restingValues.reduce(0, +) / Double(restingValues.count)
                continuation.resume(returning: avgResting)
            }
            
            healthStore.execute(query)
        }
    }
    
    /// Get sleep hours for a date range
    func getSleepHours(for startDate: Date, to endDate: Date) async throws -> Double {
        guard let sleepType = HKCategoryType.categoryType(forIdentifier: .sleepAnalysis) else {
            throw HealthKitError.invalidType
        }
        
        let predicate = HKQuery.predicateForSamples(
            withStart: startDate,
            end: endDate,
            options: .strictStartDate
        )
        
        return try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: sleepType,
                predicate: predicate,
                limit: HKObjectQueryNoLimit,
                sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)]
            ) { _, samples, error in
                if let error = error {
                    continuation.resume(throwing: error)
                    return
                }
                
                guard let samples = samples as? [HKCategorySample] else {
                    continuation.resume(returning: 0.0)
                    return
                }
                
                var totalSleep: TimeInterval = 0
                for sample in samples {
                    if sample.value == HKCategoryValueSleepAnalysis.asleepUnspecified.rawValue ||
                       sample.value == HKCategoryValueSleepAnalysis.asleepCore.rawValue ||
                       sample.value == HKCategoryValueSleepAnalysis.asleepDeep.rawValue ||
                       sample.value == HKCategoryValueSleepAnalysis.asleepREM.rawValue {
                        totalSleep += sample.endDate.timeIntervalSince(sample.startDate)
                    }
                }
                
                let hours = totalSleep / 3600.0
                continuation.resume(returning: hours)
            }
            
            healthStore.execute(query)
        }
    }
    
    /// Get latest HRV (Heart Rate Variability) value
    func getLatestHRV() async throws -> Double? {
        guard let hrvType = HKQuantityType.quantityType(forIdentifier: .heartRateVariabilitySDNN) else {
            throw HealthKitError.invalidType
        }
        
        let calendar = Calendar.current
        let now = Date()
        let weekAgo = calendar.date(byAdding: .day, value: -7, to: now)!
        
        return try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: hrvType,
                predicate: HKQuery.predicateForSamples(
                    withStart: weekAgo,
                    end: now,
                    options: .strictStartDate
                ),
                limit: 1,
                sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)]
            ) { _, samples, error in
                if let error = error {
                    continuation.resume(throwing: error)
                    return
                }
                
                guard let sample = samples?.first as? HKQuantitySample else {
                    continuation.resume(returning: nil)
                    return
                }
                
                let hrvValue = sample.quantity.doubleValue(for: HKUnit.secondUnit(with: .milli))
                continuation.resume(returning: hrvValue)
            }
            
            healthStore.execute(query)
        }
    }
    
    /// Get distance walked/run for a date range (in kilometers)
    func getDistanceWalkingRunning(for startDate: Date, to endDate: Date) async throws -> Double {
        guard let distanceType = HKQuantityType.quantityType(forIdentifier: .distanceWalkingRunning) else {
            throw HealthKitError.invalidType
        }
        
        let predicate = HKQuery.predicateForSamples(withStart: startDate, end: endDate, options: .strictStartDate)
        
        return try await withCheckedThrowingContinuation { continuation in
            let query = HKStatisticsQuery(quantityType: distanceType, quantitySamplePredicate: predicate, options: .cumulativeSum) { _, result, error in
                if let error = error {
                    continuation.resume(throwing: error)
                    return
                }
                guard let result = result, let sum = result.sumQuantity() else {
                    continuation.resume(returning: 0.0)
                    return
                }
                // Convert meters to kilometers
                let kilometers = sum.doubleValue(for: HKUnit.meter()) / 1000.0
                continuation.resume(returning: kilometers)
            }
            healthStore.execute(query)
        }
    }
    
    /// Get flights climbed for a date range
    func getFlightsClimbed(for startDate: Date, to endDate: Date) async throws -> Int {
        guard let flightsType = HKQuantityType.quantityType(forIdentifier: .flightsClimbed) else {
            throw HealthKitError.invalidType
        }
        
        let predicate = HKQuery.predicateForSamples(withStart: startDate, end: endDate, options: .strictStartDate)
        
        return try await withCheckedThrowingContinuation { continuation in
            let query = HKStatisticsQuery(quantityType: flightsType, quantitySamplePredicate: predicate, options: .cumulativeSum) { _, result, error in
                if let error = error {
                    continuation.resume(throwing: error)
                    return
                }
                guard let result = result, let sum = result.sumQuantity() else {
                    continuation.resume(returning: 0)
                    return
                }
                continuation.resume(returning: Int(sum.doubleValue(for: HKUnit.count())))
            }
            healthStore.execute(query)
        }
    }
    
    /// Get latest VO2 Max value
    func getLatestVO2Max() async throws -> Double? {
        guard let vo2MaxType = HKQuantityType.quantityType(forIdentifier: .vo2Max) else {
            throw HealthKitError.invalidType
        }
        
        let calendar = Calendar.current
        let now = Date()
        let yearAgo = calendar.date(byAdding: .year, value: -1, to: now)!
        
        return try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: vo2MaxType,
                predicate: HKQuery.predicateForSamples(
                    withStart: yearAgo,
                    end: now,
                    options: .strictStartDate
                ),
                limit: 1,
                sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)]
            ) { _, samples, error in
                if let error = error {
                    continuation.resume(throwing: error)
                    return
                }
                
                guard let sample = samples?.first as? HKQuantitySample else {
                    continuation.resume(returning: nil)
                    return
                }
                
                // VO2 Max is in ml/kg/min
                let vo2MaxValue = sample.quantity.doubleValue(for: HKUnit(from: "ml/kg*min"))
                continuation.resume(returning: vo2MaxValue)
            }
            
            healthStore.execute(query)
        }
    }
    
    /// Get average heart rate for a date range
    func getAverageHeartRate(for startDate: Date, to endDate: Date) async throws -> Double? {
        guard let heartRateType = HKQuantityType.quantityType(forIdentifier: .heartRate) else {
            throw HealthKitError.invalidType
        }
        
        let predicate = HKQuery.predicateForSamples(withStart: startDate, end: endDate, options: .strictStartDate)
        
        return try await withCheckedThrowingContinuation { continuation in
            let query = HKStatisticsQuery(quantityType: heartRateType, quantitySamplePredicate: predicate, options: .discreteAverage) { _, result, error in
                if let error = error {
                    continuation.resume(throwing: error)
                    return
                }
                guard let result = result, let average = result.averageQuantity() else {
                    continuation.resume(returning: nil)
                    return
                }
                continuation.resume(returning: average.doubleValue(for: HKUnit(from: "count/min")))
            }
            healthStore.execute(query)
        }
    }
    
    // MARK: - Write Data
    
    func saveWorkout(
        activityType: HKWorkoutActivityType,
        start: Date,
        end: Date,
        totalEnergyBurned: Double? = nil,
        totalDistance: Double? = nil,
        metadata: [String: Any]? = nil
    ) async throws {
        // Use HKWorkoutBuilder (recommended for iOS 17.0+)
        let configuration = HKWorkoutConfiguration()
        configuration.activityType = activityType
        
        let builder = HKWorkoutBuilder(healthStore: healthStore, configuration: configuration, device: nil)
        
        // Note: HKWorkoutBuilder.metadata is read-only, so we'll add metadata
        // to individual samples or handle it differently
        
        // Begin the workout session
        try await builder.beginCollection(at: start)
        
        // Add energy burned if available
        if let energyBurned = totalEnergyBurned {
            let energyType = HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned)!
            let energyQuantity = HKQuantity(unit: HKUnit.kilocalorie(), doubleValue: energyBurned)
            let energySample = HKQuantitySample(
                type: energyType,
                quantity: energyQuantity,
                start: start,
                end: end
            )
            try await builder.addSamples([energySample])
        }
        
        // Add distance if available
        if let distance = totalDistance {
            let distanceType = HKQuantityType.quantityType(forIdentifier: .distanceWalkingRunning)!
            let distanceQuantity = HKQuantity(unit: HKUnit.meter(), doubleValue: distance)
            let distanceSample = HKQuantitySample(
                type: distanceType,
                quantity: distanceQuantity,
                start: start,
                end: end
            )
            try await builder.addSamples([distanceSample])
        }
        
        // End collection and finish the workout
        try await builder.endCollection(at: end)
        guard let workout = try await builder.finishWorkout() else {
            throw HealthKitError.invalidType
        }
        
        try await healthStore.save(workout)
    }
    
    // MARK: - Sync to Server
    
    func syncToServer() async throws {
        let today = Date()
        let steps = try await getTodaySteps()
        let activeEnergy = try await getTodayActiveEnergy()
        let heartRate = try? await getAverageHeartRate(for: today)
        let sleepHours = try? await getSleepHours(for: today)
        
        let healthData = HealthDataSync(
            steps: steps,
            activeEnergyBurned: activeEnergy,
            heartRate: heartRate,
            sleepHours: sleepHours,
            date: today
        )
        
        try await APIService.shared.syncHealthData(healthData)
    }
}

// MARK: - Errors

enum HealthKitError: LocalizedError {
    case notAvailable
    case invalidType
    case authorizationDenied
    
    var errorDescription: String? {
        switch self {
        case .notAvailable:
            return "HealthKit är inte tillgängligt på denna enhet"
        case .invalidType:
            return "Ogiltig HealthKit-typ"
        case .authorizationDenied:
            return "Åtkomst till hälsodata nekad"
        }
    }
}


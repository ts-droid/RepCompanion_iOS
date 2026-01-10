import Foundation
import HealthKit
import Combine

class HealthKitManagerWatch: ObservableObject {
    static let shared = HealthKitManagerWatch()
    
    private let healthStore = HKHealthStore()
    
    @Published var isAuthorized = false
    
    private let readTypes: Set<HKObjectType> = [
        HKObjectType.quantityType(forIdentifier: .activeEnergyBurned)!,
        HKObjectType.quantityType(forIdentifier: .heartRate)!,
        HKObjectType.workoutType()
    ]
    
    private let writeTypes: Set<HKSampleType> = [
        HKObjectType.quantityType(forIdentifier: .activeEnergyBurned)!,
        HKObjectType.quantityType(forIdentifier: .heartRate)!,
        HKObjectType.workoutType()
    ]
    
    private init() {
        #if DEBUG
        self.isAuthorized = true
        #endif
        checkAuthorization()
    }
    
    func checkAuthorization() {
        #if DEBUG
        DispatchQueue.main.async {
            self.isAuthorized = true
        }
        return
        #endif
        
        guard HKHealthStore.isHealthDataAvailable() else { return }
        
        // We can't definitively check read access, but we can check sharing status for at least one type
        let status = healthStore.authorizationStatus(for: HKObjectType.workoutType())
        DispatchQueue.main.async {
            self.isAuthorized = (status == .sharingAuthorized)
        }
    }
    
    func requestAuthorization() async {
        guard HKHealthStore.isHealthDataAvailable() else { return }
        
        do {
            try await healthStore.requestAuthorization(toShare: writeTypes, read: readTypes)
            checkAuthorization()
        } catch {
            print("[Watch] HealthKit authorization failed: \(error.localizedDescription)")
        }
    }
}

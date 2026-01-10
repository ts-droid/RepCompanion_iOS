import Foundation
import CloudKit
import SwiftData
import Combine

/// Service for syncing data between devices using CloudKit
@MainActor
class CloudKitSyncService: ObservableObject {
    static let shared = CloudKitSyncService()
    
    private let container: CKContainer?
    private let privateDatabase: CKDatabase?
    
    @Published var syncStatus: SyncStatus = .idle
    @Published var lastSyncDate: Date?
    @Published var isAvailable: Bool = false
    
    enum SyncStatus {
        case idle
        case syncing
        case success
        case error(String)
    }
    
    private init() {
        // Check if CloudKit entitlements are available
        // If not, set container and database to nil
        if let _ = Bundle.main.object(forInfoDictionaryKey: "com.apple.developer.icloud-services") as? [String] {
            // CloudKit entitlement exists, initialize normally
            container = CKContainer(identifier: "iCloud.com.repcompanion.app")
            privateDatabase = container?.privateCloudDatabase
            isAvailable = true
        } else {
            // No CloudKit entitlement, set to nil
            print("[CloudKitSyncService] ⚠️ CloudKit entitlement not found - service will be unavailable")
            container = nil
            privateDatabase = nil
            isAvailable = false
            syncStatus = .error("CloudKit entitlement not configured")
        }
    }
    
    // MARK: - Account Status
    
    func checkAccountStatus() async throws -> CKAccountStatus {
        guard let container = container else {
            throw NSError(domain: "CloudKitSyncService", code: -1, userInfo: [NSLocalizedDescriptionKey: "CloudKit not available - missing entitlement"])
        }
        return try await container.accountStatus()
    }
    
    // MARK: - Sync Workout Sessions
    
    func syncWorkoutSessions(_ sessions: [WorkoutSession]) async throws {
        guard let privateDatabase = privateDatabase else {
            let error = NSError(domain: "CloudKitSyncService", code: -1, userInfo: [NSLocalizedDescriptionKey: "CloudKit not available - missing entitlement"])
            syncStatus = .error(error.localizedDescription)
            throw error
        }
        
        syncStatus = .syncing
        
        do {
            let records = try sessions.map { session in
                try createWorkoutSessionRecord(from: session)
            }
            
            let operation = CKModifyRecordsOperation(recordsToSave: records, recordIDsToDelete: nil)
            operation.savePolicy = .changedKeys
            operation.qualityOfService = .userInitiated
            
            try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
                operation.modifyRecordsResultBlock = { result in
                    switch result {
                    case .success:
                        continuation.resume()
                    case .failure(let error):
                        continuation.resume(throwing: error)
                    }
                }
                
                privateDatabase.add(operation)
            }
            
            lastSyncDate = Date()
            syncStatus = .success
            
        } catch {
            syncStatus = .error(error.localizedDescription)
            throw error
        }
    }
    
    func fetchWorkoutSessions() async throws -> [WorkoutSession] {
        guard let privateDatabase = privateDatabase else {
            throw NSError(domain: "CloudKitSyncService", code: -1, userInfo: [NSLocalizedDescriptionKey: "CloudKit not available - missing entitlement"])
        }
        
        let query = CKQuery(
            recordType: "WorkoutSession",
            predicate: NSPredicate(value: true)
        )
        query.sortDescriptors = [NSSortDescriptor(key: "createdAt", ascending: false)]
        
        let (matchResults, _) = try await privateDatabase.records(matching: query)
        
        var sessions: [WorkoutSession] = []
        
        for (_, result) in matchResults {
            switch result {
            case .success(let record):
                if let session = try? createWorkoutSession(from: record) {
                    sessions.append(session)
                }
            case .failure(let error):
                print("Error fetching record: \(error)")
            }
        }
        
        return sessions
    }
    
    // MARK: - Sync Exercise Logs
    
    func syncExerciseLogs(_ logs: [ExerciseLog]) async throws {
        guard let privateDatabase = privateDatabase else {
            throw NSError(domain: "CloudKitSyncService", code: -1, userInfo: [NSLocalizedDescriptionKey: "CloudKit not available - missing entitlement"])
        }
        
        let records = try logs.map { log in
            try createExerciseLogRecord(from: log)
        }
        
        let operation = CKModifyRecordsOperation(recordsToSave: records, recordIDsToDelete: nil)
        operation.savePolicy = .changedKeys
        operation.qualityOfService = .userInitiated
        
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            operation.modifyRecordsResultBlock = { result in
                switch result {
                case .success:
                    continuation.resume()
                case .failure(let error):
                    continuation.resume(throwing: error)
                }
            }
            
            privateDatabase.add(operation)
        }
    }
    
    // MARK: - Sync User Profile
    
    func syncUserProfile(_ profile: UserProfile) async throws {
        guard let privateDatabase = privateDatabase else {
            throw NSError(domain: "CloudKitSyncService", code: -1, userInfo: [NSLocalizedDescriptionKey: "CloudKit not available - missing entitlement"])
        }
        
        let record = try createUserProfileRecord(from: profile)
        
        try await privateDatabase.save(record)
    }
    
    func fetchUserProfile() async throws -> UserProfile? {
        guard let privateDatabase = privateDatabase else {
            throw NSError(domain: "CloudKitSyncService", code: -1, userInfo: [NSLocalizedDescriptionKey: "CloudKit not available - missing entitlement"])
        }
        
        let query = CKQuery(
            recordType: "UserProfile",
            predicate: NSPredicate(value: true)
        )
        
        let (matchResults, _) = try await privateDatabase.records(matching: query)
        
        guard let (_, result) = matchResults.first else {
            return nil
        }
        
        switch result {
        case .success(let record):
            return try? createUserProfile(from: record)
        case .failure:
            return nil
        }
    }
    
    // MARK: - Record Conversion
    
    private func createWorkoutSessionRecord(from session: WorkoutSession) throws -> CKRecord {
        let recordID = CKRecord.ID(recordName: session.id.uuidString)
        let record = CKRecord(recordType: "WorkoutSession", recordID: recordID)
        
        record["userId"] = session.userId
        record["templateId"] = session.templateId?.uuidString
        record["sessionType"] = session.sessionType
        record["sessionName"] = session.sessionName
        record["status"] = session.status
        record["startedAt"] = session.startedAt
        record["createdAt"] = session.startedAt // Use startedAt as createdAt for CloudKit
        record["completedAt"] = session.completedAt
        
        return record
    }
    
    private func createWorkoutSession(from record: CKRecord) throws -> WorkoutSession {
        guard let userId = record["userId"] as? String,
              let sessionType = record["sessionType"] as? String,
              let status = record["status"] as? String,
              let startedAt = record["startedAt"] as? Date ?? record["createdAt"] as? Date else {
            throw CloudKitError.invalidRecord
        }
        
        let templateIdString = record["templateId"] as? String
        let templateId = templateIdString.flatMap { UUID(uuidString: $0) }
        
        return WorkoutSession(
            id: UUID(uuidString: record.recordID.recordName) ?? UUID(),
            userId: userId,
            templateId: templateId,
            sessionType: sessionType,
            sessionName: record["sessionName"] as? String,
            status: status,
            startedAt: startedAt,
            completedAt: record["completedAt"] as? Date
        )
    }
    
    private func createExerciseLogRecord(from log: ExerciseLog) throws -> CKRecord {
        let recordID = CKRecord.ID(recordName: log.id.uuidString)
        let record = CKRecord(recordType: "ExerciseLog", recordID: recordID)
        
        record["workoutSessionId"] = log.workoutSessionId.uuidString
        record["exerciseKey"] = log.exerciseKey
        record["exerciseTitle"] = log.exerciseTitle
        record["exerciseOrderIndex"] = log.exerciseOrderIndex
        record["setNumber"] = log.setNumber
        record["weight"] = log.weight
        record["reps"] = log.reps
        record["completed"] = log.completed
        record["createdAt"] = log.createdAt
        
        return record
    }
    
    private func createUserProfileRecord(from profile: UserProfile) throws -> CKRecord {
        let recordID = CKRecord.ID(recordName: profile.userId)
        let record = CKRecord(recordType: "UserProfile", recordID: recordID)
        
        record["userId"] = profile.userId
        record["age"] = profile.age
        record["sex"] = profile.sex
        record["bodyWeight"] = profile.bodyWeight
        record["height"] = profile.height
        record["trainingLevel"] = profile.trainingLevel
        record["sessionsPerWeek"] = profile.sessionsPerWeek
        record["sessionDuration"] = profile.sessionDuration
        
        return record
    }
    
    private func createUserProfile(from record: CKRecord) throws -> UserProfile {
        guard let userId = record["userId"] as? String else {
            throw CloudKitError.invalidRecord
        }
        
        return UserProfile(
            userId: userId,
            age: record["age"] as? Int,
            sex: record["sex"] as? String,
            bodyWeight: record["bodyWeight"] as? Int,
            height: record["height"] as? Int,
            trainingLevel: record["trainingLevel"] as? String,
            onboardingCompleted: true
        )
    }
    
    // MARK: - Full Sync
    
    func performFullSync(modelContext: ModelContext) async throws {
        syncStatus = .syncing
        
        // Fetch remote data
        _ = try await fetchWorkoutSessions()
        _ = try await fetchUserProfile()
        
        // TODO: Merge with local data in modelContext
        // This would require comparing timestamps and resolving conflicts
        
        // Upload local data
        let localSessions = try modelContext.fetch(FetchDescriptor<WorkoutSession>())
        try await syncWorkoutSessions(localSessions)
        
        if let profile = try? modelContext.fetch(FetchDescriptor<UserProfile>()).first {
            try await syncUserProfile(profile)
        }
        
        lastSyncDate = Date()
        syncStatus = .success
    }
}

// MARK: - Errors

enum CloudKitError: LocalizedError {
    case invalidRecord
    case syncFailed
    
    var errorDescription: String? {
        switch self {
        case .invalidRecord:
            return "Ogiltig CloudKit-post"
        case .syncFailed:
            return "Synkning misslyckades"
        }
    }
}


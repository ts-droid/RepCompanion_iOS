import Foundation
import Network
import Combine

/// Service for handling offline data storage and syncing
@MainActor
class OfflineSyncService: ObservableObject {
    static let shared = OfflineSyncService()
    
    @Published var isOnline = true
    @Published var pendingSyncCount = 0
    @Published var isSyncing = false
    
    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "NetworkMonitor")
    private var cancellables = Set<AnyCancellable>()
    
    // Queue keys
    private let workoutQueueKey = "offline_workout_queue"
    private let exerciseLogQueueKey = "offline_exercise_log_queue"
    private let sessionCompleteQueueKey = "offline_session_complete_queue"
    
    private init() {
        startNetworkMonitoring()
        loadPendingSyncCount()
    }
    
    // MARK: - Network Monitoring
    
    private func startNetworkMonitoring() {
        monitor.pathUpdateHandler = { [weak self] path in
            Task { @MainActor in
                let wasOnline = self?.isOnline ?? true
                self?.isOnline = path.status == .satisfied
                
                if !wasOnline && self?.isOnline == true {
                    // Network just came back - trigger sync
                    print("[OfflineSync] Network available, starting sync...")
                    await self?.syncPendingItems()
                }
            }
        }
        monitor.start(queue: queue)
    }
    
    // MARK: - Queue Management
    
    /// Queue a workout session for sync when online
    func queueWorkoutSession(_ session: WorkoutSession) {
        var queue = getQueue(key: workoutQueueKey)
        // Convert WorkoutSession to dictionary for encoding
        let sessionDict: [String: Any] = [
            "id": session.id.uuidString,
            "userId": session.userId,
            "templateId": session.templateId?.uuidString as Any,
            "sessionType": session.sessionType,
            "sessionName": session.sessionName as Any,
            "status": session.status,
            "startedAt": ISO8601DateFormatter().string(from: session.startedAt),
            "completedAt": session.completedAt.map { ISO8601DateFormatter().string(from: $0) } as Any,
            "notes": session.notes as Any,
            "movergyScore": session.movergyScore as Any
        ]
        if let sessionData = try? JSONSerialization.data(withJSONObject: sessionDict) {
            queue.append(sessionData)
            saveQueue(key: workoutQueueKey, queue: queue)
            updatePendingCount()
        }
    }
    
    /// Queue an exercise log for sync when online
    func queueExerciseLog(_ log: ExerciseLog) {
        var queue = getQueue(key: exerciseLogQueueKey)
        // Convert ExerciseLog to dictionary for encoding
        let logDict: [String: Any] = [
            "id": log.id.uuidString,
            "workoutSessionId": log.workoutSessionId.uuidString,
            "exerciseKey": log.exerciseKey,
            "exerciseTitle": log.exerciseTitle,
            "exerciseOrderIndex": log.exerciseOrderIndex,
            "setNumber": log.setNumber,
            "weight": log.weight as Any,
            "reps": log.reps as Any,
            "completed": log.completed,
            "createdAt": ISO8601DateFormatter().string(from: log.createdAt)
        ]
        if let logData = try? JSONSerialization.data(withJSONObject: logDict) {
            queue.append(logData)
            saveQueue(key: exerciseLogQueueKey, queue: queue)
            updatePendingCount()
        }
    }
    
    /// Queue session completion for sync when online
    func queueSessionCompletion(sessionId: UUID, movergyScore: Int?) {
        var queue = getQueue(key: sessionCompleteQueueKey)
        let completion: [String: Any] = [
            "sessionId": sessionId.uuidString,
            "movergyScore": movergyScore as Any,
            "timestamp": Date().timeIntervalSince1970
        ]
        if let data = try? JSONSerialization.data(withJSONObject: completion) {
            queue.append(data)
            saveQueue(key: sessionCompleteQueueKey, queue: queue)
            updatePendingCount()
        }
    }
    
    // MARK: - Sync Operations
    
    /// Sync all pending items when network is available
    func syncPendingItems() async {
        guard isOnline, !isSyncing else {
            print("[OfflineSync] Cannot sync - offline or already syncing")
            return
        }
        
        isSyncing = true
        defer { isSyncing = false }
        
        print("[OfflineSync] Starting sync of pending items...")
        
        // Sync workout sessions
        await syncWorkoutSessions()
        
        // Sync exercise logs
        await syncExerciseLogs()
        
        // Sync session completions
        await syncSessionCompletions()
        
        updatePendingCount()
        print("[OfflineSync] Sync completed")
    }
    
    private func syncWorkoutSessions() async {
        let queue = getQueue(key: workoutQueueKey)
        guard !queue.isEmpty else { return }
        
        print("[OfflineSync] Syncing \(queue.count) workout sessions...")
        
        var failedItems: [Data] = []
        
        for data in queue {
            // Decode dictionary from stored data
            guard let sessionDict = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let idString = sessionDict["id"] as? String,
                  let id = UUID(uuidString: idString),
                  let userId = sessionDict["userId"] as? String,
                  let sessionType = sessionDict["sessionType"] as? String,
                  let status = sessionDict["status"] as? String,
                  let startedAtString = sessionDict["startedAt"] as? String,
                  let startedAt = ISO8601DateFormatter().date(from: startedAtString) else {
                continue
            }
            
            // Recreate WorkoutSession from dictionary
            let templateIdString = sessionDict["templateId"] as? String
            let templateId = templateIdString.flatMap { UUID(uuidString: $0) }
            let completedAtString = sessionDict["completedAt"] as? String
            let completedAt = completedAtString.flatMap { ISO8601DateFormatter().date(from: $0) }
            
            let session = WorkoutSession(
                id: id,
                userId: userId,
                templateId: templateId,
                sessionType: sessionType,
                sessionName: sessionDict["sessionName"] as? String,
                status: status,
                startedAt: startedAt,
                completedAt: completedAt,
                notes: sessionDict["notes"] as? String,
                movergyScore: sessionDict["movergyScore"] as? Int
            )
            
            do {
                // Try to sync to server via APIService
                try await APIService.shared.createWorkoutSession(session)
                print("[OfflineSync] Synced workout session: \(session.id)")
            } catch {
                print("[OfflineSync] Failed to sync workout session: \(error)")
                failedItems.append(data)
            }
        }
        
        // Keep only failed items
        saveQueue(key: workoutQueueKey, queue: failedItems)
    }
    
    private func syncExerciseLogs() async {
        let queue = getQueue(key: exerciseLogQueueKey)
        guard !queue.isEmpty else { return }
        
        print("[OfflineSync] Syncing \(queue.count) exercise logs...")
        
        var failedItems: [Data] = []
        
        for data in queue {
            // Decode dictionary from stored data
            guard let logDict = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let idString = logDict["id"] as? String,
                  let id = UUID(uuidString: idString),
                  let workoutSessionIdString = logDict["workoutSessionId"] as? String,
                  let workoutSessionId = UUID(uuidString: workoutSessionIdString),
                  let exerciseKey = logDict["exerciseKey"] as? String,
                  let exerciseTitle = logDict["exerciseTitle"] as? String,
                  let exerciseOrderIndex = logDict["exerciseOrderIndex"] as? Int,
                  let setNumber = logDict["setNumber"] as? Int,
                  let completed = logDict["completed"] as? Bool,
                  let createdAtString = logDict["createdAt"] as? String,
                  let _ = ISO8601DateFormatter().date(from: createdAtString) else {
                continue
            }
            
            // Recreate ExerciseLog from dictionary
            // Note: createdAt is set automatically in init, so we don't need to pass it
            let log = ExerciseLog(
                id: id,
                workoutSessionId: workoutSessionId,
                exerciseKey: exerciseKey,
                exerciseTitle: exerciseTitle,
                exerciseOrderIndex: exerciseOrderIndex,
                setNumber: setNumber,
                weight: logDict["weight"] as? Double,
                reps: logDict["reps"] as? Int,
                completed: completed
            )
            
            do {
                // Try to sync to server via APIService
                try await APIService.shared.createExerciseLog(log)
                print("[OfflineSync] Synced exercise log: \(log.id)")
            } catch {
                print("[OfflineSync] Failed to sync exercise log: \(error)")
                failedItems.append(data)
            }
        }
        
        // Keep only failed items
        saveQueue(key: exerciseLogQueueKey, queue: failedItems)
    }
    
    private func syncSessionCompletions() async {
        let queue = getQueue(key: sessionCompleteQueueKey)
        guard !queue.isEmpty else { return }
        
        print("[OfflineSync] Syncing \(queue.count) session completions...")
        
        var failedItems: [Data] = []
        
        for data in queue {
            guard let completion = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let sessionIdString = completion["sessionId"] as? String,
                  let sessionId = UUID(uuidString: sessionIdString) else {
                continue
            }
            
            let movergyScore = completion["movergyScore"] as? Int
            
            do {
                // Try to complete session on server
                try await APIService.shared.completeWorkoutSession(sessionId: sessionId, movergyScore: movergyScore)
                print("[OfflineSync] Synced session completion: \(sessionId)")
            } catch {
                print("[OfflineSync] Failed to sync session completion: \(error)")
                failedItems.append(data)
            }
        }
        
        // Keep only failed items
        saveQueue(key: sessionCompleteQueueKey, queue: failedItems)
    }
    
    // MARK: - Queue Helpers
    
    private func getQueue(key: String) -> [Data] {
        guard let data = UserDefaults.standard.data(forKey: key),
              let queue = try? JSONDecoder().decode([Data].self, from: data) else {
            return []
        }
        return queue
    }
    
    private func saveQueue(key: String, queue: [Data]) {
        if let encoded = try? JSONEncoder().encode(queue) {
            UserDefaults.standard.set(encoded, forKey: key)
        }
    }
    
    private func updatePendingCount() {
        let workoutCount = getQueue(key: workoutQueueKey).count
        let logCount = getQueue(key: exerciseLogQueueKey).count
        let completionCount = getQueue(key: sessionCompleteQueueKey).count
        pendingSyncCount = workoutCount + logCount + completionCount
    }
    
    private func loadPendingSyncCount() {
        updatePendingCount()
    }
    
    /// Clear all pending syncs (use with caution)
    func clearPendingSyncs() {
        UserDefaults.standard.removeObject(forKey: workoutQueueKey)
        UserDefaults.standard.removeObject(forKey: exerciseLogQueueKey)
        UserDefaults.standard.removeObject(forKey: sessionCompleteQueueKey)
        updatePendingCount()
    }
}


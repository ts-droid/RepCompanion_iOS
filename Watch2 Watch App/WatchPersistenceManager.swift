import Foundation
import SwiftData
import WatchConnectivity
import Network
import Combine

#if os(watchOS)
import WatchKit
#endif

#if os(watchOS)
/// Watch-optimized persistence controller with offline support
class WatchPersistenceManager: NSObject, ObservableObject, WCSessionDelegate {
    static let shared = WatchPersistenceManager()

    
    var container: ModelContainer?
    var watchSession: WCSession?
    
    @Published var sessionActivationState: WCSessionActivationState = .notActivated
    @Published var isReachable: Bool = false
    
    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "WatchNetworkMonitor")
    
    // Offline queue
    private let offlineQueueKey = "watch_offline_queue"
    
    override private init() {
        super.init()
        setupSwiftData()
        setupWatchConnectivity()
        startNetworkMonitoring()
    }
    
    // MARK: - Network Monitoring
    
    private func startNetworkMonitoring() {
        monitor.pathUpdateHandler = { [weak self] path in
            let isOnline = path.status == .satisfied
            if isOnline {
                Task { @MainActor [weak self] in
                    self?.processQueuedSyncs()
                }
            }
        }
        monitor.start(queue: queue)
    }
    
    // MARK: - SwiftData Setup
    
    private func setupSwiftData() {
        if #available(watchOS 10.0, *) {
            let schema = Schema([
                WorkoutSession.self,
                ExerciseLog.self,
                WorkoutSet.self,
                UserProfile.self,
                ProgramTemplate.self,
                ProgramTemplateExercise.self,
                ExerciseCatalog.self
            ])
            
            let modelConfiguration = ModelConfiguration(
                schema: schema,
                isStoredInMemoryOnly: false,
                allowsSave: true
            )
            
            do {
                container = try ModelContainer(for: schema, configurations: [modelConfiguration])
                print("[Watch] SwiftData container created (persistent)")
            } catch {
                print("[Watch] Error creating SwiftData container: \(error)")
                container = nil
            }
        } else {
            container = nil
        }
    }
    
    // MARK: - Watch Connectivity
    
    private func setupWatchConnectivity() {
        if WCSession.isSupported() {
            watchSession = WCSession.default
            watchSession?.delegate = self
            
            if watchSession?.activationState != .activated {
                watchSession?.activate()
                print("[Watch] WCSession activate called")
            } else {
                print("[Watch] WCSession already activated")
            }
        } else {
             print("[Watch] Watch Connectivity not supported")
        }
    }
    
    @MainActor
    var mainContext: ModelContext? {
        return container?.mainContext
    }
    
    // MARK: - WCSessionDelegate
    
    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        DispatchQueue.main.async {
            self.sessionActivationState = activationState
            self.isReachable = session.isReachable
        }
        
        if let error = error {
            print("[Watch] WCSession activation failed: \(error.localizedDescription)")
        } else {
            print("[Watch] WCSession activated: \(activationState.rawValue)")
            if activationState == .activated {
                Task { @MainActor [weak self] in
                    self?.processQueuedSyncs()
                }
            }
        }
    }
    
    func sessionReachabilityDidChange(_ session: WCSession) {
        DispatchQueue.main.async {
             self.isReachable = session.isReachable
        }
        print("[Watch] Reachability changed: \(session.isReachable)")
    }
    
    func session(_ session: WCSession, didReceiveMessage message: [String : Any]) {
        if let type = message["type"] as? String, type == "workout_start" {
            print("[Watch] Received workout start from iPhone")
            Task { @MainActor in
                self.handleWorkoutStart(message: message)
            }
        }
    }
    
    // MARK: - Save with Offline Support
    
    @MainActor
    public func logActiveSet(
        sessionId: UUID,
        exerciseName: String,
        exerciseOrderIndex: Int,
        setNumber: Int,
        reps: Int,
        weight: Double
    ) {
        // Always save locally first (offline-first approach)
        if let context = mainContext {
            saveToSwiftData(
                context: context,
                sessionId: sessionId,
                exerciseName: exerciseName,
                exerciseOrderIndex: exerciseOrderIndex,
                setNumber: setNumber,
                reps: reps,
                weight: weight
            )
        } else {
            saveToUserDefaults(
                sessionId: sessionId,
                exerciseName: exerciseName,
                exerciseOrderIndex: exerciseOrderIndex,
                setNumber: setNumber,
                reps: reps,
                weight: weight
            )
        }
        
        // Try to sync to iPhone (will queue if offline)
        syncToiPhone(
            sessionId: sessionId,
            exerciseName: exerciseName,
            exerciseOrderIndex: exerciseOrderIndex,
            setNumber: setNumber,
            reps: reps,
            weight: weight
        )
    }
    
    @MainActor
    private func saveToSwiftData(
        context: ModelContext,
        sessionId: UUID,
        exerciseName: String,
        exerciseOrderIndex: Int,
        setNumber: Int,
        reps: Int,
        weight: Double
    ) {
        let descriptor = FetchDescriptor<WorkoutSession>(
            predicate: #Predicate { $0.id == sessionId }
        )
        
        let session: WorkoutSession
        if let existing = try? context.fetch(descriptor).first {
            session = existing
        } else {
            session = WorkoutSession(
                id: sessionId,
                userId: "watch-user",
                sessionType: "strength",
                status: "active"
            )
            context.insert(session)
        }
        
        let log = ExerciseLog(
            workoutSessionId: sessionId,
            exerciseKey: exerciseName.lowercased().replacingOccurrences(of: " ", with: "-"),
            exerciseTitle: exerciseName,
            exerciseOrderIndex: exerciseOrderIndex,
            setNumber: setNumber,
            weight: weight,
            reps: reps,
            completed: true
        )
        context.insert(log)
        
        do {
            try context.save()
            print("[Watch] Saved to SwiftData: \(exerciseName) - Set \(setNumber)")
        } catch {
            print("[Watch] Error saving to SwiftData: \(error)")
        }
    }
    
    private func saveToUserDefaults(
        sessionId: UUID,
        exerciseName: String,
        exerciseOrderIndex: Int,
        setNumber: Int,
        reps: Int,
        weight: Double
    ) {
        let key = "active_workout_\(sessionId.uuidString)"
        var workoutData = UserDefaults.standard.dictionary(forKey: key) ?? [:]
        
        var sets = workoutData["sets"] as? [[String: Any]] ?? []
        sets.append([
            "exerciseName": exerciseName,
            "exerciseOrderIndex": exerciseOrderIndex,
            "setNumber": setNumber,
            "reps": reps,
            "weight": weight,
            "timestamp": Date().timeIntervalSince1970
        ])
        
        workoutData["sets"] = sets
        workoutData["sessionId"] = sessionId.uuidString
        workoutData["lastUpdated"] = Date().timeIntervalSince1970
        
        UserDefaults.standard.set(workoutData, forKey: key)
        print("[Watch] Saved to UserDefaults: \(exerciseName) - Set \(setNumber)")
    }
    
    @MainActor
    func getActiveWorkout(sessionId: UUID) -> [[String: Any]]? {
        if let context = mainContext {
            return getFromSwiftData(context: context, sessionId: sessionId)
        } else {
            return getFromUserDefaults(sessionId: sessionId)
        }
    }
    
    @MainActor
    private func getFromSwiftData(context: ModelContext, sessionId: UUID) -> [[String: Any]]? {
        let descriptor = FetchDescriptor<ExerciseLog>(
            predicate: #Predicate { $0.workoutSessionId == sessionId }
        )
        guard let logs = try? context.fetch(descriptor) else { return nil }
        return logs.map { log in
            [
                "exerciseName": log.exerciseTitle,
                "exerciseOrderIndex": log.exerciseOrderIndex,
                "setNumber": log.setNumber,
                "reps": log.reps ?? 0,
                "weight": log.weight ?? 0.0,
                "timestamp": log.createdAt.timeIntervalSince1970
            ]
        }
    }
    
    private func getFromUserDefaults(sessionId: UUID) -> [[String: Any]]? {
        let key = "active_workout_\(sessionId.uuidString)"
        guard let workoutData = UserDefaults.standard.dictionary(forKey: key),
              let sets = workoutData["sets"] as? [[String: Any]] else {
            return nil
        }
        return sets
    }
    
    // MARK: - Sync to iPhone (with offline queue)
    
    private func syncToiPhone(
        sessionId: UUID,
        exerciseName: String,
        exerciseOrderIndex: Int,
        setNumber: Int,
        reps: Int,
        weight: Double
    ) {
        guard let session = watchSession else {
            queueForSync(sessionId: sessionId, exerciseName: exerciseName, exerciseOrderIndex: exerciseOrderIndex, setNumber: setNumber, reps: reps, weight: weight)
            return
        }
        
        if session.isReachable {
            let message: [String: Any] = [
                "type": "workout_update",
                "sessionId": sessionId.uuidString,
                "exerciseName": exerciseName,
                "exerciseOrderIndex": exerciseOrderIndex,
                "setNumber": setNumber,
                "reps": reps,
                "weight": weight,
                "timestamp": Date().timeIntervalSince1970
            ]
            
            session.sendMessage(message, replyHandler: { _ in
                print("[Watch] Synced to iPhone")
            }, errorHandler: { [weak self] error in
                print("[Watch] Error syncing to iPhone: \(error.localizedDescription)")
                self?.queueForSync(sessionId: sessionId, exerciseName: exerciseName, exerciseOrderIndex: exerciseOrderIndex, setNumber: setNumber, reps: reps, weight: weight)
            })
        } else {
            queueForSync(sessionId: sessionId, exerciseName: exerciseName, exerciseOrderIndex: exerciseOrderIndex, setNumber: setNumber, reps: reps, weight: weight)
        }
    }
    
    private func queueForSync(
        sessionId: UUID,
        exerciseName: String,
        exerciseOrderIndex: Int,
        setNumber: Int,
        reps: Int,
        weight: Double
    ) {
        var queue = getOfflineQueue()
        queue.append([
            "sessionId": sessionId.uuidString,
            "exerciseName": exerciseName,
            "exerciseOrderIndex": exerciseOrderIndex,
            "setNumber": setNumber,
            "reps": reps,
            "weight": weight,
            "timestamp": Date().timeIntervalSince1970
        ])
        saveOfflineQueue(queue)
        print("[Watch] Queued for sync: \(exerciseName) - Set \(setNumber)")
    }
    
    @MainActor
    func processQueuedSyncs() {
        guard let session = watchSession, session.isReachable else { return }
        let queue = getOfflineQueue()
        guard !queue.isEmpty else { return }
        
        print("[Watch] Processing \(queue.count) queued items...")
        var remainingQueue: [[String: Any]] = []
        
        for item in queue {
            guard let _ = item["sessionId"] as? String,
                  let exerciseName = item["exerciseName"] as? String,
                  let _ = item["exerciseOrderIndex"] as? Int,
                  let _ = item["setNumber"] as? Int,
                  let _ = item["reps"] as? Int,
                  let _ = item["weight"] as? Double else {
                continue
            }
            
            let message = item // ... simplified
            session.sendMessage(message, replyHandler: { _ in
                print("[Watch] Synced queued item: \(exerciseName)")
            }, errorHandler: { _ in
                remainingQueue.append(item)
            })
        }
        saveOfflineQueue(remainingQueue)
    }
    
    private func getOfflineQueue() -> [[String: Any]] {
        guard let data = UserDefaults.standard.data(forKey: offlineQueueKey),
              let queue = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else { return [] }
        return queue
    }
    
    private func saveOfflineQueue(_ queue: [[String: Any]]) {
        if let data = try? JSONSerialization.data(withJSONObject: queue) {
            UserDefaults.standard.set(data, forKey: offlineQueueKey)
        }
    }
    
    public func requestSyncFromiPhone() {
        guard let session = watchSession else { return }
        if session.activationState != .activated { session.activate() }
        if session.isReachable {
             session.sendMessage(["type": "request_sync"], replyHandler: nil, errorHandler: nil)
        }
    }
    
    @MainActor
    public func handleWorkoutStart(message: [String: Any]) {
        guard let sessionIdString = message["sessionId"] as? String,
              let sessionId = UUID(uuidString: sessionIdString),
              let timestamp = message["startedAt"] as? TimeInterval,
              let templateIdString = message["templateId"] as? String else {
            print("[Watch] Invalid start message")
            return
        }
        
        let templateId = UUID(uuidString: templateIdString)
        guard let context = mainContext else { return }
        
        // Check/Create Session
        let sessionDescriptor = FetchDescriptor<WorkoutSession>(
             predicate: #Predicate { $0.id == sessionId }
        )
        if (try? context.fetch(sessionDescriptor).first) == nil {
             let newSession = WorkoutSession(
                 id: sessionId,
                 userId: "watch-user",
                 templateId: templateId,
                 sessionType: "strength",
                 status: "active",
                 startedAt: Date(timeIntervalSince1970: timestamp)
             )
             context.insert(newSession)
             print("[Watch] Created new session: \(sessionId)")
        }
        
        // Handle Exercises
        if let exercisesData = message["exercises"] as? [[String: Any]] {
            for data in exercisesData {
                guard let idString = data["id"] as? String,
                      let id = UUID(uuidString: idString),
                      let name = data["name"] as? String else { continue }
                
                let existingExercise = try? context.fetch(FetchDescriptor<ProgramTemplateExercise>(predicate: #Predicate { $0.id == id })).first
                if existingExercise == nil {
                     let newExercise = ProgramTemplateExercise(
                         id: id,
                         exerciseKey: name.lowercased().replacingOccurrences(of: " ", with: "-"),
                         exerciseName: name,
                         orderIndex: data["orderIndex"] as? Int ?? 0,
                         targetSets: data["targetSets"] as? Int ?? 3,
                         targetReps: data["targetReps"] as? String ?? "8-10",
                         targetWeight: data["targetWeight"] as? Double ?? 0.0,
                         requiredEquipment: [],
                         muscles: []
                     )
                     if let tid = templateId, let template = (try? context.fetch(FetchDescriptor<ProgramTemplate>(predicate: #Predicate { $0.id == tid })))?.first {
                         newExercise.template = template
                     }
                     context.insert(newExercise)
                }
            }
        }
        try? context.save()
    }
    
    public func requestProgramSync() {
        guard let session = watchSession else { return }
        if session.activationState != .activated { session.activate() }
        if session.isReachable {
            print("[Watch] 📤 Requesting program sync via sendMessage with replyHandler...")
            session.sendMessage(["type": "fetch_program"], replyHandler: { [weak self] reply in
                print("[Watch] 📥 Received reply with keys: \(reply.keys)")
                if let templatesData = reply["templates"] as? [[String: Any]] {
                    print("[Watch] ✅ Received \(templatesData.count) templates in reply")
                    Task { @MainActor in
                        self?.handleProgramSync(userInfo: reply)
                    }
                } else {
                    print("[Watch] ⚠️ Reply didn't contain templates")
                }
            }, errorHandler: { error in
                print("[Watch] ❌ Error requesting program via message: \(error.localizedDescription)")
                // Fallback to userInfo (async, may take time)
                session.transferUserInfo(["type": "fetch_program"])
            })
        } else {
            print("[Watch] Session not reachable, requesting via transferUserInfo...")
            session.transferUserInfo(["type": "fetch_program"])
        }
    }
    
    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String : Any]) {
        print("[Watch] 📥 didReceiveUserInfo called with keys: \(userInfo.keys)")
        if let type = userInfo["type"] as? String {
            print("[Watch] 📥 UserInfo type: \(type)")
            if type == "program_sync" {
                print("[Watch] ✅ Received program sync via UserInfo")
                if let templates = userInfo["templates"] as? [[String: Any]] {
                    print("[Watch] 📦 Contains \(templates.count) templates")
                }
                Task { @MainActor in
                    self.handleProgramSync(userInfo: userInfo)
                }
            } else if type == "workout_start" {
                // Fallback for workout start via UserInfo (background)
                print("[Watch] Received workout start via UserInfo")
                Task { @MainActor in
                    self.handleWorkoutStart(message: userInfo)
                }
            }
        } else {
            print("[Watch] ⚠️ UserInfo has no 'type' key")
        }
    }
    
    @MainActor
    private func handleProgramSync(userInfo: [String: Any]) {
        guard let templatesData = userInfo["templates"] as? [[String: Any]],
              let context = mainContext else { return }
        
        print("[Watch] Processing \(templatesData.count) templates...")
        
        for templateData in templatesData {
            guard let idString = templateData["id"] as? String,
                  let id = UUID(uuidString: idString),
                  let name = templateData["templateName"] as? String,
                  let userId = templateData["userId"] as? String else { continue }
            
            // Check if template exists
            let descriptor = FetchDescriptor<ProgramTemplate>(predicate: #Predicate { $0.id == id })
            let template: ProgramTemplate
            
            if let existing = try? context.fetch(descriptor).first {
                template = existing
                template.templateName = name
            } else {
                template = ProgramTemplate(
                    id: id,
                    userId: userId,
                    templateName: name
                )
                context.insert(template)
            }
            
            // Handle exercises
            if let exercisesData = templateData["exercises"] as? [[String: Any]] {
                // We might want to clear existing exercises or sync smartly. 
                // For now, let's update/insert based on ID.
                
                for exData in exercisesData {
                    guard let exIdString = exData["id"] as? String,
                          let exId = UUID(uuidString: exIdString),
                          let exName = exData["exerciseName"] as? String else { continue }
                    
                    let exDescriptor = FetchDescriptor<ProgramTemplateExercise>(predicate: #Predicate { $0.id == exId })
                    
                    if let existingEx = try? context.fetch(exDescriptor).first {
                        // Update
                        existingEx.exerciseName = exName
                        existingEx.targetSets = exData["targetSets"] as? Int ?? 3
                        existingEx.targetReps = exData["targetReps"] as? String ?? "8-10"
                        existingEx.targetWeight = exData["targetWeight"] as? Double
                        existingEx.exerciseKey = exData["exerciseKey"] as? String ?? exName.lowercased()
                    } else {
                        let newEx = ProgramTemplateExercise(
                            id: exId,
                            exerciseKey: exData["exerciseKey"] as? String ?? exName.lowercased(),
                            exerciseName: exName,
                            orderIndex: exData["orderIndex"] as? Int ?? 0,
                            targetSets: exData["targetSets"] as? Int ?? 3,
                            targetReps: exData["targetReps"] as? String ?? "8-10",
                            targetWeight: exData["targetWeight"] as? Double
                        )
                        newEx.template = template
                        context.insert(newEx)
                    }
                }
            }
        }
        
        do {
            try context.save()
            print("[Watch] Program templates synced successfully")
        } catch {
            print("[Watch] Error saving templates: \(error)")
        }
    }
}
#endif

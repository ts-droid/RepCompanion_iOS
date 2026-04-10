import Foundation
import WatchConnectivity
import SwiftData
import Combine

class WatchConnectivityManager: NSObject, WCSessionDelegate, ObservableObject {
    static let shared = WatchConnectivityManager()
    
    @Published var isWatchAppInstalled = false
    @Published var isReachable = false
    
    private var session: WCSession?
    
    // Messaging queue for when session is not ready
    @Published var pendingWorkoutStart: [String: Any]?
    @Published var pendingFileQueues: [[String: Any]] = []
    
    override private init() {
        super.init()
        if WCSession.isSupported() {
            session = WCSession.default
            session?.delegate = self
            session?.activate()
        }
    }
    
    // MARK: - WCSessionDelegate
    
    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        DispatchQueue.main.async {
            self.isWatchAppInstalled = session.isWatchAppInstalled
            self.isReachable = session.isReachable
            
            // Flush pending messages if activated
            if activationState == .activated {
                self.flushPendingMessages()
            }
        }
        
        if let error = error {
            #if DEBUG
            print("WCSession activation failed: \(error.localizedDescription)")
            #endif
        } else {
            #if DEBUG
            print("WCSession activated with state: \(activationState.rawValue)")
            #endif
        }
    }
    
    func sessionDidBecomeInactive(_ session: WCSession) {
        // Code to handle the session becoming inactive
    }
    
    func sessionDidDeactivate(_ session: WCSession) {
        // Code to handle the session deactivating
        session.activate()
    }
    
    func sessionReachabilityDidChange(_ session: WCSession) {
        DispatchQueue.main.async {
            self.isReachable = session.isReachable
            if session.isReachable {
                self.flushPendingMessages()
            }
        }
    }

    private func flushPendingMessages() {
        guard let wcsession = self.session, wcsession.activationState == .activated else { return }
        
        if let payload = pendingWorkoutStart {
            #if DEBUG
            print("[WatchConnectivity] Flushing pending workout start...")
            #endif
            if wcsession.isReachable {
                wcsession.sendMessage(payload, replyHandler: nil) { error in
                     // Fallback to transferUserInfo
                     wcsession.transferUserInfo(payload)
                }
            } else {
                 wcsession.transferUserInfo(payload)
            }
            pendingWorkoutStart = nil
        }
        
        while !pendingFileQueues.isEmpty {
            let payload = pendingFileQueues.removeFirst()
            #if DEBUG
            print("[WatchConnectivity] Flushing pending set completion...")
            #endif
             if wcsession.isReachable {
                 wcsession.sendMessage(payload, replyHandler: nil)
            } else {
                 wcsession.transferUserInfo(payload)
            }
        }
    }
    
    func session(_ session: WCSession, didReceiveMessage message: [String : Any]) {
        if let type = message["type"] as? String {
             if type == "request_sync" {
                #if DEBUG
                print("[iOS] Received sync request from Watch")
                #endif
                DispatchQueue.main.async {
                    NotificationCenter.default.post(name: NSNotification.Name("WatchSyncRequested"), object: nil)
                    self.flushPendingMessages()
                }
             } else if type == "fetch_program" {
                 // No-reply version - fallback, sends via transferUserInfo
                 #if DEBUG
                 print("[iOS] Received fetch_program request from Watch (no reply expected)")
                 #endif
                 Task {
                     handleSyncRequest()
                 }
             } else if type == "workout_update" {
                 #if DEBUG
                 print("[iOS] 📥 Received workout_update from Watch")
                 #endif
                 Task { @MainActor in
                     self.handleWorkoutUpdate(message: message)
                 }
             } else if type == "workout_complete" {
                 #if DEBUG
                 print("[iOS] 📥 Received workout_complete from Watch")
                 #endif
                 Task { @MainActor in
                     self.handleWorkoutComplete(message: message)
                 }
             }
        }
    }
    
    @MainActor
    private func handleWorkoutUpdate(message: [String: Any]) {
        guard let sessionIdString = message["sessionId"] as? String,
              let sessionId = UUID(uuidString: sessionIdString),
              let exerciseName = message["exerciseName"] as? String,
              let setNumber = message["setNumber"] as? Int else {
            return
        }
        
        let reps = message["reps"] as? Int
        let weight = message["weight"] as? Double
        let orderIndex = message["exerciseOrderIndex"] as? Int ?? 0
        
        let container = PersistenceController.shared.container
        let context = ModelContext(container)
        
        // 1. Ensure session exists and is active
        let sessionDescriptor = FetchDescriptor<WorkoutSession>(predicate: #Predicate { $0.id == sessionId })
        if let session = try? context.fetch(sessionDescriptor).first {
            // Keep timer "fresh" if it was active
            if session.status == "active" && session.lastStartTime == nil {
                // If it was paused, maybe we should unpause it implicitly?
                // For now, let's keep the user's explicit pause/active logic on iPhone
            }
        }
        
        // 2. Log the set
        let log = ExerciseLog(
            workoutSessionId: sessionId,
            exerciseKey: exerciseName.lowercased().replacingOccurrences(of: " ", with: "-"),
            exerciseTitle: exerciseName,
            exerciseOrderIndex: orderIndex,
            setNumber: setNumber,
            weight: weight,
            reps: reps,
            completed: true
        )
        context.insert(log)
        try? context.save()
        
        #if DEBUG
        print("[iOS] ✅ Logged set from Watch: \(exerciseName) Set \(setNumber)")
        #endif
        NotificationCenter.default.post(name: NSNotification.Name("WatchLogReceived"), object: nil)
    }
    
    @MainActor
    private func handleWorkoutComplete(message: [String: Any]) {
        guard let sessionIdString = message["sessionId"] as? String,
              let sessionId = UUID(uuidString: sessionIdString) else {
            return
        }
        
        let context = ModelContext(PersistenceController.shared.container)
        let sessionDescriptor = FetchDescriptor<WorkoutSession>(predicate: #Predicate { $0.id == sessionId })
        
        if let session = try? context.fetch(sessionDescriptor).first {
            if session.status != "completed" {
                session.status = "completed"
                session.completedAt = Date()
                
                // Final duration update
                if let start = session.lastStartTime {
                    session.accumulatedTime += Date().timeIntervalSince(start)
                }
                session.lastStartTime = nil
                
                try? context.save()
                #if DEBUG
                print("[iOS] ✅ Workout completed from Watch: \(sessionIdString)")
                #endif
                NotificationCenter.default.post(name: NSNotification.Name("WatchWorkoutCompleted"), object: nil)
            }
        }
    }
    
    // With reply handler - for immediate sync response
    func session(_ session: WCSession, didReceiveMessage message: [String : Any], replyHandler: @escaping ([String : Any]) -> Void) {
        if let type = message["type"] as? String, type == "fetch_program" {
            #if DEBUG
            print("[iOS] 📥 Received fetch_program with replyHandler - responding immediately")
            #endif
            
            Task { @MainActor in
                let context = ModelContext(PersistenceController.shared.container)
                let descriptor = FetchDescriptor<ProgramTemplate>(sortBy: [SortDescriptor(\.createdAt, order: .reverse)])
                
                do {
                    let templates = try context.fetch(descriptor)
                    #if DEBUG
                    print("[iOS] ✅ Fetched \(templates.count) templates, sending in reply")
                    #endif
                    
                    let templatesData = templates.map { template -> [String: Any] in
                        var dict: [String: Any] = [
                            "id": template.id.uuidString,
                            "templateName": template.templateName,
                            "userId": template.userId,
                            "createdAt": template.createdAt.timeIntervalSince1970
                        ]
                        
                        let exercises = template.exercises
                        dict["exercises"] = exercises.map { exercise -> [String: Any] in
                            return [
                                "id": exercise.id.uuidString,
                                "templateId": exercise.template?.id.uuidString ?? "",
                                "exerciseName": exercise.exerciseName,
                                "exerciseKey": exercise.exerciseKey,
                                "orderIndex": exercise.orderIndex,
                                "targetSets": exercise.targetSets,
                                "targetReps": exercise.targetReps,
                                "targetWeight": exercise.targetWeight ?? 0.0
                            ]
                        }
                        return dict
                    }
                    
                    replyHandler(["templates": templatesData, "count": templates.count])
                } catch {
                    #if DEBUG
                    print("[iOS] ❌ Failed to fetch templates: \(error)")
                    #endif
                    replyHandler(["error": error.localizedDescription])
                }
            }
        } else {
            // For other message types, just acknowledge
            replyHandler(["received": true])
        }
    }
    
    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String : Any]) {
        if let type = userInfo["type"] as? String {
             if type == "fetch_program" {
                 Task {
                     handleSyncRequest()
                 }
             }
        }
    }
    
    // MARK: - Callbacks
    
    public func forceSync() {
        #if DEBUG
        print("[iOS] Force sync requested from UI")
        #endif
        
        guard let session = session, session.isPaired, session.isWatchAppInstalled else {
             #if DEBUG
             print("[WatchConnectivity] Cannot sync: Watch is not paired or app is not installed.")
             #endif
             return
        }
        
        Task {
            handleSyncRequest()
        }
    }
    
    @MainActor
    private func handleSyncRequest() {
        let context = ModelContext(PersistenceController.shared.container)
        let descriptor = FetchDescriptor<ProgramTemplate>(sortBy: [SortDescriptor(\.createdAt, order: .reverse)])
        
        do {
            let templates = try context.fetch(descriptor)
            #if DEBUG
            print("[WatchConnectivity] Fetched \(templates.count) templates for sync")
            #endif
            sendProgramTemplates(templates)
        } catch {
            #if DEBUG
            print("[WatchConnectivity] Failed to fetch templates: \(error)")
            #endif
        }
    }
}

extension WatchConnectivityManager {
    // MARK: - Messaging
    
    func sendProgramTemplates(_ templates: [ProgramTemplate]) {
        guard let wcsession = self.session else { return }
        
        // Serialize templates
        let templatesData = templates.map { template -> [String: Any] in
            var dict: [String: Any] = [
                "id": template.id.uuidString,
                "templateName": template.templateName,
                "userId": template.userId,
                "createdAt": template.createdAt.timeIntervalSince1970
            ]
            
            let exercises = template.exercises
            dict["exercises"] = exercises.map { exercise -> [String: Any] in
                return [
                    "id": exercise.id.uuidString,
                    "templateId": exercise.template?.id.uuidString ?? "",
                    "exerciseName": exercise.exerciseName,
                    "exerciseKey": exercise.exerciseKey, // Ensure this exists in updated model
                    "orderIndex": exercise.orderIndex,
                    "targetSets": exercise.targetSets,
                    "targetReps": exercise.targetReps,
                    "targetWeight": exercise.targetWeight ?? 0.0,
                    "requiredEquipment": exercise.requiredEquipment,
                    "muscles": exercise.muscles,
                    "notes": exercise.notes ?? ""
                ]
            }
            return dict
        }
        
        let payload: [String: Any] = [
            "type": "program_sync",
            "templates": templatesData,
            "timestamp": Date().timeIntervalSince1970
        ]
        
        #if DEBUG
        print("[WatchConnectivity] Sending \(templates.count) templates to Watch")
        #endif
        
        if wcsession.activationState == .activated {
            wcsession.transferUserInfo(payload)
        } else {
             #if DEBUG
             print("[WatchConnectivity] WCSession not activated, cannot send program")
             #endif
             // Could implement queuing for this too if crucial, but usually requested when active
        }
    }
    
    func sendWorkoutStart(session: WorkoutSession, template: ProgramTemplate?, exercises: [ProgramTemplateExercise]) {
        guard let wcsession = self.session else { return }
        
        // Prepare payload
        var payload: [String: Any] = [
            "type": "workout_start",
            "sessionId": session.id.uuidString,
            "startedAt": session.startedAt.timeIntervalSince1970,
            "templateId": session.templateId?.uuidString ?? "",
            "templateName": template?.templateName ?? "Quick Workout"
        ]
        
        // Serialize exercises
        let exercisesData = exercises.map { exercise -> [String: Any] in
            return [
                "id": exercise.id.uuidString,
                "name": exercise.exerciseName,
                "orderIndex": exercise.orderIndex,
                "targetSets": exercise.targetSets,
                "targetReps": exercise.targetReps,
                "targetWeight": exercise.targetWeight ?? 0.0
            ]
        }
        
        payload["exercises"] = exercisesData
        
        // Safety check: ensure session is activated before trying to send
        guard wcsession.activationState == .activated else {
            #if DEBUG
            print("[WatchConnectivity] WCSession not activated, QUEUING workout start")
            #endif
            self.pendingWorkoutStart = payload
            if wcsession.activationState == .notActivated { wcsession.activate() }
            return
        }
        
        // Send immediately
        if wcsession.isReachable {
            wcsession.sendMessage(payload, replyHandler: nil) { error in
                #if DEBUG
                print("Error sending workout start message: \(error.localizedDescription)")
                #endif
                wcsession.transferUserInfo(payload)
            }
        } else {
            wcsession.transferUserInfo(payload)
        }
        
        #if DEBUG
        print("[WatchConnectivity] Sent workout start for session: \(session.id)")
        #endif
    }
    
    // Function to update ongoing session state (like completed sets)
    func sendSetCompletion(log: ExerciseLog) {
         guard let wcsession = self.session else { return }
         
         let payload: [String: Any] = [
             "type": "set_completed",
             "sessionId": log.workoutSessionId.uuidString,
             "exerciseName": log.exerciseTitle,
             "setNumber": log.setNumber,
             "reps": log.reps ?? 0,
             "weight": log.weight ?? 0.0,
             "timestamp": log.createdAt.timeIntervalSince1970
         ]

         guard wcsession.activationState == .activated else {
             #if DEBUG
             print("[WatchConnectivity] WCSession not activated, QUEUING set completion")
             #endif
             self.pendingFileQueues.append(payload)
             return
         }
         
        if wcsession.isReachable {
             wcsession.sendMessage(payload, replyHandler: nil)
        } else {
             wcsession.transferUserInfo(payload)
        }
    }
}

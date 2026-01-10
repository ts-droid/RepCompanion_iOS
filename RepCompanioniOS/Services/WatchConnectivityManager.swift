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
            print("WCSession activation failed: \(error.localizedDescription)")
        } else {
            print("WCSession activated with state: \(activationState.rawValue)")
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
            print("[WatchConnectivity] Flushing pending workout start...")
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
            print("[WatchConnectivity] Flushing pending set completion...")
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
                print("[iOS] Received sync request from Watch")
                DispatchQueue.main.async {
                    NotificationCenter.default.post(name: NSNotification.Name("WatchSyncRequested"), object: nil)
                    self.flushPendingMessages()
                }
             } else if type == "fetch_program" {
                 // No-reply version - fallback, sends via transferUserInfo
                 print("[iOS] Received fetch_program request from Watch (no reply expected)")
                 Task {
                     await handleSyncRequest()
                 }
             }
        }
    }
    
    // With reply handler - for immediate sync response
    func session(_ session: WCSession, didReceiveMessage message: [String : Any], replyHandler: @escaping ([String : Any]) -> Void) {
        if let type = message["type"] as? String, type == "fetch_program" {
            print("[iOS] 📥 Received fetch_program with replyHandler - responding immediately")
            
            Task { @MainActor in
                let context = ModelContext(PersistenceController.shared.container)
                let descriptor = FetchDescriptor<ProgramTemplate>(sortBy: [SortDescriptor(\.createdAt, order: .reverse)])
                
                do {
                    let templates = try context.fetch(descriptor)
                    print("[iOS] ✅ Fetched \(templates.count) templates, sending in reply")
                    
                    let templatesData = templates.map { template -> [String: Any] in
                        var dict: [String: Any] = [
                            "id": template.id.uuidString,
                            "templateName": template.templateName,
                            "userId": template.userId,
                            "createdAt": template.createdAt.timeIntervalSince1970
                        ]
                        
                        if let exercises = template.exercises {
                            dict["exercises"] = exercises.map { exercise -> [String: Any] in
                                return [
                                    "id": exercise.id.uuidString,
                                    "templateId": exercise.templateId.uuidString,
                                    "exerciseName": exercise.exerciseName,
                                    "exerciseKey": exercise.exerciseKey,
                                    "orderIndex": exercise.orderIndex,
                                    "targetSets": exercise.targetSets,
                                    "targetReps": exercise.targetReps,
                                    "targetWeight": exercise.targetWeight ?? 0.0
                                ]
                            }
                        }
                        return dict
                    }
                    
                    replyHandler(["templates": templatesData, "count": templates.count])
                } catch {
                    print("[iOS] ❌ Failed to fetch templates: \(error)")
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
                 print("[iOS] Received fetch_program request via UserInfo")
                 Task {
                     await handleSyncRequest()
                 }
             }
        }
    }
    
    // MARK: - Callbacks
    
    public func forceSync() {
        print("[iOS] Force sync requested from UI")
        
        guard let session = session, session.isPaired, session.isWatchAppInstalled else {
             print("[WatchConnectivity] Cannot sync: Watch is not paired or app is not installed.")
             return
        }
        
        Task {
            await handleSyncRequest()
        }
    }
    
    @MainActor
    private func handleSyncRequest() {
        let context = ModelContext(PersistenceController.shared.container)
        let descriptor = FetchDescriptor<ProgramTemplate>(sortBy: [SortDescriptor(\.createdAt, order: .reverse)])
        
        do {
            let templates = try context.fetch(descriptor)
            print("[WatchConnectivity] Fetched \(templates.count) templates for sync")
            sendProgramTemplates(templates)
        } catch {
            print("[WatchConnectivity] Failed to fetch templates: \(error)")
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
            
            if let exercises = template.exercises {
                dict["exercises"] = exercises.map { exercise -> [String: Any] in
                    return [
                        "id": exercise.id.uuidString,
                        "templateId": exercise.templateId.uuidString,
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
            }
            return dict
        }
        
        let payload: [String: Any] = [
            "type": "program_sync",
            "templates": templatesData,
            "timestamp": Date().timeIntervalSince1970
        ]
        
        print("[WatchConnectivity] Sending \(templates.count) templates to Watch")
        
        if wcsession.activationState == .activated {
            wcsession.transferUserInfo(payload)
        } else {
             print("[WatchConnectivity] WCSession not activated, cannot send program")
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
            print("[WatchConnectivity] WCSession not activated, QUEUING workout start")
            self.pendingWorkoutStart = payload
            if wcsession.activationState == .notActivated { wcsession.activate() }
            return
        }
        
        // Send immediately
        if wcsession.isReachable {
            wcsession.sendMessage(payload, replyHandler: nil) { error in
                print("Error sending workout start message: \(error.localizedDescription)")
                wcsession.transferUserInfo(payload)
            }
        } else {
            wcsession.transferUserInfo(payload)
        }
        
        print("[WatchConnectivity] Sent workout start for session: \(session.id)")
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
             print("[WatchConnectivity] WCSession not activated, QUEUING set completion")
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

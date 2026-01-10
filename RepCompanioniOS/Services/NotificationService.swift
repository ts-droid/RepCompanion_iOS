import Foundation
import UserNotifications
import UIKit
import Combine

/// Service for managing push notifications and local notifications
@MainActor
class NotificationService: NSObject, ObservableObject {
    static let shared = NotificationService()
    
    @Published var authorizationStatus: UNAuthorizationStatus = .notDetermined
    
    private override init() {
        super.init()
        Task {
            await checkAuthorizationStatus()
        }
    }
    
    // MARK: - Authorization
    
    func requestAuthorization() async throws {
        let center = UNUserNotificationCenter.current()
        center.delegate = self
        
        let granted = try await center.requestAuthorization(options: [.alert, .sound, .badge])
        
        if granted {
            await MainActor.run {
                registerForRemoteNotifications()
            }
        }
        
        await checkAuthorizationStatus()
    }
    
    private func checkAuthorizationStatus() async {
        let center = UNUserNotificationCenter.current()
        let settings = await center.notificationSettings()
        authorizationStatus = settings.authorizationStatus
    }
    
    private func registerForRemoteNotifications() {
        UIApplication.shared.registerForRemoteNotifications()
    }
    
    // MARK: - Local Notifications
    
    func scheduleWorkoutReminder(
        title: String,
        body: String,
        date: Date,
        identifier: String
    ) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        content.categoryIdentifier = "WORKOUT_REMINDER"
        
        // Add action buttons
        let startAction = UNNotificationAction(
            identifier: "START_WORKOUT",
            title: "Starta pass",
            options: .foreground
        )
        let snoozeAction = UNNotificationAction(
            identifier: "SNOOZE",
            title: "Påminn om 30 min",
            options: []
        )
        
        let category = UNNotificationCategory(
            identifier: "WORKOUT_REMINDER",
            actions: [startAction, snoozeAction],
            intentIdentifiers: [],
            options: []
        )
        
        UNUserNotificationCenter.current().setNotificationCategories([category])
        
        let dateComponents = Calendar.current.dateComponents(
            [.year, .month, .day, .hour, .minute],
            from: date
        )
        let trigger = UNCalendarNotificationTrigger(dateMatching: dateComponents, repeats: false)
        
        let request = UNNotificationRequest(
            identifier: identifier,
            content: content,
            trigger: trigger
        )
        
        UNUserNotificationCenter.current().add(request) { error in
            if let error = error {
                print("Error scheduling notification: \(error)")
            }
        }
    }
    
    func scheduleMotivationalMessage(
        title: String,
        body: String,
        date: Date,
        identifier: String
    ) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        
        let dateComponents = Calendar.current.dateComponents(
            [.year, .month, .day, .hour, .minute],
            from: date
        )
        let trigger = UNCalendarNotificationTrigger(dateMatching: dateComponents, repeats: false)
        
        let request = UNNotificationRequest(
            identifier: identifier,
            content: content,
            trigger: trigger
        )
        
        UNUserNotificationCenter.current().add(request) { error in
            if let error = error {
                print("Error scheduling motivational message: \(error)")
            }
        }
    }
    
    func scheduleWeeklyReminders(for workoutDays: [Int]) {
        // Cancel existing reminders
        UNUserNotificationCenter.current().removeAllPendingNotificationRequests()
        
        let weekdays = ["Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag", "Söndag"]
        
        for day in workoutDays {
            let weekday = weekdays[day - 1]
            let identifier = "workout_reminder_\(day)"
            
            // Schedule for 8:00 AM on workout days
            var dateComponents = DateComponents()
            dateComponents.weekday = day
            dateComponents.hour = 8
            dateComponents.minute = 0
            
            scheduleWorkoutReminder(
                title: "Dags att träna! 💪",
                body: "Glöm inte ditt träningspass idag (\(weekday))",
                date: Calendar.current.date(from: dateComponents) ?? Date(),
                identifier: identifier
            )
        }
    }
    
    func cancelNotification(identifier: String) {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [identifier])
    }
    
    func cancelAllNotifications() {
        UNUserNotificationCenter.current().removeAllPendingNotificationRequests()
    }
    
    // MARK: - Remote Notifications
    
    func handleRemoteNotification(_ userInfo: [AnyHashable: Any]) {
        // Handle remote notification from server
        guard let aps = userInfo["aps"] as? [String: Any],
              let _ = aps["alert"] as? [String: Any] else {
            return
        }
        
        // Process notification based on type
        if let notificationType = userInfo["type"] as? String {
            switch notificationType {
            case "workout_reminder":
                // Handle workout reminder
                break
            case "achievement":
                // Handle achievement notification
                break
            case "challenge":
                // Handle challenge notification
                break
            default:
                break
            }
        }
    }
}

// MARK: - UNUserNotificationCenterDelegate

extension NotificationService: UNUserNotificationCenterDelegate {
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        // Show notification even when app is in foreground
        completionHandler([.banner, .sound, .badge])
    }
    
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        if response.actionIdentifier == "START_WORKOUT" {
            // Handle start workout action
            NotificationCenter.default.post(
                name: NSNotification.Name("StartWorkoutFromNotification"),
                object: nil
            )
        } else if response.actionIdentifier == "SNOOZE" {
            // Reschedule for 30 minutes later
            let newDate = Date().addingTimeInterval(30 * 60)
            scheduleWorkoutReminder(
                title: response.notification.request.content.title,
                body: response.notification.request.content.body,
                date: newDate,
                identifier: response.notification.request.identifier
            )
        }
        
        completionHandler()
    }
}


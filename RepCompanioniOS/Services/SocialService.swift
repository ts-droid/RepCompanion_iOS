import Foundation
import UIKit
import Combine

/// Service for social features - sharing progress and challenges
@MainActor
class SocialService: ObservableObject {
    static let shared = SocialService()
    
    @Published var sharedProgress: [ProgressShare] = []
    @Published var activeChallenges: [Challenge] = []
    
    private init() {}
    
    // MARK: - Share Progress
    
    func shareWorkoutProgress(
        workoutName: String,
        duration: TimeInterval,
        exercises: Int,
        totalVolume: Double
    ) async throws {
        let progress = ProgressShare(
            type: .workout,
            title: "I have completed: \(workoutName)",
            description: "\(exercises) exercises • \(Int(duration / 60)) min • \(Int(totalVolume)) kg total volume",
            metrics: [
                "duration": duration,
                "exercises": Double(exercises),
                "totalVolume": totalVolume
            ],
            imageURL: nil
        )
        
        let response = try await APIService.shared.shareProgress(progress)
        
        // Show share sheet
        await showShareSheet(url: response.shareURL, title: progress.title)
    }
    
    func shareMilestone(
        title: String,
        description: String,
        metrics: [String: Double]
    ) async throws {
        let progress = ProgressShare(
            type: .milestone,
            title: title,
            description: description,
            metrics: metrics,
            imageURL: nil
        )
        
        let response = try await APIService.shared.shareProgress(progress)
        
        await showShareSheet(url: response.shareURL, title: title)
    }
    
    private func showShareSheet(url: String, title: String) async {
        guard let url = URL(string: url) else { return }
        
        await MainActor.run {
            let activityVC = UIActivityViewController(
                activityItems: [url, title],
                applicationActivities: nil
            )
            
            if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
               let rootViewController = windowScene.windows.first?.rootViewController {
                rootViewController.present(activityVC, animated: true)
            }
        }
    }
    
    // MARK: - Challenges
    
    func fetchChallenges() async throws {
        let challenges = try await APIService.shared.getChallenges()
        activeChallenges = challenges
    }
    
    func joinChallenge(_ challenge: Challenge) async throws {
        // TODO: Implement join challenge API call
        // This would update the challenge on the server
    }
    
    func createChallenge(
        title: String,
        description: String,
        startDate: Date,
        endDate: Date
    ) async throws {
        // TODO: Implement create challenge API call
    }
    
    // MARK: - Leaderboards
    
    func getLeaderboard(for period: LeaderboardPeriod) async throws -> [LeaderboardEntry] {
        // TODO: Implement leaderboard API call
        return []
    }
    
    enum LeaderboardPeriod {
        case daily
        case weekly
        case monthly
        case allTime
    }
    
    struct LeaderboardEntry: Identifiable {
        let id: String
        let userId: String
        let userName: String
        let rank: Int
        let score: Double
        let metric: String
    }
}


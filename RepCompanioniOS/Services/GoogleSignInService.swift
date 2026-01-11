import Foundation
import UIKit
import Combine

#if canImport(GoogleSignIn)
import GoogleSignIn
#endif

/// Service for handling Google Sign-In authentication
/// 
/// SETUP INSTRUCTIONS:
/// 1. Add Google Sign-In SDK via Swift Package Manager:
///    - In Xcode: File > Add Package Dependencies
///    - URL: https://github.com/google/GoogleSignIn-iOS
///    - Version: Latest
///
/// 2. Get Google OAuth Client ID:
///    - Go to https://console.cloud.google.com
///    - Create/select a project
///    - Enable Google Sign-In API
///    - Create OAuth 2.0 Client ID for iOS
///    - Add your bundle identifier
///
/// 3. Add GoogleService-Info.plist to your project:
///    - Download from Firebase Console or create manually
///    - Add CLIENT_ID to the plist
///
/// 4. Configure URL Scheme in Info.plist:
///    - Add REVERSED_CLIENT_ID as URL scheme
@MainActor
class GoogleSignInService: ObservableObject {
    static let shared = GoogleSignInService()
    
    @Published private(set) var isConfigured = false
    
    private init() {
        // Try to configure Google Sign-In if SDK is available
        configureGoogleSignIn()
    }
    
    private func configureGoogleSignIn() {
        #if canImport(GoogleSignIn)
        print("[GoogleSignInService] 🔍 Checking for GoogleService-Info.plist...")
        guard let path = Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") else {
            print("[GoogleSignInService] ⚠️ GoogleService-Info.plist not found in bundle.")
            return
        }
        
        guard let plist = NSDictionary(contentsOfFile: path),
              let clientId = plist["CLIENT_ID"] as? String else {
            print("[GoogleSignInService] ⚠️ Could not find CLIENT_ID in GoogleService-Info.plist.")
            return
        }
        
        if clientId.contains("PLACEHOLDER") {
            print("[GoogleSignInService] ⚠️ Google Sign-In is using a PLACEHOLDER Client ID. It will not work until you replace it with a real one.")
            return
        }
        
        guard let config = GIDConfiguration(clientID: clientId) else {
            print("[GoogleSignInService] ❌ Failed to create GIDConfiguration with ID: \(clientId)")
            return
        }
        
        GIDSignIn.sharedInstance.configuration = config
        isConfigured = true
        print("[GoogleSignInService] ✅ Configured successfully with ID: \(clientId)")
        #else
        print("[GoogleSignInService] ❌ GoogleSignIn framework (SDK) is NOT found. Please add it via SPM.")
        #endif
    }
    
    /// Sign in with Google
    func signIn(presentingViewController: UIViewController) async throws -> (idToken: String, accessToken: String) {
        #if canImport(GoogleSignIn)
        guard isConfigured else {
            throw GoogleSignInError.notConfigured
        }
        
        let result = try await GIDSignIn.sharedInstance.signIn(withPresenting: presentingViewController)
        
        guard let idToken = result.user.idToken?.tokenString else {
            throw GoogleSignInError.missingIdToken
        }
        
        let accessToken = result.user.accessToken.tokenString
        
        return (idToken: idToken, accessToken: accessToken)
        #else
        throw GoogleSignInError.notConfigured
        #endif
    }
    
    /// Sign out from Google
    func signOut() {
        #if canImport(GoogleSignIn)
        GIDSignIn.sharedInstance.signOut()
        #endif
    }
    
    /// Check if user is currently signed in
    var isSignedIn: Bool {
        #if canImport(GoogleSignIn)
        return GIDSignIn.sharedInstance.currentUser != nil
        #else
        return false
        #endif
    }
    
    /// Check if Google Sign-In is configured and available
    var isAvailable: Bool {
        return isConfigured
    }
}

enum GoogleSignInError: LocalizedError {
    case notConfigured
    case invalidViewController
    case missingIdToken
    case signInFailed(Error)
    
    var errorDescription: String? {
        switch self {
        case .notConfigured:
            return "Google Sign-In är inte konfigurerad. Lägg till GoogleSignIn SDK och GoogleService-Info.plist."
        case .invalidViewController:
            return "Ogiltig view controller"
        case .missingIdToken:
            return "ID-token saknas från Google"
        case .signInFailed(let error):
            return "Google-inloggning misslyckades: \(error.localizedDescription)"
        }
    }
}


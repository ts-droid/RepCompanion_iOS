import Foundation
import AuthenticationServices
import Combine
import SwiftData

/// Service for handling user authentication
@MainActor
class AuthService: ObservableObject {
    static let shared = AuthService()
    
    @Published var isAuthenticated = false
    @Published var currentUserId: String?
    @Published var currentUserEmail: String?
    @Published var currentUserName: String?
    
    private let userDefaults = UserDefaults.standard
    private let userIdKey = "auth_user_id"
    private let userEmailKey = "auth_user_email"
    private let userNameKey = "auth_user_name"
    private let authMethodKey = "auth_method"
    
    private init() {
        // Check if user is already authenticated
        if let userId = userDefaults.string(forKey: userIdKey) {
            currentUserId = userId
            currentUserEmail = userDefaults.string(forKey: userEmailKey)
            currentUserName = userDefaults.string(forKey: userNameKey)
            isAuthenticated = true
        }
    }
    
    // MARK: - Sign In with Apple
    
    func signInWithApple(authorization: ASAuthorization, modelContext: ModelContext? = nil) async throws {
        guard let appleIDCredential = authorization.credential as? ASAuthorizationAppleIDCredential else {
            throw AuthError.invalidCredential
        }
        
        // Get ID token (required for backend verification)
        guard let identityToken = appleIDCredential.identityToken,
              let idTokenString = String(data: identityToken, encoding: .utf8) else {
            throw AuthError.missingToken
        }
        
        // Get authorization code (optional, but useful for backend)
        let authorizationCode = appleIDCredential.authorizationCode.flatMap { String(data: $0, encoding: .utf8) }
        
        // Authenticate with backend
        let apiService = APIService.shared
        let authResponse = try await apiService.authenticateWithApple(
            idToken: idTokenString,
            authorizationCode: authorizationCode
        )
        
        // Extract user info from response or credential
        let email = appleIDCredential.email
        let fullName = appleIDCredential.fullName
        
        // Create user identifier (use user ID from Apple)
        let userIdentifier = authResponse.user.id // Use ID from backend response
        
        // Use email if available, otherwise use user identifier
        // Note: Email may be nil on subsequent sign-ins if user previously authorized
        let userEmail = email ?? authResponse.user.email
        
        // Use name if available
        // Note: Name may be nil on subsequent sign-ins if user previously authorized
        var userName: String? = authResponse.user.name
        if userName == nil {
            if let givenName = fullName?.givenName, let familyName = fullName?.familyName {
                userName = "\(givenName) \(familyName)"
            } else if let givenName = fullName?.givenName {
                userName = givenName
            }
        }
        
        // Save authentication state
        saveAuthState(userId: userIdentifier, email: userEmail, name: userName, method: "apple")
        
        // Sync data from backend
        if let modelContext = modelContext {
            await syncUserData(userId: userIdentifier, modelContext: modelContext)
        }
    }
    
    // MARK: - Sign In with Google
    
    func signInWithGoogle(idToken: String, accessToken: String?, modelContext: ModelContext? = nil) async throws {
        // Authenticate with backend
        let apiService = APIService.shared
        let authResponse = try await apiService.authenticateWithGoogle(
            idToken: idToken,
            accessToken: accessToken
        )
        
        // Extract user info from response
        let userIdentifier = authResponse.user.id
        let userEmail = authResponse.user.email
        let userName = authResponse.user.name
        
        // Save authentication state
        saveAuthState(userId: userIdentifier, email: userEmail, name: userName, method: "google")
        
        // Sync data from backend
        if let modelContext = modelContext {
            await syncUserData(userId: userIdentifier, modelContext: modelContext)
        }
    }
    
    // MARK: - Magic Link
    
    func sendMagicLink(email: String) async throws {
        try await APIService.shared.sendMagicLink(email: email)
    }
    
    func signInWithMagicLink(token: String, modelContext: ModelContext? = nil) async throws {
        let authResponse = try await APIService.shared.verifyMagicLink(token: token)
        
        // Extract user info from response
        let userIdentifier = authResponse.user.id
        let userEmail = authResponse.user.email
        let userName = authResponse.user.name
        
        // Save authentication state
        saveAuthState(userId: userIdentifier, email: userEmail, name: userName, method: "magic_link")
        
        // Sync data from backend
        if let modelContext = modelContext {
            await syncUserData(userId: userIdentifier, modelContext: modelContext)
        }
    }
    
    // MARK: - Sign In with Email
    
    func signInWithEmail(email: String, password: String, modelContext: ModelContext? = nil) async throws {
        // Authenticate with backend
        let apiService = APIService.shared
        let authResponse = try await apiService.authenticate(email: email, password: password)
        
        // Extract user info from response
        let userIdentifier = authResponse.user.id
        let userEmail = authResponse.user.email
        let userName = authResponse.user.name
        
        // Save authentication state
        saveAuthState(userId: userIdentifier, email: userEmail, name: userName, method: "email")
        
        // Sync data from backend
        if let modelContext = modelContext {
            await syncUserData(userId: userIdentifier, modelContext: modelContext)
        }
    }
    
    func signUpWithEmail(email: String, password: String, name: String, modelContext: ModelContext? = nil) async throws {
        // Authenticate with backend - use register endpoint if available, otherwise try login
        let apiService = APIService.shared
        
        // Try to register first (if endpoint exists)
        do {
            let authResponse = try await apiService.register(email: email, password: password, name: name)
            
            // Extract user info from response
            let userIdentifier = authResponse.user.id
            let userEmail = authResponse.user.email
            let userName = authResponse.user.name
            
            // Save authentication state
            saveAuthState(userId: userIdentifier, email: userEmail, name: userName, method: "email")
            
            // Sync data from backend
            if let modelContext = modelContext {
                await syncUserData(userId: userIdentifier, modelContext: modelContext)
            }
        } catch {
            // If register fails, try login (user might already exist)
            print("[AuthService] Register failed, trying login: \(error.localizedDescription)")
            try await signInWithEmail(email: email, password: password, modelContext: modelContext)
        }
    }
    
    // MARK: - Data Sync
    
    private func syncUserData(userId: String, modelContext: ModelContext) async {
        do {
            try await SyncService.shared.syncAllData(userId: userId, modelContext: modelContext)
        } catch {
            print("Error syncing user data: \(error.localizedDescription)")
            // Don't fail authentication if sync fails - user can still use app
        }
    }
    
    // MARK: - Sign Out
    
    func signOut() {
        userDefaults.removeObject(forKey: userIdKey)
        userDefaults.removeObject(forKey: userEmailKey)
        userDefaults.removeObject(forKey: userNameKey)
        userDefaults.removeObject(forKey: authMethodKey)
        
        currentUserId = nil
        currentUserEmail = nil
        currentUserName = nil
        isAuthenticated = false
    }
    
    // MARK: - Private Helpers
    
    private func saveAuthState(userId: String, email: String, name: String?, method: String) {
        userDefaults.set(userId, forKey: userIdKey)
        userDefaults.set(email, forKey: userEmailKey)
        if let name = name {
            userDefaults.set(name, forKey: userNameKey)
        }
        userDefaults.set(method, forKey: authMethodKey)
        
        currentUserId = userId
        currentUserEmail = email
        currentUserName = name
        isAuthenticated = true
    }
}

// MARK: - AuthError

enum AuthError: LocalizedError {
    case invalidCredential
    case missingToken
    case missingTokenOrCode
    case authenticationFailed
    case networkError
    
    var errorDescription: String? {
        switch self {
        case .invalidCredential:
            return "Ogiltiga autentiseringsuppgifter"
        case .missingToken:
            return "Autentiseringstoken saknas"
        case .missingTokenOrCode:
            return "Token eller auktoriseringskod saknas"
        case .authenticationFailed:
            return "Autentisering misslyckades"
        case .networkError:
            return "Network error. Check your connection."
        }
    }
}

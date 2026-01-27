import Foundation

/// API Service for communicating with the backend server
@MainActor
class APIService {
    static let shared = APIService()
    
    // Backend server URL
    // IMPORTANT: Use 127.0.0.1 instead of localhost to force IPv4
    // iOS Simulator sometimes resolves localhost to IPv6 (::1) which causes connection issues
    // For physical device, use your Mac's IP address (Local) or Production URL (Cloud)
    private let useCloud = true // ALWAYS TRUE FOR ALPHA
    private let productionURL = "https://repcompanionserver-production.up.railway.app" // FINAL RAILWAY URL
    
    #if targetEnvironment(simulator)
    // Simulator: Use 127.0.0.1 (IPv4) instead of localhost to avoid IPv6 issues
    lazy var baseURL: String = {
        return "http://127.0.0.1:5002"
    }()
    #else
    // Physical device needs Mac's IP address or Cloud URL
    // Current Mac IP: 192.168.68.82 (auto-detected)
    lazy var baseURL: String = {
        return useCloud ? productionURL : "http://192.168.68.82:5002"
    }()
    #endif
    
    // Log baseURL on initialization to verify configuration
    init() {
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print("[APIService] 🔧 INITIALIZED")
        print("[APIService] 🌐 Base URL: \(baseURL)")
        #if targetEnvironment(simulator)
        print("[APIService] 📱 Running on: iOS Simulator")
        #else
        print("[APIService] 📱 Running on: Physical Device")
        #endif
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    }
    
    var authToken: String? {
        // Get from keychain or user defaults
        UserDefaults.standard.string(forKey: "authToken")
    }
    
    // MARK: - Request Helper
    
    private func performRequest(_ request: URLRequest) async throws -> (Data, URLResponse) {
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            return (data, response)
        } catch let error as NSError {
            print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
            print("[APIService] ❌ NETWORK ERROR")
            print("[APIService] 🌐 URL: \(request.url?.absoluteString ?? "Unknown")")
            print("[APIService] 🏷️ Domain: \(error.domain)")
            print("[APIService] 🔢 Code: \(error.code)")
            print("[APIService] 💬 Description: \(error.localizedDescription)")
            
            // Check for Local Network Prohibited
            if error.domain == NSURLErrorDomain {
                let errorString = "\(error)"
                if errorString.contains("Local network prohibited") {
                    print("[APIService] ⚠️ CRITICAL: Local Network access is prohibited!")
                    print("[APIService] 👉 Please ensure you have accepted the Local Network permission dialog.")
                    print("[APIService] 👉 Go to Settings > RepCompanion > Local Network and toggle it ON.")
                } else if error.code == -1004 {
                    print("[APIService] ⚠️ Could not connect to server. Ensure the backend is running at \(baseURL)")
                } else if error.code == -1009 {
                    print("[APIService] ⚠️ Internet appears to be offline.")
                }
            }
            print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
            throw error
        }
    }
    
    
    // MARK: - Authentication
    
    /// Authenticate with Apple ID token
    func authenticateWithApple(idToken: String, authorizationCode: String?) async throws -> AuthResponse {
        let url = URL(string: "\(baseURL)/api/auth/apple")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        var body: [String: Any] = ["idToken": idToken]
        if let code = authorizationCode {
            body["authorizationCode"] = code
        }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await performRequest(request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.httpError(httpResponse.statusCode)
        }
        
        let authResponse = try JSONDecoder().decode(AuthResponse.self, from: data)
        
        // Store token
        UserDefaults.standard.set(authResponse.token, forKey: "authToken")
        
        return authResponse
    }
    
    /// Authenticate with Google ID token
    func authenticateWithGoogle(idToken: String, accessToken: String?) async throws -> AuthResponse {
        let url = URL(string: "\(baseURL)/api/auth/google")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        var body: [String: Any] = ["idToken": idToken]
        if let token = accessToken {
            body["accessToken"] = token
        }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await performRequest(request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.httpError(httpResponse.statusCode)
        }
        
        let authResponse = try JSONDecoder().decode(AuthResponse.self, from: data)
        
        // Store token
        UserDefaults.standard.set(authResponse.token, forKey: "authToken")
        
        return authResponse
    }
    
    /// Send magic link to email
    func sendMagicLink(email: String) async throws {
        let url = URL(string: "\(baseURL)/api/auth/magic-link")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body = ["email": email]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (_, response) = try await performRequest(request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.httpError(httpResponse.statusCode)
        }
    }
    
    /// Verify magic link token
    func verifyMagicLink(token: String) async throws -> AuthResponse {
        let url = URL(string: "\(baseURL)/api/auth/magic-link/verify")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body = ["token": token]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await performRequest(request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.httpError(httpResponse.statusCode)
        }
        
        let authResponse = try JSONDecoder().decode(AuthResponse.self, from: data)
        
        // Store token
        UserDefaults.standard.set(authResponse.token, forKey: "authToken")
        
        return authResponse
    }
    
    // MARK: - Gym Geosearch
    
    func fetchNearbyGyms(lat: Double, lng: Double, radiusKm: Double = 50.0) async throws -> [NearbyGymResponse] {
        guard let token = authToken else {
            throw APIError.unauthorized
        }
        
        var components = URLComponents(string: "\(baseURL)/api/gyms/nearby")!
        components.queryItems = [
            URLQueryItem(name: "lat", value: String(lat)),
            URLQueryItem(name: "lng", value: String(lng)),
            URLQueryItem(name: "radius", value: String(radiusKm))
        ]
        
        guard let url = components.url else {
            throw APIError.invalidResponse
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        let (data, response) = try await performRequest(request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.httpError(httpResponse.statusCode)
        }
        
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode([NearbyGymResponse].self, from: data)
    }
    
    func authenticate(email: String, password: String) async throws -> AuthResponse {
        let url = URL(string: "\(baseURL)/api/auth/login")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body = [
            "email": email,
            "password": password
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await performRequest(request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.httpError(httpResponse.statusCode)
        }
        
        let authResponse = try JSONDecoder().decode(AuthResponse.self, from: data)
        
        // Store token
        UserDefaults.standard.set(authResponse.token, forKey: "authToken")
        
        return authResponse
    }
    
    func register(email: String, password: String, name: String) async throws -> AuthResponse {
        let url = URL(string: "\(baseURL)/api/auth/signup")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body = [
            "email": email,
            "password": password,
            "name": name
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await performRequest(request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.httpError(httpResponse.statusCode)
        }
        
        let authResponse = try JSONDecoder().decode(AuthResponse.self, from: data)
        
        // Store token
        UserDefaults.standard.set(authResponse.token, forKey: "authToken")
        
        return authResponse
    }
    
    // MARK: - Workout Program Generation
    
    func generateWorkoutProgram(force: Bool = false) async throws -> WorkoutProgramResponse {
        guard let token = authToken else {
            throw APIError.unauthorized
        }
        
        let url = URL(string: "\(baseURL)/api/programs/generate")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        let body = ["force": force]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await performRequest(request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            if httpResponse.statusCode == 429 {
                let errorResponse = try? JSONDecoder().decode(ErrorResponse.self, from: data)
                throw APIError.rateLimited(errorResponse?.message ?? "Rate limit exceeded")
            }
            throw APIError.httpError(httpResponse.statusCode)
        }
        
        return try JSONDecoder().decode(WorkoutProgramResponse.self, from: data)
    }
    
    // MARK: - Onboarding
    
    struct OnboardingCompleteRequest: Codable {
        let profile: ProfileData
        let equipment: [String]
        
        struct ProfileData: Codable {
            let motivationType: String
            let trainingLevel: String
            let specificSport: String?
            let focusTags: [String]?
            let selectedIntent: String?
            let age: Int?
            let sex: String?
            let bodyWeight: Int?
            let height: Int?
            let goalStrength: Int
            let goalVolume: Int
            let goalEndurance: Int
            let goalCardio: Int
            let sessionsPerWeek: Int
            let sessionDuration: Int
            let oneRmBench: Int?
            let oneRmOhp: Int?
            let oneRmDeadlift: Int?
            let oneRmSquat: Int?
            let oneRmLatpull: Int?
            let theme: String?
        }
    }
    
    struct OnboardingCompleteResponse: Codable {
        let success: Bool
        let profile: UserProfileResponse
        let gym: GymResponse?
        let program: ProgramGenerationResponse?
        let hasProgram: Bool?
        let templatesCreated: Int?
    }
    
    struct ProgramGenerationResponse: Codable {
        let cached: Bool?
        let jobId: String?
        let status: String?
        // Note: program field is not decoded here as it's complex nested structure
        // We'll handle it separately if needed
        
        enum CodingKeys: String, CodingKey {
            case cached
            case jobId
            case status
            // Explicitly exclude 'program' field to avoid decoding errors
        }
    }
    
    struct GenerationStatusResponse: Codable {
        let status: String // "queued" | "generating" | "completed" | "failed"
        let progress: Int // 0-100
        let error: String?
        // Note: program field is not decoded here as it's complex nested structure
    }
    
    struct SuggestedGoalsResponse: Codable {
        let goalStrength: Int
        let goalHypertrophy: Int // Mapped from backend 'goalVolume'
        let goalEndurance: Int
        let goalCardio: Int
        let focusTags: [String]?
        let selectedIntent: String?
        
        enum CodingKeys: String, CodingKey {
            case goalStrength
            case goalHypertrophy = "goalVolume" // Map backend 'goalVolume' to 'goalHypertrophy'
            case goalEndurance
            case goalCardio
            case focusTags
            case selectedIntent
        }
    }
    
    struct SuggestedOneRmResponse: Codable {
        let oneRmBench: Int
        let oneRmOhp: Int
        let oneRmDeadlift: Int
        let oneRmSquat: Int
        let oneRmLatpull: Int
    }
    
    func completeOnboarding(profile: OnboardingCompleteRequest.ProfileData, equipment: [String], useV4: Bool = true) async throws -> OnboardingCompleteResponse {
        print("[APIService] 🚀 Using V4 AI architecture: \(useV4)")
        
        var urlComponents = URLComponents(string: "\(baseURL)/api/onboarding/complete")!
        if useV4 {
            urlComponents.queryItems = [URLQueryItem(name: "useV4", value: "true")]
        }
        
        guard let url = urlComponents.url else {
            print("[APIService] ❌ ERROR: Failed to create URL from components")
            throw APIError.invalidResponse
        }
        
        print("[APIService] 🌐 Request URL: \(url.absoluteString)")
        print("[APIService] 📋 Base URL: \(baseURL)")
        
        // Create custom URLSessionConfiguration with extended timeout for AI generation
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 300.0 // 5 minutes for AI generation
        config.timeoutIntervalForResource = 300.0 // 5 minutes total
        let session = URLSession(configuration: config)
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        // Add auth token if available
        if let token = UserDefaults.standard.string(forKey: "authToken") {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            print("[APIService] ✅ Using auth token for onboarding")
        } else {
            print("[APIService] ⚠️  No auth token found - request may fail")
        }
        
        let body = OnboardingCompleteRequest(profile: profile, equipment: equipment)
        request.httpBody = try JSONEncoder().encode(body)
        
        print("[APIService] ⏱️ Starting onboarding completion (timeout: 5 minutes for AI generation)...")
        
        // Check server health before making request
        do {
            let healthURL = URL(string: "\(baseURL)/api/health")!
            let healthRequest = URLRequest(url: healthURL, timeoutInterval: 5.0)
            let (_, healthResponse) = try await URLSession.shared.data(for: healthRequest)
            if let httpResponse = healthResponse as? HTTPURLResponse {
                print("[APIService] ✅ Server health check: \(httpResponse.statusCode)")
            }
        } catch {
            print("[APIService] ⚠️  Server health check failed: \(error.localizedDescription)")
            print("[APIService] ⚠️  Continuing with request anyway...")
        }
        
        do {
            let (data, response) = try await session.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse else {
                throw APIError.invalidResponse
            }
            
            guard (200...299).contains(httpResponse.statusCode) else {
                // Try to decode error message for better feedback
                if let errorResponse = try? JSONDecoder().decode(ErrorResponse.self, from: data) {
                    print("[APIService] ❌ Onboarding failed: \(errorResponse.message)")
                    throw NSError(domain: "APIService", code: httpResponse.statusCode, userInfo: [NSLocalizedDescriptionKey: errorResponse.message])
                }
                
                // If status is 401, provide specific message
                if httpResponse.statusCode == 401 {
                    throw NSError(domain: "APIService", code: 401, userInfo: [NSLocalizedDescriptionKey: "Du är inte inloggad. Vänligen logga in igen."])
                }
                
                throw APIError.httpError(httpResponse.statusCode)
            }
        
        // Try to decode response - add better error handling
        do {
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            let onboardingResponse = try decoder.decode(OnboardingCompleteResponse.self, from: data)
            
            // Handle program response (cached or async)
            if let programResponse = onboardingResponse.program {
                if programResponse.cached == true {
                    print("[APIService] ✅ Program from cache")
                } else if let jobId = programResponse.jobId {
                    print("[APIService] ⏳ Program generation started, jobId: \(jobId)")
                }
            }
            
            return onboardingResponse
        } catch let decodeError {
            // Log the actual JSON for debugging
            if let jsonString = String(data: data, encoding: .utf8) {
                print("[APIService] ❌ Failed to decode response. JSON: \(jsonString)")
            }
            print("[APIService] ❌ Decoding error: \(decodeError)")
            throw decodeError
        }
        } catch let error as URLError {
            print("[APIService] ❌ NETWORK ERROR in onboarding completion:")
            print("[APIService] Error code: \(error.code.rawValue)")
            print("[APIService] Error description: \(error.localizedDescription)")
            print("[APIService] Failed to connect to \(baseURL)")
            
            // Retry logic for connection errors
            if error.code == .cannotConnectToHost || error.code == .timedOut || error.code == .networkConnectionLost {
                print("[APIService] 🔄 Retrying onboarding completion (connection error detected)...")
                // Simple retry without recursive call
                for attempt in 1...2 {
                    let waitTime = 3.0 * Double(attempt)
                    print("[APIService] ⏳ Retry attempt \(attempt)/2 after \(waitTime)s...")
                    try await Task.sleep(nanoseconds: UInt64(waitTime * 1_000_000_000))
                    
                    do {
                        // Recreate request for retry
                        var retryRequest = URLRequest(url: url)
                        retryRequest.httpMethod = "POST"
                        retryRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
                        retryRequest.httpBody = try JSONEncoder().encode(body)
                        retryRequest.timeoutInterval = 300.0
                        
                        let (retryData, retryResponse) = try await session.data(for: retryRequest)
                        if let retryHttpResponse = retryResponse as? HTTPURLResponse,
                           (200...299).contains(retryHttpResponse.statusCode) {
                            let decoder = JSONDecoder()
                            decoder.dateDecodingStrategy = .iso8601
                            return try decoder.decode(OnboardingCompleteResponse.self, from: retryData)
                        }
                    } catch {
                        if attempt == 2 {
                            throw APIError.networkError("Failed after 2 retry attempts: \(error.localizedDescription)")
                        }
                    }
                }
            }
            
            throw APIError.networkError(error.localizedDescription)
        } catch {
            print("[APIService] ❌ ERROR in onboarding completion: \(error.localizedDescription)")
            throw error
        }
    }
    
    // MARK: - Async Program Generation
    
    /// Get suggested training goals based on user profile
    func suggestTrainingGoals(
        motivationType: String,
        trainingLevel: String,
        specificSport: String? = nil,
        age: Int?,
        sex: String?,
        bodyWeight: Int?,
        height: Int?,
        oneRmBench: Int?,
        oneRmOhp: Int?,
        oneRmDeadlift: Int?,
        oneRmSquat: Int?,
        oneRmLatpull: Int?
    ) async throws -> SuggestedGoalsResponse {
        let url = URL(string: "\(baseURL)/api/profile/suggest-goals")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        // Build request body
        var body: [String: Any] = [
            "motivationType": motivationType,
            "trainingLevel": trainingLevel
        ]
        
        if let age = age {
            body["age"] = age
        }
        if let sex = sex {
            body["sex"] = sex
        }
        if let bodyWeight = bodyWeight {
            body["bodyWeight"] = bodyWeight
        }
        if let height = height {
            body["height"] = height
        }
        
        body["oneRmValues"] = [
            "oneRmBench": oneRmBench as Any,
            "oneRmOhp": oneRmOhp as Any,
            "oneRmDeadlift": oneRmDeadlift as Any,
            "oneRmSquat": oneRmSquat as Any,
            "oneRmLatpull": oneRmLatpull as Any
        ]
        
        if let specificSport = specificSport {
            body["specificSport"] = specificSport
        }
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            if let errorResponse = try? JSONDecoder().decode(ErrorResponse.self, from: data) {
                throw NSError(domain: "APIService", code: httpResponse.statusCode, userInfo: [NSLocalizedDescriptionKey: errorResponse.message])
            }
            throw APIError.httpError(httpResponse.statusCode)
        }
        
        return try JSONDecoder().decode(SuggestedGoalsResponse.self, from: data)
    }
    
    /// Get suggested 1RM values based on user profile
    /// Uses V3 AI analysis if available, otherwise falls back to local calculation
    func suggestOneRmValues(
        motivationType: String,
        trainingLevel: String,
        age: Int,
        sex: String,
        bodyWeight: Int,
        height: Int,
        useV3: Bool = false
    ) async throws -> SuggestedOneRmResponse {
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print("[APIService] 🚀 STARTING 1RM SUGGESTION REQUEST")
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print("[APIService] 📋 Request Parameters:")
        print("  • motivationType: \(motivationType)")
        print("  • trainingLevel: \(trainingLevel)")
        print("  • age: \(age)")
        print("  • sex: \(sex)")
        print("  • bodyWeight: \(bodyWeight) kg")
        print("  • height: \(height) cm")
        print("  • useV3: \(useV3)")
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        
        var urlComponents = URLComponents(string: "\(baseURL)/api/profile/suggest-onerm")!
        if useV3 {
            urlComponents.queryItems = [URLQueryItem(name: "useV3", value: "true")]
        }
        
        guard let url = urlComponents.url else {
            print("[APIService] ❌ ERROR: Failed to create URL from components")
            throw APIError.invalidResponse
        }
        
        print("[APIService] 🌐 Request URL: \(url.absoluteString)")
        print("[APIService] 📋 Base URL: \(baseURL)")
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "motivationType": motivationType,
            "trainingLevel": trainingLevel,
            "age": age,
            "sex": sex,
            "bodyWeight": bodyWeight,
            "height": height
        ]
        
        print("[APIService] 📦 Request Body:")
        if let jsonData = try? JSONSerialization.data(withJSONObject: body, options: .prettyPrinted),
           let jsonString = String(data: jsonData, encoding: .utf8) {
            print(jsonString)
        }
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        print("[APIService] ⏳ Sending HTTP request...")
        let startTime = Date()
        
        // Check server health before making request
        do {
            let healthURL = URL(string: "\(baseURL)/api/health")!
            let healthRequest = URLRequest(url: healthURL, timeoutInterval: 5.0)
            let (_, healthResponse) = try await URLSession.shared.data(for: healthRequest)
            if let httpResponse = healthResponse as? HTTPURLResponse {
                print("[APIService] ✅ Server health check: \(httpResponse.statusCode)")
            }
        } catch {
            print("[APIService] ⚠️  Server health check failed: \(error.localizedDescription)")
            print("[APIService] ⚠️  Continuing with request anyway...")
        }
        
        // Create custom URLSessionConfiguration with extended timeout for V3 AI analysis
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30.0 // 30 seconds for V3 AI analysis
        config.timeoutIntervalForResource = 30.0 // 30 seconds total
        let session = URLSession(configuration: config)
        
        do {
            let (data, response) = try await session.data(for: request)
            let duration = Date().timeIntervalSince(startTime)
            
            print("[APIService] ⏱️  Request completed in \(String(format: "%.2f", duration)) seconds")
            
            guard let httpResponse = response as? HTTPURLResponse else {
                print("[APIService] ❌ ERROR: Invalid response type")
                throw APIError.invalidResponse
            }
            
            print("[APIService] 📡 HTTP Response:")
            print("  • Status Code: \(httpResponse.statusCode)")
            print("  • Headers: \(httpResponse.allHeaderFields)")
            print("  • Data Size: \(data.count) bytes")
            
            guard (200...299).contains(httpResponse.statusCode) else {
                print("[APIService] ❌ ERROR: HTTP status code \(httpResponse.statusCode)")
                if let responseString = String(data: data, encoding: .utf8) {
                    print("[APIService] Response body: \(responseString)")
                }
                if let errorResponse = try? JSONDecoder().decode(ErrorResponse.self, from: data) {
                    print("[APIService] Decoded error: \(errorResponse.message)")
                    throw NSError(domain: "APIService", code: httpResponse.statusCode, userInfo: [NSLocalizedDescriptionKey: errorResponse.message])
                }
                throw APIError.httpError(httpResponse.statusCode)
            }
            
            print("[APIService] ✅ HTTP Status: SUCCESS")
            
            if let responseString = String(data: data, encoding: .utf8) {
                print("[APIService] 📄 Response Body:")
                print(responseString)
            }
            
            let decodedResponse = try JSONDecoder().decode(SuggestedOneRmResponse.self, from: data)
            
            print("[APIService] ✅ Decoded Response:")
            print("  • oneRmBench: \(decodedResponse.oneRmBench) kg")
            print("  • oneRmOhp: \(decodedResponse.oneRmOhp) kg")
            print("  • oneRmDeadlift: \(decodedResponse.oneRmDeadlift) kg")
            print("  • oneRmSquat: \(decodedResponse.oneRmSquat) kg")
            print("  • oneRmLatpull: \(decodedResponse.oneRmLatpull) kg")
            print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
            print("[APIService] ✅ REQUEST COMPLETED SUCCESSFULLY")
            print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
            
            return decodedResponse
        } catch let error as URLError {
            let duration = Date().timeIntervalSince(startTime)
            print("[APIService] ❌ NETWORK ERROR after \(String(format: "%.2f", duration)) seconds:")
            print("[APIService] Error code: \(error.code.rawValue)")
            print("[APIService] Error description: \(error.localizedDescription)")
            print("[APIService] Failed to connect to \(baseURL)")
            
            // Retry logic for connection errors
            if error.code == .cannotConnectToHost || error.code == .timedOut || error.code == .networkConnectionLost {
                print("[APIService] 🔄 Retrying request (connection error detected)...")
                // Simple retry without recursive call to avoid infinite loop
                for attempt in 1...2 {
                    let waitTime = 2.0 * Double(attempt)
                    print("[APIService] ⏳ Retry attempt \(attempt)/2 after \(waitTime)s...")
                    try await Task.sleep(nanoseconds: UInt64(waitTime * 1_000_000_000))
                    
                    do {
                        // Recreate request for retry
                        var retryRequest = URLRequest(url: url)
                        retryRequest.httpMethod = "POST"
                        retryRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
                        retryRequest.httpBody = try JSONSerialization.data(withJSONObject: body)
                        retryRequest.timeoutInterval = 30.0
                        
                        let (retryData, retryResponse) = try await session.data(for: retryRequest)
                        if let retryHttpResponse = retryResponse as? HTTPURLResponse,
                           (200...299).contains(retryHttpResponse.statusCode) {
                            return try JSONDecoder().decode(SuggestedOneRmResponse.self, from: retryData)
                        }
                    } catch {
                        if attempt == 2 {
                            throw APIError.networkError("Failed after 2 retry attempts: \(error.localizedDescription)")
                        }
                    }
                }
            }
            
            throw APIError.networkError(error.localizedDescription)
        } catch {
            let duration = Date().timeIntervalSince(startTime)
            print("[APIService] ❌ ERROR after \(String(format: "%.2f", duration)) seconds:")
            print("[APIService] Error type: \(type(of: error))")
            print("[APIService] Error description: \(error.localizedDescription)")
            if let nsError = error as NSError? {
                print("[APIService] Error domain: \(nsError.domain)")
                print("[APIService] Error code: \(nsError.code)")
                print("[APIService] Error userInfo: \(nsError.userInfo)")
            }
            print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
            throw error
        }
    }
    
    /// Get generation job status
    func getGenerationStatus(jobId: String) async throws -> GenerationStatusResponse {
        let url = URL(string: "\(baseURL)/api/program/generate/status/\(jobId)")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        // Get token from UserDefaults directly (thread-safe)
        if let token = UserDefaults.standard.string(forKey: "authToken") {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.httpError(httpResponse.statusCode)
        }
        
        return try JSONDecoder().decode(GenerationStatusResponse.self, from: data)
    }
    
    // MARK: - User Profile
    
    func fetchUserProfile() async throws -> UserProfileResponse {
        guard let token = authToken else {
            throw APIError.unauthorized
        }
        
        let url = URL(string: "\(baseURL)/api/profile")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.httpError(httpResponse.statusCode)
        }
        
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode(UserProfileResponse.self, from: data)
    }
    
    // MARK: - Program Status
    
    /// Get current program generation status (doesn't require jobId)
    func getProgramStatus() async throws -> ProgramStatusResponse {
        // Try plural first as it's more robust against route shadowing
        let endpoints = ["/api/programs/status", "/api/program/status"]
        
        var lastError: Error?
        
        for endpoint in endpoints {
            let url = URL(string: "\(baseURL)\(endpoint)")!
            var request = URLRequest(url: url)
            request.httpMethod = "GET"
            
            if let token = authToken {
                request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            }
            
            do {
                let (data, response) = try await URLSession.shared.data(for: request)
                guard let httpResponse = response as? HTTPURLResponse else {
                    continue
                }
                
                print("[API] Program status response (\(endpoint)): \(httpResponse.statusCode)")
                
                if (200...299).contains(httpResponse.statusCode) {
                    return try JSONDecoder().decode(ProgramStatusResponse.self, from: data)
                } else if httpResponse.statusCode == 404 {
                    let errorBody = String(data: data, encoding: .utf8) ?? "No error body"
                    print("[API] ⚠️ 404 on \(endpoint): \(errorBody)")
                    continue
                } else {
                    let errorBody = String(data: data, encoding: .utf8) ?? "Unknown error"
                    print("[API] ⚠️ HTTP error \(httpResponse.statusCode) on \(endpoint): \(errorBody)")
                    throw APIError.httpError(httpResponse.statusCode)
                }
            } catch {
                lastError = error
                print("[API] ⚠️ Failed to fetch \(endpoint): \(error.localizedDescription)")
            }
        }
        
        throw lastError ?? APIError.networkError("Failed to get program status from any endpoint")
    }
    
    struct ProgramStatusResponse: Codable {
        let status: String
        let message: String
        let hasTemplates: Bool
        let templatesCount: Int
        let progress: Int?
        let jobId: String?
        let error: String?
    }
    
    // MARK: - Program Templates
    
    func fetchProgramTemplates() async throws -> [ProgramTemplateResponse] {
        let url = URL(string: "\(baseURL)/api/program/templates")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        
        // Add auth token if available, but don't fail if missing (dev mode allows unauthenticated)
        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            print("[API] 🔑 Using auth token for templates request")
        } else {
            print("[API] ⚠️ No auth token available, trying without (dev mode)")
        }
        
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse else {
                print("[API] ❌ Invalid response type")
                throw APIError.invalidResponse
            }
            
            print("[API] 📡 Templates response: \(httpResponse.statusCode)")
            
            guard (200...299).contains(httpResponse.statusCode) else {
                let errorBody = String(data: data, encoding: .utf8) ?? "Unknown error"
                print("[API] ❌ HTTP Error \(httpResponse.statusCode): \(errorBody)")
                throw APIError.httpError(httpResponse.statusCode)
            }
        
            // Log raw response for debugging
            if let responseString = String(data: data, encoding: .utf8) {
                print("[API] 📄 Raw response (first 1000 chars): \(String(responseString.prefix(1000)))")
            }
        
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        
        // Response is an array of objects with template and exerciseCount
        struct TemplateWithMetadata: Decodable {
            let template: ProgramTemplateResponse
            let exerciseCount: Int
            let isNext: Bool
            let exercises: [ProgramTemplateExerciseResponse]?
        }
        
            let templatesWithMetadata = try decoder.decode([TemplateWithMetadata].self, from: data)
            let templates = templatesWithMetadata.map { meta -> ProgramTemplateResponse in
                // Start with the basic template data
                let base = meta.template
                
                // Return a new copy with the exercises from the metadata wrapper
                return ProgramTemplateResponse(
                    id: base.id,
                    templateName: base.templateName,
                    muscleFocus: base.muscleFocus,
                    dayOfWeek: base.dayOfWeek,
                    estimatedDurationMinutes: base.estimatedDurationMinutes,
                    exercises: meta.exercises // Inject the exercises from the wrapper!
                )
            }
            print("[API] ✅ Decoded \(templates.count) templates from response")
            return templates
        } catch let error as URLError {
            print("[API] ❌ Network error: \(error.localizedDescription)")
            print("[API] ❌ Failed to connect to \(baseURL)")
            throw APIError.networkError(error.localizedDescription)
        } catch {
            print("[API] ❌ Decoding error: \(error.localizedDescription)")
            throw error
        }
    }
    
    func deleteAllTemplates() async throws {
        let url = URL(string: "\(baseURL)/api/program/templates")!
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        
        // Add auth token if available, but don't fail if missing (dev mode allows unauthenticated)
        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            print("[API] 🔑 Using auth token for delete templates request")
        } else {
            print("[API] ⚠️ No auth token available, trying without (dev mode)")
        }
        
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse else {
                print("[API] ❌ Invalid response type")
                throw APIError.invalidResponse
            }
            
            print("[API] 📡 Delete templates response: \(httpResponse.statusCode)")
            
            guard (200...299).contains(httpResponse.statusCode) else {
                let errorBody = String(data: data, encoding: .utf8) ?? "Unknown error"
                print("[API] ❌ HTTP Error \(httpResponse.statusCode): \(errorBody)")
                throw APIError.httpError(httpResponse.statusCode)
            }
            
            print("[API] ✅ Successfully deleted all templates on server")
        } catch let error as URLError {
            print("[API] ❌ Network error: \(error.localizedDescription)")
            print("[API] ❌ Failed to connect to \(baseURL)")
            throw APIError.networkError(error.localizedDescription)
        } catch {
            print("[API] ❌ Error deleting templates: \(error.localizedDescription)")
            throw error
        }
    }
    
    func deleteAllGyms() async throws {
        let url = URL(string: "\(baseURL)/api/gyms")!
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        
        // Add auth token if available, but don't fail if missing (dev mode allows unauthenticated)
        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            print("[API] 🔑 Using auth token for delete gyms request")
        } else {
            print("[API] ⚠️ No auth token available, trying without (dev mode)")
        }
        
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse else {
                print("[API] ❌ Invalid response type")
                throw APIError.invalidResponse
            }
            
            print("[API] 📡 Delete gyms response: \(httpResponse.statusCode)")
            
            guard (200...299).contains(httpResponse.statusCode) else {
                let errorBody = String(data: data, encoding: .utf8) ?? "Unknown error"
                print("[API] ❌ HTTP Error \(httpResponse.statusCode): \(errorBody)")
                throw APIError.httpError(httpResponse.statusCode)
            }
            
            print("[API] ✅ Successfully deleted all gyms on server")
        } catch let error as URLError {
            print("[API] ❌ Network error: \(error.localizedDescription)")
            print("[API] ❌ Failed to connect to \(baseURL)")
            throw APIError.networkError(error.localizedDescription)
        } catch {
            print("[API] ❌ Error deleting gyms: \(error.localizedDescription)")
            throw error
        }
    }
    
    /// Reset user profile values to defaults on server (for debug "Återställ onboarding" function)
    func resetProfile() async throws {
        let url = URL(string: "\(baseURL)/api/profile/reset")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        // Add auth token if available, but don't fail if missing (dev mode allows unauthenticated)
        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            print("[API] 🔑 Using auth token for reset profile request")
        } else {
            print("[API] ⚠️ No auth token available, trying without (dev mode)")
        }
        
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse else {
                print("[API] ❌ Invalid response type")
                throw APIError.invalidResponse
            }
            
            print("[API] 📡 Reset profile response: \(httpResponse.statusCode)")
            
            guard (200...299).contains(httpResponse.statusCode) else {
                let errorBody = String(data: data, encoding: .utf8) ?? "Unknown error"
                print("[API] ❌ HTTP Error \(httpResponse.statusCode): \(errorBody)")
                throw APIError.httpError(httpResponse.statusCode)
            }
            
            print("[API] ✅ Successfully reset profile on server")
        } catch let error as URLError {
            print("[API] ❌ Network error: \(error.localizedDescription)")
            print("[API] ❌ Failed to connect to \(baseURL)")
            throw APIError.networkError(error.localizedDescription)
        } catch {
            print("[API] ❌ Error resetting profile: \(error.localizedDescription)")
            throw error
        }
    }
    
    // MARK: - Workout Sessions
    
    func fetchWorkoutSessions(limit: Int? = nil) async throws -> [WorkoutSessionResponse] {
        guard let token = authToken else {
            throw APIError.unauthorized
        }
        
        var components = URLComponents(string: "\(baseURL)/api/sessions")!
        if let limit = limit {
            components.queryItems = [URLQueryItem(name: "limit", value: String(limit))]
        }
        
        guard let url = components.url else {
            throw APIError.invalidResponse
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.httpError(httpResponse.statusCode)
        }
        
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode([WorkoutSessionResponse].self, from: data)
    }
    
    // MARK: - Health Data Sync
    
    func syncHealthData(_ healthData: HealthDataSync) async throws {
        guard let token = authToken else {
            throw APIError.unauthorized
        }
        
        let url = URL(string: "\(baseURL)/api/health/sync")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        request.httpBody = try encoder.encode(healthData)
        
        let (_, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.httpError(httpResponse.statusCode)
        }
    }
    
    // MARK: - Social Features
    
    func shareProgress(_ progress: ProgressShare) async throws -> ShareResponse {
        guard let token = authToken else {
            throw APIError.unauthorized
        }
        
        let url = URL(string: "\(baseURL)/api/social/share")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        request.httpBody = try encoder.encode(progress)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.httpError(httpResponse.statusCode)
        }
        
        return try JSONDecoder().decode(ShareResponse.self, from: data)
    }
    
    func getChallenges() async throws -> [Challenge] {
        guard let token = authToken else {
            throw APIError.unauthorized
        }
        
        let url = URL(string: "\(baseURL)/api/social/challenges")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.httpError(httpResponse.statusCode)
        }
        
        return try JSONDecoder().decode([Challenge].self, from: data)
    }
    
    // MARK: - Exercise Catalog
    
    func fetchExerciseCatalog() async throws -> [ExerciseCatalogResponse] {
        // Can be called without auth for public catalog
        let url = URL(string: "\(baseURL)/api/exercises/catalog")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        
        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.httpError(httpResponse.statusCode)
        }
        
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode([ExerciseCatalogResponse].self, from: data)
    }
    
    func fetchExerciseVideo(exerciseName: String) async throws -> ExerciseVideoResponse {
        guard let token = authToken else {
            throw APIError.unauthorized
        }
        
        var components = URLComponents(string: "\(baseURL)/api/exercises/video")!
        components.queryItems = [URLQueryItem(name: "name", value: exerciseName)]
        
        guard let url = components.url else {
            throw APIError.invalidResponse
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.httpError(httpResponse.statusCode)
        }
        
        return try JSONDecoder().decode(ExerciseVideoResponse.self, from: data)
    }
    
    // MARK: - Equipment Recognition
    
    struct EquipmentRecognitionRequest: Codable {
        let image: String // Base64 encoded image
    }
    
    struct EquipmentRecognitionResponse: Codable {
        let success: Bool?
        let equipment: [String]
        let confidence: Double?
        let detections: Int?
    }
    
    func recognizeEquipment(imageBase64: String) async throws -> EquipmentRecognitionResponse {
        guard let token = authToken else {
            throw APIError.unauthorized
        }
        
        let url = URL(string: "\(baseURL)/api/equipment/recognize")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        let body = EquipmentRecognitionRequest(image: imageBase64)
        request.httpBody = try JSONEncoder().encode(body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.httpError(httpResponse.statusCode)
        }
        
        return try JSONDecoder().decode(EquipmentRecognitionResponse.self, from: data)
    }
    
    // MARK: - Equipment Catalog
    
    func fetchEquipmentCatalog() async throws -> [EquipmentCatalogResponse] {
        // Can be called without auth for public catalog
        let url = URL(string: "\(baseURL)/api/equipment/catalog")!
        print("[APIService] 🔄 Fetching equipment catalog from: \(url.absoluteString)")
        print("[APIService] 📋 Base URL: \(baseURL)")
        
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.timeoutInterval = 30.0
        
        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            print("[APIService] ✅ Using auth token")
        } else {
            print("[APIService] ⚠️ No auth token - using public endpoint")
        }
        
        let (data, response) = try await performRequest(request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.httpError(httpResponse.statusCode)
        }
        
        print("[APIService] ✅ Response OK, data size: \(data.count) bytes")
        
        // Try to decode
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        
        do {
            let equipment = try decoder.decode([EquipmentCatalogResponse].self, from: data)
            print("[APIService] ✅ Successfully decoded \(equipment.count) equipment items")
            if equipment.isEmpty {
                print("[APIService] ⚠️ WARNING: Decoded empty array!")
            } else {
                print("[APIService] 📋 First few items: \(equipment.prefix(3).map { $0.name }.joined(separator: ", "))")
            }
            return equipment
        } catch {
            print("[APIService] ❌ Decode error: \(error)")
            if let jsonString = String(data: data, encoding: .utf8) {
                print("[APIService] 📄 Response body (first 500 chars): \(String(jsonString.prefix(500)))")
            }
            throw error
        }
    }
    
    // MARK: - User Equipment & Gyms
    
    func fetchUserGyms() async throws -> [GymResponse] {
        guard let token = authToken else {
            throw APIError.unauthorized
        }
        
        let url = URL(string: "\(baseURL)/api/gyms")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.httpError(httpResponse.statusCode)
        }
        
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode([GymResponse].self, from: data)
    }
    
    func fetchUserEquipment(gymId: String? = nil) async throws -> [UserEquipmentResponse] {
        guard let token = authToken else {
            throw APIError.unauthorized
        }
        
        var url: URL
        if let gymId = gymId {
            var components = URLComponents(string: "\(baseURL)/api/equipment")!
            components.queryItems = [URLQueryItem(name: "gymId", value: gymId)]
            url = components.url!
        } else {
            url = URL(string: "\(baseURL)/api/equipment")!
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.httpError(httpResponse.statusCode)
        }
        
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode([UserEquipmentResponse].self, from: data)
    }
    
    func createGym(name: String, location: String?, latitude: String? = nil, longitude: String? = nil, equipmentIds: [String]? = nil, isPublic: Bool = false) async throws -> GymResponse {
        guard let token = authToken else {
            throw APIError.unauthorized
        }
        
        let url = URL(string: "\(baseURL)/api/gyms")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        var body: [String: Any] = [
            "name": name,
            "location": location as Any,
            "isPublic": isPublic
        ]
        
        if let lat = latitude { body["latitude"] = lat }
        if let lon = longitude { body["longitude"] = lon }
        if let eqs = equipmentIds { body["equipmentIds"] = eqs }
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.httpError(httpResponse.statusCode)
        }
        
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode(GymResponse.self, from: data)
    }
    
    func updateGym(id: String, name: String, location: String?, latitude: String? = nil, longitude: String? = nil, equipmentIds: [String]? = nil, isPublic: Bool = false) async throws -> GymResponse {
        guard let token = authToken else {
            throw APIError.unauthorized
        }
        
        let url = URL(string: "\(baseURL)/api/gyms/\(id)")!
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        var body: [String: Any] = [
            "name": name,
            "location": location as Any,
            "isPublic": isPublic
        ]
        
        if let lat = latitude { body["latitude"] = lat }
        if let lon = longitude { body["longitude"] = lon }
        if let eqs = equipmentIds { body["equipmentIds"] = eqs }
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.httpError(httpResponse.statusCode)
        }
        
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode(GymResponse.self, from: data)
    }
    
    func addEquipment(
        gymId: String,
        equipmentType: String,
        equipmentName: String
    ) async throws -> UserEquipmentResponse {
        guard let token = authToken else {
            throw APIError.unauthorized
        }
        
        let url = URL(string: "\(baseURL)/api/equipment")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        let body = [
            "gymId": gymId,
            "equipmentType": equipmentType,
            "equipmentName": equipmentName
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.httpError(httpResponse.statusCode)
        }
        
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode(UserEquipmentResponse.self, from: data)
    }
    
    // MARK: - Training Tips
    
    func fetchTrainingTips(
        category: String? = nil,
        workoutType: String? = nil
    ) async throws -> [TrainingTipResponse] {
        guard let token = authToken else {
            throw APIError.unauthorized
        }
        
        var components = URLComponents(string: "\(baseURL)/api/tips")!
        var queryItems: [URLQueryItem] = []
        
        if let category = category {
            queryItems.append(URLQueryItem(name: "category", value: category))
        }
        if let workoutType = workoutType {
            queryItems.append(URLQueryItem(name: "workoutType", value: workoutType))
        }
        queryItems.append(URLQueryItem(name: "isActive", value: "true"))
        
        components.queryItems = queryItems.isEmpty ? nil : queryItems
        
        guard let url = components.url else {
            throw APIError.invalidResponse
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.httpError(httpResponse.statusCode)
        }
        
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode([TrainingTipResponse].self, from: data)
    }
    
    func fetchPersonalizedTips(limit: Int = 5) async throws -> [ProfileTrainingTipResponse] {
        guard let token = authToken else {
            throw APIError.unauthorized
        }
        
        var components = URLComponents(string: "\(baseURL)/api/tips/personalized")!
        components.queryItems = [URLQueryItem(name: "limit", value: String(limit))]
        
        guard let url = components.url else {
            throw APIError.invalidResponse
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.httpError(httpResponse.statusCode)
        }
        
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode([ProfileTrainingTipResponse].self, from: data)
    }
    
    func fetchPersonalizedTipsByCategory(category: String, limit: Int = 10) async throws -> [ProfileTrainingTipResponse] {
        guard let token = authToken else {
            throw APIError.unauthorized
        }
        
        var components = URLComponents(string: "\(baseURL)/api/tips/personalized/\(category)")!
        components.queryItems = [URLQueryItem(name: "limit", value: String(limit))]
        
        guard let url = components.url else {
            throw APIError.invalidResponse
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.httpError(httpResponse.statusCode)
        }
        
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode([ProfileTrainingTipResponse].self, from: data)
    }
    
    func fetchProfileTrainingTips() async throws -> [ProfileTrainingTipResponse] {
        // This would fetch all profile tips (might be large, consider pagination)
        // For now, we'll use personalized endpoint with high limit
        return try await fetchPersonalizedTips(limit: 1000)
    }
    
    // MARK: - Gym Programs
    
    func fetchGymPrograms(userId: String) async throws -> [GymProgramResponse] {
        guard let token = authToken else {
            throw APIError.unauthorized
        }
        
        let url = URL(string: "\(baseURL)/api/gym-programs")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.httpError(httpResponse.statusCode)
        }
        
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode([GymProgramResponse].self, from: data)
    }
    
    // MARK: - Unmapped Exercises
    
    func reportUnmappedExercise(
        aiName: String,
        suggestedMatch: String?,
        count: Int
    ) async throws {
        guard let token = authToken else {
            throw APIError.unauthorized
        }
        
        let url = URL(string: "\(baseURL)/api/exercises/unmapped")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        var body: [String: Any] = [
            "aiName": aiName,
            "count": count
        ]
        if let suggestedMatch = suggestedMatch {
            body["suggestedMatch"] = suggestedMatch
        }
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (_, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.httpError(httpResponse.statusCode)
        }
    }
    
    // MARK: - Offline Support
    
    /// Create workout session (with offline support)
    func createWorkoutSession(_ session: WorkoutSession) async throws {
        // Always save locally first (offline-first approach)
        // The session should already be saved in SwiftData by the caller
        
        // Check if online
        let isOnline = OfflineSyncService.shared.isOnline
        
        // Try to sync online if available
        if isOnline {
            do {
                let url = URL(string: "\(baseURL)/api/sessions")!
                var request = URLRequest(url: url)
                request.httpMethod = "POST"
                request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                if let token = authToken {
                    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
                }
                
                // Create a dictionary for API request
                var sessionData: [String: Any] = [
                    "id": session.id,
                    "userId": session.userId,
                    "sessionType": session.sessionType,
                    "status": session.status,
                    "startedAt": ISO8601DateFormatter().string(from: session.startedAt)
                ]
                
                // Add optional fields
                if let templateId = session.templateId {
                    sessionData["templateId"] = templateId
                }
                if let sessionName = session.sessionName {
                    sessionData["sessionName"] = sessionName
                }
                if let completedAt = session.completedAt {
                    sessionData["completedAt"] = ISO8601DateFormatter().string(from: completedAt)
                }
                if let notes = session.notes {
                    sessionData["notes"] = notes
                }
                if let movergyScore = session.movergyScore {
                    sessionData["movergyScore"] = movergyScore
                }
                
                request.httpBody = try JSONSerialization.data(withJSONObject: sessionData)
                
                let (_, response) = try await URLSession.shared.data(for: request)
                
                guard let httpResponse = response as? HTTPURLResponse else {
                    throw APIError.invalidResponse
                }
                
                guard (200...299).contains(httpResponse.statusCode) else {
                    // If sync fails, queue it
                    OfflineSyncService.shared.queueWorkoutSession(session)
                    throw APIError.httpError(httpResponse.statusCode)
                }
                
                print("[APIService] Workout session synced to server")
            } catch {
                // If online but sync fails, queue it
                OfflineSyncService.shared.queueWorkoutSession(session)
                print("[APIService] Failed to sync workout session, queued: \(error)")
                throw error
            }
        } else {
            // Offline - queue it
            OfflineSyncService.shared.queueWorkoutSession(session)
            print("[APIService] Workout session queued for offline sync")
        }
    }
    
    /// Create exercise log (with offline support)
    func createExerciseLog(_ log: ExerciseLog) async throws {
        // Always save locally first (offline-first approach)
        // The log should already be saved in SwiftData by the caller
        
        // Check if online
        let isOnline = OfflineSyncService.shared.isOnline
        
        if isOnline {
            do {
                let url = URL(string: "\(baseURL)/api/exercises")!
                var request = URLRequest(url: url)
                request.httpMethod = "POST"
                request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                if let token = authToken {
                    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
                }
                
                // Create a dictionary for API request
                var logData: [String: Any] = [
                    "id": log.id,
                    "workoutSessionId": log.workoutSessionId,
                    "exerciseKey": log.exerciseKey,
                    "exerciseTitle": log.exerciseTitle,
                    "exerciseOrderIndex": log.exerciseOrderIndex,
                    "setNumber": log.setNumber,
                    "completed": log.completed,
                    "createdAt": ISO8601DateFormatter().string(from: log.createdAt)
                ]
                
                // Add optional fields
                if let weight = log.weight {
                    logData["weight"] = weight
                }
                if let reps = log.reps {
                    logData["reps"] = reps
                }
                
                request.httpBody = try JSONSerialization.data(withJSONObject: logData)
                
                let (_, response) = try await URLSession.shared.data(for: request)
                
                guard let httpResponse = response as? HTTPURLResponse else {
                    throw APIError.invalidResponse
                }
                
                guard (200...299).contains(httpResponse.statusCode) else {
                    OfflineSyncService.shared.queueExerciseLog(log)
                    throw APIError.httpError(httpResponse.statusCode)
                }
                
                print("[APIService] Exercise log synced to server")
            } catch {
                OfflineSyncService.shared.queueExerciseLog(log)
                print("[APIService] Failed to sync exercise log, queued: \(error)")
                throw error
            }
        } else {
            OfflineSyncService.shared.queueExerciseLog(log)
            print("[APIService] Exercise log queued for offline sync")
        }
    }
    
    /// Complete workout session (with offline support)
    func completeWorkoutSession(sessionId: UUID, movergyScore: Int?) async throws {
        // Check if online
        let isOnline = OfflineSyncService.shared.isOnline
        
        if isOnline {
            do {
                let url = URL(string: "\(baseURL)/api/sessions/\(sessionId.uuidString)/complete")!
                var request = URLRequest(url: url)
                request.httpMethod = "POST"
                request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                if let token = authToken {
                    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
                }
                
                var body: [String: Any] = [:]
                if let score = movergyScore {
                    body["movergyScore"] = score
                }
                request.httpBody = try JSONSerialization.data(withJSONObject: body)
                
                let (_, response) = try await URLSession.shared.data(for: request)
                
                guard let httpResponse = response as? HTTPURLResponse else {
                    throw APIError.invalidResponse
                }
                
                guard (200...299).contains(httpResponse.statusCode) else {
                    OfflineSyncService.shared.queueSessionCompletion(sessionId: sessionId, movergyScore: movergyScore)
                    throw APIError.httpError(httpResponse.statusCode)
                }
                
                print("[APIService] Session completion synced to server")
            } catch {
                OfflineSyncService.shared.queueSessionCompletion(sessionId: sessionId, movergyScore: movergyScore)
                print("[APIService] Failed to sync session completion, queued: \(error)")
                throw error
            }
        } else {
            OfflineSyncService.shared.queueSessionCompletion(sessionId: sessionId, movergyScore: movergyScore)
            print("[APIService] Session completion queued for offline sync")
        }
    }
    
    // MARK: - Admin Methods (Dev Only)
    
    /// Fetch all pending exercises waiting for approval
    func fetchPendingExercises() async throws -> [PendingExercise] {
        let url = URL(string: "\(baseURL)/api/admin/pending/exercises")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.httpError(httpResponse.statusCode)
        }
        
        return try JSONDecoder().decode([PendingExercise].self, from: data)
    }
    
    /// Approve a pending exercise
    func approvePendingExercise(id: String) async throws -> AdminExerciseDTO {
        let url = URL(string: "\(baseURL)/api/admin/pending/exercises/\(id)/approve")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            let _ = try? JSONDecoder().decode(ErrorResponse.self, from: data)
            throw APIError.httpError(httpResponse.statusCode)
        }
        
        let approveResponse = try JSONDecoder().decode(AdminApproveResponse.self, from: data)
        return approveResponse.exercise
    }
    
    /// Reject a pending exercise
    func rejectPendingExercise(id: String, reason: String?) async throws {
        let url = URL(string: "\(baseURL)/api/admin/pending/exercises/\(id)/reject")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        var body: [String: Any] = [:]
        if let reason = reason {
            body["reason"] = reason
        }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (_, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.httpError(httpResponse.statusCode)
        }
    }
    
    /// Fetch all pending equipment waiting for approval
    func fetchPendingEquipment() async throws -> [PendingEquipment] {
        let url = URL(string: "\(baseURL)/api/admin/pending/equipment")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.httpError(httpResponse.statusCode)
        }
        
        return try JSONDecoder().decode([PendingEquipment].self, from: data)
    }
    
    /// Approve a pending equipment
    func approvePendingEquipment(id: String) async throws -> EquipmentCatalogResponse {
        let url = URL(string: "\(baseURL)/api/admin/pending/equipment/\(id)/approve")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.httpError(httpResponse.statusCode)
        }
        
        let approveResponse = try JSONDecoder().decode(AdminApproveEquipmentResponse.self, from: data)
        return approveResponse.equipment
    }
    
    /// Reject a pending equipment
    func rejectPendingEquipment(id: String, reason: String?) async throws {
        let url = URL(string: "\(baseURL)/api/admin/pending/equipment/\(id)/reject")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        var body: [String: Any] = [:]
        if let reason = reason {
            body["reason"] = reason
        }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (_, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.httpError(httpResponse.statusCode)
        }
    }
    
    // MARK: - V4 Workout Generation (Robust)
    
    /// Generate a V4 workout program with robust decoding
    func generateProgramV4() async throws -> V4ProgramResponse {
        let url = URL(string: "\(baseURL)/api/program/generate-v4")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        let (data, response) = try await performRequest(request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.httpError(httpResponse.statusCode)
        }
        
        do {
            return try JSONDecoder().decode(V4ProgramResponse.self, from: data)
        } catch {
            print("[APIService] ❌ DECODING ERROR (V4): \(error)")
            throw APIError.decodingError
        }
    }
    
    /// Fetch the user's time model for V4 generation
    func fetchUserTimeModel() async throws -> UserTimeModel {
        let url = URL(string: "\(baseURL)/api/user/time-model")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        let (data, response) = try await performRequest(request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.httpError(httpResponse.statusCode)
        }
        
        return try JSONDecoder().decode(UserTimeModel.self, from: data)
    }
    
    /// Update the user's time model
    func updateUserTimeModel(_ model: UserTimeModel) async throws -> UserTimeModel {
        let url = URL(string: "\(baseURL)/api/user/time-model")!
        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        request.httpBody = try JSONEncoder().encode(model)
        
        let (data, response) = try await performRequest(request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.httpError(httpResponse.statusCode)
        }
        
        return try JSONDecoder().decode(UserTimeModel.self, from: data)
    }
}

// MARK: - Additional Response Models

struct GymProgramResponse: Codable {
    let id: String
    let userId: String
    let gymId: String
    let programData: [String: AnyCodable]
    let templateSnapshot: [String: AnyCodable]?
    let snapshotCreatedAt: Date?
    let createdAt: Date
    let updatedAt: Date
    
    var programDataDict: [String: Any] {
        programData.mapValues { $0.value }
    }
    
    var templateSnapshotDict: [String: Any]? {
        templateSnapshot?.mapValues { $0.value }
    }
}

// Helper for decoding Any values from JSON
struct AnyCodable: Codable {
    let value: Any
    
    init(_ value: Any) {
        self.value = value
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        
        if let bool = try? container.decode(Bool.self) {
            value = bool
        } else if let int = try? container.decode(Int.self) {
            value = int
        } else if let double = try? container.decode(Double.self) {
            value = double
        } else if let string = try? container.decode(String.self) {
            value = string
        } else if let array = try? container.decode([AnyCodable].self) {
            value = array.map { $0.value }
        } else if let dict = try? container.decode([String: AnyCodable].self) {
            value = dict.mapValues { $0.value }
        } else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Cannot decode AnyCodable")
        }
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        
        switch value {
        case let bool as Bool:
            try container.encode(bool)
        case let int as Int:
            try container.encode(int)
        case let double as Double:
            try container.encode(double)
        case let string as String:
            try container.encode(string)
        case let array as [Any]:
            try container.encode(array.map { AnyCodable($0) })
        case let dict as [String: Any]:
            try container.encode(dict.mapValues { AnyCodable($0) })
        default:
            throw EncodingError.invalidValue(value, EncodingError.Context(codingPath: container.codingPath, debugDescription: "Cannot encode AnyCodable"))
        }
    }
}

// MARK: - Additional Response Models

struct ExerciseVideoResponse: Codable {
    let youtubeUrl: String?
    let videoType: String?
    let name: String?
    let nameEn: String?
}

struct GymResponse: Codable {
    let id: String
    let userId: String
    let name: String
    let location: String?
    let latitude: String?
    let longitude: String?
    let isPublic: Bool?
    let createdAt: Date
}

struct NearbyGymResponse: Codable {
    let id: String
    let userId: String
    let name: String
    let location: String?
    let latitude: String?
    let longitude: String?
    let isPublic: Bool?
    let distance: Double
    let createdAt: Date
}

struct UserEquipmentResponse: Codable {
    let id: String
    let userId: String
    let gymId: String
    let equipmentType: String
    let equipmentName: String
    let available: Bool
    let createdAt: Date
}

struct AiProgramDataResponse: Codable {
    let type: String?
    let generatedAt: String?
}

struct UserProfileResponse: Codable {
    let id: String?
    let userId: String?
    let age: Int?
    let sex: String?
    let bodyWeight: Int?
    let height: Int?
    let bodyFatPercent: Int?
    let muscleMassPercent: Int?
    let oneRmBench: Int?
    let oneRmOhp: Int?
    let oneRmDeadlift: Int?
    let oneRmSquat: Int?
    let oneRmLatpull: Int?
    let motivationType: String?
    let trainingLevel: String?
    let specificSport: String?
    let trainingGoals: String?
    let goalStrength: Int?
    let goalVolume: Int?
    let goalEndurance: Int?
    let goalCardio: Int?
    let sessionsPerWeek: Int?
    let sessionDuration: Int?
    let restTime: Int?
    let restTimeBetweenSets: Int?
    let restTimeBetweenExercises: Int?
    let theme: String?
    let avatarType: String?
    let avatarEmoji: String?
    let avatarImageUrl: String?
    let avatarConfig: String?
    let onboardingCompleted: Bool?
    let appleHealthConnected: Bool?
    let equipmentRegistered: Bool?
    let hasAiProgram: Bool?
    let aiProgramData: AiProgramDataResponse?
    let selectedGymId: String?
    let lastCompletedTemplateId: String?
    let lastSessionType: String?
    let currentPassNumber: Int?
    let programGenerationsThisWeek: Int?
    let weekStartDate: Date?
    let createdAt: Date?
    let updatedAt: Date?
}

struct ProgramTemplateResponse: Decodable {
    let id: String
    let templateName: String
    let muscleFocus: String?
    let dayOfWeek: Int?
    let estimatedDurationMinutes: Int?
    
    // Exercises can be at root or wrapped in 'exercises' property of top-level object
    // while template fields are in 'template' property
    let exercises: [ProgramTemplateExerciseResponse]?
    
    enum CodingKeys: String, CodingKey {
        case id
        case templateName
        case muscleFocus
        case dayOfWeek
        case estimatedDurationMinutes
        case exercises
        case template // New format wrapper
    }
    
    // New nested keys
    enum TemplateKeys: String, CodingKey {
        case id
        case templateName
        case muscleFocus
        case dayOfWeek
        case estimatedDurationMinutes
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        
        // 1. Try new nested format: { template: {...}, exercises: [...] }
        if let templateContainer = try? container.nestedContainer(keyedBy: TemplateKeys.self, forKey: .template) {
            id = try templateContainer.decode(String.self, forKey: .id)
            templateName = try templateContainer.decode(String.self, forKey: .templateName)
            muscleFocus = try? templateContainer.decode(String.self, forKey: .muscleFocus)
            dayOfWeek = try? templateContainer.decode(Int.self, forKey: .dayOfWeek)
            estimatedDurationMinutes = try? templateContainer.decode(Int.self, forKey: .estimatedDurationMinutes)
            
            // Exercises are at the root level of the response object in the new format
            exercises = try? container.decode([ProgramTemplateExerciseResponse].self, forKey: .exercises)
        } 
        // 2. Fallback to old flat format
        else {
            id = try container.decode(String.self, forKey: .id)
            templateName = try container.decode(String.self, forKey: .templateName)
            muscleFocus = try? container.decode(String.self, forKey: .muscleFocus)
            dayOfWeek = try? container.decode(Int.self, forKey: .dayOfWeek)
            estimatedDurationMinutes = try? container.decode(Int.self, forKey: .estimatedDurationMinutes)
            exercises = try? container.decode([ProgramTemplateExerciseResponse].self, forKey: .exercises)
        }
    }
    
    // Add memberwise initializer manually since we defined a custom init(from:)
    init(id: String, templateName: String, muscleFocus: String?, dayOfWeek: Int?, estimatedDurationMinutes: Int?, exercises: [ProgramTemplateExerciseResponse]?) {
        self.id = id
        self.templateName = templateName
        self.muscleFocus = muscleFocus
        self.dayOfWeek = dayOfWeek
        self.estimatedDurationMinutes = estimatedDurationMinutes
        self.exercises = exercises
    }
}

struct ProgramTemplateExerciseResponse: Codable {
    let id: String
    let exerciseKey: String
    let exerciseName: String
    let orderIndex: Int
    let targetSets: Int
    let targetReps: String
    let targetWeight: Double?
    let requiredEquipment: [String]
    let muscles: [String]
    let notes: String?
}

struct WorkoutSessionResponse: Codable {
    let id: String
    let templateId: String?
    let sessionType: String
    let sessionName: String?
    let status: String
    let startedAt: Date
    let completedAt: Date?
}

// MARK: - Response Models

struct AuthResponse: Codable {
    let token: String
    let user: UserInfo
}

struct UserInfo: Codable {
    let id: String
    let email: String
    let name: String?
}

struct WorkoutProgramResponse: Codable {
    let success: Bool
    let program: WorkoutProgram
    let profile: UserProfileData?
}

struct UserProfileData: Codable {
    let userId: String
    let updatedAt: String
}

struct ErrorResponse: Codable {
    let message: String
    let remaining: Int?
    let resetDate: String?
}

struct HealthDataSync: Codable {
    let steps: Int?
    let activeEnergyBurned: Double?
    let heartRate: Double?
    let sleepHours: Double?
    let date: Date
}

struct ProgressShare: Codable {
    let type: ShareType
    let title: String
    let description: String
    let metrics: [String: Double]
    let imageURL: String?
    
    enum ShareType: String, Codable {
        case workout = "workout"
        case milestone = "milestone"
        case challenge = "challenge"
    }
}

struct ShareResponse: Codable {
    let shareId: String
    let shareURL: String
}

struct Challenge: Codable, Identifiable {
    let id: String
    let title: String
    let description: String
    let startDate: Date
    let endDate: Date
    let participants: Int
    let isParticipating: Bool
}

// MARK: - Admin Models

struct PendingExercise: Codable, Identifiable {
    let id: String
    let name: String
    let nameEn: String?
    let description: String?
    let category: String?
    let difficulty: String?
    let primaryMuscles: [String]?
    let secondaryMuscles: [String]?
    let requiredEquipment: [String]?
    let movementPattern: String?
    let isCompound: Bool?
    let youtubeUrl: String?
    let videoType: String?
    let instructions: String?
    let createdBy: String
    let aiGeneratedName: String?
    let status: String
    let reviewedBy: String?
    let reviewedAt: Date?
    let rejectionReason: String?
    let createdAt: Date
}

struct PendingEquipment: Codable, Identifiable {
    let id: String
    let name: String
    let nameEn: String?
    let category: String?
    let type: String?
    let description: String?
    let createdBy: String
    let aiGeneratedName: String?
    let status: String
    let reviewedBy: String?
    let reviewedAt: Date?
    let rejectionReason: String?
    let createdAt: Date
}

// Disambiguated API DTO for approved exercise (renamed from Exercise to avoid clash with SwiftData model)
struct AdminExerciseDTO: Codable {
    let id: String
    let name: String
    let nameEn: String?
    let description: String?
    let category: String?
    let difficulty: String?
    let primaryMuscles: [String]?
    let secondaryMuscles: [String]?
    let requiredEquipment: [String]?
    let movementPattern: String?
    let isCompound: Bool?
    let youtubeUrl: String?
    let videoType: String?
    let instructions: String?
}

struct AdminApproveResponse: Codable {
    let success: Bool
    let exercise: AdminExerciseDTO
}

struct EquipmentCatalogResponse: Codable {
    let id: String
    let name: String
    let nameEn: String?
    let category: String
    let type: String
    let description: String?
    let createdAt: Date
}

struct AdminApproveEquipmentResponse: Codable {
    let success: Bool
    let equipment: EquipmentCatalogResponse
}

// MARK: - Errors

enum APIError: LocalizedError {
    case invalidResponse
    case unauthorized
    case httpError(Int)
    case rateLimited(String)
    case decodingError
    case networkError(String)
    case unknown(String)
    
    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "Ogiltigt svar från servern"
        case .unauthorized:
            return "Du är inte inloggad"
        case .httpError(let code):
            return "HTTP-fel: \(code)"
        case .rateLimited(let message):
            return message
        case .decodingError:
            return "Kunde inte tolka svaret från servern"
        case .networkError(let message):
            return "Nätverksfel: \(message). Kontrollera din internetanslutning och att servern körs."
        case .unknown(let message):
            return message
        }
    }
}


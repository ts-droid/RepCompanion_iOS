import Foundation

/// API Service for communicating with the backend server
@MainActor
class APIService {
    static let shared = APIService()
    
    // TODO: Update with your actual server URL
    // Using port 5001 because 5000 is often used by macOS AirPlay
    private let baseURL = "http://localhost:5001"
    
    private var authToken: String? {
        // Get from keychain or user defaults
        UserDefaults.standard.string(forKey: "authToken")
    }
    
    private init() {}
    
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
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
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
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
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
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
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
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
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
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
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
        let goalVolume: Int
        let goalEndurance: Int
        let goalCardio: Int
    }
    
    struct SuggestedOneRmResponse: Codable {
        let oneRmBench: Int
        let oneRmOhp: Int
        let oneRmDeadlift: Int
        let oneRmSquat: Int
        let oneRmLatpull: Int
    }
    
    func completeOnboarding(profile: OnboardingCompleteRequest.ProfileData, equipment: [String]) async throws -> OnboardingCompleteResponse {
        // TEMPORARY: Skip token requirement for testing
        print("[APIService] ✅ Completing onboarding without authentication (testing mode)...")
        
        let url = URL(string: "\(baseURL)/api/onboarding/complete")!
        
        // Create custom URLSessionConfiguration with extended timeout for AI generation
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 300.0 // 5 minutes for AI generation
        config.timeoutIntervalForResource = 300.0 // 5 minutes total
        let session = URLSession(configuration: config)
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        // No Authorization header - backend will use default dev user
        
        let body = OnboardingCompleteRequest(profile: profile, equipment: equipment)
        request.httpBody = try JSONEncoder().encode(body)
        
        print("[APIService] ⏱️ Starting onboarding completion (timeout: 5 minutes for AI generation)...")
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
        } catch {
            // Log the actual JSON for debugging
            if let jsonString = String(data: data, encoding: .utf8) {
                print("[APIService] ❌ Failed to decode response. JSON: \(jsonString)")
            }
            print("[APIService] ❌ Decoding error: \(error)")
            throw error
        }
    }
    
    // MARK: - Async Program Generation
    
    /// Get suggested training goals based on user profile
    func suggestTrainingGoals(
        motivationType: String,
        trainingLevel: String,
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
    func suggestOneRmValues(
        motivationType: String,
        trainingLevel: String,
        age: Int,
        sex: String,
        bodyWeight: Int,
        height: Int
    ) async throws -> SuggestedOneRmResponse {
        let url = URL(string: "\(baseURL)/api/profile/suggest-onerm")!
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
        
        return try JSONDecoder().decode(SuggestedOneRmResponse.self, from: data)
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
    
    // MARK: - Program Templates
    
    func fetchProgramTemplates() async throws -> [ProgramTemplateResponse] {
        guard let token = authToken else {
            throw APIError.unauthorized
        }
        
        let url = URL(string: "\(baseURL)/api/program/templates")!
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
        
        // Response is an array of objects with template and exerciseCount
        struct TemplateWithMetadata: Codable {
            let template: ProgramTemplateResponse
            let exerciseCount: Int
            let isNext: Bool
        }
        
        let templatesWithMetadata = try decoder.decode([TemplateWithMetadata].self, from: data)
        return templatesWithMetadata.map { $0.template }
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
        
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.timeoutInterval = 30.0
        
        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            print("[APIService] ✅ Using auth token")
        } else {
            print("[APIService] ⚠️ No auth token - using public endpoint")
        }
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            print("[APIService] ❌ Invalid response type")
            throw APIError.invalidResponse
        }
        
        print("[APIService] 📡 Response status: \(httpResponse.statusCode)")
        
        guard (200...299).contains(httpResponse.statusCode) else {
            let errorBody = String(data: data, encoding: .utf8) ?? "No error body"
            print("[APIService] ❌ HTTP error: \(httpResponse.statusCode), body: \(errorBody)")
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
    
    func createGym(name: String, location: String?) async throws -> GymResponse {
        guard let token = authToken else {
            throw APIError.unauthorized
        }
        
        let url = URL(string: "\(baseURL)/api/gyms")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        let body = [
            "name": name,
            "location": location as Any
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
    let aiProgramData: String?
    let selectedGymId: String?
    let lastCompletedTemplateId: String?
    let lastSessionType: String?
    let currentPassNumber: Int?
    let programGenerationsThisWeek: Int?
    let weekStartDate: Date?
    let createdAt: Date?
    let updatedAt: Date?
}

struct ProgramTemplateResponse: Codable {
    let id: String
    let templateName: String
    let muscleFocus: String?
    let dayOfWeek: Int?
    let estimatedDurationMinutes: Int?
    let exercises: [ProgramTemplateExerciseResponse]
}

struct ProgramTemplateExerciseResponse: Codable {
    let id: String
    let exerciseKey: String
    let exerciseName: String
    let orderIndex: Int
    let targetSets: Int
    let targetReps: String
    let targetWeight: Int?
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
        }
    }
}


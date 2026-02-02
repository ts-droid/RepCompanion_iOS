import Foundation
import SwiftData
import Combine

struct WorkoutGenerationInput {
    let gender: String
    let age: Int
    let weightKg: Double
    let heightCm: Int
    let trainingLevel: String
    let mainGoal: String
    let motivationType: String?
    let specificSport: String?
    let focusTags: [String]
    let selectedIntent: String?
    let distribution: GoalDistribution
    let sessionsPerWeek: Int
    let sessionLengthMinutes: Int
    let availableEquipment: [String]
    let gymId: String?
    let oneRMValues: OneRMValues?
    
    struct GoalDistribution {
        let strengthPercent: Int
        let hypertrophyPercent: Int
        let endurancePercent: Int
        let cardioPercent: Int
    }
    
    struct OneRMValues {
        let bench: Double?
        let ohp: Double?
        let deadlift: Double?
        let squat: Double?
        let latpull: Double?
    }
}

struct WorkoutProgram: Codable {
    let userProfile: UserProfileData
    let programOverview: ProgramOverview
    let weeklySessions: [WeeklySession]
    let recoveryTips: [String]
    
    struct UserProfileData: Codable {
        let gender: String
        let age: Int
        let weightKg: Double
        let heightCm: Int
        let trainingLevel: String
        let mainGoal: String
        let focusTags: [String]?
        let selectedIntent: String?
        let distribution: GoalDistribution
        let sessionsPerWeek: Int
        let sessionLengthMinutes: Int
        let availableEquipment: [String]
        
        struct GoalDistribution: Codable {
            let strengthPercent: Int
            let hypertrophyPercent: Int
            let endurancePercent: Int
            let cardioPercent: Int
        }
    }
    
    struct ProgramOverview: Codable {
        let weekFocusSummary: String
        let expectedDifficulty: String
        let notesOnProgression: String
    }
    
    struct WeeklySession: Codable {
        let sessionNumber: Int
        let weekday: String
        let sessionName: String
        let sessionType: String
        let estimatedDurationMinutes: Int
        let muscleFocus: String
        let warmup: [WarmupExercise]
        let mainWork: [MainExercise]
        let cooldown: [CooldownExercise]
        
        struct WarmupExercise: Codable {
            let exerciseName: String
            let sets: Int
            let repsOrDuration: String
            let notes: String
        }
        
        struct MainExercise: Codable {
            let exerciseName: String
            let sets: Int
            let reps: String
            let restSeconds: Int
            let tempo: String
            let suggestedWeightKg: Double
            let suggestedWeightNotes: String
            let targetMuscles: [String]
            let requiredEquipment: [String]
            let techniqueCues: [String]
        }
        
        struct CooldownExercise: Codable {
            let exerciseName: String
            let durationOrReps: String
            let notes: String
        }
    }
}

@MainActor
class WorkoutGenerationService: ObservableObject {
    static let shared = WorkoutGenerationService()
    
    private let modelContext: ModelContext?
    
    init(modelContext: ModelContext? = nil) {
        self.modelContext = modelContext
    }
    
    func getUserWorkoutData(userId: String, modelContext: ModelContext) -> WorkoutGenerationInput? {
        // Use the passed-in context
        let context = modelContext
        
        // Fetch user profile
        let profileDescriptor = FetchDescriptor<UserProfile>(
            predicate: #Predicate { $0.userId == userId }
        )
        
        guard let profile = try? context.fetch(profileDescriptor).first else {
            return nil
        }
        
        // Map sex to gender format
        let genderMap: [String: String] = [
            "male": "Man",
            "man": "Man",
            "female": "Kvinna",
            "kvinna": "Kvinna",
            "other": "Annat",
            "annat": "Annat"
        ]
        let gender = genderMap[profile.sex?.lowercased() ?? ""] ?? "Annat"
        
        // Map motivation type to main goal (labels used for AI prompt context)
        let goalMap: [String: String] = [
            "fitness": "Generell fitness",
            "lose_weight": "Weight loss and health",
            "weight_loss": "Weight loss and health",
            "viktminskning": "Weight loss and health",
            "rehabilitation": "Rehabilitering",
            "rehabilitering": "Rehabilitering",
            "better_health": "Health and lifestyle",
            "better_health": "Health and lifestyle",
            "health_lifestyle": "Health and lifestyle",
            "build_muscle": "Muscle growth and hypertrophy",
            "bygga_muskler": "Muscle growth and hypertrophy",
            "hypertrofi": "Muscle growth and hypertrophy",
            "mobility": "Mobility and flexibility",
            "become_more_flexible": "Mobility and flexibility",
            "sport": "Sportprestation",
            "health": "Generell fitness",
            "styrka": "Muscle growth",
            "estetik": "Muscle growth"
        ]
        let motivationType = profile.motivationType ?? profile.trainingGoals ?? "fitness"
        let mainGoal = goalMap[motivationType.lowercased()] ?? "Generell fitness"
        
        // Map training level
        let levelMap: [String: String] = [
            "beginner": "Beginner",
            "beginner": "Beginner",
            "intermediate": "Van",
            "van": "Van",
            "advanced": "Mycket van",
            "mycket_van": "Mycket van",
            "elite": "Elit",
            "elit": "Elit"
        ]
        let trainingLevel = levelMap[profile.trainingLevel?.lowercased() ?? ""] ?? "Van"
        
        // Fetch selected gym
        let gymDescriptor = FetchDescriptor<Gym>(
            predicate: #Predicate { $0.userId == userId && $0.isSelected }
        )
        let selectedGym = try? context.fetch(gymDescriptor).first
        
        return WorkoutGenerationInput(
            gender: gender,
            age: profile.age ?? 30,
            weightKg: Double(profile.bodyWeight ?? 75),
            heightCm: profile.height ?? 175,
            trainingLevel: trainingLevel,
            mainGoal: mainGoal,
            motivationType: motivationType,
            specificSport: profile.specificSport,
            focusTags: profile.focusTags,
            selectedIntent: profile.selectedIntent,
            distribution: WorkoutGenerationInput.GoalDistribution(
                strengthPercent: profile.goalStrength,
                hypertrophyPercent: profile.goalVolume,
                endurancePercent: profile.goalEndurance,
                cardioPercent: profile.goalCardio
            ),
            sessionsPerWeek: profile.sessionsPerWeek,
            sessionLengthMinutes: profile.sessionDuration,
            availableEquipment: selectedGym?.equipmentIds ?? [],
            gymId: selectedGym?.id,
            oneRMValues: WorkoutGenerationInput.OneRMValues(
                bench: profile.oneRmBench.map { Double($0) },
                ohp: profile.oneRmOhp.map { Double($0) },
                deadlift: profile.oneRmDeadlift.map { Double($0) },
                squat: profile.oneRmSquat.map { Double($0) },
                latpull: profile.oneRmLatpull.map { Double($0) }
            )
        )
    }
    
    func generateProgram(for input: WorkoutGenerationInput, userId: String, modelContext: ModelContext) async throws -> WorkoutProgram {
        // HYBRID APPROACH: Try Apple Intelligence first (on-device), then fall back to server-side
        
        // Step 1: Try Apple Intelligence if available (iOS 18+)
        if #available(iOS 18.0, *) {
            let appleIntelligence = AppleIntelligenceService.shared
            if appleIntelligence.isAvailable() {
                do {
                    print("[WorkoutGeneration] 🧠 Attempting Apple Intelligence generation...")
                    let program = try await appleIntelligence.generateWorkoutProgram(for: input)
                    
                    // Save program templates to SwiftData
                    try await saveProgramTemplates(from: program, userId: userId, gymId: input.gymId, modelContext: modelContext)
                    
                    print("[WorkoutGeneration] ✅ Successfully generated program using Apple Intelligence")
                    return program
                } catch let error as AppleIntelligenceError {
                    print("[WorkoutGeneration] ⚠️ Apple Intelligence failed: \(error.localizedDescription)")
                    // Fall through to server-side generation
                } catch {
                    print("[WorkoutGeneration] ⚠️ Apple Intelligence error: \(error.localizedDescription)")
                    // Fall through to server-side generation
                }
            } else {
                print("[WorkoutGeneration] ℹ️ Apple Intelligence not available on this device")
            }
        }
        
        // Step 2: Fall back to server-side generation via API
        print("[WorkoutGeneration] 🌐 Using server-side V4 generation...")
        do {
            let v4Response = try await APIService.shared.generateProgramV4()
            let program = convertV4ToLegacyFormat(v4Response.program, input: input)
            
            // Save program templates to SwiftData
            try await saveProgramTemplates(from: program, userId: userId, gymId: input.gymId, modelContext: modelContext)
            
            print("[WorkoutGeneration] ✅ Successfully generated program using V4 API")
            return program
        } catch {
            // Final fallback to mock if API fails (for development/testing)
            print("[WorkoutGeneration] ⚠️ V4 generation failed, using mock: \(error)")
            let mockProgram = createMockProgram(for: input)
            
            // Save program templates to SwiftData
            try await saveProgramTemplates(from: mockProgram, userId: userId, gymId: input.gymId, modelContext: modelContext)
            
            return mockProgram
        }
    }
    
    // Convert V4 program structure to legacy WorkoutProgram format
    private func convertV4ToLegacyFormat(_ v4Program: V4Program, input: WorkoutGenerationInput) -> WorkoutProgram {
        let sessions = v4Program.sessions.enumerated().map { (index, v4Session) -> WorkoutProgram.WeeklySession in
            // Extract all exercises from all blocks
            var allExercises: [V4Exercise] = []
            for block in v4Session.blocks {
                allExercises.append(contentsOf: block.exercises)
            }
            
            // Convert V4 exercises to legacy MainExercise format
            let mainWork = allExercises.map { v4Ex -> WorkoutProgram.WeeklySession.MainExercise in
                // Calculate suggested weight based on load type
                let suggestedWeight: Double
                let weightNotes: String
                
                switch v4Ex.loadType {
                case .percentage1RM:
                    suggestedWeight = v4Ex.loadValue // Already in kg from backend
                    weightNotes = "\(Int(v4Ex.loadValue))% av 1RM"
                case .rpe:
                    suggestedWeight = 0
                    weightNotes = "RPE \(Int(v4Ex.loadValue))"
                case .bodyweight:
                    suggestedWeight = 0
                    weightNotes = "Kroppsvikt"
                case .fixed:
                    suggestedWeight = v4Ex.loadValue
                    weightNotes = "\(Int(v4Ex.loadValue)) kg"
                case .unknown(let type):
                    suggestedWeight = v4Ex.loadValue
                    weightNotes = type
                }
                
                return WorkoutProgram.WeeklySession.MainExercise(
                    exerciseName: v4Ex.exerciseName ?? v4Ex.exerciseID,
                    sets: v4Ex.sets,
                    reps: v4Ex.reps,
                    restSeconds: v4Ex.restSeconds ?? 90,
                    tempo: "2-1-2-1", // Default tempo
                    suggestedWeightKg: suggestedWeight,
                    suggestedWeightNotes: weightNotes,
                    targetMuscles: [], // Not provided by V4
                    requiredEquipment: [], // Not provided by V4
                    techniqueCues: v4Ex.notes.map { [$0] } ?? []
                )
            }
            
            // Use session name from V4, fallback to "Pass X"
            let sessionName = v4Session.name ?? "Pass \(index + 1)"
            
            return WorkoutProgram.WeeklySession(
                sessionNumber: v4Session.sessionIndex,
                weekday: v4Session.weekday,
                sessionName: sessionName,
                sessionType: "strength",
                estimatedDurationMinutes: v4Session.estimatedMinutes ?? input.sessionLengthMinutes,
                muscleFocus: v4Session.name ?? "Full Body",
                warmup: [
                    WorkoutProgram.WeeklySession.WarmupExercise(
                        exerciseName: "Dynamic Warm-up",
                        sets: 1,
                        repsOrDuration: "5-10 min",
                        notes: "Prepare your body for training"
                    )
                ],
                mainWork: mainWork,
                cooldown: [
                    WorkoutProgram.WeeklySession.CooldownExercise(
                        exerciseName: "Static Stretching",
                        durationOrReps: "5 min",
                        notes: "Stretch trained muscle groups"
                    )
                ]
            )
        }
        
        return WorkoutProgram(
            userProfile: WorkoutProgram.UserProfileData(
                gender: input.gender,
                age: input.age,
                weightKg: input.weightKg,
                heightCm: input.heightCm,
                trainingLevel: input.trainingLevel,
                mainGoal: input.mainGoal,
                focusTags: input.focusTags,
                selectedIntent: input.selectedIntent,
                distribution: WorkoutProgram.UserProfileData.GoalDistribution(
                    strengthPercent: input.distribution.strengthPercent,
                    hypertrophyPercent: input.distribution.hypertrophyPercent,
                    endurancePercent: input.distribution.endurancePercent,
                    cardioPercent: input.distribution.cardioPercent
                ),
                sessionsPerWeek: input.sessionsPerWeek,
                sessionLengthMinutes: input.sessionLengthMinutes,
                availableEquipment: input.availableEquipment
            ),
                programOverview: WorkoutProgram.ProgramOverview(
                    weekFocusSummary: v4Program.programName ?? String(localized: "Personal Training Program"),
                    expectedDifficulty: String(localized: "Medium"),
                    notesOnProgression: String(localized: "Increase weight gradually each week")
                ),
                weeklySessions: sessions,
                recoveryTips: [
                    String(localized: "Sleep 7-9 hours per night for optimal recovery"),
                    String(localized: "Eat protein within 2 hours after training"),
                    String(localized: "Rest at least one day between intense sessions")
                ]
        )
    }
    
    private func createMockProgram(for input: WorkoutGenerationInput) -> WorkoutProgram {
        let sessions = (1...input.sessionsPerWeek).map { sessionNumber in
            WorkoutProgram.WeeklySession(
                sessionNumber: sessionNumber,
                weekday: getWeekday(for: sessionNumber, totalSessions: input.sessionsPerWeek),
                sessionName: "Pass \(sessionNumber)",
                sessionType: "strength",
                estimatedDurationMinutes: input.sessionLengthMinutes,
                muscleFocus: getMuscleFocus(for: sessionNumber),
                warmup: [
                    WorkoutProgram.WeeklySession.WarmupExercise(
                        exerciseName: "Dynamic Warm-up",
                        sets: 1,
                        repsOrDuration: "5-10 min",
                        notes: "Prepare your body for training"
                    )
                ],
                mainWork: createMainExercises(for: sessionNumber, input: input),
                cooldown: [
                    WorkoutProgram.WeeklySession.CooldownExercise(
                        exerciseName: "Static Stretching",
                        durationOrReps: "5 min",
                        notes: "Stretch trained muscle groups"
                    )
                ]
            )
        }
        
        return WorkoutProgram(
            userProfile: WorkoutProgram.UserProfileData(
                gender: input.gender,
                age: input.age,
                weightKg: input.weightKg,
                heightCm: input.heightCm,
                trainingLevel: input.trainingLevel,
                mainGoal: input.mainGoal,
                focusTags: input.focusTags,
                selectedIntent: input.selectedIntent,
                distribution: WorkoutProgram.UserProfileData.GoalDistribution(
                    strengthPercent: input.distribution.strengthPercent,
                    hypertrophyPercent: input.distribution.hypertrophyPercent,
                    endurancePercent: input.distribution.endurancePercent,
                    cardioPercent: input.distribution.cardioPercent
                ),
                sessionsPerWeek: input.sessionsPerWeek,
                sessionLengthMinutes: input.sessionLengthMinutes,
                availableEquipment: input.availableEquipment
            ),
            programOverview: WorkoutProgram.ProgramOverview(
                weekFocusSummary: String(localized: "Balanced full-body program with focus on basic movements"),
                expectedDifficulty: String(localized: "Medium"),
                notesOnProgression: String(localized: "Increase weight gradually each week")
            ),
            weeklySessions: sessions,
            recoveryTips: [
                String(localized: "Sleep 7-9 hours per night for optimal recovery"),
                String(localized: "Eat protein within 2 hours after training"),
                String(localized: "Rest at least one day between intense sessions")
            ]
        )
    }
    
    private func getWeekday(for sessionNumber: Int, totalSessions: Int) -> String {
        let weekdays = [
            String(localized: "Monday"),
            String(localized: "Tuesday"),
            String(localized: "Wednesday"),
            String(localized: "Thursday"),
            String(localized: "Friday"),
            String(localized: "Saturday"),
            String(localized: "Sunday")
        ]
        let spacing = 7 / totalSessions
        let index = (sessionNumber - 1) * spacing
        return weekdays[min(index, weekdays.count - 1)]
    }
    
    private func getMuscleFocus(for sessionNumber: Int) -> String {
        switch sessionNumber {
        case 1: return "Upper Body - Push"
        case 2: return "Legs"
        case 3: return "Upper Body - Pull"
        case 4: return "Full Body"
        default: return "Full Body"
        }
    }
    
    private func createMainExercises(for sessionNumber: Int, input: WorkoutGenerationInput) -> [WorkoutProgram.WeeklySession.MainExercise] {
        switch sessionNumber {
        case 1: // Upper Push
            return [
                WorkoutProgram.WeeklySession.MainExercise(
                    exerciseName: "Bench Press",
                    sets: 3,
                    reps: "8-12",
                    restSeconds: 90,
                    tempo: "2-1-2-1",
                    suggestedWeightKg: calculateStartingWeight(exercise: "bench", input: input),
                    suggestedWeightNotes: "Start conservatively",
                    targetMuscles: ["Chest", "Shoulders", "Triceps"],
                    requiredEquipment: ["Barbell", "Bench"],
                    techniqueCues: ["Keep shoulder blades together", "Controlled movement"]
                ),
                WorkoutProgram.WeeklySession.MainExercise(
                    exerciseName: "Overhead Press",
                    sets: 3,
                    reps: "8-10",
                    restSeconds: 90,
                    tempo: "2-1-2-1",
                    suggestedWeightKg: calculateStartingWeight(exercise: "ohp", input: input),
                    suggestedWeightNotes: "Focus on technique",
                    targetMuscles: ["Shoulders", "Triceps", "Core"],
                    requiredEquipment: ["Barbell"],
                    techniqueCues: ["Brace your core", "Press rakt upp"]
                )
            ]
        case 2: // Legs
            return [
                WorkoutProgram.WeeklySession.MainExercise(
                    exerciseName: "Squat",
                    sets: 3,
                    reps: "10-15",
                    restSeconds: 120,
                    tempo: "2-1-2-1",
                    suggestedWeightKg: calculateStartingWeight(exercise: "squat", input: input),
                    suggestedWeightNotes: "Djup position",
                    targetMuscles: ["Quadriceps", "Glutes", "Hamstrings"],
                    requiredEquipment: ["Barbell"],
                    techniqueCues: ["Knees follow toes", "Keep your back straight"]
                )
            ]
        default: // Upper Pull
            return [
                WorkoutProgram.WeeklySession.MainExercise(
                    exerciseName: "Bent-over Row",
                    sets: 3,
                    reps: "8-12",
                    restSeconds: 90,
                    tempo: "2-1-2-1",
                    suggestedWeightKg: calculateStartingWeight(exercise: "row", input: input),
                    suggestedWeightNotes: "Feel it in your back",
                    targetMuscles: ["Lats", "Rhomboids", "Biceps"],
                    requiredEquipment: ["Barbell"],
                    techniqueCues: ["Dra till magen", "Brace shoulder blades"]
                )
            ]
        }
    }
    
    private func calculateStartingWeight(exercise: String, input: WorkoutGenerationInput) -> Double {
        guard let oneRM = input.oneRMValues else { return 20 }
        
        let baseWeight: Double
        switch exercise {
        case "bench": baseWeight = oneRM.bench ?? 40
        case "ohp": baseWeight = oneRM.ohp ?? 30
        case "squat": baseWeight = oneRM.squat ?? 50
        case "deadlift": baseWeight = oneRM.deadlift ?? 60
        default: baseWeight = 30
        }
        
        // Use 70% of 1RM for 8-12 rep range
        return baseWeight * 0.7
    }
    
    func saveProgramTemplates(from program: WorkoutProgram, userId: String, gymId: String?, modelContext: ModelContext) async throws {
        print("[WorkoutGenerationService] 🧹 Starting cleanup for user: \(userId), gym: \(gymId ?? "none")")
        
        // Clear existing templates for THIS gym specifically
        // Also clear legacy "current-user" templates to avoid duplicates
        let descriptor = FetchDescriptor<ProgramTemplate>(
            predicate: #Predicate { ($0.userId == userId || $0.userId == "current-user") && $0.gymId == gymId }
        )
        
        do {
            let existingTemplates = try modelContext.fetch(descriptor)
            print("[WorkoutGenerationService] 🗑️ Found \(existingTemplates.count) existing templates to delete")
            for template in existingTemplates {
                modelContext.delete(template)
            }
        } catch {
            print("[WorkoutGenerationService] ⚠️ Cleanup fetch failed: \(error)")
        }
        
        // Create new templates from generated program
        print("[WorkoutGenerationService] 📝 Saving \(program.weeklySessions.count) new sessions")
        
        for session in program.weeklySessions {
            let template = ProgramTemplate(
                userId: userId,
                gymId: gymId,
                templateName: session.sessionName,
                muscleFocus: session.muscleFocus,
                dayOfWeek: getDayOfWeek(from: session.weekday),
                estimatedDurationMinutes: session.estimatedDurationMinutes
            )
            
            // Add exercises to template
            print("[WorkoutGenerationService]   - Session: \(session.sessionName), Exercises: \(session.mainWork.count)")
            
            for (exerciseIndex, exercise) in session.mainWork.enumerated() {
                let templateExercise = ProgramTemplateExercise(
                    gymId: gymId,
                    exerciseKey: exercise.exerciseName.lowercased().replacingOccurrences(of: " ", with: "-"),
                    exerciseName: exercise.exerciseName,
                    orderIndex: exerciseIndex,
                    targetSets: exercise.sets,
                    targetReps: exercise.reps,
                    targetWeight: exercise.suggestedWeightKg,
                    requiredEquipment: exercise.requiredEquipment,
                    muscles: exercise.targetMuscles
                )
                
                // Establish the relationship
                templateExercise.template = template
                template.exercises.append(templateExercise)
                
                // Explicitly insert the exercise if needed, though SwiftData usually handles through relationship
                modelContext.insert(templateExercise)
            }
            
            modelContext.insert(template)
        }
        
        do {
            try modelContext.save()
            print("[WorkoutGenerationService] ✅ Successfully saved all templates and exercises")
        } catch {
            print("[WorkoutGenerationService] ❌ Failed to save context: \(error)")
            throw error
        }
    }
    
    private func getDayOfWeek(from weekday: String) -> Int {
        let weekdays = [
            String(localized: "Monday"): 1,
            String(localized: "Tuesday"): 2,
            String(localized: "Wednesday"): 3,
            String(localized: "Thursday"): 4,
            String(localized: "Friday"): 5,
            String(localized: "Saturday"): 6,
            String(localized: "Sunday"): 7
        ]
        return weekdays[weekday] ?? 1
    }
    
    // MARK: - Muscle Balance Analysis
    
    func fetchMuscleBalanceAnalysis() async throws -> MuscleBalanceAnalysis {
        guard let token = APIService.shared.authToken else {
            throw APIError.unauthorized
        }
        
        var request = URLRequest(url: URL(string: "\(APIService.shared.baseURL)/api/profile/muscle-balance")!)
        request.httpMethod = "GET"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, (200...299).contains(httpResponse.statusCode) else {
            throw APIError.invalidResponse
        }
        
        let decoder = JSONDecoder()
        return try decoder.decode(MuscleBalanceAnalysis.self, from: data)
    }
}

// MARK: - Models

struct MuscleBalanceAnalysis: Codable {
    let stats: [MuscleGroupStats]
    let totalExercises: Int
    let totalSets: Int
    let avgExercisesPerMuscle: Double
}

struct MuscleGroupStats: Codable, Identifiable {
    var id: String { muscleGroup }
    let muscleGroup: String
    let exerciseCount: Double
    let totalSets: Int
    let percentage: Int
}

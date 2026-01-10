import Foundation
import SwiftData

struct WorkoutGenerationInput {
    let gender: String
    let age: Int
    let weightKg: Double
    let heightCm: Int
    let trainingLevel: String
    let mainGoal: String
    let motivationType: String?
    let specificSport: String?
    let distribution: GoalDistribution
    let sessionsPerWeek: Int
    let sessionLengthMinutes: Int
    let availableEquipment: [String]
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
class WorkoutGenerationService {
    private let modelContext: ModelContext
    
    init(modelContext: ModelContext) {
        self.modelContext = modelContext
    }
    
    func getUserWorkoutData(userId: String) -> WorkoutGenerationInput? {
        // Fetch user profile
        let profileDescriptor = FetchDescriptor<UserProfile>(
            predicate: #Predicate { $0.userId == userId }
        )
        
        guard let profile = try? modelContext.fetch(profileDescriptor).first else {
            return nil
        }
        
        // Map sex to gender format
        let genderMap: [String: String] = [
            "man": "Man",
            "kvinna": "Kvinna",
            "male": "Man",
            "female": "Kvinna",
            "icke-binär": "Icke-binär",
            "annat": "Annat"
        ]
        let gender = genderMap[profile.sex?.lowercased() ?? ""] ?? "Annat"
        
        // Map motivation type to main goal
        let goalMap: [String: String] = [
            "fitness": "Generell fitness",
            "viktminskning": "Viktminskning och hälsa",
            "rehabilitering": "Rehabilitering",
            "hälsa_livsstil": "Hälsa och livsstil",
            "hypertrofi": "Muskelökning och hypertrofi",
            "sport": "Sportprestation",
            "hälsa": "Generell fitness",
            "styrka": "Muskelökning",
            "estetik": "Muskelökning"
        ]
        let motivationType = profile.motivationType ?? profile.trainingGoals ?? "fitness"
        let mainGoal = goalMap[motivationType.lowercased()] ?? "Generell fitness"
        
        // Map training level
        let levelMap: [String: String] = [
            "nybörjare": "Nybörjare",
            "van": "Van",
            "mycket_van": "Mycket van",
            "elit": "Elit",
            "mellannivå": "Van",
            "avancerad": "Mycket van"
        ]
        let trainingLevel = levelMap[profile.trainingLevel?.lowercased() ?? ""] ?? "Van"
        
        return WorkoutGenerationInput(
            gender: gender,
            age: profile.age ?? 30,
            weightKg: Double(profile.bodyWeight ?? 75),
            heightCm: profile.height ?? 175,
            trainingLevel: trainingLevel,
            mainGoal: mainGoal,
            motivationType: motivationType,
            specificSport: profile.specificSport,
            distribution: WorkoutGenerationInput.GoalDistribution(
                strengthPercent: profile.goalStrength,
                hypertrophyPercent: profile.goalVolume,
                endurancePercent: profile.goalEndurance,
                cardioPercent: profile.goalCardio
            ),
            sessionsPerWeek: profile.sessionsPerWeek,
            sessionLengthMinutes: profile.sessionDuration,
            availableEquipment: ["Dumbbells", "Barbell", "Bench", "Pull-up Bar"], // Mock data
            oneRMValues: WorkoutGenerationInput.OneRMValues(
                bench: profile.oneRmBench.map { Double($0) },
                ohp: profile.oneRmOhp.map { Double($0) },
                deadlift: profile.oneRmDeadlift.map { Double($0) },
                squat: profile.oneRmSquat.map { Double($0) },
                latpull: profile.oneRmLatpull.map { Double($0) }
            )
        )
    }
    
    func generateProgram(for input: WorkoutGenerationInput) async throws -> WorkoutProgram {
        // HYBRID APPROACH: Try Apple Intelligence first (on-device), then fall back to server-side
        
        // Step 1: Try Apple Intelligence if available (iOS 18+)
        if #available(iOS 18.0, *) {
            let appleIntelligence = AppleIntelligenceService.shared
            if appleIntelligence.isAvailable() {
                do {
                    print("[WorkoutGeneration] 🧠 Attempting Apple Intelligence generation...")
                    let program = try await appleIntelligence.generateWorkoutProgram(for: input)
                    
                    // Save program templates to SwiftData
                    try await saveProgramTemplates(from: program, userId: "current-user")
                    
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
        print("[WorkoutGeneration] 🌐 Using server-side generation...")
        do {
            let response = try await APIService.shared.generateWorkoutProgram(force: false)
            let program = response.program
            
            // Save program templates to SwiftData
            try await saveProgramTemplates(from: program, userId: "current-user")
            
            print("[WorkoutGeneration] ✅ Successfully generated program using server-side API")
            return program
        } catch {
            // Final fallback to mock if API fails (for development/testing)
            print("[WorkoutGeneration] ⚠️ Server-side generation failed, using mock: \(error)")
            let mockProgram = createMockProgram(for: input)
            
            // Save program templates to SwiftData
            try await saveProgramTemplates(from: mockProgram, userId: "current-user")
            
            return mockProgram
        }
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
                        notes: "Förbered kroppen för träning"
                    )
                ],
                mainWork: createMainExercises(for: sessionNumber, input: input),
                cooldown: [
                    WorkoutProgram.WeeklySession.CooldownExercise(
                        exerciseName: "Static Stretching",
                        durationOrReps: "5 min",
                        notes: "Stretcha tränade muskelgrupper"
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
                weekFocusSummary: "Balanserat helkroppsprogram med fokus på grundläggande rörelser",
                expectedDifficulty: "Medel",
                notesOnProgression: "Öka vikten gradvis varje vecka"
            ),
            weeklySessions: sessions,
            recoveryTips: [
                "Sov 7-9 timmar per natt för optimal återhämtning",
                "Ät protein inom 2 timmar efter träning",
                "Vila minst en dag mellan intensiva pass"
            ]
        )
    }
    
    private func getWeekday(for sessionNumber: Int, totalSessions: Int) -> String {
        let weekdays = ["Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag", "Söndag"]
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
                    suggestedWeightNotes: "Börja konservativt",
                    targetMuscles: ["Chest", "Shoulders", "Triceps"],
                    requiredEquipment: ["Barbell", "Bench"],
                    techniqueCues: ["Håll skulderbladen ihop", "Kontrollerad rörelse"]
                ),
                WorkoutProgram.WeeklySession.MainExercise(
                    exerciseName: "Overhead Press",
                    sets: 3,
                    reps: "8-10",
                    restSeconds: 90,
                    tempo: "2-1-2-1",
                    suggestedWeightKg: calculateStartingWeight(exercise: "ohp", input: input),
                    suggestedWeightNotes: "Fokus på teknik",
                    targetMuscles: ["Shoulders", "Triceps", "Core"],
                    requiredEquipment: ["Barbell"],
                    techniqueCues: ["Spänn core", "Press rakt upp"]
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
                    techniqueCues: ["Knäna följer tårna", "Håll ryggen rak"]
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
                    suggestedWeightNotes: "Känn i ryggen",
                    targetMuscles: ["Lats", "Rhomboids", "Biceps"],
                    requiredEquipment: ["Barbell"],
                    techniqueCues: ["Dra till magen", "Spänn skulderbladen"]
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
    
    private func saveProgramTemplates(from program: WorkoutProgram, userId: String) async throws {
        // Clear existing templates
        let existingTemplates = try modelContext.fetch(FetchDescriptor<ProgramTemplate>())
        for template in existingTemplates {
            modelContext.delete(template)
        }
        
        // Create new templates from generated program
        for session in program.weeklySessions {
            let template = ProgramTemplate(
                userId: userId,
                templateName: session.sessionName,
                muscleFocus: session.muscleFocus,
                dayOfWeek: getDayOfWeek(from: session.weekday),
                estimatedDurationMinutes: session.estimatedDurationMinutes
            )
            
            // Add exercises to template
            for (exerciseIndex, exercise) in session.mainWork.enumerated() {
                let templateExercise = ProgramTemplateExercise(
                    templateId: template.id,
                    exerciseKey: exercise.exerciseName.lowercased().replacingOccurrences(of: " ", with: "-"),
                    exerciseName: exercise.exerciseName,
                    orderIndex: exerciseIndex,
                    targetSets: exercise.sets,
                    targetReps: exercise.reps,
                    targetWeight: exercise.suggestedWeightKg,
                    requiredEquipment: exercise.requiredEquipment,
                    muscles: exercise.targetMuscles
                )
                if template.exercises == nil {
                    template.exercises = []
                }
                template.exercises?.append(templateExercise)
            }
            
            modelContext.insert(template)
        }
        
        try modelContext.save()
    }
    
    private func getDayOfWeek(from weekday: String) -> Int {
        let weekdays = ["Måndag": 1, "Tisdag": 2, "Onsdag": 3, "Torsdag": 4, "Fredag": 5, "Lördag": 6, "Söndag": 7]
        return weekdays[weekday] ?? 1
    }
}

import Foundation

// MARK: - Safe "unknown" enums

enum BlockType: Equatable, Hashable {
    case warmup, main, accessory, cardio, cooldown
    case unknown(String)

    init(raw: String) {
        switch raw.lowercased() {
        case "warmup": self = .warmup
        case "main": self = .main
        case "accessory": self = .accessory
        case "cardio": self = .cardio
        case "cooldown": self = .cooldown
        default: self = .unknown(raw)
        }
    }

    var rawValue: String {
        switch self {
        case .warmup: return "warmup"
        case .main: return "main"
        case .accessory: return "accessory"
        case .cardio: return "cardio"
        case .cooldown: return "cooldown"
        case .unknown(let s): return s
        }
    }
}

enum V4LoadType: Equatable, Hashable, Codable {
    case percentage1RM, rpe, bodyweight, fixed
    case unknown(String)

    init(raw: String) {
        switch raw.lowercased() {
        case "percentage_1rm", "percentage1rm", "percentage": self = .percentage1RM
        case "rpe": self = .rpe
        case "bodyweight": self = .bodyweight
        case "fixed", "fixed_weight": self = .fixed
        default: self = .unknown(raw)
        }
    }

    var rawValue: String {
        switch self {
        case .percentage1RM: return "percentage_1rm"
        case .rpe: return "rpe"
        case .bodyweight: return "bodyweight"
        case .fixed: return "fixed"
        case .unknown(let s): return s
        }
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let rawString = try container.decode(String.self)
        self.init(raw: rawString)
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(rawValue)
    }
}

// MARK: - V4 Response

struct V4ProgramResponse: Decodable {
    let program: V4Program
}

struct V4Program: Decodable {
    let programName: String?
    let durationWeeks: Int?
    let sessionsPerWeek: Int?
    let targetMinutes: Int?
    let sessions: [V4Session]

    enum CodingKeys: String, CodingKey {
        case programName = "program_name"
        case durationWeeks = "duration_weeks"
        case sessionsPerWeek = "sessions_per_week"
        case targetMinutes = "target_minutes"
        case sessions
    }
}

struct V4Session: Decodable, Identifiable {
    var id: String { "\(sessionIndex)-\(weekday)" }

    let sessionIndex: Int
    let weekday: String
    let name: String?
    let estimatedMinutes: Int?
    let blocks: [V4Block]

    enum CodingKeys: String, CodingKey {
        case sessionIndex = "session_index"
        case weekday
        case name
        case estimatedMinutes = "estimated_minutes"
        case blocks
    }
}

struct V4Block: Decodable, Identifiable {
    var id: String { "\(type.rawValue)-\(exercises.count)" }

    let type: BlockType
    let exercises: [V4Exercise]

    enum CodingKeys: String, CodingKey {
        case type
        case exercises
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let typeRaw = (try? c.decode(String.self, forKey: .type)) ?? "unknown"
        self.type = BlockType(raw: typeRaw)
        self.exercises = (try? c.decode([V4Exercise].self, forKey: .exercises)) ?? []
    }
}

struct V4Exercise: Decodable, Identifiable, Hashable {
    var id: String { "\(exerciseID)-\(sets)-\(reps)-\(blockHint ?? "")" }

    let exerciseID: String
    let exerciseName: String?
    let sets: Int
    let reps: String
    let restSeconds: Int?
    let loadType: V4LoadType
    let loadValue: Double
    let priority: Int?
    let notes: String?
    let blockHint: String?

    enum CodingKeys: String, CodingKey {
        case exerciseID = "exercise_id"
        case exerciseName = "exercise_name"
        case sets
        case reps
        case restSeconds = "rest_seconds"
        case loadType = "load_type"
        case loadValue = "load_value"
        case priority
        case notes
        case blockHint = "block_hint"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)

        self.exerciseID = (try? c.decode(String.self, forKey: .exerciseID)) ?? "unknown_exercise"
        self.exerciseName = try? c.decode(String.self, forKey: .exerciseName)
        self.sets = (try? c.decode(Int.self, forKey: .sets)) ?? 0
        self.reps = (try? c.decode(String.self, forKey: .reps)) ?? ""
        self.restSeconds = try? c.decode(Int.self, forKey: .restSeconds)

        let ltRaw = (try? c.decode(String.self, forKey: .loadType)) ?? "unknown"
        self.loadType = V4LoadType(raw: ltRaw)

        self.loadValue = (try? c.decode(Double.self, forKey: .loadValue)) ?? 0
        self.priority = try? c.decode(Int.self, forKey: .priority)
        self.notes = try? c.decode(String.self, forKey: .notes)
        self.blockHint = try? c.decode(String.self, forKey: .blockHint)
    }
}

struct UserTimeModel: Codable, Equatable {
    var workSecondsPer10Reps: Int
    var restBetweenSetsSeconds: Int
    var restBetweenExercisesSeconds: Int
    var warmupMinutesDefault: Int
    var cooldownMinutesDefault: Int

    static let `default` = UserTimeModel(
        workSecondsPer10Reps: 30,
        restBetweenSetsSeconds: 90,
        restBetweenExercisesSeconds: 120,
        warmupMinutesDefault: 8,
        cooldownMinutesDefault: 5
    )

    enum CodingKeys: String, CodingKey {
        case workSecondsPer10Reps = "work_seconds_per_10_reps"
        case restBetweenSetsSeconds = "rest_between_sets_seconds"
        case restBetweenExercisesSeconds = "rest_between_exercises_seconds"
        case warmupMinutesDefault = "warmup_minutes_default"
        case cooldownMinutesDefault = "cooldown_minutes_default"
    }
}

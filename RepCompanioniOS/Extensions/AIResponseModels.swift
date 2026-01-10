//
//  AIResponseModels.swift
//  RepCompanioniOS
//
//  Models for AI V3 two-step process responses
//

import Foundation

// MARK: - Step 1: Analysis Response

struct TrainingAnalysisResponse: Codable {
    let analysisSummary: String
    let focusDistribution: FocusDistribution
    let estimated1RM: Estimated1RM
    
    enum CodingKeys: String, CodingKey {
        case analysisSummary = "analysis_summary"
        case focusDistribution = "focus_distribution"
        case estimated1RM = "estimated_1rm_kg"
    }
}

struct FocusDistribution: Codable {
    let strength: Int
    let hypertrophy: Int // Volym
    let endurance: Int   // Uthållighet
    let cardio: Int      // Kondition
    
    enum CodingKeys: String, CodingKey {
        case strength = "styrka"
        case hypertrophy = "volym"
        case endurance = "uthallighet"
        case cardio = "kondition"
    }
}

struct Estimated1RM: Codable {
    var benchPress: Double
    var overheadPress: Double
    var deadlift: Double
    var squat: Double
    var latPulldown: Double
    
    enum CodingKeys: String, CodingKey {
        case benchPress = "bench_press"
        case overheadPress = "overhead_press"
        case deadlift = "deadlift"
        case squat = "squat"
        case latPulldown = "lat_pulldown"
    }
}

// MARK: - Step 2: Program Response

struct WorkoutProgramResponseV3: Codable {
    let programName: String
    let sportSpecificNote: String?
    let schedule: [WorkoutDay]
    
    enum CodingKeys: String, CodingKey {
        case programName = "program_name"
        case sportSpecificNote = "sport_specific_note"
        case schedule
    }
}

struct WorkoutDay: Codable, Identifiable {
    var id: Int { dayNumber }
    
    let dayNumber: Int
    let dayName: String
    let focusArea: String?
    let durationMinutes: Int
    let exercises: [WorkoutExercise]
    
    enum CodingKeys: String, CodingKey {
        case dayNumber = "day_id"
        case dayName = "day_name"
        case focusArea = "focus_area"
        case durationMinutes = "duration_minutes"
        case exercises
    }
}

struct WorkoutExercise: Codable, Identifiable {
    var id: Int { order }
    
    let order: Int
    let name: String
    let exerciseId: String?
    let sets: Int
    let reps: String
    let restSeconds: Int
    let loadType: LoadType
    let loadValue: Double?
    let calculatedWeight: Double?
    let notes: String?
    
    enum CodingKeys: String, CodingKey {
        case order
        case name = "exercise_name"
        case exerciseId = "exercise_id"
        case sets
        case reps
        case restSeconds = "rest_seconds"
        case loadType = "load_type"
        case loadValue = "load_value"
        case calculatedWeight = "calculated_weight_kg"
        case notes
    }
}

enum LoadType: String, Codable {
    case percentage1RM = "percentage_1rm"
    case rpe = "rpe"
    case bodyweight = "bodyweight"
    case fixedWeight = "fixed_weight"
}


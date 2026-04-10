import SwiftData
import Foundation

@MainActor
class PersistenceController {
    static let shared = PersistenceController()

    let container: ModelContainer

    init() {
               let schema = Schema([
                   // Core workout models
                   WorkoutSession.self,
                   ExerciseLog.self,
                   Exercise.self,
                   WorkoutSet.self,

                   // Program and template models
                   ProgramTemplate.self,
                   ProgramTemplateExercise.self,

                   // User and stats models
                   UserProfile.self,
                   ExerciseStats.self,
                   
                   // Exercise and equipment catalog
                   ExerciseCatalog.self,
                   EquipmentCatalog.self,
                   Gym.self,
                   UserEquipment.self,
                   
                   // Training tips
                   TrainingTip.self,
                   ProfileTrainingTip.self,
                   
                   // Additional models
                   GymProgram.self,
                   UnmappedExercise.self,
                   HealthMetric.self,
               ])
        

        // Get the default URL for Application Support directory
        let url = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        let storeURL = url.appendingPathComponent("default.store")
        
        // Ensure Application Support directory exists
        do {
            try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true, attributes: nil)
            #if DEBUG
            print("✅ Application Support directory created/verified: \(url.path)")
            #endif
        } catch {
            #if DEBUG
            print("⚠️ Could not create Application Support directory: \(error)")
            #endif
        }
        
        // Update model configuration to use explicit URL
        // IMPORTANT: CloudKit integration disabled because it requires all relationships to be optional
        // If you want to enable CloudKit sync, you need to:
        // 1. Make all @Relationship properties optional in all models
        // 2. Add cloudKitContainerIdentifier parameter below
        let modelConfigurationWithURL = ModelConfiguration(
            schema: schema,
            url: storeURL,
            allowsSave: true
            // cloudKitContainerIdentifier: nil  // Explicitly disabled for now
        )
        
        // Create container - use var to allow assignment in different code paths
        var createdContainer: ModelContainer
        do {
            createdContainer = try ModelContainer(for: schema, configurations: [modelConfigurationWithURL])
            
            // After container is created, set default values for existing UserProfiles
            // that might be missing restTimeBetweenSets or restTimeBetweenExercises
            Task { @MainActor in
                // Model migration logic: ensuring defaults are set for new properties
                // but since they are non-optional with defaults in the model now,
                // we don't need the explicit nil checks.
            }
            
            // Don't create default profile - let onboarding handle it
        } catch {
            #if DEBUG
            print("⚠️ ModelContainer creation failed: \(error.localizedDescription)")
            print("🔄 Attempting automatic recovery by deleting old store files...")
            #endif
            
            let fileManager = FileManager.default
            let storeFiles = [
                storeURL.path,
                storeURL.path + "-wal",
                storeURL.path + "-shm"
            ]
            
            var deletedFiles = false
            for filePath in storeFiles {
                if fileManager.fileExists(atPath: filePath) {
                    do {
                        try fileManager.removeItem(atPath: filePath)
                        #if DEBUG
                        print("✅ Deleted: \(filePath)")
                        #endif
                        deletedFiles = true
                    } catch {
                        #if DEBUG
                        print("⚠️ Could not delete \(filePath): \(error.localizedDescription)")
                        #endif
                    }
                }
            }
            
            if deletedFiles {
                #if DEBUG
                print("🔄 Retrying ModelContainer creation with fresh store...")
                #endif
                do {
                    createdContainer = try ModelContainer(for: schema, configurations: [modelConfigurationWithURL])
                    #if DEBUG
                    print("✅ Successfully created ModelContainer after automatic recovery")
                    #endif
                    
                    // Set default values after recovery
                    Task { @MainActor in
                        // Model migration logic: ensuring defaults are set
                    }
                } catch {
                    let recoveryError = error
                    let errorMessage = """
                    ❌ Automatic recovery failed: \(recoveryError.localizedDescription)
                    
                    Manual steps required:
                    
                    1. Reset the iOS Simulator:
                       - In Xcode: Device > Erase All Content and Settings...
                       - OR in Terminal: xcrun simctl erase all
                    
                    2. Or delete the app from simulator and reinstall
                    
                    3. Or manually delete the database file:
                       \(storeURL.path)
                    """
                    #if DEBUG
                    print(errorMessage)
                    #endif
                    fatalError("Could not create ModelContainer even after recovery attempt: \(recoveryError)")
                }
            } else {
                // Fallback to in-memory only if persistent storage fails and we couldn't delete files
                #if DEBUG
                print("⚠️ Could not delete old store files, falling back to in-memory storage")
                #endif
                let fallbackConfig = ModelConfiguration(schema: schema, isStoredInMemoryOnly: true)
                do {
                    createdContainer = try ModelContainer(for: schema, configurations: [fallbackConfig])
                    #if DEBUG
                    print("⚠️ Using in-memory storage as fallback (data will be lost on app restart)")
                    #endif
                } catch {
                    let errorMessage = """
                    ❌ ModelContainer creation failed and could not delete old store files.
                    
                    Manual steps required:
                    
                    1. Reset the iOS Simulator:
                       - In Xcode: Device > Erase All Content and Settings...
                       - OR in Terminal: xcrun simctl erase all
                    
                    2. Or delete the app from simulator and reinstall
                    
                    3. Or manually delete the database file:
                       \(storeURL.path)
                    """
                    #if DEBUG
                    print(errorMessage)
                    #endif
                    fatalError("Could not create ModelContainer even with fallback: \(error)")
                }
            }
        }
        
        // Assign once to the let constant
        self.container = createdContainer
    }
    
    // Preview helper
    static var preview: PersistenceController = {
        let result = PersistenceController()
        let viewContext = result.container.mainContext
        
        // Add sample user profile
        let profile = UserProfile(
            userId: "preview-user",
            age: 30,
            sex: "man",
            bodyWeight: 75,
            height: 180,
            trainingLevel: "van",
            onboardingCompleted: true
        )
        viewContext.insert(profile)
        
        // Add sample workout session
        let session = WorkoutSession(
            userId: "preview-user",
            sessionType: "strength",
            sessionName: "Upper Body Push",
            status: "completed",
            completedAt: Date()
        )
        viewContext.insert(session)
        
        // Add sample exercise logs
        let log1 = ExerciseLog(
            workoutSessionId: session.id,
            exerciseKey: "bench-press",
            exerciseTitle: "Bench Press",
            exerciseOrderIndex: 0,
            setNumber: 1,
            weight: 60,
            reps: 10,
            completed: true
        )
        viewContext.insert(log1)
        
        return result
    }()
}

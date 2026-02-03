import SwiftUI
import SwiftData

/// View for displaying program template details with all exercises
struct ProgramTemplateDetailView: View {
    let template: ProgramTemplate
    let onEdit: (() -> Void)?
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.modelContext) private var modelContext
    
    init(template: ProgramTemplate, onEdit: (() -> Void)? = nil) {
        self.template = template
        self.onEdit = onEdit
    }
    
    @State private var activeSession: WorkoutSession?
    @State private var showActiveWorkout = false
    @State private var showStartConfirmation = false
    
    // Query to fetch exercises for this template
    private var exercises: [ProgramTemplateExercise] {
        template.exercises.sorted { $0.orderIndex < $1.orderIndex }
    }
    
    private func startWorkout() {
        let calendar = Calendar.current
        let today = Date()
        let weekday = calendar.component(.weekday, from: today)
        let dayOfWeek: Int
        if weekday == 1 { // Sunday
            dayOfWeek = 7
        } else {
            dayOfWeek = weekday - 1
        }
        
        // Only show confirmation if starting a workout for a DIFFERENT day than today
        if template.dayOfWeek == dayOfWeek {
            confirmStartWorkout()
        } else {
            showStartConfirmation = true
        }
    }
    
    private func confirmStartWorkout() {
        let session = WorkoutSession(
            userId: template.userId,
            templateId: template.id,
            sessionType: "strength",
            sessionName: template.templateName,
            status: "active"
        )
        
        modelContext.insert(session)
        try? modelContext.save()
        
        activeSession = session
        showActiveWorkout = true
    }
    
    var body: some View {
        NavigationView {
            ZStack(alignment: .bottom) {
                Color.appBackground(for: colorScheme).ignoresSafeArea()
                
                ScrollView {
                    VStack(alignment: .leading, spacing: 24) {
                        // Header Info
                        VStack(alignment: .leading, spacing: 12) {
                            Text(template.templateName)
                                .font(.title2)
                                .fontWeight(.bold)
                                .foregroundStyle(Color.textPrimary(for: colorScheme))
                            
                            if let muscleFocus = template.muscleFocus {
                                Text(muscleFocus)
                                    .font(.subheadline)
                                    .foregroundStyle(Color.textSecondary(for: colorScheme))
                            }
                            
                            HStack(spacing: 16) {
                                if let dayOfWeek = template.dayOfWeek {
                                    Label(getDayName(dayOfWeek), systemImage: "calendar")
                                        .font(.caption)
                                        .foregroundStyle(Color.textSecondary(for: colorScheme))
                                }
                                
                                if let duration = template.estimatedDurationMinutes {
                                    Label("\(duration) min", systemImage: "clock")
                                        .font(.caption)
                                        .foregroundStyle(Color.textSecondary(for: colorScheme))
                                }
                                
                                Label("\(exercises.count) exercises", systemImage: "dumbbell.fill")
                                    .font(.caption)
                                    .foregroundStyle(Color.textSecondary(for: colorScheme))
                            }
                        }
                        .padding()
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.cardBackground(for: colorScheme))
                        .cornerRadius(12)
                        
                        // Warm-up Section (New)
                        if let warmup = template.warmupDescription, !warmup.isEmpty {
                            VStack(alignment: .leading, spacing: 12) {
                                Label(String(localized: "Warm-up"), systemImage: "flame.fill")
                                    .font(.headline)
                                    .foregroundStyle(Color.orange)
                                
                                Text(warmup)
                                    .font(.subheadline)
                                    .foregroundStyle(Color.textPrimary(for: colorScheme))
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                            .padding()
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Color.cardBackground(for: colorScheme))
                            .cornerRadius(12)
                        }
                        
                        // Exercises List
                        VStack(alignment: .leading, spacing: 16) {
                            Text(String(localized: "Exercises"))
                                .font(.headline)
                                .foregroundStyle(Color.textPrimary(for: colorScheme))
                            
                            if exercises.isEmpty {
                                VStack(spacing: 12) {
                                    Image(systemName: "dumbbell.fill")
                                        .font(.system(size: 40))
                                        .foregroundStyle(Color.textSecondary(for: colorScheme))
                                    Text(String(localized: "No exercises"))
                                        .font(.subheadline)
                                        .foregroundStyle(Color.textSecondary(for: colorScheme))
                                    Text(String(localized: "This session has no exercises yet"))
                                        .font(.caption)
                                        .foregroundStyle(Color.textSecondary(for: colorScheme).opacity(0.7))
                                }
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 40)
                            } else {
                                ForEach(Array(exercises.enumerated()), id: \.element.id) { index, exercise in
                                    ProgramExerciseRow(
                                        exercise: exercise,
                                        number: index + 1,
                                        colorScheme: colorScheme
                                    )
                                }
                            }
                        }
                        .padding()
                        .background(Color.cardBackground(for: colorScheme))
                        .cornerRadius(12)
                        
                        Spacer(minLength: 100)
                    }
                    .padding()
                }
                
                // Floating Action Button
                if !exercises.isEmpty {
                    Button(action: startWorkout) {
                        Text(String(localized: "Start session"))
                            .font(.headline)
                            .fontWeight(.bold)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color(hex: "6395B8"))
                            .foregroundColor(.white)
                            .cornerRadius(12)
                    }
                    .padding(.horizontal)
                    .padding(.bottom, 20)
                }
            }
            .navigationTitle(String(localized: "Session details"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button(String(localized: "Close")) {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(String(localized: "Edit")) {
                        onEdit?()
                    }
                }
            }
            .sheet(isPresented: $showActiveWorkout) {
                if let session = activeSession {
                    ActiveWorkoutView(session: session, template: template)
                }
            }
            .alert("Start session", isPresented: $showStartConfirmation) {
                Button("Yes, let's go!") {
                    confirmStartWorkout()
                }
                Button("Avbryt", role: .cancel) {}
            } message: {
                Text("Vill du starta \(getDayName(template.dayOfWeek ?? 0))s pass idag?")
            }
        }
    }
    
    private func getDayName(_ dayOfWeek: Int) -> String {
        let days = [
            "",
            String(localized: "Monday"),
            String(localized: "Tuesday"),
            String(localized: "Wednesday"),
            String(localized: "Thursday"),
            String(localized: "Friday"),
            String(localized: "Saturday"),
            String(localized: "Sunday")
        ]
        return days[safe: dayOfWeek] ?? ""
    }
}

struct ProgramExerciseRow: View {
    let exercise: ProgramTemplateExercise
    let number: Int
    let colorScheme: ColorScheme
    
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            // Exercise number
            Text("\(number)")
                .font(.headline)
                .fontWeight(.bold)
                .foregroundStyle(Color.accentBlue)
                .frame(width: 30, height: 30)
                .background(Color.accentBlue.opacity(0.1))
                .clipShape(Circle())
            
            // Video Thumbnail (New)
            VideoThumbnailView(exerciseId: exercise.exerciseKey)
                .frame(width: 60, height: 60)
                .cornerRadius(8)
            
            VStack(alignment: .leading, spacing: 6) {
                Text(exercise.exerciseName)
                    .font(.headline)
                    .foregroundStyle(Color.textPrimary(for: colorScheme))
                    .fixedSize(horizontal: false, vertical: true) // Allow multiline
                
                HStack(spacing: 12) {
                    Label("\(exercise.targetSets) set", systemImage: "repeat")
                        .font(.caption)
                        .foregroundStyle(Color.textSecondary(for: colorScheme))
                    
                    Label(exercise.targetReps, systemImage: "number")
                        .font(.caption)
                        .foregroundStyle(Color.textSecondary(for: colorScheme))
                    
                    if let weight = exercise.targetWeight {
                        Label("\(Int(weight)) kg", systemImage: "scalemass.fill")
                            .font(.caption)
                            .foregroundStyle(Color.textSecondary(for: colorScheme))
                    }
                }
                
                if !exercise.requiredEquipment.isEmpty {
                    HStack(spacing: 2) {
                        Text("Utrustning:")
                            .font(.caption)
                            .fontWeight(.medium)
                        
                        ForEach(exercise.requiredEquipment.indices, id: \.self) { index in
                            let equipmentId = exercise.requiredEquipment[index]
                            Text(LocalizedStringKey(equipmentId))
                                .font(.caption)
                            
                            if index < exercise.requiredEquipment.count - 1 {
                                Text(",")
                                    .font(.caption)
                            }
                        }
                    }
                    .foregroundStyle(Color.textSecondary(for: colorScheme).opacity(0.8))
                }
            }
            
            Spacer()
            
            // Video Icon (New)
            VideoIndicatorView(exerciseId: exercise.exerciseKey)
        }
        .padding()
        .background(Color.appBackground(for: colorScheme))
        .cornerRadius(8)
    }
}

// Indicator icon for exercises with videos
struct VideoIndicatorView: View {
    let exerciseId: String
    @Query private var exercises: [ExerciseCatalog]
    @Environment(\.openURL) private var openURL
    
    init(exerciseId: String) {
        self.exerciseId = exerciseId
        let id = exerciseId
        _exercises = Query(filter: #Predicate<ExerciseCatalog> { $0.id == id })
    }
    
    var body: some View {
        if let exercise = exercises.first, let urlString = exercise.youtubeUrl, let url = URL(string: urlString) {
            Button {
                openURL(url)
            } label: {
                Image(systemName: "play.circle.fill")
                    .font(.title3)
                    .foregroundStyle(Color.accentBlue)
                    .padding(8)
                    .background(Color.accentBlue.opacity(0.1))
                    .clipShape(Circle())
            }
        }
    }
}

// Helper View for Video Thumbnail
struct VideoThumbnailView: View {
    let exerciseId: String
    @Query private var exercises: [ExerciseCatalog]
    
    init(exerciseId: String) {
        self.exerciseId = exerciseId
        let id = exerciseId
        _exercises = Query(filter: #Predicate<ExerciseCatalog> { $0.id == id })
    }
    
    var body: some View {
        Group {
            if let exercise = exercises.first,
               let youtubeUrl = exercise.youtubeUrl {
                
                if let videoId = extractYouTubeId(from: youtubeUrl) {
                    AsyncImage(url: URL(string: "https://img.youtube.com/vi/\(videoId)/mqdefault.jpg")) { phase in
                        switch phase {
                        case .empty:
                            ProgressView()
                        case .success(let image):
                            ZStack {
                                image
                                    .resizable()
                                    .aspectRatio(contentMode: .fill)
                                
                                // Play overlay for clarity
                                Image(systemName: "play.fill")
                                    .foregroundStyle(.white)
                                    .shadow(radius: 4)
                            }
                        case .failure:
                            FallbackThumbnailView(isSearch: false)
                        @unknown default:
                            EmptyView()
                        }
                    }
                    .onTapGesture {
                        if let url = URL(string: youtubeUrl) {
                            UIApplication.shared.open(url)
                        }
                    }
                } else {
                    // It's a URL but not a direct video (likely a search URL)
                    FallbackThumbnailView(isSearch: youtubeUrl.contains("search_query"))
                        .onTapGesture {
                            if let url = URL(string: youtubeUrl) {
                                UIApplication.shared.open(url)
                            }
                        }
                }
            } else {
                // Fallback icon if no video
                FallbackThumbnailView(isSearch: false)
            }
        }
    }
    
    private func extractYouTubeId(from url: String) -> String? {
        // Regex for standard YouTube URLs and short URLs
        let pattern = #"(?<=v=|v\/|vi\/|youtu\.be\/)[a-zA-Z0-9_-]{11}"#
        
        guard let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive),
              let range = regex.firstMatch(in: url, options: [], range: NSRange(location: 0, length: url.utf16.count))?.range,
              let rangeRange = Range(range, in: url) else {
            return nil
        }
        
        return String(url[rangeRange])
    }
}

struct FallbackThumbnailView: View {
    let isSearch: Bool
    
    var body: some View {
        ZStack {
            Color.gray.opacity(0.1)
            VStack(spacing: 4) {
                Image(systemName: isSearch ? "magnifyingglass.circle.fill" : "dumbbell.fill")
                    .font(.title2)
                    .foregroundStyle(Color.gray.opacity(0.5))
                if isSearch {
                    Text(String(localized: "Search video"))
                        .font(.system(size: 8))
                        .foregroundStyle(Color.gray.opacity(0.7))
                }
            }
        }
    }
}

extension Array {
    subscript(safe index: Int) -> Element? {
        return indices.contains(index) ? self[index] : nil
    }
}


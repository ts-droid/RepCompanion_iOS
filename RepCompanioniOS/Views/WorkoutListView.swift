import SwiftUI
import SwiftData

struct WorkoutListView: View {
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.modelContext) private var modelContext
    @StateObject private var authService = AuthService.shared
    
    @Query private var programTemplates: [ProgramTemplate]
    @Query private var userProfiles: [UserProfile]
    
    @State private var activeSession: WorkoutSession?
    @State private var showActiveWorkout = false
    @State private var selectedTemplate: ProgramTemplate?
    @State private var showTemplateDetail = false 
    @State private var editingTemplate: ProgramTemplate?
    
    // Logic for refined workout initiation
    @State private var showStartConfirmation = false
    @State private var templateToStart: ProgramTemplate?
    
    private var currentProfile: UserProfile? {
        guard let userId = authService.currentUserId else { return nil }
        return userProfiles.first { $0.userId == userId }
    }
    
    private var sortedTemplates: [ProgramTemplate] {
        let activeGymId = currentProfile?.selectedGymId
        return programTemplates
            .filter { $0.gymId == activeGymId } // Filter by gym
            .sorted { template1, template2 in
                let day1 = template1.dayOfWeek ?? 0
                let day2 = template2.dayOfWeek ?? 0
                if day1 != day2 {
                    return day1 < day2
                }
                return template1.templateName < template2.templateName
            }
    }
    
    private var currentPassNumber: Int {
        currentProfile?.currentPassNumber ?? 1
    }
    
    private func getExerciseCount(for template: ProgramTemplate) -> Int {
        template.exercises.count
    }
    
    private func getDayName(_ dayOfWeek: Int?) -> String {
        guard let dayOfWeek = dayOfWeek, dayOfWeek >= 1, dayOfWeek <= 7 else { return "" }
        let days = ["", "Mon", "Tis", "Ons", "Tors", "Fre", "Sat", "Sun"]
        return days[dayOfWeek]
    }
    
    private func getFullDayName(_ dayOfWeek: Int?) -> String {
        guard let dayOfWeek = dayOfWeek, dayOfWeek >= 1, dayOfWeek <= 7 else { return "next" }
        let days = ["", "Monday", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Saturday", "Sunday"]
        return days[dayOfWeek]
    }
    
    private func isNextTemplate(_ template: ProgramTemplate) -> Bool {
        return nextTemplate?.id == template.id
    }
    
    private var nextTemplate: ProgramTemplate? {
        guard !sortedTemplates.isEmpty else { return nil }
        
        let calendar = Calendar.current
        let today = Date()
        let weekday = calendar.component(.weekday, from: today)
        // Calendar.weekday: 1 = Sunday, 2 = Monday, ..., 7 = Saturday
        // Our dayOfWeek: 1 = Monday, 2 = Tuesday, ..., 7 = Sunday
        let dayOfWeek = (weekday == 1) ? 7 : (weekday - 1)
        
        // 1. Priority: Check if there's a template for TODAY
        if let todayTemplate = sortedTemplates.first(where: { $0.dayOfWeek == dayOfWeek }) {
            return todayTemplate
        }
        
        // 2. Priority: Find the next UPCOMING scheduled template in the current week
        // e.g. If it's Friday and you have a Saturday workout, suggest Saturday.
        let upcomingScheduled = sortedTemplates.filter { template in
            guard let day = template.dayOfWeek else { return false }
            return day > dayOfWeek
        }.sorted { ($0.dayOfWeek ?? 0) < ($1.dayOfWeek ?? 0) }.first
        
        if let upcoming = upcomingScheduled {
            return upcoming
        }
        
        // 3. Fallback: Use the sequential cycle (current pass number)
        let profilePass = currentProfile?.currentPassNumber ?? 1
        let expectedIndex = (profilePass - 1) % sortedTemplates.count
        
        if sortedTemplates.indices.contains(expectedIndex) {
            return sortedTemplates[expectedIndex]
        }
        
        return sortedTemplates.first
    }
    
    private func prepareStartWorkout() {
        guard let template = nextTemplate else { return }
        templateToStart = template
        
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
        guard let template = templateToStart else { return }
        
        let session = WorkoutSession(
            userId: currentProfile?.userId ?? "default",
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
                
                VStack(alignment: .leading) {
                    // Header
                    HStack {
                        Text("Training program")
                            .font(.title2)
                            .fontWeight(.bold)
                            .foregroundStyle(Color.textPrimary(for: colorScheme))
                        Spacer()
                        if !sortedTemplates.isEmpty {
                            Text("Pass \(currentPassNumber)/\(sortedTemplates.count)")
                                .font(.subheadline)
                                .foregroundStyle(Color.textSecondary(for: colorScheme))
                        }
                    }
                    .padding()
                    
                    ScrollView {
                        VStack(spacing: 12) {
                            if sortedTemplates.isEmpty {
                                VStack(spacing: 16) {
                                    Image(systemName: "dumbbell.fill")
                                        .font(.system(size: 50))
                                        .foregroundStyle(Color.textSecondary(for: colorScheme))
                                    Text("No training programs")
                                        .font(.headline)
                                        .foregroundStyle(Color.textPrimary(for: colorScheme))
                                    Text("Generate a training program to get started")
                                        .font(.subheadline)
                                        .foregroundStyle(Color.textSecondary(for: colorScheme))
                                        .multilineTextAlignment(.center)
                                }
                                .padding()
                                .padding(.top, 50)
                            } else {
                                ForEach(sortedTemplates, id: \.id) { template in
                                    ProgramTemplateCard(
                                        template: template,
                                        exerciseCount: getExerciseCount(for: template),
                                        isNext: isNextTemplate(template),
                                        dayName: getDayName(template.dayOfWeek),
                                        colorScheme: colorScheme,
                                        onView: {
                                            selectedTemplate = template
                                            showTemplateDetail = true
                                        }
                                    )
                                }
                            }
                        }
                        .padding(.horizontal)
                        .padding(.bottom, 100)
                    }
                    .refreshable {
                        // Pull-to-refresh: Sync templates from server
                        print("[WorkoutListView] 🔄 Pull-to-refresh triggered")
                        if let userId = authService.currentUserId {
                            do {
                                // Sync specifically for the user (SyncService might need updates to handle per-gym sync if server supports it, otherwise generic sync)
                                try await SyncService.shared.syncProgramTemplates(userId: userId, modelContext: modelContext)
                                print("[WorkoutListView] ✅ Templates synced successfully")
                            } catch {
                                print("[WorkoutListView] ❌ Error syncing templates: \(error.localizedDescription)")
                            }
                        } else {
                            print("[WorkoutListView] ⚠️ No user ID for sync")
                        }
                    }
                }
                
                // Floating Action Button
                if !sortedTemplates.isEmpty {
                    Button(action: prepareStartWorkout) {
                        Text("Start session")
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
            .navigationBarHidden(true)
            .alert("Start session", isPresented: $showStartConfirmation) {
                Button("Yes, let's go!") {
                    confirmStartWorkout()
                }
                Button("Avbryt", role: .cancel) {}
            } message: {
                if let template = templateToStart {
                    Text("Vill du starta \(getFullDayName(template.dayOfWeek))s pass idag?")
                } else {
                    Text("Do you want to start today's session?")
                }
            }
            .sheet(item: $selectedTemplate) { template in
                ProgramTemplateDetailView(
                    template: template,
                    onEdit: {
                        let templateToEdit = template // Capture for closure
                        selectedTemplate = nil // Dismiss detail
                        // Delay to allow dismissal animation
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                             editingTemplate = templateToEdit
                        }
                    }
                )
            }
            .sheet(isPresented: $showActiveWorkout) {
                if let session = activeSession,
                   let template = programTemplates.first(where: { $0.id == session.templateId }) {
                    ActiveWorkoutView(session: session, template: template)
                }
            }
            .sheet(item: $editingTemplate) { template in
                 EditProgramTemplateView(template: template)
            }
        }
    }
}

struct ProgramTemplateCard: View {
    let template: ProgramTemplate
    let exerciseCount: Int
    let isNext: Bool
    let dayName: String
    let colorScheme: ColorScheme
    let onView: () -> Void
    
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(template.templateName)
                        .font(.headline)
                        .fontWeight(.bold)
                        .foregroundStyle(Color.textPrimary(for: colorScheme))
                    
                    if isNext {
                        Text("Next")
                            .font(.caption2)
                            .fontWeight(.bold)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color(hex: "6395B8").opacity(0.3))
                            .foregroundColor(Color(hex: "6395B8"))
                            .cornerRadius(4)
                    }
                }
                
                // Show muscle focus as subtitle
                if let muscleFocus = template.muscleFocus, !muscleFocus.isEmpty {
                    Text(muscleFocus)
                        .font(.caption)
                        .foregroundStyle(Color(hex: "6395B8"))
                }
                
                HStack(spacing: 4) {
                    if !dayName.isEmpty {
                        Text(dayName)
                    }
                    if !dayName.isEmpty {
                        Text("•")
                            .foregroundStyle(Color.textSecondary(for: colorScheme))
                    }
                    Text("\(exerciseCount) exercises")
                    if let duration = template.estimatedDurationMinutes {
                        Text("•")
                            .foregroundStyle(Color.textSecondary(for: colorScheme))
                        Text("\(duration) min")
                    }
                }
                .font(.subheadline)
                .foregroundStyle(Color.textSecondary(for: colorScheme))
            }
            
            Spacer()
            
            Button("Show") {
                onView()
            }
            .font(.subheadline)
            .foregroundColor(Color.textPrimary(for: colorScheme))
        }
        .padding()
        .background(Color.cardBackground(for: colorScheme))
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(isNext ? Color(hex: "6395B8") : Color.white.opacity(0.05), lineWidth: 1)
        )
    }
}

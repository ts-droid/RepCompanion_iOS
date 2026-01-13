import SwiftUI
import SwiftData
import WatchConnectivity

struct WatchContentView: View {
    @StateObject private var healthKit = HealthKitManagerWatch.shared
    @ObservedObject private var persistence = WatchPersistenceManager.shared
    @State private var showAuthCheck = false
    @State private var navigateToWorkout = false
    @State private var showStartConfirmation = false
    
    @Query(filter: #Predicate<WorkoutSession> { $0.status == "active" })
    private var activeSessions: [WorkoutSession]
    
    @Query(sort: \ProgramTemplate.dayOfWeek)
    private var templates: [ProgramTemplate]
    
    @Environment(\.modelContext) private var modelContext
    
    // Find the next appropriate template based on day of week
    private var nextTemplate: ProgramTemplate? {
        guard !templates.isEmpty else { return nil }
        
        let calendar = Calendar.current
        let weekday = calendar.component(.weekday, from: Date())
        // Calendar.weekday: 1 = Sunday, 2 = Monday, ..., 7 = Saturday
        // Our dayOfWeek: 1 = Monday, 2 = Tuesday, ..., 7 = Sunday
        let todayDayOfWeek: Int
        if weekday == 1 { // Sunday
            todayDayOfWeek = 7
        } else {
            todayDayOfWeek = weekday - 1
        }
        
        // 1. Check if there's a template for today
        if let todayTemplate = templates.first(where: { $0.dayOfWeek == todayDayOfWeek }) {
            return todayTemplate
        }
        
        // 2. Find the next upcoming template after today
        let sortedTemplates = templates.filter { $0.dayOfWeek != nil }
            .sorted { ($0.dayOfWeek ?? 0) < ($1.dayOfWeek ?? 0) }
        
        if let upcomingTemplate = sortedTemplates.first(where: { ($0.dayOfWeek ?? 0) > todayDayOfWeek }) {
            return upcomingTemplate
        }
        
        // 3. If no template after today, return first template (next week)
        return sortedTemplates.first ?? templates.first
    }
    
    private var isNextTemplateToday: Bool {
        guard let template = nextTemplate, let dayOfWeek = template.dayOfWeek else { return true }
        let calendar = Calendar.current
        let weekday = calendar.component(.weekday, from: Date())
        let todayDayOfWeek = weekday == 1 ? 7 : weekday - 1
        return dayOfWeek == todayDayOfWeek
    }
    
    private func getDayName(_ dayOfWeek: Int?) -> String {
        guard let dayOfWeek = dayOfWeek, dayOfWeek >= 1, dayOfWeek <= 7 else { return "nästa" }
        let days = ["", "Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag", "Söndag"]
        return days[dayOfWeek]
    }
    
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 8) {
                    // Quick Action for starting a workout
                    if !activeSessions.isEmpty {
                        // Resume Active Session
                        Button(action: {
                            if healthKit.isAuthorized {
                                navigateToWorkout = true
                            } else {
                                showAuthCheck = true
                            }
                        }) {
                            HStack(spacing: 8) {
                                Image(systemName: "play.fill")
                                Text("Fortsätt pass")
                            }
                        }
                        .buttonStyle(SecondaryButtonStyle(color: .orange, textColor: .black))
                        
                        NavigationLink(destination: WatchProgramListView()) {
                            HStack(spacing: 8) {
                                Image(systemName: "clipboard.fill")
                                Text("Program")
                            }
                        }
                        .buttonStyle(SecondaryButtonStyle(color: .blue, textColor: .white))
                    } else if templates.isEmpty {
                        // No templates yet
                        VStack(spacing: 8) {
                            Text("Inga program hittades.")
                                .font(.caption2)
                                .foregroundColor(.gray)
                            
                            Button(action: {
                                persistence.requestProgramSync()
                            }) {
                                Text("Hämta från iPhone")
                            }
                            .buttonStyle(SecondaryButtonStyle(color: .blue.opacity(0.3), height: 40))
                        }
                    } else {
                        // Single "Starta pass" button (like iOS)
                        Button(action: {
                            prepareStartWorkout()
                        }) {
                            HStack(spacing: 8) {
                                Image(systemName: "play.fill")
                                Text("Starta pass")
                            }
                        }
                        .buttonStyle(PrimaryButtonStyle())
                        
                        NavigationLink(destination: WatchProgramListView()) {
                            HStack(spacing: 8) {
                                Image(systemName: "clipboard.fill")
                                Text("Program")
                            }
                        }
                        .buttonStyle(SecondaryButtonStyle(color: .blue, textColor: .white))
                    }
                    
                    // Stats Link - Full dashboard with history and PBs
                    NavigationLink(destination: WatchStatsView()) {
                        HStack(spacing: 8) {
                            Image(systemName: "chart.bar.fill")
                            Text("Statistik")
                        }
                    }
                    .buttonStyle(SubtleButtonStyle())
                    
                    #if DEBUG
                    Text("Templates: \(templates.count)")
                        .font(.system(size: 8))
                        .foregroundColor(.gray)
                    #endif
                }
                .padding(.horizontal)
                .padding(.top, 4)
            }
            .navigationTitle("RepCompanion")
            .navigationBarTitleDisplayMode(.inline)
            .onAppear {
                persistence.requestProgramSync()
            }
            .navigationDestination(isPresented: $navigateToWorkout) {
                ActiveWorkoutView()
            }
            .sheet(isPresented: $showAuthCheck) {
                HealthAuthViewWatch(onDismiss: {
                    showAuthCheck = false
                    navigateToWorkout = true
                })
            }
            .confirmationDialog(
                "Starta pass",
                isPresented: $showStartConfirmation,
                titleVisibility: .visible
            ) {
                Button("Ja, kör!") {
                    confirmStartWorkout()
                }
                Button("Avbryt", role: .cancel) {}
            } message: {
                if let template = nextTemplate {
                    Text("Vill du starta \(getDayName(template.dayOfWeek))s pass idag?")
                }
            }
        }
    }
    
    private func prepareStartWorkout() {
        guard nextTemplate != nil else { return }
        
        if isNextTemplateToday {
            // Today's workout - start directly
            confirmStartWorkout()
        } else {
            // Different day - show confirmation
            showStartConfirmation = true
        }
    }
    
    private func confirmStartWorkout() {
        guard let template = nextTemplate else { return }
        
        let newSession = WorkoutSession(
            id: UUID(),
            userId: "watch-user",
            templateId: template.id,
            sessionType: "strength",
            status: "active",
            startedAt: Date()
        )
        
        modelContext.insert(newSession)
        
        do {
            try modelContext.save()
            print("[Watch] Started session for template: \(template.templateName)")
            navigateToWorkout = true
        } catch {
            print("[Watch] Error starting session: \(error)")
        }
    }
}

// MARK: - Program List View (like iOS WorkoutListView)
struct WatchProgramListView: View {
    @Query(sort: \ProgramTemplate.dayOfWeek)
    private var templates: [ProgramTemplate]
    
    @Environment(\.modelContext) private var modelContext
    
    private func getDayShortName(_ dayOfWeek: Int?) -> String {
        guard let dayOfWeek = dayOfWeek, dayOfWeek >= 1, dayOfWeek <= 7 else { return "" }
        let days = ["", "Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"]
        return days[dayOfWeek]
    }
    
    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                ForEach(templates) { template in
                    NavigationLink(destination: WatchProgramEditView(template: template)) {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(template.templateName)
                                    .font(.headline.weight(.bold))
                                
                                HStack(spacing: 6) {
                                    if let dayOfWeek = template.dayOfWeek {
                                        Text(getDayShortName(dayOfWeek))
                                    }
                                    Text("•")
                                    Text("\(template.exercises.count) övningar")
                                }
                                .font(.footnote)
                                .foregroundColor(.secondary)
                            }
                            Spacer()
                            
                            Image(systemName: "chevron.right")
                                .font(.caption.weight(.bold))
                                .foregroundColor(.secondary)
                        }
                        .padding(.vertical, 12)
                        .padding(.horizontal, 12)
                        .cardStyle()
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal)
        }
        .navigationTitle("Program")
    }
}

#Preview {
    WatchContentView()
}

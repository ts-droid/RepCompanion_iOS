import SwiftUI
import SwiftData

struct ProfileView: View {
    @Environment(\.colorScheme) private var systemColorScheme
    @Environment(\.modelContext) private var modelContext
    @AppStorage("selectedTheme") private var selectedTheme = "Main"
    @AppStorage("colorScheme") private var colorScheme = "System"
    @StateObject private var authService = AuthService.shared
    @StateObject private var healthKitService = HealthKitService.shared
    @State private var showSettings = false
    @State private var showTrainingAdjustment = false
    @State private var showBodyLog = false

    @Query private var profiles: [UserProfile]
    @Query private var gyms: [Gym]
    @Query(sort: \BodyMeasurement.date, order: .reverse) private var allMeasurements: [BodyMeasurement]
    
    private var currentProfile: UserProfile? {
        if let userId = authService.currentUserId {
            return profiles.first(where: { $0.userId == userId })
        }
        return profiles.first
    }
    
    private var selectedGym: Gym? {
        guard let profile = currentProfile, let gymId = profile.selectedGymId else { return nil }
        return gyms.first(where: { $0.id == gymId })
    }
    
    // Get the effective color scheme (user preference or system)
    private var effectiveColorScheme: ColorScheme {
        switch colorScheme {
        case "Light": return .light
        case "Dark": return .dark
        default: return systemColorScheme
        }
    }
    
    let themes = [
        ("Main", Color(hex: "00BFA5")),
        ("Forest", Color(hex: "2E7D32")),
        ("Purple", Color(hex: "7C4DFF")),
        ("Ocean", Color(hex: "0288D1")),
        ("Sunset", Color(hex: "FF6F00")),
        ("Slate", Color(hex: "607D8B")),
        ("Crimson", Color(hex: "C62828")),
        ("Pink", Color(hex: "E91E63"))
    ]
    
    var body: some View {
        NavigationView {
            ZStack {
                Color.appBackground(for: effectiveColorScheme).ignoresSafeArea()
                
                ScrollView {
                    VStack(spacing: 24) {
                        // Profile Header
                        VStack(spacing: 16) {
                            // Settings button and profile picture in HStack
                            HStack(alignment: .center, spacing: 0) {
                                // Settings button to the left
                                Button(action: {
                                    #if DEBUG
                                    print("[ProfileView] 🔧 Settings button tapped")
                                    #endif
                                    showSettings = true
                                }) {
                                    Image(systemName: "gearshape.fill")
                                        .font(.system(size: 24))
                                        .foregroundColor(.white)
                                        .frame(width: 50, height: 50)
                                        .background(
                                            LinearGradient(
                                                gradient: Gradient(colors: [Color(hex: "06B6D4"), Color(hex: "14B8A6")]),
                                                startPoint: .topLeading,
                                                endPoint: .bottomTrailing
                                            )
                                        )
                                        .clipShape(Circle())
                                        .shadow(color: .black.opacity(0.3), radius: 5, x: 0, y: 2)
                                }
                                .buttonStyle(PlainButtonStyle())
                                
                                Spacer()
                                
                                // Profile picture centered
                                ZStack(alignment: .bottomTrailing) {
                                    Circle()
                                        .fill(Color(hex: "00BFA5"))
                                        .frame(width: 80, height: 80)
                                        .overlay(
                                            Text("👤")
                                                .font(.system(size: 40))
                                        )
                                    
                                    Circle()
                                        .fill(Color.cardBackground(for: effectiveColorScheme))
                                        .frame(width: 28, height: 28)
                                        .overlay(
                                            Image(systemName: "pencil")
                                                .font(.system(size: 12))
                                                .foregroundColor(.white)
                                        )
                                }
                                
                                Spacer()
                                
                                // Empty space to balance the layout (same width as settings button)
                                Color.clear
                                    .frame(width: 50, height: 50)
                            }
                            .padding(.horizontal, 20)
                            
                            VStack(spacing: 4) {
                                Text(authService.currentUserName ?? "–")
                                    .font(.title2)
                                    .fontWeight(.bold)
                                    .foregroundStyle(Color.textPrimary(for: effectiveColorScheme))
                                Text(authService.currentUserEmail ?? "–")
                                    .font(.subheadline)
                                    .foregroundStyle(Color.textSecondary(for: effectiveColorScheme))
                            }
                            
                            // Stats Row
                            HStack(spacing: 40) {
                                StatItem(icon: "calendar", label: String(localized: "Sessions/week"), value: "\(currentProfile?.sessionsPerWeek ?? 3)", colorScheme: effectiveColorScheme)
                                StatItem(icon: "clock", label: String(localized: "Min/session"), value: "\(currentProfile?.sessionDuration ?? 60)", colorScheme: effectiveColorScheme)
                                StatItem(icon: "flame", label: String(localized: "Age"), value: "\(currentProfile?.age ?? 0)", colorScheme: effectiveColorScheme)
                            }
                            .padding(.top, 8)
                            
                            // User Info Row
                            HStack(spacing: 40) {
                                InfoItem(label: String(localized: "Sex"), value: LocalizationService.localizeSex(currentProfile?.sex), colorScheme: effectiveColorScheme)
                                InfoItem(label: String(localized: "Level"), value: LocalizationService.localizeTrainingLevel(currentProfile?.trainingLevel), colorScheme: effectiveColorScheme)
                                InfoItem(label: String(localized: "Focus"), value: currentProfile?.derivedTrainingFocus ?? String(localized: "All-round"), colorScheme: effectiveColorScheme)
                            }
                            .padding(.top, 8)
                            
                            // Rest Time Settings
                            VStack(alignment: .leading, spacing: 12) {
                                Text(String(localized: "Rest"))
                                    .font(.caption.bold())
                                    .foregroundColor(Color.textSecondary(for: effectiveColorScheme))
                                
                                HStack(spacing: 20) {
                                    VStack(alignment: .leading) {
                                        Text(String(localized: "Between sets"))
                                            .font(.caption2)
                                            .foregroundColor(Color.textSecondary(for: effectiveColorScheme))
                                        HStack {
                                            Stepper("\(currentProfile?.restTimeBetweenSets ?? 90)s", value: Binding(
                                                get: { currentProfile?.restTimeBetweenSets ?? 90 },
                                                set: { currentProfile?.restTimeBetweenSets = $0 }
                                            ), in: 30...300, step: 15)
                                        }
                                    }
                                    
                                    VStack(alignment: .leading) {
                                        Text(String(localized: "Between exercises"))
                                            .font(.caption2)
                                            .foregroundColor(Color.textSecondary(for: effectiveColorScheme))
                                        HStack {
                                            Stepper("\(currentProfile?.restTimeBetweenExercises ?? 120)s", value: Binding(
                                                get: { currentProfile?.restTimeBetweenExercises ?? 120 },
                                                set: { currentProfile?.restTimeBetweenExercises = $0 }
                                            ), in: 30...600, step: 30)
                                        }
                                    }
                                }
                            }
                            .padding()
                            .background(Color.cardBackground(for: effectiveColorScheme).opacity(0.5))
                            .cornerRadius(12)
                        }
                        .padding()
                        .background(Color.cardBackground(for: effectiveColorScheme))
                        .cornerRadius(16)
                        .padding(.horizontal)
                        
                        // Training Goals
                        VStack(alignment: .leading, spacing: 16) {
                            HStack {
                                Image(systemName: "target")
                                    .foregroundStyle(Color.textPrimary(for: effectiveColorScheme))
                                Text(String(localized: "Training goals"))
                                    .font(.title3)
                                    .fontWeight(.bold)
                                    .foregroundStyle(Color.textPrimary(for: effectiveColorScheme))
                            }
                            .padding(.horizontal)
                            
                            VStack(spacing: 12) {
                                GoalRow(title: String(localized: "Strength"), percentage: currentProfile?.goalStrength ?? 25, colorScheme: effectiveColorScheme)
                                GoalRow(title: String(localized: "Volume"), percentage: currentProfile?.goalVolume ?? 25, colorScheme: effectiveColorScheme)
                                GoalRow(title: String(localized: "Endurance"), percentage: currentProfile?.goalEndurance ?? 25, colorScheme: effectiveColorScheme)
                                GoalRow(title: String(localized: "Cardio"), percentage: currentProfile?.goalCardio ?? 25, colorScheme: effectiveColorScheme)
                            }
                            .padding()
                            .background(Color.cardBackground(for: effectiveColorScheme))
                            .cornerRadius(16)
                            .padding(.horizontal)
                        }
                        
                        // Color Scheme Selection
                        VStack(alignment: .leading, spacing: 16) {
                            HStack {
                                Image(systemName: "circle.lefthalf.filled")
                                    .foregroundStyle(Color.textPrimary(for: effectiveColorScheme))
                                Text(String(localized: "Color scheme"))
                                    .font(.title3)
                                    .fontWeight(.bold)
                                    .foregroundStyle(Color.textPrimary(for: effectiveColorScheme))
                            }
                            .padding(.horizontal)
                            
                            HStack(spacing: 12) {
                                ColorSchemeButton(title: String(localized: "Light"), icon: "sun.max.fill", isSelected: colorScheme == "Light", colorScheme: effectiveColorScheme) {
                                    colorScheme = "Light"
                                }
                                ColorSchemeButton(title: String(localized: "Dark"), icon: "moon.fill", isSelected: colorScheme == "Dark", colorScheme: effectiveColorScheme) {
                                    colorScheme = "Dark"
                                }
                                ColorSchemeButton(title: String(localized: "System"), icon: "gear", isSelected: colorScheme == "System", colorScheme: effectiveColorScheme) {
                                    colorScheme = "System"
                                }
                            }
                            .padding(.horizontal)
                        }
                        
                        // Theme Selection
                        VStack(alignment: .leading, spacing: 16) {
                            HStack {
                                Image(systemName: "paintpalette")
                                    .foregroundStyle(Color.textPrimary(for: effectiveColorScheme))
                                Text(String(localized: "Select Theme"))
                                    .font(.title3)
                                    .fontWeight(.bold)
                                    .foregroundStyle(Color.textPrimary(for: effectiveColorScheme))
                            }
                            .padding(.horizontal)
                            
                            Text(String(localized: "Customize the app appearance with your favorite color scheme"))
                                .font(.subheadline)
                                .foregroundStyle(Color.textSecondary(for: effectiveColorScheme))
                                .padding(.horizontal)
                            
                            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 16) {
                                ForEach(themes, id: \.0) { theme in
                                    ThemeCircle(name: theme.0, color: theme.1, isSelected: selectedTheme == theme.0, colorScheme: effectiveColorScheme) {
                                        selectedTheme = theme.0
                                    }
                                }
                            }
                            .padding(.horizontal)
                        }
                        
                        // Health Integration
                        VStack(alignment: .leading, spacing: 16) {
                            HStack {
                                Image(systemName: "heart.text.square")
                                    .foregroundStyle(Color.textPrimary(for: effectiveColorScheme))
                                Text(String(localized: "Health integration"))
                                    .font(.title3)
                                    .fontWeight(.bold)
                                    .foregroundStyle(Color.textPrimary(for: effectiveColorScheme))
                            }
                            .padding(.horizontal)
                            
                            VStack(spacing: 12) {
                                Text(String(localized: "Automatically sync workout data, steps, sleep and recovery from your health platforms."))
                                    .font(.subheadline)
                                    .foregroundStyle(Color.textSecondary(for: effectiveColorScheme))
                                
                                Button(action: {
                                    Task {
                                        try? await healthKitService.requestAuthorization()
                                    }
                                }) {
                                    HStack {
                                        Image(systemName: healthKitService.isAuthorized ? "heart.fill" : "heart")
                                        Text(healthKitService.isAuthorized ? String(localized: "Health data connected") : String(localized: "Connect health data"))
                                    }
                                    .frame(maxWidth: .infinity)
                                    .padding()
                                    .background(healthKitService.isAuthorized ? Color.green : Color(hex: "6395B8"))
                                    .foregroundColor(.white)
                                    .cornerRadius(12)
                                }
                                .disabled(healthKitService.isAuthorized)
                            }
                            .padding()
                            .background(Color.cardBackground(for: effectiveColorScheme))
                            .cornerRadius(16)
                            .padding(.horizontal)
                        }
                        
                        // Body Measurements
                        BodyMeasurementSectionView(
                            userId: authService.currentUserId ?? "",
                            measurements: allMeasurements,
                            focus: currentProfile?.measurementFocus ?? .weightLoss,
                            colorScheme: effectiveColorScheme,
                            selectedTheme: selectedTheme,
                            onLogTap: { showBodyLog = true }
                        )

                        // Gym Settings
                        VStack(alignment: .leading, spacing: 16) {
                            HStack {
                                Image(systemName: "mappin.circle")
                                    .foregroundStyle(Color.textPrimary(for: effectiveColorScheme))
                                Text(String(localized: "Active Gym"))
                                    .font(.title3)
                                    .fontWeight(.bold)
                                    .foregroundStyle(Color.textPrimary(for: effectiveColorScheme))
                            }
                            .padding(.horizontal)
                            
                            if let gym = selectedGym {
                                NavigationLink(destination: EditGymView(gymToEdit: gym)) {
                                    GymRow(
                                        gym: gym,
                                        isSelected: true,
                                        colorScheme: effectiveColorScheme,
                                        selectedTheme: selectedTheme
                                    )
                                }
                                .buttonStyle(PlainButtonStyle())
                                .padding(.horizontal)
                            } else {
                                NavigationLink(destination: GymListView()) {
                                    HStack(spacing: 12) {
                                        ZStack {
                                            Circle()
                                                .fill(Color.gray.opacity(0.1))
                                                .frame(width: 40, height: 40)
                                            Image(systemName: "dumbbell.fill")
                                                .foregroundColor(.gray)
                                        }
                                        
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(String(localized: "No gym selected"))
                                                .font(.subheadline)
                                                .fontWeight(.bold)
                                                .foregroundStyle(Color.textPrimary(for: effectiveColorScheme))
                                            Text(String(localized: "Select a gym to get started"))
                                                .font(.caption2)
                                                .foregroundStyle(Color.textSecondary(for: effectiveColorScheme))
                                        }
                                        Spacer()
                                        Image(systemName: "chevron.right")
                                            .font(.caption2)
                                            .foregroundColor(.gray.opacity(0.5))
                                    }
                                    .padding()
                                    .background(
                                        RoundedRectangle(cornerRadius: 12)
                                            .fill(Color.cardBackground(for: effectiveColorScheme))
                                            .shadow(color: Color.black.opacity(0.03), radius: 2, x: 0, y: 1)
                                    )
                                }
                                .buttonStyle(PlainButtonStyle())
                                .padding(.horizontal)
                            }
                        }
                        
                        // Action Buttons
                        VStack(spacing: 12) {
                            NavigationLink(destination: GymListView()) {
                                HStack {
                                    Image(systemName: "dumbbell.fill")
                                    Text(String(localized: "My Gyms"))
                                    Spacer()
                                }
                                .padding()
                                .background(Color.cardBackground(for: effectiveColorScheme))
                                .foregroundColor(Color.textPrimary(for: effectiveColorScheme))
                                .cornerRadius(12)
                            }
                            
                            ActionButton(icon: "gearshape.fill", title: String(localized: "Adjust Training"), colorScheme: effectiveColorScheme, action: {
                                showTrainingAdjustment = true
                            })
                            ActionButton(icon: "square.and.arrow.down", title: String(localized: "Export Exercises"), colorScheme: effectiveColorScheme, action: {})
                            ActionButton(icon: "rectangle.portrait.and.arrow.right", title: String(localized: "Log Out"), isDestructive: true, colorScheme: effectiveColorScheme, action: {
                                authService.signOut()
                            })
                        }
                        .padding(.horizontal)
                        .padding(.bottom, 20)
                    }
                    .padding(.top)
                }
            }
            .navigationBarHidden(true)
            .onAppear {
                let days = BodyMeasurementService.shared.daysSinceLastLog(
                    userId: authService.currentUserId ?? "",
                    modelContext: modelContext
                )
                NotificationService.shared.scheduleWeeklyBodyReminder(daysSinceLastLog: days)
            }
            .sheet(isPresented: $showSettings) {
                SettingsView()
            }
            .sheet(isPresented: $showTrainingAdjustment) {
                TrainingAdjustmentView()
            }
            .sheet(isPresented: $showBodyLog) {
                BodyMeasurementLogView(
                    userId: authService.currentUserId ?? "",
                    focus: currentProfile?.measurementFocus ?? .weightLoss,
                    previousMeasurement: allMeasurements.first,
                    onSaved: {}
                )
            }
        }
    }
}

// MARK: - BodyMeasurementSectionView

struct BodyMeasurementSectionView: View {
    let userId: String
    let measurements: [BodyMeasurement]
    let focus: MeasurementFocus
    let colorScheme: ColorScheme
    let selectedTheme: String
    let onLogTap: () -> Void

    private var latest: BodyMeasurement? { measurements.first }

    private var daysSinceLog: Int? {
        guard let last = latest else { return nil }
        return Calendar.current.dateComponents([.day], from: last.date, to: Date()).day
    }

    private var needsReminder: Bool { (daysSinceLog ?? 999) >= 6 }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Header
            HStack {
                Image(systemName: "scalemass.fill")
                    .foregroundStyle(Color.textPrimary(for: colorScheme))
                Text(String(localized: "Vikt & Kroppsmått"))
                    .font(.title3).fontWeight(.bold)
                    .foregroundStyle(Color.textPrimary(for: colorScheme))
                Spacer()
                if needsReminder {
                    Text(String(localized: "Logga nu!"))
                        .font(.caption2).fontWeight(.semibold)
                        .foregroundColor(.white)
                        .padding(.horizontal, 8).padding(.vertical, 3)
                        .background(Color.red.opacity(0.85))
                        .cornerRadius(8)
                }
            }
            .padding(.horizontal)

            // Summary card
            VStack(spacing: 10) {
                if let last = latest {
                    // Senast loggat datum
                    HStack {
                        Text(String(localized: "Senast loggat"))
                            .font(.caption).foregroundColor(Color.textSecondary(for: colorScheme))
                        Spacer()
                        Text(last.date, style: .date)
                            .font(.caption).foregroundColor(Color.textSecondary(for: colorScheme))
                    }

                    Divider()

                    // Vikt + top-2 fokuserade mått
                    if let w = last.weight {
                        summaryRow(icon: "scalemass", label: String(localized: "Vikt"),
                                   value: formatVal(w) + " kg",
                                   delta: weightDelta30d())
                    }
                    ForEach(focus.primaryFields.prefix(2), id: \.label) { field in
                        if let val = last[keyPath: field.keyPath] {
                            summaryRow(icon: "ruler", label: field.label,
                                       value: formatVal(val) + " cm",
                                       delta: delta30d(keyPath: field.keyPath))
                        }
                    }
                } else {
                    Text(String(localized: "Inga mått loggade ännu — tryck Logga mått för att komma igång!"))
                        .font(.subheadline)
                        .foregroundColor(Color.textSecondary(for: colorScheme))
                        .multilineTextAlignment(.center)
                        .padding(.vertical, 8)
                }

                // Buttons
                HStack(spacing: 12) {
                    Button(action: onLogTap) {
                        HStack {
                            Image(systemName: "plus.circle")
                            Text(String(localized: "Logga mått"))
                        }
                        .font(.subheadline).fontWeight(.semibold)
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(Color.accentBlue)
                        .cornerRadius(10)
                    }

                    NavigationLink(destination: BodyProgressView(userId: userId, focus: focus)) {
                        HStack {
                            Image(systemName: "chart.line.uptrend.xyaxis")
                            Text(String(localized: "Visa progress"))
                        }
                        .font(.subheadline).fontWeight(.semibold)
                        .foregroundColor(Color.textPrimary(for: colorScheme))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(Color.appBackground(for: colorScheme))
                        .cornerRadius(10)
                        .overlay(
                            RoundedRectangle(cornerRadius: 10)
                                .stroke(Color.textSecondary(for: colorScheme).opacity(0.2), lineWidth: 1)
                        )
                    }
                }
            }
            .padding()
            .background(Color.cardBackground(for: colorScheme))
            .cornerRadius(16)
            .padding(.horizontal)
        }
    }

    @ViewBuilder
    private func summaryRow(icon: String, label: String, value: String, delta: Double?) -> some View {
        HStack {
            Image(systemName: icon)
                .foregroundColor(Color.textSecondary(for: colorScheme))
                .frame(width: 18)
            Text(label)
                .font(.subheadline)
                .foregroundColor(Color.textPrimary(for: colorScheme))
            Spacer()
            Text(value)
                .font(.subheadline).fontWeight(.semibold)
                .foregroundColor(Color.textPrimary(for: colorScheme))
            if let d = delta, d != 0 {
                Text((d > 0 ? "+" : "") + formatVal(d))
                    .font(.caption2)
                    .foregroundColor(d < 0 ? .green : .red)
                    .padding(.horizontal, 5).padding(.vertical, 2)
                    .background((d < 0 ? Color.green : Color.red).opacity(0.1))
                    .cornerRadius(5)
            }
        }
    }

    private func formatVal(_ v: Double) -> String {
        v.truncatingRemainder(dividingBy: 1) == 0 ? String(Int(v)) : String(format: "%.1f", v)
    }

    private func weightDelta30d() -> Double? {
        guard let latest = measurements.first?.weight else { return nil }
        let cutoff = Calendar.current.date(byAdding: .day, value: -30, to: Date()) ?? Date()
        let old = measurements.last(where: { $0.date <= cutoff && $0.weight != nil })?.weight
        guard let oldVal = old else { return nil }
        return latest - oldVal
    }

    private func delta30d(keyPath: KeyPath<BodyMeasurement, Double?>) -> Double? {
        guard let latest = measurements.first?[keyPath: keyPath] else { return nil }
        let cutoff = Calendar.current.date(byAdding: .day, value: -30, to: Date()) ?? Date()
        let old = measurements.last(where: { $0.date <= cutoff && $0[keyPath: keyPath] != nil })?[keyPath: keyPath]
        guard let oldVal = old else { return nil }
        return latest - oldVal
    }
}

// MARK: - Components

struct StatItem: View {
    let icon: String
    let label: String
    let value: String
    let colorScheme: ColorScheme
    
    var body: some View {
        VStack(spacing: 4) {
            HStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.caption2)
                Text(label)
                    .font(.caption2)
            }
            .foregroundStyle(Color.textSecondary(for: colorScheme))
            
            Text(value)
                .font(.title3)
                .fontWeight(.bold)
                .foregroundStyle(Color.textPrimary(for: colorScheme))
        }
    }
}

struct InfoItem: View {
    let label: String
    let value: String
    let colorScheme: ColorScheme
    
    var body: some View {
        VStack(spacing: 4) {
            Text(label)
                .font(.caption2)
                .foregroundStyle(Color.textSecondary(for: colorScheme))
            Text(value)
                .font(.subheadline)
                .fontWeight(.semibold)
                .foregroundStyle(Color.textPrimary(for: colorScheme))
        }
    }
}

struct GoalRow: View {
    let title: String
    let percentage: Int
    let colorScheme: ColorScheme
    
    var body: some View {
        HStack {
            Text(title)
                .font(.subheadline)
                .foregroundStyle(Color.textPrimary(for: colorScheme))
            Spacer()
            Text("\(percentage)%")
                .font(.subheadline)
                .fontWeight(.bold)
                .foregroundStyle(Color.textPrimary(for: colorScheme))
        }
        .overlay(alignment: .leading) {
            GeometryReader { geo in
                Rectangle()
                    .fill(Color(hex: "6395B8").opacity(0.3))
                    .frame(width: geo.size.width * CGFloat(percentage) / 100)
            }
        }
    }
}

struct ColorSchemeButton: View {
    let title: String
    let icon: String
    let isSelected: Bool
    let colorScheme: ColorScheme
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.title2)
                    .foregroundColor(isSelected ? Color.primaryColor(for: colorScheme) : Color.textSecondary(for: colorScheme))
                Text(title)
                    .font(.caption)
                    .foregroundColor(isSelected ? Color.textPrimary(for: colorScheme) : Color.textSecondary(for: colorScheme))
            }
            .frame(maxWidth: .infinity)
            .padding()
            .background(isSelected ? Color.primaryColor(for: colorScheme).opacity(0.2) : Color.cardBackground(for: colorScheme))
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(isSelected ? Color.primaryColor(for: colorScheme) : Color.textSecondary(for: colorScheme).opacity(0.2), lineWidth: isSelected ? 2 : 1)
            )
        }
    }
}

struct ThemeCircle: View {
    let name: String
    let color: Color
    let isSelected: Bool
    let colorScheme: ColorScheme
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                Circle()
                    .fill(color)
                    .frame(width: 60, height: 60)
                    .overlay(
                        Circle()
                            .stroke(Color.white, lineWidth: isSelected ? 3 : 0)
                    )
                    .overlay(
                        isSelected ? Image(systemName: "checkmark")
                            .foregroundColor(.white)
                            .font(.title3)
                            .fontWeight(.bold) : nil
                    )
                
                Text(name)
                    .font(.caption)
                    .foregroundStyle(isSelected ? .white : Color.textSecondary(for: colorScheme))
            }
        }
    }
}

struct ActionButton: View {
    let icon: String
    let title: String
    var isDestructive: Bool = false
    let colorScheme: ColorScheme
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            HStack {
                Image(systemName: icon)
                Text(title)
                Spacer()
            }
            .padding()
            .background(isDestructive ? Color.red.opacity(0.1) : Color.cardBackground(for: colorScheme))
            .foregroundColor(isDestructive ? .red : Color.textPrimary(for: colorScheme))
            .cornerRadius(12)
        }
    }
}

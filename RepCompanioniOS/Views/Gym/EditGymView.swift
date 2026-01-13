import SwiftUI
import SwiftData

struct EditGymView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) var colorScheme
    @AppStorage("selectedTheme") private var selectedTheme = "Main"
    
    @StateObject private var gymService = GymService.shared
    
    @StateObject private var locationService = LocationService.shared
    
    // Form State
    @State private var name: String = ""
    @State private var location: String = ""
    @State private var latitude: Double?
    @State private var longitude: Double?
    @State private var isPublic: Bool = false
    @State private var selectedEquipmentIds: [String] = []
    @State private var showNearbyGyms = false
    @State private var hasInitialized = false
    @State private var showAdaptationAlert = false
    @State private var createdGymId: String?
    @State private var sourceGymId: String?
    
    @Query private var userProfiles: [UserProfile]
    @Query private var allTemplates: [ProgramTemplate]
    
    // Determine if we are editing or creating
    var gymToEdit: Gym?
    
    @FocusState private var focusedField: Field?
    enum Field {
        case name
        case location
    }
    
    var isEditing: Bool {
        gymToEdit != nil
    }
    
    // Check if it's currently active
    private var isActive: Bool {
        guard let gym = gymToEdit else { return false }
        return gym.isSelected
    }
    
    var body: some View {
        mainContent
            .alert("Skapa program för gymmet?", isPresented: $showAdaptationAlert) {
                Button("Ja, baserat på mitt program") {
                    if let targetId = createdGymId {
                        Task {
                            try? await ProgramAdaptationService.shared.adaptProgram(
                                userId: userProfiles.first?.userId ?? "",
                                sourceGymId: sourceGymId,
                                targetGymId: targetId,
                                modelContext: modelContext
                            )
                            dismiss()
                        }
                    }
                }
                Button("Nej, hoppa över") {
                    dismiss()
                }
            } message: {
                Text("Vill du skapa ett träningsupplägg för detta gym baserat på ditt nuvarande program? Övningarna anpassas efter tillgänglig utrustning.")
            }
    }
    
    @ViewBuilder
    private var mainContent: some View {
        if isEditing && !hasInitialized {
            // Placeholder while loading
            ProgressView()
                .onAppear { initializeFromGym() }
        } else if !isEditing && !hasInitialized {
             // Creating new
             content
                .onAppear { initializeNew() }
        } else {
            content
        }
    }
    
    @ViewBuilder
    private var content: some View {
        Form {
            if isEditing {
                Section {
                    if isActive {
                        HStack {
                            Image(systemName: "checkmark.circle.fill")
                            Text("Aktivt gym")
                                .fontWeight(.bold)
                            Spacer()
                        }
                        .padding(.vertical, 8)
                        .foregroundColor(Color.themePrimaryColor(theme: selectedTheme, colorScheme: colorScheme))
                    } else {
                        Button(action: {
                            if let gym = gymToEdit {
                                withAnimation {
                                    gymService.selectGym(gym: gym, modelContext: modelContext)
                                }
                            }
                        }) {
                            HStack {
                                Image(systemName: "hand.tap.fill")
                                Text("Välj som aktivt gym")
                                    .fontWeight(.semibold)
                                Spacer()
                            }
                            .padding(.vertical, 8)
                        }
                    }
                }
            }

            Section(header: Text("Gym Information")) {
                    TextField("Gym Namn (t.ex. Mitt Gym)", text: $name)
                        .focused($focusedField, equals: .name)
                    
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            TextField("Adress (Valfritt)", text: $location)
                                .focused($focusedField, equals: .location)
                                .onChange(of: location) { _, newValue in
                                    locationService.searchQuery = newValue
                                }
                            
                            if !location.isEmpty {
                                Button(action: { location = "" }) {
                                    Image(systemName: "xmark.circle.fill")
                                        .foregroundColor(.gray)
                                }
                            }
                        }
                        
                        if !locationService.suggestions.isEmpty && focusedField == .location {
                            VStack(alignment: .leading, spacing: 12) {
                                Divider()
                                ForEach(locationService.suggestions.prefix(3)) { suggestion in
                                    Button(action: {
                                        self.location = suggestion.title
                                        locationService.searchQuery = ""
                                        focusedField = nil
                                    }) {
                                        VStack(alignment: .leading) {
                                            Text(suggestion.title)
                                                .font(.subheadline)
                                                .foregroundColor(Color.textPrimary(for: colorScheme))
                                            Text(suggestion.subtitle)
                                                .font(.caption)
                                                .foregroundColor(.gray)
                                        }
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                    }
                                }
                            }
                            .padding(.vertical, 8)
                        }
                    }
                    
                    Toggle("Publikt gym", isOn: $isPublic)
                        .tint(Color.themePrimaryColor(theme: selectedTheme, colorScheme: colorScheme))
                    
                    if !isPublic {
                        Text("Privata gym sparas endast för dig.")
                            .font(.caption)
                            .foregroundColor(.gray)
                    }
                }
                
                Section(header: Text("Hitta i närheten")) {
                    Button(action: {
                        locationService.searchNearbyGyms()
                        showNearbyGyms = true
                    }) {
                        HStack {
                            Image(systemName: "location.fill")
                            if locationService.isSearching {
                                ProgressView()
                                    .padding(.leading, 8)
                            } else {
                                Text("Sök gym i närheten")
                            }
                        }
                    }
                    
                    if showNearbyGyms && !locationService.nearbyGyms.isEmpty {
                        ForEach(locationService.nearbyGyms.prefix(5)) { nearby in
                            Button(action: {
                                self.name = nearby.name
                                self.location = nearby.address ?? ""
                                self.latitude = nearby.latitude
                                self.longitude = nearby.longitude
                                self.showNearbyGyms = false
                            }) {
                                HStack {
                                    VStack(alignment: .leading) {
                                        Text(nearby.name)
                                            .foregroundColor(Color.textPrimary(for: colorScheme))
                                        if let addr = nearby.address {
                                            Text(addr)
                                                .font(.caption)
                                                .foregroundColor(.gray)
                                                .lineLimit(1)
                                        }
                                    }
                                    Spacer()
                                    Text(formatDistance(nearby.distance))
                                        .font(.caption)
                                        .foregroundColor(.gray)
                                }
                            }
                        }
                    }
                }
                
                Section(header: Text("Utrustning")) {
                    NavigationLink(destination: EquipmentSelectionView(
                        selectedEquipmentIds: $selectedEquipmentIds,
                        colorScheme: colorScheme,
                        selectedTheme: selectedTheme
                    )) {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Välj utrustning")
                                    .fontWeight(.medium)
                                Text("\(selectedEquipmentIds.count) valda")
                                    .font(.caption)
                                    .foregroundColor(.gray)
                            }
                            Spacer()
                            Image(systemName: "dumbbell.fill")
                                .foregroundColor(Color.themePrimaryColor(theme: selectedTheme, colorScheme: colorScheme))
                        }
                        .padding(.vertical, 4)
                    }
                    
                    if selectedEquipmentIds.isEmpty {
                        Text("Ingen utrustning vald. Detta gym kommer endast att stödja kroppsviktsövningar.")
                            .font(.caption)
                            .foregroundColor(.orange)
                            .padding(.vertical, 4)
                }
            }
        }
        .navigationTitle(isEditing ? name : "Nytt gym")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Avbryt") {
                    dismiss()
                }
            }
            
            ToolbarItem(placement: .confirmationAction) {
                Button("Spara") {
                    saveGym()
                }
                .disabled(name.isEmpty)
            }
        }
    }
    
    private func initializeFromGym() {
        if let gym = gymToEdit {
            name = gym.name
            location = gym.location ?? ""
            latitude = gym.latitude
            longitude = gym.longitude
            isPublic = gym.isPublic
            selectedEquipmentIds = gym.equipmentIds
        }
        locationService.requestPermission()
        hasInitialized = true
    }
    
    private func initializeNew() {
        locationService.requestPermission()
        hasInitialized = true
    }
    
    private func formatDistance(_ meters: Double) -> String {
        if meters < 1000 {
            return "\(Int(meters)) m"
        } else {
            return String(format: "%.1f km", meters / 1000.0)
        }
    }
    
    private func saveGym() {
        Task {
            do {
                if let gym = gymToEdit {
                    // Update existing
                    try await gymService.updateGym(
                        gym: gym,
                        name: name,
                        location: location.isEmpty ? nil : location,
                        latitude: latitude,
                        longitude: longitude,
                        equipmentIds: selectedEquipmentIds,
                        isPublic: isPublic,
                        modelContext: modelContext
                    )
                    dismiss()
                } else {
                    // Create new
                    if let profile = userProfiles.first {
                        let newGym = try await gymService.createGym(
                            name: name,
                            location: location.isEmpty ? nil : location,
                            latitude: latitude,
                            longitude: longitude,
                            equipmentIds: selectedEquipmentIds,
                            isPublic: isPublic,
                            userId: profile.userId,
                            modelContext: modelContext
                        )
                        
                        // Check if we should suggest program adaptation
                        let activeGymId = profile.selectedGymId
                        let hasTemplates = !allTemplates.isEmpty
                        
                        if hasTemplates {
                            createdGymId = newGym.id
                            sourceGymId = activeGymId
                            showAdaptationAlert = true
                        } else {
                            dismiss()
                        }
                    } else {
                        dismiss()
                    }
                }
            } catch {
                print("Error saving gym: \(error)")
                dismiss()
            }
        }
    }
}

import SwiftUI
import SwiftData

struct EditGymView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) var colorScheme
    @AppStorage("selectedTheme") private var selectedTheme = "Main"
    
    @StateObject private var gymService = GymService.shared
    
    // Form State
    @State private var name: String = ""
    @State private var location: String = ""
    @State private var selectedEquipmentIds: [String] = []
    
    // Determine if we are editing or creating
    var gymToEdit: Gym?
    
    var isEditing: Bool {
        gymToEdit != nil
    }
    
    var body: some View {
        NavigationView {
            Form {
                Section(header: Text("Gym Information")) {
                    TextField("Gym Name (e.g., Home Gym)", text: $name)
                    TextField("Location (Optional)", text: $location)
                }
                
                Section(header: Text("Utrustning")) {
                    NavigationLink(destination: EquipmentSelectionView(
                        selectedEquipmentIds: $selectedEquipmentIds,
                        colorScheme: colorScheme,
                        selectedTheme: selectedTheme
                    )) {
                        HStack {
                            Text("Välj utrustning")
                            Spacer()
                            Text("\(selectedEquipmentIds.count) valda")
                                .foregroundColor(.gray)
                        }
                    }
                }
            }
            .navigationTitle(isEditing ? "Redigera gym" : "Nytt gym")
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
            .onAppear {
                if let gym = gymToEdit {
                    name = gym.name
                    location = gym.location ?? ""
                    selectedEquipmentIds = gym.equipmentIds
                }
            }
        }
    }
    
    private func saveGym() {
        if let gym = gymToEdit {
            // Update existing
            gymService.updateGym(
                gym: gym,
                name: name,
                location: location.isEmpty ? nil : location,
                equipmentIds: selectedEquipmentIds,
                modelContext: modelContext
            )
        } else {
            // Create new
            // Assuming we can get userId from somewhere. 
            // Ideally passing it in or fetching from ProfileService/UserProfile
            // For now let's query UserProfile to get the ID.
            
            // This is a bit of a hack inside View, better to pass userId but let's query for now
            // to keep generic signature simple.
            
            do {
                let descriptor = FetchDescriptor<UserProfile>()
                if let profile = try? modelContext.fetch(descriptor).first {
                     _ = gymService.createGym(
                        name: name,
                        location: location.isEmpty ? nil : location,
                        equipmentIds: selectedEquipmentIds,
                        userId: profile.userId, // Using profile's userId
                        modelContext: modelContext
                    )
                }
            }
        }
        dismiss()
    }
}

import SwiftUI
import SwiftData

struct GymDetailView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) var colorScheme
    @AppStorage("selectedTheme") private var selectedTheme = "Main"
    
    let gym: Gym
    
    @Query(sort: \EquipmentCatalog.name) private var equipmentCatalog: [EquipmentCatalog]
    
    private var selectedEquipment: [EquipmentCatalog] {
        equipmentCatalog.filter { equipment in
            gym.equipmentIds.contains(equipment.id)
        }
    }
    
    @State private var showingEditView = false
    
    var body: some View {
        List {
            Section(header: Text("Gym Information")) {
                HStack {
                    Text("Namn")
                        .foregroundColor(Color.textSecondary(for: colorScheme))
                    Spacer()
                    Text(gym.name)
                        .foregroundColor(Color.textPrimary(for: colorScheme))
                }
                
                if let location = gym.location, !location.isEmpty {
                    HStack {
                        Text("Plats")
                            .foregroundColor(Color.textSecondary(for: colorScheme))
                        Spacer()
                        Text(location)
                            .foregroundColor(Color.textPrimary(for: colorScheme))
                    }
                }
            }
            
            Section(header: Text("Utrustning")) {
                if selectedEquipment.isEmpty {
                    Text("Ingen utrustning vald")
                        .foregroundColor(Color.textSecondary(for: colorScheme))
                        .font(.subheadline)
                } else {
                    ForEach(selectedEquipment) { equipment in
                        HStack {
                            Image(systemName: "dumbbell.fill")
                                .foregroundColor(Color.themePrimaryColor(theme: selectedTheme, colorScheme: colorScheme))
                                .frame(width: 24)
                            
                            VStack(alignment: .leading, spacing: 4) {
                                Text(equipment.name)
                                    .foregroundColor(Color.textPrimary(for: colorScheme))
                                
                                if !equipment.category.isEmpty {
                                    Text(equipment.category)
                                        .font(.caption)
                                        .foregroundColor(Color.textSecondary(for: colorScheme))
                                }
                            }
                            
                            Spacer()
                        }
                        .padding(.vertical, 4)
                    }
                }
            }
        }
        .navigationTitle(gym.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button("Redigera") {
                    showingEditView = true
                }
            }
        }
        .sheet(isPresented: $showingEditView) {
            EditGymView(gymToEdit: gym)
        }
    }
}



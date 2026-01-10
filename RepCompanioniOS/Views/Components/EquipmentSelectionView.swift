import SwiftUI
import SwiftData

struct EquipmentSelectionView: View {
    @Binding var selectedEquipmentIds: [String]
    let colorScheme: ColorScheme
    let selectedTheme: String
    
    @State private var availableEquipment: [EquipmentCatalog] = []
    @State private var isLoading = false
    @State private var showCamera = false
    
    // Grouping equipment
    private var groupedEquipment: [String: [EquipmentCatalog]] {
        Dictionary(grouping: availableEquipment, by: { $0.category })
    }
    
    private var categories: [String] {
        groupedEquipment.keys.sorted()
    }
    
    var body: some View {
        VStack(spacing: 24) {
            Button(action: { showCamera = true }) {
                HStack {
                    Image(systemName: "camera.fill")
                    Text("Skanna utrustning")
                }
                .foregroundColor(.white)
                .padding()
                .frame(maxWidth: .infinity)
                .background(Color.themeGradient(theme: selectedTheme, colorScheme: colorScheme))
                .cornerRadius(12)
            }
            
            if isLoading {
                ProgressView()
                    .padding()
            } else if availableEquipment.isEmpty {
                Text("Ingen utrustning hittades. Kontrollera din anslutning.")
                    .foregroundColor(Color.textSecondary(for: colorScheme))
                    .padding()
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: 24) {
                        ForEach(categories, id: \.self) { category in
                            VStack(alignment: .leading, spacing: 12) {
                                Text(category)
                                    .font(.headline)
                                    .foregroundColor(Color.textPrimary(for: colorScheme))
                                    .padding(.leading, 4)
                                
                                LazyVGrid(columns: [
                                    GridItem(.flexible()),
                                    GridItem(.flexible())
                                ], spacing: 12) {
                                    ForEach(groupedEquipment[category] ?? [], id: \.id) { equipment in
                                        EquipmentCard(
                                            equipment: equipment,
                                            isSelected: selectedEquipmentIds.contains(equipment.id),
                                            colorScheme: colorScheme,
                                            selectedTheme: selectedTheme
                                        ) {
                                            toggleSelection(equipment.id)
                                        }
                                    }
                                }
                            }
                        }
                    }
                    .padding(.bottom, 20)
                }
            }
        }
        .sheet(isPresented: $showCamera) {
            EquipmentCameraView { newEquipmentIds in
                for id in newEquipmentIds {
                    if !selectedEquipmentIds.contains(id) {
                        selectedEquipmentIds.append(id)
                    }
                }
                showCamera = false
            }
        }
        .onAppear {
            loadEquipment()
        }
    }
    
    private func loadEquipment() {
        guard availableEquipment.isEmpty else { return }
        
        isLoading = true
        Task {
            do {
                // Fetch from server via APIService (assuming EquipmentCatalog is cached or fetched fresh)
                // Actually, ExerciseCatalogService syncs to SwiftData, we should query from there?
                // But this view might be used where we want direct access or via service.
                // Let's us APIService directly or modelContext if we want persistence.
                // For simplicity/robustness, let's fetch fresh list or use what's in DB.
                // Reusing APIService fetchEquipmentCatalog directly to avoid context threading issues for now, 
                // OR better: use ModelContext if passed in, but we didn't pass it.
                // Let's use APIService.shared.fetchEquipmentCatalog() -> [EquipmentCatalog]
                // Oh wait, APIService returns [EquipmentCatalogResponse], not Model objects.
                // OnboardingView used `loadEquipmentCatalog` which populated `availableEquipment`.
                // Let's look at how OnboardingView did it.
                // It seems it used `availableEquipment` state.
                
                // Let's replicate `APIService.shared.fetchEquipmentCatalog` and map manualy if needed, 
                // OR query from DB if we trust sync.
                // Let's try fetching from API to ensure fresh data for selection.
                
                let response = try await APIService.shared.fetchEquipmentCatalog()
                
                // Convert Response to Model for display (temporary usage)
                self.availableEquipment = response.map { item in
                     EquipmentCatalog(
                        id: item.id,
                        name: item.name,
                        nameEn: item.nameEn,
                        category: item.category,
                        type: item.type,
                        equipmentDescription: item.description,
                        createdAt: item.createdAt
                    )
                }
                isLoading = false
            } catch {
                print("Failed to load equipment: \(error)")
                isLoading = false
            }
        }
    }
    
    private func toggleSelection(_ id: String) {
        if let index = selectedEquipmentIds.firstIndex(of: id) {
            selectedEquipmentIds.remove(at: index)
        } else {
            selectedEquipmentIds.append(id)
        }
    }
}

struct EquipmentCard: View {
    let equipment: EquipmentCatalog
    let isSelected: Bool
    let colorScheme: ColorScheme
    let selectedTheme: String
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 8) {
                Text(equipment.name)
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .foregroundColor(Color.textPrimary(for: colorScheme))
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                    .frame(height: 40, alignment: .topLeading)
                
                Spacer()
                
                if isSelected {
                    HStack {
                        Spacer()
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(Color.themePrimaryColor(theme: selectedTheme, colorScheme: colorScheme))
                    }
                }
            }
            .padding(12)
            .frame(height: 100)
            .background(
                isSelected
                    ? Color.themePrimaryColor(theme: selectedTheme, colorScheme: colorScheme).opacity(0.15)
                    : Color.cardBackground(for: colorScheme)
            )
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(
                        isSelected
                            ? Color.themePrimaryColor(theme: selectedTheme, colorScheme: colorScheme)
                            : Color.clear,
                        lineWidth: 2
                    )
            )
        }
    }
}

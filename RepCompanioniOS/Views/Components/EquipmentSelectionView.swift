import SwiftUI
import SwiftData

struct EquipmentSelectionView: View {
    @Binding var selectedEquipmentIds: [String]
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    let colorScheme: ColorScheme
    let selectedTheme: String
    var onFinish: (() -> Void)? = nil // Optional callback for onboarding
    
    @Query(sort: \EquipmentCatalog.name) private var availableEquipment: [EquipmentCatalog]
    @State private var isLoading = false
    @State private var showCamera = false
    
    private var groupedEquipment: [String: [EquipmentCatalog]] {
        Dictionary(grouping: availableEquipment, by: { $0.category })
    }
    
    private var categories: [String] {
        groupedEquipment.keys.sorted()
    }
    
    var body: some View {
        VStack(spacing: 0) {
            // Header for Scanning
            VStack(spacing: 16) {
                Button(action: { showCamera = true }) {
                    HStack {
                        Image(systemName: "camera.fill")
                        Text("Skanna utrustning")
                    }
                    .font(.headline)
                    .foregroundColor(.white)
                    .padding()
                    .frame(maxWidth: .infinity)
                    .background(Color.themeGradient(theme: selectedTheme, colorScheme: colorScheme))
                    .cornerRadius(12)
                    .shadow(color: Color.themePrimaryColor(theme: selectedTheme, colorScheme: colorScheme).opacity(0.3), radius: 8, x: 0, y: 4)
                }
                .padding(.horizontal)
                .padding(.top, 16)
                
                Text("Eller välj manuellt nedan")
                    .font(.caption)
                    .foregroundColor(Color.textSecondary(for: colorScheme))
            }
            .padding(.bottom, 16)
            .background(Color.appBackground(for: colorScheme))
            
            if isLoading {
                Spacer()
                ProgressView("Hämtar utrustning...")
                    .padding()
                Spacer()
            } else if availableEquipment.isEmpty {
                Spacer()
                VStack(spacing: 12) {
                    Image(systemName: "wifi.exclamationmark")
                        .font(.largeTitle)
                    Text("Ingen utrustning hittades.")
                    Button("Försök igen") { loadEquipment() }
                        .buttonStyle(.bordered)
                }
                .foregroundColor(Color.textSecondary(for: colorScheme))
                Spacer()
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: 32) {
                        ForEach(categories, id: \.self) { category in
                            VStack(alignment: .leading, spacing: 16) {
                                Text(category)
                                    .font(.title3)
                                    .fontWeight(.bold)
                                    .foregroundColor(Color.textPrimary(for: colorScheme))
                                    .padding(.horizontal, 4)
                                
                                LazyVGrid(columns: [
                                    GridItem(.flexible(), spacing: 16),
                                    GridItem(.flexible(), spacing: 16)
                                ], spacing: 16) {
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
                    .padding(.horizontal)
                    .padding(.bottom, 100)
                }
            }
        }
        .overlay(alignment: .bottom) {
            if onFinish != nil {
                Button(action: { onFinish?() }) {
                    Text("Fortsätt")
                        .font(.headline)
                        .foregroundColor(.white)
                        .padding()
                        .frame(maxWidth: .infinity)
                        .background(Color.themeGradient(theme: selectedTheme, colorScheme: colorScheme))
                        .cornerRadius(12)
                        .padding()
                }
                .background(
                    LinearGradient(
                        colors: [Color.appBackground(for: colorScheme).opacity(0), Color.appBackground(for: colorScheme)],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                    .ignoresSafeArea()
                )
            }
        }
        .navigationTitle("Välj utrustning")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if onFinish == nil {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Klar") {
                        dismiss()
                    }
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
                try await ExerciseCatalogService.shared.syncEquipmentCatalog(modelContext: modelContext)
                await MainActor.run {
                    isLoading = false
                }
            } catch {
                await MainActor.run {
                    print("Failed to load equipment: \(error)")
                    isLoading = false
                }
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
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Spacer()
                    ZStack {
                        Circle()
                            .fill(isSelected ? Color.themePrimaryColor(theme: selectedTheme, colorScheme: colorScheme) : Color.textSecondary(for: colorScheme).opacity(0.1))
                            .frame(width: 24, height: 24)
                        
                        if isSelected {
                            Image(systemName: "checkmark")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(.white)
                        }
                    }
                }
                
                Text(equipment.name)
                    .font(.body)
                    .fontWeight(.semibold)
                    .foregroundColor(isSelected ? Color.themePrimaryColor(theme: selectedTheme, colorScheme: colorScheme) : Color.textPrimary(for: colorScheme))
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                    .frame(height: 48, alignment: .topLeading)
                
                Spacer(minLength: 0)
            }
            .padding(16)
            .frame(maxWidth: .infinity)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color.cardBackground(for: colorScheme))
                    .shadow(color: isSelected ? Color.themePrimaryColor(theme: selectedTheme, colorScheme: colorScheme).opacity(0.1) : Color.black.opacity(0.05), radius: 8, x: 0, y: 4)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(
                        isSelected
                            ? Color.themePrimaryColor(theme: selectedTheme, colorScheme: colorScheme)
                            : Color.textSecondary(for: colorScheme).opacity(0.1),
                        lineWidth: isSelected ? 2 : 1
                    )
            )
        }
        .scaleEffect(isSelected ? 0.98 : 1.0)
        .animation(.spring(response: 0.3, dampingFraction: 0.6), value: isSelected)
    }
}

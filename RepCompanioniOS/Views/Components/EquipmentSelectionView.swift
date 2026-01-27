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
                        Text(String(localized: "Scan equipment"))
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
                
                Text(String(localized: "Or choose manually below"))
                    .font(.caption)
                    .foregroundColor(Color.textSecondary(for: colorScheme))
            }
            .padding(.bottom, 16)
            .background(Color.appBackground(for: colorScheme))
            
            if isLoading {
                Spacer()
                ProgressView(String(localized: "Loading equipment..."))
                    .padding()
                Spacer()
            } else if availableEquipment.isEmpty {
                Spacer()
                VStack(spacing: 12) {
                    Image(systemName: "wifi.exclamationmark")
                        .font(.largeTitle)
                    Text(String(localized: "No equipment found."))
                    Button(String(localized: "Try again")) { loadEquipment() }
                        .buttonStyle(.bordered)
                }
                .foregroundColor(Color.textSecondary(for: colorScheme))
                Spacer()
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: 32) {
                        ForEach(categories, id: \.self) { category in
                            VStack(alignment: .leading, spacing: 12) {
                                Text(localizeCategory(category))
                                    .font(.title3)
                                    .fontWeight(.bold)
                                    .foregroundColor(Color.textPrimary(for: colorScheme))
                                    .padding(.horizontal)
                                
                                VStack(spacing: 12) {
                                    ForEach(groupedEquipment[category] ?? [], id: \.id) { equipment in
                                        Button(action: { toggleSelection(equipment.id) }) {
                                            HStack(spacing: 16) {
                                                // Checkbox
                                                ZStack {
                                                    Circle()
                                                        .stroke(
                                                            selectedEquipmentIds.contains(equipment.id) 
                                                                ? Color.themePrimaryColor(theme: selectedTheme, colorScheme: colorScheme)
                                                                : Color.gray.opacity(0.5),
                                                            lineWidth: 2
                                                        )
                                                        .frame(width: 24, height: 24)
                                                    
                                                    if selectedEquipmentIds.contains(equipment.id) {
                                                        Circle()
                                                            .fill(Color.themePrimaryColor(theme: selectedTheme, colorScheme: colorScheme))
                                                            .frame(width: 14, height: 14)
                                                    }
                                                }
                                                
                                                // Text Content
                                                VStack(alignment: .leading, spacing: 4) {
                                                    Text(equipment.name)
                                                        .font(.body)
                                                        .fontWeight(.medium)
                                                        .foregroundColor(Color.textPrimary(for: colorScheme))
                                                    
                                                    if let nameEn = equipment.nameEn {
                                                        Text(nameEn)
                                                            .font(.caption)
                                                            .foregroundColor(Color.textSecondary(for: colorScheme))
                                                    }
                                                }
                                                
                                                Spacer()
                                                
                                                // Optional info icon or similar could go here
                                            }
                                            .padding()
                                            .background(Color.cardBackground(for: colorScheme))
                                            .cornerRadius(12)
                                            .overlay(
                                                RoundedRectangle(cornerRadius: 12)
                                                    .stroke(
                                                        selectedEquipmentIds.contains(equipment.id) 
                                                            ? Color.themePrimaryColor(theme: selectedTheme, colorScheme: colorScheme)
                                                            : Color.clear,
                                                        lineWidth: 1
                                                    )
                                            )
                                        }
                                    }
                                }
                                .padding(.horizontal)
                            }
                        }
                    }
                    .padding(.bottom, 100)
                }
            }
        }
        .overlay(alignment: .bottom) {
            if onFinish != nil {
                Button(action: { onFinish?() }) {
                    Text(String(localized: "Continue"))
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
        .navigationTitle(String(localized: "Select Equipment"))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if onFinish == nil {
                ToolbarItem(placement: .confirmationAction) {
                    Button(String(localized: "Done")) {
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

    
    private func localizeCategory(_ key: String) -> String {
        switch key.lowercased() {
        case "free_weights", "freeweights": return String(localized: "Free Weights")
        case "machine", "machines": return String(localized: "Machines")
        case "cardio": return String(localized: "Cardio")
        case "strength": return String(localized: "Strength")
        case "accessory", "accessories": return String(localized: "Accessories")
        case "bodyweight": return String(localized: "Bodyweight")
        case "attachment", "attachments": return String(localized: "Attachment")
        case "bench", "benches": return String(localized: "Benches")
        case "rack_rig", "racks_rigs", "racks/rigs": return String(localized: "Racks/Rigs")
        default: return key.capitalized
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

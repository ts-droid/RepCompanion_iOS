import SwiftUI
import SwiftData

struct GymListView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.colorScheme) var colorScheme
    @AppStorage("selectedTheme") private var selectedTheme = "Main"
    
    // Fetch all gyms needed for list
    @Query(sort: \Gym.createdAt) private var gyms: [Gym]
    
    // Fetch profile for current selection state
    @Query private var profiles: [UserProfile]
    
    @State private var showingAddGym = false
    @State private var gymToEdit: Gym?
    
    @StateObject private var gymService = GymService.shared
    
    var body: some View {
        List {
            if gyms.isEmpty {
                ContentUnavailableView(
                    "Inga gym",
                    systemImage: "dumbbell.fill",
                    description: Text("Lägg till ditt första gym för att komma igång.")
                )
            } else {
                ForEach(gyms) { gym in
                    NavigationLink(destination: EditGymView(gymToEdit: gym)) {
                        GymRowContent(
                            gym: gym,
                            isSelected: gym.isSelected,
                            colorScheme: colorScheme,
                            selectedTheme: selectedTheme
                        )
                    }
                    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                        Button(role: .destructive) {
                            gymService.deleteGym(gym: gym, modelContext: modelContext)
                        } label: {
                            Label("Ta bort", systemImage: "trash")
                        }
                        
                        Button {
                            gymToEdit = gym
                        } label: {
                            Label("Redigera", systemImage: "pencil")
                        }
                        .tint(.blue)
                    }
                }
            }
        }
        .navigationTitle("Mina Gym")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button(action: { showingAddGym = true }) {
                    Image(systemName: "plus")
                }
            }
        }
        .sheet(isPresented: $showingAddGym) {
            NavigationView {
                EditGymView()
            }
        }
        .sheet(item: $gymToEdit) { gym in
            NavigationView {
                EditGymView(gymToEdit: gym)
            }
        }
        .onAppear {
            autoSelectFirstGymIfNeeded()
        }
    }
    
    private func autoSelectFirstGymIfNeeded() {
        // If there's exactly one gym and none are selected in the profile, select it
        guard gyms.count == 1, let firstGym = gyms.first else { return }
        
        let currentUserId = firstGym.userId
        let profile = profiles.first { $0.userId == currentUserId }
        
        if profile?.selectedGymId == nil {
            print("[GymListView] 🔄 Auto-selecting first gym: \(firstGym.name)")
            gymService.selectGym(gym: firstGym, modelContext: modelContext)
        }
    }
    
    private func selectGym(_ gym: Gym) {
        withAnimation {
            gymService.selectGym(gym: gym, modelContext: modelContext)
        }
    }
}

struct GymRowContent: View {
    let gym: Gym
    let isSelected: Bool
    let colorScheme: ColorScheme
    let selectedTheme: String
    
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(gym.name)
                    .font(.headline)
                    .foregroundColor(Color.textPrimary(for: colorScheme))
                
                if let location = gym.location, !location.isEmpty {
                    Text(location)
                        .font(.caption)
                        .foregroundColor(Color.textSecondary(for: colorScheme))
                }
                
                Text("\(gym.equipmentIds.count) utrustning")
                    .font(.caption2)
                    .foregroundColor(.gray)
            }
            
            Spacer()
            
            if isSelected {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundColor(Color.themePrimaryColor(theme: selectedTheme, colorScheme: colorScheme))
                    .font(.title3)
            }
        }
    }
}

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
    @State private var didCleanupDuplicates = false
    
    @StateObject private var gymService = GymService.shared
    
    var body: some View {
        ZStack {
            Color.appBackground(for: colorScheme).ignoresSafeArea()
            
            List {
                if gyms.isEmpty {
                    VStack(spacing: 20) {
                        Image(systemName: "dumbbell.fill")
                            .font(.system(size: 48))
                            .foregroundColor(.gray.opacity(0.3))
                        
                        Text(String(localized: "No gyms"))
                            .font(.headline)
                            .foregroundColor(Color.textPrimary(for: colorScheme))
                        
                        Text(String(localized: "Add your first gym to get started."))
                            .font(.subheadline)
                            .foregroundColor(Color.textSecondary(for: colorScheme))
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 32)
                    }
                    .frame(maxWidth: .infinity)
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)
                    .padding(.top, 100)
                } else {
                    ForEach(uniqueGyms) { gym in
                        ZStack {
                            NavigationLink(destination: ActiveGymDetailView(gym: gym)) {
                                EmptyView()
                            }
                            .opacity(0)
                            
                            GymRow(
                                gym: gym,
                                isSelected: gym.isSelected(profiles: profiles),
                                colorScheme: colorScheme,
                                selectedTheme: selectedTheme
                            )
                        }
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                        .listRowInsets(EdgeInsets(top: 6, leading: 16, bottom: 6, trailing: 16))
                        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                            Button(role: .destructive) {
                                withAnimation {
                                    gymService.deleteGym(gym: gym, modelContext: modelContext)
                                }
                            } label: {
                                Label(String(localized: "Delete"), systemImage: "trash")
                            }
                            
                            Button {
                                gymToEdit = gym
                            } label: {
                                Label(String(localized: "Edit"), systemImage: "pencil")
                            }
                            .tint(.blue)
                        }
                    }
                }
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
        }
        .navigationTitle(String(localized: "My Gyms"))
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button(action: { showingAddGym = true }) {
                    Image(systemName: "plus.circle.fill")
                        .font(.title3)
                        .foregroundColor(Color.themePrimaryColor(theme: selectedTheme, colorScheme: colorScheme))
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
            cleanupDuplicatesIfNeeded()
        }
    }

    private var uniqueGyms: [Gym] {
        var seen = Set<String>()
        var result: [Gym] = []
        for gym in gyms {
            let key = "\(gym.name.trimmingCharacters(in: .whitespacesAndNewlines).lowercased())|\((gym.location ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased())"
            if seen.contains(key) {
                continue
            }
            seen.insert(key)
            result.append(gym)
        }
        return result
    }

    private func cleanupDuplicatesIfNeeded() {
        guard !didCleanupDuplicates else { return }
        didCleanupDuplicates = true
        if let userId = gyms.first?.userId {
            Task {
                await gymService.cleanupDuplicateGyms(userId: userId, modelContext: modelContext)
            }
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
}

extension Gym {
    func isSelected(profiles: [UserProfile]) -> Bool {
        guard let profile = profiles.first(where: { $0.userId == self.userId }) else { return false }
        return profile.selectedGymId == self.id
    }
}

struct GymListView_Previews: PreviewProvider {
    static var previews: some View {
        GymListView()
    }
}

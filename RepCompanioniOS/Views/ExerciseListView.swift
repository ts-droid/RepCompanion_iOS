import SwiftUI
import SwiftData

/// View for browsing and searching exercises
struct ExerciseListView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.colorScheme) private var colorScheme
    @StateObject private var catalogService = ExerciseCatalogService.shared
    
    @State private var searchText = ""
    @State private var selectedCategory: String?
    @State private var selectedDifficulty: String?
    @State private var isLoading = false
    @State private var showSyncAlert = false
    
    @Query(sort: \ExerciseCatalog.name) private var allExercises: [ExerciseCatalog]
    
    private var categories: [String] {
        Array(Set(allExercises.map { $0.category })).sorted()
    }
    
    private var difficulties: [String] {
        ["beginner", "intermediate", "advanced"]
    }
    
    private var filteredExercises: [ExerciseCatalog] {
        var exercises = allExercises
        
        if !searchText.isEmpty {
            exercises = catalogService.searchExercises(
                query: searchText,
                category: selectedCategory,
                modelContext: modelContext
            )
        }
        
        if let difficulty = selectedDifficulty {
            exercises = exercises.filter { $0.difficulty == difficulty }
        }
        
        if let category = selectedCategory {
            exercises = exercises.filter { $0.category == category }
        }
        
        return exercises
    }
    
    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Search and Filters
                VStack(spacing: 12) {
                    // Search Bar
                    HStack {
                        Image(systemName: "magnifyingglass")
                            .foregroundColor(.gray)
                        TextField("Sök övningar...", text: $searchText)
                            .textFieldStyle(PlainTextFieldStyle())
                    }
                    .padding()
                    .background(Color.cardBackground(for: colorScheme))
                    .cornerRadius(10)
                    
                    // Filters
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            FilterChip(
                                title: "Alla kategorier",
                                isSelected: selectedCategory == nil,
                                colorScheme: colorScheme
                            ) {
                                selectedCategory = nil
                            }
                            
                            ForEach(categories, id: \.self) { category in
                                FilterChip(
                                    title: category,
                                    isSelected: selectedCategory == category,
                                    colorScheme: colorScheme
                                ) {
                                    selectedCategory = selectedCategory == category ? nil : category
                                }
                            }
                        }
                        .padding(.horizontal)
                    }
                }
                .padding()
                .background(Color.appBackground(for: colorScheme))
                
                // Exercise List
                if isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if filteredExercises.isEmpty {
                    VStack(spacing: 16) {
                        Image(systemName: "figure.strengthtraining.traditional")
                            .font(.system(size: 60))
                            .foregroundColor(.gray)
                        Text("Inga övningar hittades")
                            .font(.headline)
                            .foregroundStyle(Color.textSecondary(for: colorScheme))
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List {
                        ForEach(filteredExercises) { exercise in
                            NavigationLink(destination: ExerciseDetailView(exercise: exercise)) {
                                ExerciseRow(exercise: exercise, colorScheme: colorScheme)
                            }
                        }
                    }
                    .listStyle(PlainListStyle())
                }
            }
            .background(Color.appBackground(for: colorScheme))
            .navigationTitle("Övningar")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: syncCatalog) {
                        Image(systemName: "arrow.clockwise")
                    }
                }
            }
            .alert("Synkning", isPresented: $showSyncAlert) {
                Button("OK") { }
            } message: {
                Text(isLoading ? "Synkar övningskatalog..." : "Synkning slutförd")
            }
        }
    }
    
    private func syncCatalog() {
        Task {
            isLoading = true
            showSyncAlert = true
            do {
                try await catalogService.syncExercises(modelContext: modelContext)
            } catch {
                print("Error syncing exercises: \(error)")
            }
            isLoading = false
        }
    }
}

struct ExerciseRow: View {
    let exercise: ExerciseCatalog
    let colorScheme: ColorScheme
    
    var body: some View {
        HStack(spacing: 12) {
            // Video indicator
            if exercise.youtubeUrl != nil {
                Image(systemName: "play.circle.fill")
                    .foregroundColor(.accentBlue)
            }
            
            VStack(alignment: .leading, spacing: 4) {
                Text(exercise.name)
                    .font(.headline)
                    .foregroundStyle(Color.textPrimary(for: colorScheme))
                
                HStack(spacing: 8) {
                    Text(exercise.category)
                        .font(.caption)
                        .foregroundStyle(Color.textSecondary(for: colorScheme))
                    
                    Text("•")
                        .foregroundStyle(Color.textSecondary(for: colorScheme))
                    
                    Text(exercise.difficulty.capitalized)
                        .font(.caption)
                        .foregroundStyle(Color.textSecondary(for: colorScheme))
                }
            }
            
            Spacer()
            
            if exercise.isCompound {
                Image(systemName: "square.stack.3d.up.fill")
                    .foregroundColor(.orange)
                    .font(.caption)
            }
        }
        .padding(.vertical, 4)
    }
}

struct FilterChip: View {
    let title: String
    let isSelected: Bool
    let colorScheme: ColorScheme
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.caption)
                .fontWeight(.medium)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(isSelected ? Color.accentBlue : Color.cardBackground(for: colorScheme))
                .foregroundColor(isSelected ? .white : Color.textPrimary(for: colorScheme))
                .cornerRadius(16)
        }
    }
}


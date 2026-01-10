import SwiftUI
import SwiftData

/// View for editing program template with exercises
struct EditProgramTemplateView: View {
    let template: ProgramTemplate
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.modelContext) private var modelContext
    
    @Query private var allExercises: [ProgramTemplateExercise]
    @State private var exercises: [ProgramTemplateExercise] = []
    @State private var hasChanges = false
    @State private var showAddExercise = false
    
    private var templateExercises: [ProgramTemplateExercise] {
        allExercises.filter { $0.templateId == template.id }
            .sorted { $0.orderIndex < $1.orderIndex }
    }
    
    var body: some View {
        NavigationView {
            ZStack {
                Color.appBackground(for: colorScheme).ignoresSafeArea()
                
                ScrollView {
                    VStack(spacing: 20) {
                        // Header Card
                        VStack(alignment: .leading, spacing: 12) {
                            HStack {
                                Text(template.templateName)
                                    .font(.title2)
                                    .fontWeight(.bold)
                                    .foregroundStyle(Color.textPrimary(for: colorScheme))
                                Spacer()
                            }
                            
                            HStack {
                                if let dayOfWeek = template.dayOfWeek {
                                    Label(getDayName(dayOfWeek), systemImage: "calendar")
                                        .font(.subheadline)
                                        .foregroundStyle(Color.textSecondary(for: colorScheme))
                                }
                                Spacer()
                            }
                            
                            HStack {
                                Text("Beräknad träningstid")
                                    .font(.subheadline)
                                    .foregroundStyle(Color.textSecondary(for: colorScheme))
                                Spacer()
                                if let duration = template.estimatedDurationMinutes {
                                    Text("\(duration) min")
                                        .font(.subheadline)
                                        .fontWeight(.semibold)
                                        .foregroundStyle(Color.textPrimary(for: colorScheme))
                                }
                            }
                        }
                        .padding()
                        .background(Color.cardBackground(for: colorScheme))
                        .cornerRadius(12)
                        
                        // Exercises List
                        ForEach(Array(exercises.enumerated()), id: \.element.id) { index, exercise in
                            EditableExerciseCard(
                                exercise: exercise,
                                index: index,
                                totalExercises: exercises.count,
                                colorScheme: colorScheme,
                                onUpdate: { updatedExercise in
                                    exercises[index] = updatedExercise
                                    hasChanges = true
                                },
                                onMoveUp: {
                                    if index > 0 {
                                        exercises.swapAt(index, index - 1)
                                        updateOrderIndices()
                                        hasChanges = true
                                    }
                                },
                                onMoveDown: {
                                    if index < exercises.count - 1 {
                                        exercises.swapAt(index, index + 1)
                                        updateOrderIndices()
                                        hasChanges = true
                                    }
                                },
                                onDelete: {
                                    exercises.remove(at: index)
                                    updateOrderIndices()
                                    hasChanges = true
                                }
                            )
                        }
                        
                        // Add Exercise Button
                        Button(action: {
                            showAddExercise = true
                        }) {
                            HStack {
                                Image(systemName: "plus.circle.fill")
                                Text("Lägg till övning")
                            }
                            .font(.headline)
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.accentBlue)
                            .cornerRadius(12)
                        }
                    }
                    .padding()
                    .padding(.bottom, 100)
                }
                
                // Bottom Action Buttons
                VStack(spacing: 12) {
                    Button(action: {
                        saveChangesAndStart()
                    }) {
                        HStack {
                            Image(systemName: "play.circle.fill")
                            Text("Starta pass")
                        }
                        .font(.headline)
                        .fontWeight(.bold)
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.accentBlue)
                        .cornerRadius(12)
                    }
                    
                    Button(action: {
                        saveChanges()
                    }) {
                        Text("Spara ändringar")
                            .font(.headline)
                            .foregroundColor(Color.textPrimary(for: colorScheme))
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.cardBackground(for: colorScheme))
                            .cornerRadius(12)
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(Color.textSecondary(for: colorScheme).opacity(0.2), lineWidth: 1)
                            )
                    }
                    .disabled(!hasChanges)
                }
                .padding()
                .background(Color.appBackground(for: colorScheme))
            }
            .navigationTitle("Redigera pass")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Avbryt") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Spara") {
                        saveChanges()
                    }
                    .fontWeight(.semibold)
                    .disabled(!hasChanges)
                }
            }
            .onAppear {
                loadExercises()
            }
            .sheet(isPresented: $showAddExercise) {
                AddExerciseView(
                    templateId: template.id,
                    onExerciseAdded: { newExercise in
                        exercises.append(newExercise)
                        updateOrderIndices()
                        hasChanges = true
                        showAddExercise = false
                    }
                )
            }
        }
    }
    
    private func loadExercises() {
        exercises = templateExercises
    }
    
    private func updateOrderIndices() {
        for (index, exercise) in exercises.enumerated() {
            exercise.orderIndex = index
        }
    }
    
    private func saveChanges() {
        saveChangesInternal()
    }
    
    private func saveChangesAndStart() {
        saveChangesInternal()
        // TODO: Start workout session
        // This would create a WorkoutSession and navigate to ActiveWorkoutView
    }
    
    private func saveChangesInternal() {
        // Delete removed exercises
        let currentIds = Set(exercises.map { $0.id.uuidString })
        for exercise in templateExercises {
            if !currentIds.contains(exercise.id.uuidString) {
                modelContext.delete(exercise)
            }
        }
        
        // Update or insert exercises
        for exercise in exercises {
            if let existing = templateExercises.first(where: { $0.id == exercise.id }) {
                // Update existing
                existing.exerciseName = exercise.exerciseName
                existing.targetSets = exercise.targetSets
                existing.targetReps = exercise.targetReps
                existing.targetWeight = exercise.targetWeight
                existing.orderIndex = exercise.orderIndex
            } else {
                // Insert new
                modelContext.insert(exercise)
            }
        }
        
        do {
            try modelContext.save()
            hasChanges = false
            dismiss()
        } catch {
            print("Error saving changes: \(error)")
        }
    }
    
    private func getDayName(_ dayOfWeek: Int) -> String {
        guard dayOfWeek >= 1, dayOfWeek <= 7 else { return "" }
        let days = ["", "Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag", "Söndag"]
        return days[dayOfWeek]
    }
}

struct EditableExerciseCard: View {
    @Bindable var exercise: ProgramTemplateExercise
    let index: Int
    let totalExercises: Int
    let colorScheme: ColorScheme
    let onUpdate: (ProgramTemplateExercise) -> Void
    let onMoveUp: () -> Void
    let onMoveDown: () -> Void
    let onDelete: () -> Void
    
    @State private var sets: Int
    @State private var reps: String
    @State private var weight: Double?
    
    init(
        exercise: ProgramTemplateExercise,
        index: Int,
        totalExercises: Int,
        colorScheme: ColorScheme,
        onUpdate: @escaping (ProgramTemplateExercise) -> Void,
        onMoveUp: @escaping () -> Void,
        onMoveDown: @escaping () -> Void,
        onDelete: @escaping () -> Void
    ) {
        self.exercise = exercise
        self.index = index
        self.totalExercises = totalExercises
        self.colorScheme = colorScheme
        self.onUpdate = onUpdate
        self.onMoveUp = onMoveUp
        self.onMoveDown = onMoveDown
        self.onDelete = onDelete
        
        _sets = State(initialValue: exercise.targetSets)
        _reps = State(initialValue: exercise.targetReps)
        _weight = State(initialValue: exercise.targetWeight)
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Exercise Header
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(exercise.exerciseName)
                        .font(.headline)
                        .foregroundStyle(Color.textPrimary(for: colorScheme))
                    
                    if !exercise.muscles.isEmpty {
                        Text(exercise.muscles.joined(separator: ", "))
                            .font(.caption)
                            .foregroundStyle(Color.textSecondary(for: colorScheme))
                    }
                }
                
                Spacer()
                
                // Move buttons
                VStack(spacing: 4) {
                    Button(action: onMoveUp) {
                        Image(systemName: "chevron.up")
                            .font(.caption)
                            .foregroundColor(index > 0 ? Color.accentBlue : Color.gray)
                    }
                    .disabled(index == 0)
                    
                    Button(action: onMoveDown) {
                        Image(systemName: "chevron.down")
                            .font(.caption)
                            .foregroundColor(index < totalExercises - 1 ? Color.accentBlue : Color.gray)
                    }
                    .disabled(index == totalExercises - 1)
                }
            }
            
            // Input Fields
            HStack(spacing: 12) {
                // Sets
                VStack(alignment: .leading, spacing: 4) {
                    Text("Set")
                        .font(.caption)
                        .foregroundStyle(Color.textSecondary(for: colorScheme))
                    TextField("", value: $sets, format: .number)
                        .textFieldStyle(.roundedBorder)
                        .keyboardType(.numberPad)
                        .frame(width: 60)
                        .onChange(of: sets) { _, newValue in
                            exercise.targetSets = newValue
                            onUpdate(exercise)
                        }
                }
                
                // Reps
                VStack(alignment: .leading, spacing: 4) {
                    Text("Reps")
                        .font(.caption)
                        .foregroundStyle(Color.textSecondary(for: colorScheme))
                    TextField("", text: $reps)
                        .textFieldStyle(.roundedBorder)
                        .frame(width: 80)
                        .onChange(of: reps) { _, newValue in
                            exercise.targetReps = newValue
                            onUpdate(exercise)
                        }
                }
                
                // Weight
                VStack(alignment: .leading, spacing: 4) {
                    Text("Kg")
                        .font(.caption)
                        .foregroundStyle(Color.textSecondary(for: colorScheme))
                    TextField("", value: $weight, format: .number)
                        .textFieldStyle(.roundedBorder)
                        .keyboardType(.decimalPad)
                        .frame(width: 70)
                        .onChange(of: weight) { _, newValue in
                            exercise.targetWeight = newValue
                            onUpdate(exercise)
                        }
                }
                
                Spacer()
                
                // Delete button
                Button(action: onDelete) {
                    Image(systemName: "trash")
                        .foregroundColor(.red)
                        .frame(width: 44, height: 44)
                }
            }
        }
        .padding()
        .background(Color.cardBackground(for: colorScheme))
        .cornerRadius(12)
    }
}

struct AddExerciseView: View {
    let templateId: UUID
    let onExerciseAdded: (ProgramTemplateExercise) -> Void
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var modelContext
    @Environment(\.colorScheme) private var colorScheme
    
    @Query private var exerciseCatalog: [ExerciseCatalog]
    @State private var searchText = ""
    @State private var selectedExercise: ExerciseCatalog?
    @State private var sets = 3
    @State private var reps = "8-12"
    @State private var weight: Double? = nil
    
    private var filteredExercises: [ExerciseCatalog] {
        if searchText.isEmpty {
            return Array(exerciseCatalog.prefix(20))
        }
        return exerciseCatalog.filter { $0.name.localizedCaseInsensitiveContains(searchText) }
            .prefix(20)
            .map { $0 }
    }
    
    var body: some View {
        NavigationView {
            VStack {
                if selectedExercise == nil {
                    // Exercise selection
                    VStack(spacing: 16) {
                        TextField("Sök övning", text: $searchText)
                            .textFieldStyle(.roundedBorder)
                            .padding()
                        
                        List(filteredExercises) { exercise in
                            Button(action: {
                                selectedExercise = exercise
                            }) {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(exercise.name)
                                        .font(.headline)
                                        .foregroundStyle(Color.textPrimary(for: colorScheme))
                                    Text(exercise.category)
                                        .font(.caption)
                                        .foregroundStyle(Color.textSecondary(for: colorScheme))
                                }
                            }
                        }
                    }
                } else {
                    // Exercise configuration
                    VStack(spacing: 20) {
                        Text(selectedExercise!.name)
                            .font(.title2)
                            .fontWeight(.bold)
                            .padding()
                        
                        VStack(spacing: 16) {
                            Stepper("Set: \(sets)", value: $sets, in: 1...10)
                            TextField("Reps (t.ex. 8-12)", text: $reps)
                                .textFieldStyle(.roundedBorder)
                            TextField("Vikt (kg)", value: $weight, format: .number)
                                .textFieldStyle(.roundedBorder)
                                .keyboardType(.decimalPad)
                        }
                        .padding()
                        
                        Button("Lägg till") {
                            let exerciseKey = selectedExercise!.id
                            let allMuscles = selectedExercise!.primaryMuscles + selectedExercise!.secondaryMuscles
                            let newExercise = ProgramTemplateExercise(
                                templateId: templateId,
                                exerciseKey: exerciseKey,
                                exerciseName: selectedExercise!.name,
                                orderIndex: 0, // Will be updated
                                targetSets: sets,
                                targetReps: reps,
                                targetWeight: weight,
                                requiredEquipment: selectedExercise!.requiredEquipment,
                                muscles: allMuscles
                            )
                            onExerciseAdded(newExercise)
                        }
                        .buttonStyle(.borderedProminent)
                        .padding()
                    }
                }
            }
            .navigationTitle("Lägg till övning")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    if selectedExercise != nil {
                        Button("Tillbaka") {
                            selectedExercise = nil
                        }
                    } else {
                        Button("Avbryt") {
                            dismiss()
                        }
                    }
                }
            }
        }
    }
}



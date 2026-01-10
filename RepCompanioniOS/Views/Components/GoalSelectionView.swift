import SwiftUI

// Enum for goal types
enum GoalType {
    case strength, volume, endurance, cardio
}

struct GoalSelectionView: View {
    @Binding var goalStrength: Int
    @Binding var goalVolume: Int
    @Binding var goalEndurance: Int
    @Binding var goalCardio: Int
    let colorScheme: ColorScheme
    let selectedTheme: String
    
    var body: some View {
        VStack(spacing: 24) {
            Text("Träningsmål")
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(Color.textPrimary(for: colorScheme))
                .multilineTextAlignment(.center)
            
            Text("Fördela 100% mellan dina träningsmål")
                .font(.subheadline)
                .foregroundColor(Color.textSecondary(for: colorScheme))
                .multilineTextAlignment(.center)
            
            VStack(spacing: 20) {
                GoalSlider(
                    title: "Styrka",
                    value: Binding(
                        get: { goalStrength },
                        set: { newValue in
                            adjustGoals(changed: .strength, to: newValue)
                        }
                    ),
                    colorScheme: colorScheme,
                    selectedTheme: selectedTheme
                )
                
                GoalSlider(
                    title: "Volym",
                    value: Binding(
                        get: { goalVolume },
                        set: { newValue in
                            adjustGoals(changed: .volume, to: newValue)
                        }
                    ),
                    colorScheme: colorScheme,
                    selectedTheme: selectedTheme
                )
                
                GoalSlider(
                    title: "Uthållighet",
                    value: Binding(
                        get: { goalEndurance },
                        set: { newValue in
                            adjustGoals(changed: .endurance, to: newValue)
                        }
                    ),
                    colorScheme: colorScheme,
                    selectedTheme: selectedTheme
                )
                
                GoalSlider(
                    title: "Kondition",
                    value: Binding(
                        get: { goalCardio },
                        set: { newValue in
                            adjustGoals(changed: .cardio, to: newValue)
                        }
                    ),
                    colorScheme: colorScheme,
                    selectedTheme: selectedTheme
                )
            }
            
            Text("Totalt: \(goalStrength + goalVolume + goalEndurance + goalCardio)%")
                .font(.caption)
                .foregroundColor(
                    goalStrength + goalVolume + goalEndurance + goalCardio == 100
                        ? Color.green
                        : Color.red
                )
        }
    }
    
    // Logic extracted from OnboardingView
    private func adjustGoals(changed: GoalType, to newValue: Int) {
        // Clamp the new value to valid range
        let clampedNewValue = max(0, min(100, newValue))
        
        // Get the old value of the changed goal
        let oldValue: Int
        switch changed {
        case .strength: oldValue = goalStrength
        case .volume: oldValue = goalVolume
        case .endurance: oldValue = goalEndurance
        case .cardio: oldValue = goalCardio
        }
        
        // Calculate the difference (delta)
        let delta = clampedNewValue - oldValue
        
        // If no change, return early
        guard delta != 0 else { return }
        
        // Update the changed goal first
        switch changed {
        case .strength: goalStrength = clampedNewValue
        case .volume: goalVolume = clampedNewValue
        case .endurance: goalEndurance = clampedNewValue
        case .cardio: goalCardio = clampedNewValue
        }
        
        // Get current values of other goals
        let otherGoals: [(GoalType, Int)] = [
            (.strength, goalStrength),
            (.volume, goalVolume),
            (.endurance, goalEndurance),
            (.cardio, goalCardio)
        ].filter { $0.0 != changed }
        
        // Calculate total of other goals
        let otherTotal = otherGoals.map { $0.1 }.reduce(0, +)
        let targetTotal = 100 - clampedNewValue
        
        // If other goals need to be adjusted
        if otherTotal != targetTotal {
            let adjustmentNeeded = targetTotal - otherTotal
            
            if otherTotal == 0 {
                // If all other goals are 0, distribute equally
                let equalShare = targetTotal / otherGoals.count
                let remainder = targetTotal % otherGoals.count
                
                for (index, (goal, _)) in otherGoals.enumerated() {
                    let value = equalShare + (index < remainder ? 1 : 0)
                    switch goal {
                    case .strength: goalStrength = value
                    case .volume: goalVolume = value
                    case .endurance: goalEndurance = value
                    case .cardio: goalCardio = value
                    }
                }
            } else {
                // Distribute the adjustment proportionally
                var adjustments: [Int] = []
                var totalAdjustment = 0
                
                // Calculate proportional adjustments
                for (_, currentValue) in otherGoals {
                    let proportion = Double(currentValue) / Double(otherTotal)
                    let adjustment = Int(round(proportion * Double(adjustmentNeeded)))
                    adjustments.append(adjustment)
                    totalAdjustment += adjustment
                }
                
                // Handle rounding errors
                let roundingError = adjustmentNeeded - totalAdjustment
                if roundingError != 0 && !adjustments.isEmpty {
                    adjustments[0] += roundingError
                }
                
                // Apply adjustments
                for (index, (goal, _)) in otherGoals.enumerated() {
                    let newValue = otherGoals[index].1 + adjustments[index]
                    switch goal {
                    case .strength: goalStrength = newValue
                    case .volume: goalVolume = newValue
                    case .endurance: goalEndurance = newValue
                    case .cardio: goalCardio = newValue
                    }
                }
            }
        }
    }
}

struct GoalSlider: View {
    let title: String
    @Binding var value: Int
    let colorScheme: ColorScheme
    var selectedTheme: String = "Main" // Default value to support extraction
    
    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack {
                Text(title)
                    .font(.headline)
                    .foregroundColor(Color.textPrimary(for: colorScheme))
                Spacer()
                Text("\(value)%")
                    .font(.body)
                    .fontWeight(.bold)
                    .foregroundColor(Color.textPrimary(for: colorScheme))
            }
            
            Slider(value: Binding(
                get: { Double(value) },
                set: { value = Int($0) }
            ), in: 0...100, step: 1)
            // Using a simple tint for now or pass selectedTheme if needed.
            // OnboardingView used Color.themePrimaryColor which depends on selectedTheme.
            // Let's add selectedTheme to this struct as well.
            .tint(Color.themePrimaryColor(theme: selectedTheme, colorScheme: colorScheme))
        }
    }
}

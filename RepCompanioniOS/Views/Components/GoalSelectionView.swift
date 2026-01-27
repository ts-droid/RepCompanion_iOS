import SwiftUI

// Enum for goal types
enum GoalType {
    case strength, hypertrophy, endurance, cardio
}

struct GoalSelectionView: View {
    @Binding var goalStrength: Int
    @Binding var goalHypertrophy: Int
    @Binding var goalEndurance: Int
    @Binding var goalCardio: Int
    @Binding var focusTags: [String]
    let colorScheme: ColorScheme
    let selectedTheme: String
    
    var body: some View {
        VStack(spacing: 24) {
            Text(String(localized: "Training Goals"))
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(Color.textPrimary(for: colorScheme))
                .multilineTextAlignment(.center)
            
            Text(String(localized: "Distribute 100% between your training goals"))
                .font(.subheadline)
                .foregroundColor(Color.textSecondary(for: colorScheme))
                .multilineTextAlignment(.center)
            
            VStack(spacing: 20) {
                GoalSlider(
                    title: String(localized: "Strength"),
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
                    title: String(localized: "Hypertrophy"),
                    value: Binding(
                        get: { goalHypertrophy },
                        set: { newValue in
                            adjustGoals(changed: .hypertrophy, to: newValue)
                        }
                    ),
                    colorScheme: colorScheme,
                    selectedTheme: selectedTheme
                )
                
                GoalSlider(
                    title: String(localized: "Endurance"),
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
                    title: String(localized: "Cardio"),
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
            
            Text(String(localized: "Total: \(goalStrength + goalHypertrophy + goalEndurance + goalCardio)%"))
                .font(.caption)
                .foregroundColor(
                    goalStrength + goalHypertrophy + goalEndurance + goalCardio == 100
                        ? Color.green
                        : Color.red
                )
            
            Divider()
                .padding(.vertical, 8)
            
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text(String(localized: "Extra Focus"))
                        .font(.headline)
                        .foregroundColor(Color.textPrimary(for: colorScheme))
                    
                    Spacer()
                    
                    Text(String(localized: "\(focusTags.count)/3"))
                        .font(.caption)
                        .foregroundColor(Color.textSecondary(for: colorScheme))
                }
                
                Text(String(localized: "Tags that refine your programming (max 3)"))
                    .font(.caption)
                    .foregroundColor(Color.textSecondary(for: colorScheme))
                
                let tags = ["Explosiveness", "Technique", "Mobility", "Rehab/Recovery", "Conditioning/Metcon"]
                
                FocusFlowLayout(spacing: 8) {
                    ForEach(tags, id: \.self) { tag in
                        FocusTagChip(
                            title: LocalizationService.localizeFocusTag(tag),
                            isSelected: focusTags.contains(tag),
                            colorScheme: colorScheme,
                            selectedTheme: selectedTheme,
                            action: {
                                if focusTags.contains(tag) {
                                    focusTags.removeAll(where: { $0 == tag })
                                } else if focusTags.count < 3 {
                                    focusTags.append(tag)
                                }
                            }
                        )
                    }
                }
            }
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
        case .hypertrophy: oldValue = goalHypertrophy
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
        case .hypertrophy: goalHypertrophy = clampedNewValue
        case .endurance: goalEndurance = clampedNewValue
        case .cardio: goalCardio = clampedNewValue
        }
        
        // Get current values of other goals
        let otherGoals: [(GoalType, Int)] = [
            (.strength, goalStrength),
            (.hypertrophy, goalHypertrophy),
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
                    case .hypertrophy: goalHypertrophy = value
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
                    case .hypertrophy: goalHypertrophy = newValue
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

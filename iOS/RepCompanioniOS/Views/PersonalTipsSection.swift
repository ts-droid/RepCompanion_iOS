import SwiftUI
import SwiftData

/// Section for displaying personalized training tips
struct PersonalTipsSection: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.colorScheme) private var colorScheme
    
    @Query private var userProfiles: [UserProfile]
    @StateObject private var tipService = TrainingTipService.shared
    
    private var currentProfile: UserProfile? {
        userProfiles.first
    }
    
    private var tips: [ProfileTrainingTip] {
        guard let profile = currentProfile else { return [] }
        return tipService.getPersonalizedTips(
            for: profile,
            limit: 1,
            modelContext: modelContext
        )
    }
    
    private var currentTip: ProfileTrainingTip? {
        tips.first
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Image(systemName: "lightbulb")
                    .foregroundStyle(Color.textSecondary(for: colorScheme))
                Text(String(localized: "Personal tips"))
                    .font(.title3)
                    .fontWeight(.bold)
                    .foregroundStyle(Color.textPrimary(for: colorScheme))
            }
            .padding(.horizontal)
            
            Text(String(localized: "Personalized advice for your training"))
                .font(.subheadline)
                .foregroundStyle(Color.textSecondary(for: colorScheme))
                .padding(.horizontal)
            
            if let tip = currentTip {
                TipCard(
                    icon: getIcon(for: tip.category),
                    iconColor: getColor(for: tip.category),
                    title: String(localized: String.LocalizationValue(tip.category.capitalized)),
                    content: tip.tipText,
                    colorScheme: colorScheme,
                    affiliateLink: tip.affiliateLink
                )
            } else {
                // Fallback to default tip if no personalized tips available
                DefaultTipView(colorScheme: colorScheme)
            }
        }
    }
    
    private func getIcon(for category: String) -> String {
        switch category.lowercased() {
        case "nutrition", "kost": return "apple.logo"
        case "recovery", "recovery": return "moon.fill"
        case "cardio", "kondition": return "figure.run"
        case "periodization", "periodisering": return "calendar"
        case "mixed_training", "mixed training": return "figure.strengthtraining.traditional"
        case "strength", "styrka", "build_muscle", "bygga_muskler": return "figure.strengthtraining.traditional"
        case "volume", "volym": return "scalemass.fill"
        case "lose_weight", "weight_loss", "viktminskning": return "percent"
        case "rehabilitation", "rehab", "rehabilitering": return "bandage.fill"
        case "mobility", "mobilitet", "become_more_flexible": return "figure.flexibility"
        default: return "lightbulb.fill"
        }
    }
    
    private func getColor(for category: String) -> Color {
        switch category.lowercased() {
        case "nutrition", "kost": return .nutritionGreen
        case "recovery", "recovery": return .recoveryPurple
        case "cardio", "kondition": return .red
        case "periodization", "periodisering": return .blue
        case "mixed_training", "mixed training": return .accentBlue
        case "strength", "styrka", "build_muscle", "bygga_muskler", "volume", "volym": return .orange
        case "lose_weight", "weight_loss", "viktminskning": return .green
        case "rehabilitation", "rehab", "rehabilitering": return .teal
        case "mobility", "mobilitet", "become_more_flexible": return .purple
        default: return .accentBlue
        }
    }
}

struct DefaultTipView: View {
    let colorScheme: ColorScheme
    
    var body: some View {
        TipCard(
            icon: "apple.logo",
            iconColor: .nutritionGreen,
            title: String(localized: "Nutrition"),
            content: String(localized: "Calorie intake matters for progression. If you strive for muscle building, a small calorie surplus is needed (200-300 kcal/day)."),
            colorScheme: colorScheme
        )
    }
}


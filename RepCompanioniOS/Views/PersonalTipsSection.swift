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
                Text("Personliga tips")
                    .font(.title3)
                    .fontWeight(.bold)
                    .foregroundStyle(Color.textPrimary(for: colorScheme))
            }
            .padding(.horizontal)
            
            Text("Anpassade råd för din träning")
                .font(.subheadline)
                .foregroundStyle(Color.textSecondary(for: colorScheme))
                .padding(.horizontal)
            
            if let tip = currentTip {
                TipCard(
                    icon: getIcon(for: tip.category),
                    iconColor: getColor(for: tip.category),
                    title: tip.category.capitalized,
                    content: tip.tipText,
                    colorScheme: colorScheme
                )
            } else {
                // Fallback to default tip if no personalized tips available
                DefaultTipView(colorScheme: colorScheme)
            }
        }
    }
    
    private func getIcon(for category: String) -> String {
        switch category.lowercased() {
        case "kost", "nutrition": return "apple.logo"
        case "återhämtning", "recovery": return "moon.fill"
        case "kondition", "cardio": return "figure.run"
        case "periodisering": return "calendar"
        case "blandad träning": return "figure.strengthtraining.traditional"
        case "styrka", "bygga_muskler": return "figure.strengthtraining.traditional"
        case "volym": return "scalemass.fill"
        case "viktminskning": return "percent"
        case "rehab", "rehabilitering": return "bandage.fill"
        case "mobilitet", "bli_rörligare": return "figure.flexibility"
        default: return "lightbulb.fill"
        }
    }
    
    private func getColor(for category: String) -> Color {
        switch category.lowercased() {
        case "kost", "nutrition": return .nutritionGreen
        case "återhämtning", "recovery": return .recoveryPurple
        case "kondition", "cardio": return .red
        case "periodisering": return .blue
        case "blandad träning": return .accentBlue
        case "styrka", "bygga_muskler", "volym": return .orange
        case "viktminskning": return .green
        case "rehab", "rehabilitering": return .teal
        case "mobilitet", "bli_rörligare": return .purple
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
            title: "Näring",
            content: "Kaloriintag spelar roll för progressionen. Om du strävar efter muskelökning, behövs ett litet kaloriöverskott (200-300 kcal/dag).",
            colorScheme: colorScheme
        )
    }
}


import SwiftUI
import SwiftData

struct GymRow: View {
    let gym: Gym
    let isSelected: Bool
    let colorScheme: ColorScheme
    let selectedTheme: String
    
    var body: some View {
        HStack(spacing: 12) {
            // Icon Container
            ZStack {
                Circle()
                    .fill(gym.isVerified ? Color.themePrimaryColor(theme: selectedTheme, colorScheme: colorScheme).opacity(0.1) : Color.gray.opacity(0.1))
                    .frame(width: 40, height: 40)
                
                Image(systemName: gym.isVerified ? "checkmark.seal.fill" : "building.2.fill")
                    .foregroundColor(gym.isVerified ? Color.themePrimaryColor(theme: selectedTheme, colorScheme: colorScheme) : .gray)
            }
            
            VStack(alignment: .leading, spacing: 2) {
                Text(gym.name)
                    .font(.subheadline)
                    .fontWeight(.bold)
                    .foregroundColor(Color.textPrimary(for: colorScheme))
                
                if let location = gym.location, !location.isEmpty {
                    Text(location)
                        .font(.caption2)
                        .foregroundColor(.gray)
                        .lineLimit(1)
                }
                
                HStack(spacing: 4) {
                    if gym.isVerified {
                        Text(String(localized: "Equipment verified"))
                            .font(.system(size: 8, weight: .bold))
                            .foregroundColor(Color.themePrimaryColor(theme: selectedTheme, colorScheme: colorScheme))
                            .padding(.horizontal, 4)
                            .padding(.vertical, 2)
                            .background(Color.themePrimaryColor(theme: selectedTheme, colorScheme: colorScheme).opacity(0.1))
                            .cornerRadius(4)
                    }
                    
                    Text("\(gym.equipmentIds.count) utrustning")
                        .font(.system(size: 8, weight: .bold))
                        .foregroundColor(.gray)
                        .padding(.horizontal, 4)
                        .padding(.vertical, 2)
                        .background(Color.gray.opacity(0.1))
                        .cornerRadius(4)
                }
                .padding(.top, 2)
            }
            
            Spacer()
            
            if isSelected {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundColor(Color.themePrimaryColor(theme: selectedTheme, colorScheme: colorScheme))
                    .font(.title3)
            } else {
                Image(systemName: "chevron.right")
                    .font(.caption2)
                    .foregroundColor(.gray.opacity(0.5))
            }
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.cardBackground(for: colorScheme))
                .shadow(color: Color.black.opacity(0.03), radius: 2, x: 0, y: 1)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(isSelected ? Color.themePrimaryColor(theme: selectedTheme, colorScheme: colorScheme) : Color.clear, lineWidth: 2)
        )
    }
}

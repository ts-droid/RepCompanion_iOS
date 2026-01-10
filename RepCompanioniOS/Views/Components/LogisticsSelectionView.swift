import SwiftUI

struct LogisticsSelectionView: View {
    @Binding var sessionsPerWeek: Int
    @Binding var sessionDuration: Int
    let colorScheme: ColorScheme
    let selectedTheme: String
    
    var body: some View {
        VStack(spacing: 24) {
            Text("Träningsfrekvens")
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(Color.textPrimary(for: colorScheme))
                .multilineTextAlignment(.center)
            
            VStack(spacing: 24) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Pass per vecka: \(sessionsPerWeek)")
                        .font(.headline)
                        .foregroundColor(Color.textPrimary(for: colorScheme))
                    Slider(value: Binding(
                        get: { Double(sessionsPerWeek) },
                        set: { sessionsPerWeek = Int($0) }
                    ), in: 1...7, step: 1)
                    .tint(Color.themePrimaryColor(theme: selectedTheme, colorScheme: colorScheme))
                }
                
                VStack(alignment: .leading, spacing: 8) {
                    Text("Passlängd: \(sessionDuration) minuter")
                        .font(.headline)
                        .foregroundColor(Color.textPrimary(for: colorScheme))
                    Slider(value: Binding(
                        get: { Double(sessionDuration) },
                        set: { sessionDuration = Int($0) }
                    ), in: 30...180, step: 15)
                    .tint(Color.themePrimaryColor(theme: selectedTheme, colorScheme: colorScheme))
                }
            }
        }
    }
}

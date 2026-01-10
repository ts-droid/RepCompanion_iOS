import SwiftUI

struct CTACard: View {
    let title: String
    let subtitle: String
    let icon: String
    let color: Color
    var isLoading: Bool = false
    let colorScheme: ColorScheme
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.title3)
                    .foregroundColor(color)
                    .frame(width: 32, height: 32)
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.headline)
                        .fontWeight(.bold)
                        .foregroundColor(Color.textPrimary(for: colorScheme))
                    
                    Text(subtitle)
                        .font(.caption)
                        .foregroundColor(Color.textSecondary(for: colorScheme))
                        .multilineTextAlignment(.leading)
                }
                
                Spacer()
                
                if isLoading {
                    ProgressView()
                        .scaleEffect(0.7)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.cardBackground(for: colorScheme))
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(color, lineWidth: 1)
            )
        }
        .disabled(isLoading)
        .padding(.horizontal)
    }
}

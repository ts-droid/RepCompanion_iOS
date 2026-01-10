import SwiftUI

struct HealthAuthViewWatch: View {
    @Environment(\.dismiss) private var dismiss
    var onDismiss: () -> Void
    
    var body: some View {
        ZStack {
            // Background Glow
            Circle()
                .fill(Color.green.opacity(0.15))
                .frame(width: 120, height: 120)
                .blur(radius: 20)
                .offset(y: -20)
            
            VStack(spacing: 8) {
                // Close button (standard for many watch sheets)
                HStack {
                    Button(action: { dismiss() }) {
                        Image(systemName: "xmark.circle.fill")
                            .symbolRenderingMode(.hierarchical)
                            .foregroundStyle(.gray)
                            .font(.title3)
                    }
                    .buttonStyle(.plain)
                    Spacer()
                }
                .padding(.horizontal, 4)
                
                Image(systemName: "rectangle.portrait.and.arrow.forward")
                    .font(.system(size: 32, weight: .medium))
                    .foregroundColor(.green)
                    .padding(.top, -15)
                
                VStack(spacing: 2) {
                    Text("RepCompanion")
                        .font(.system(size: 14, weight: .bold))
                    
                    Text("Öppna RepCompanion på din telefon för att börja logga ditt pass.")
                        .font(.system(size: 9))
                        .multilineTextAlignment(.center)
                        .foregroundColor(.secondary)
                        .padding(.horizontal, 8)
                }
                
                Spacer()
                
                Button("Klar") {
                    onDismiss()
                }
                .buttonStyle(PrimaryButtonStyle(height: 44))
            }
            .frame(maxHeight: .infinity)
            .padding(.horizontal, 8)
            .padding(.bottom, 8)
            .ignoresSafeArea(edges: .bottom)
        }
    }
}

#Preview {
    HealthAuthViewWatch(onDismiss: {})
}

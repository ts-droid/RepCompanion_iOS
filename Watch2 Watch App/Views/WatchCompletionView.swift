import SwiftUI

/// Workout completion celebration view for Watch
struct WatchCompletionView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var animationScale: CGFloat = 0.5
    @State private var showCheckmark = false
    
    var body: some View {
        VStack(spacing: 8) {
            // Trophy animation
            ZStack {
                Circle()
                    .fill(Color.green.opacity(0.2))
                    .frame(width: 80, height: 80)
                    .scaleEffect(animationScale)
                
                Image(systemName: showCheckmark ? "checkmark.circle.fill" : "trophy.fill")
                    .font(.system(size: 40))
                    .foregroundColor(.green)
                    .scaleEffect(animationScale)
            }
            
            Text("Pass klart!")
                .font(.headline)
                .foregroundColor(.white)
            
            Text("Bra jobbat! 💪")
                .font(.caption)
                .foregroundColor(.gray)
            
            Spacer()
            
            Button(action: { dismiss() }) {
                Text("Klar")
            }
            .buttonStyle(PrimaryButtonStyle())
        }
        .frame(maxHeight: .infinity)
        .padding(.horizontal, 8)
        .padding(.bottom, 8)
        .ignoresSafeArea(edges: .bottom)
        .onAppear {
            withAnimation(.spring(response: 0.5, dampingFraction: 0.6)) {
                animationScale = 1.0
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
                withAnimation {
                    showCheckmark = true
                }
            }
            // Haptic feedback
            WKInterfaceDevice.current().play(.success)
        }
    }
}

#Preview {
    WatchCompletionView()
}

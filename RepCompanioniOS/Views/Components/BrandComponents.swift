import SwiftUI

struct BrandBackground: View {
    @Environment(\.colorScheme) private var colorScheme
    
    var body: some View {
        ZStack {
            // Main gradient background
            LinearGradient(
                gradient: Gradient(colors: [
                    Color(hex: "E0F7FA"), // Light cyan
                    Color(hex: "FFFFFF"), // White
                    Color(hex: "F1F8E9")  // Very light green
                ]),
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()
            
            // Decorative shapes (matching the uploaded design)
            GeometryReader { geo in
                // Top left circles
                Circle()
                    .fill(Color(hex: "4DB6AC").opacity(0.15))
                    .frame(width: 300, height: 300)
                    .offset(x: -100, y: -100)
                    .blur(radius: 40)
                
                Circle()
                    .fill(Color(hex: "81C784").opacity(0.1))
                    .frame(width: 200, height: 200)
                    .offset(x: 50, y: -50)
                    .blur(radius: 30)
                
                // Bottom right circles
                Circle()
                    .fill(Color(hex: "26A69A").opacity(0.12))
                    .frame(width: 350, height: 350)
                    .offset(x: geo.size.width - 200, y: geo.size.height - 200)
                    .blur(radius: 50)
                
                Circle()
                    .fill(Color(hex: "66BB6A").opacity(0.08))
                    .frame(width: 250, height: 250)
                    .offset(x: geo.size.width - 300, y: geo.size.height - 100)
                    .blur(radius: 40)
                    
                // Floating subtle icons (dumbbell, heart) - optional polish
                Image(systemName: "dumbbell.fill")
                    .font(.system(size: 80))
                    .foregroundColor(Color(hex: "26A69A").opacity(0.04))
                    .rotationEffect(.degrees(-30))
                    .offset(x: 40, y: geo.size.height - 150)
                
                Image(systemName: "heart.fill")
                    .font(.system(size: 60))
                    .foregroundColor(Color(hex: "66BB6A").opacity(0.03))
                    .offset(x: geo.size.width - 80, y: 150)
            }
        }
    }
}

struct BrandLogo: View {
    var size: CGFloat = 120
    
    var body: some View {
        VStack(spacing: 8) {
            ZStack {
                // Outer glow
                Circle()
                    .fill(
                        RadialGradient(
                            gradient: Gradient(colors: [Color(hex: "26A69A").opacity(0.2), .clear]),
                            center: .center,
                            startRadius: 0,
                            endRadius: size / 1.5
                        )
                    )
                    .frame(width: size * 1.5, height: size * 1.5)
                
                // Redesigned modern logo based on provided image
                // Represents a person with a dumbbell/barbell as an "R" or abstract flow
                ZStack {
                    // Barbells
                    HStack(spacing: 4) {
                        Capsule()
                            .fill(LinearGradient(colors: [Color(hex: "2E7D32"), Color(hex: "4CAF50")], startPoint: .top, endPoint: .bottom))
                            .frame(width: size/10, height: size/3)
                        
                        Capsule()
                            .fill(LinearGradient(colors: [Color(hex: "2E7D32"), Color(hex: "4CAF50")], startPoint: .top, endPoint: .bottom))
                            .frame(width: size/10, height: size/4)
                    }
                    .offset(x: -size/4)
                    
                    // Human figure / R curve
                    Path { path in
                        path.move(to: CGPoint(x: size/2.5, y: size/3))
                        path.addCurve(
                            to: CGPoint(x: size/1.2, y: size/1.5),
                            control1: CGPoint(x: size/1.5, y: -size/10),
                            control2: CGPoint(x: size * 1.1, y: size/2)
                        )
                    }
                    .stroke(
                        LinearGradient(colors: [Color(hex: "0277BD"), Color(hex: "03A9F4")], startPoint: .leading, endPoint: .trailing),
                        style: StrokeStyle(lineWidth: size/8, lineCap: .round)
                    )
                    
                    // Human head
                    Circle()
                        .fill(Color(hex: "0288D1"))
                        .frame(width: size/4, height: size/4)
                        .offset(x: size/5, y: -size/3.5)
                }
                .frame(width: size, height: size)
                .shadow(color: Color.black.opacity(0.1), radius: 10, x: 0, y: 5)
            }
            
            HStack(spacing: 0) {
                Text("Rep")
                    .font(.system(size: size/3, weight: .bold, design: .rounded))
                    .foregroundColor(Color(hex: "1A237E")) // Deep Navy
                Text("Companion")
                    .font(.system(size: size/3, weight: .bold, design: .rounded))
                    .foregroundColor(Color(hex: "43A047")) // Green
            }
            .padding(.top, 8)
        }
    }
}

#Preview {
    ZStack {
        BrandBackground()
        BrandLogo()
    }
}

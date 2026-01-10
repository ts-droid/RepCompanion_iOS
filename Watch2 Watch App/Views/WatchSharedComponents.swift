import SwiftUI

/// A compact card container for watchOS UI elements
struct CompactCard<Content: View>: View {
    let padding: CGFloat
    let cornerRadius: CGFloat
    let content: Content
    
    init(padding: CGFloat = 10, cornerRadius: CGFloat = 18, @ViewBuilder content: () -> Content) {
        self.padding = padding
        self.cornerRadius = cornerRadius
        self.content = content()
    }
    
    var body: some View {
        content
            .padding(padding)
            .frame(maxWidth: .infinity)
            .background(
                ZStack {
                    RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                        .fill(Color.white.opacity(0.06))
                    
                    // Liquid Glass Rim Highlight
                    RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                        .stroke(
                            LinearGradient(
                                colors: [.white.opacity(0.15), .clear, .white.opacity(0.05)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            lineWidth: 0.5
                        )
                }
            )
            .shadow(color: .black.opacity(0.2), radius: 2, x: 0, y: 1)
    }
}

/// A stylized wheel picker inside a capsule for watchOS
struct CapsuleWheelPicker<Value: Hashable>: View {
    let values: [Value]
    @Binding var selection: Value
    let text: (Value) -> String
    var stroke: Color
    var font: Font = .title3.weight(.semibold)

    var body: some View {
        ZStack {
            Capsule(style: .continuous)
                .fill(Color.white.opacity(0.06))
                .overlay(
                    Capsule(style: .continuous)
                        .stroke(stroke.opacity(0.9), lineWidth: 1.5)
                )

            Picker("", selection: $selection) {
                ForEach(values, id: \.self) { v in
                    Text(text(v))
                        .font(font)
                        .monospacedDigit()
                        .tag(v)
                }
            }
            .labelsHidden()
            .pickerStyle(.wheel)
            .clipShape(Capsule(style: .continuous))
        }
    }
}

extension View {
    func headerStyle(color: Color = .green) -> some View {
        self.font(.system(size: 18, weight: .heavy, design: .rounded))
            .foregroundStyle(color)
            .lineLimit(1)
    }
    
    func cardStyle(cornerRadius: CGFloat = 18) -> some View {
        self.background(
            ZStack {
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .fill(Color.white.opacity(0.06))
                
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .stroke(
                        LinearGradient(
                            colors: [.white.opacity(0.15), .clear, .white.opacity(0.05)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 0.5
                    )
            }
        )
        .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
    }
}

/// Standard primary button style for Watch (Green/Black)
struct PrimaryButtonStyle: ButtonStyle {
    var height: CGFloat = 44
    var isEnabled: Bool = true
    
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline.weight(.bold))
            .frame(maxWidth: .infinity)
            .frame(height: height)
            .background(Color.green)
            .clipShape(Capsule())
            .foregroundColor(.black)
            .padding(.horizontal, 16) // Narrower button
            .opacity(configuration.isPressed ? 0.8 : (isEnabled ? 1.0 : 0.5))
            .scaleEffect(configuration.isPressed ? 0.96 : 1.0)
    }
}

/// Standard secondary button style for Watch (Blue/White, Orange/Black, etc.)
struct SecondaryButtonStyle: ButtonStyle {
    var color: Color = .blue
    var textColor: Color = .white
    var height: CGFloat = 44
    
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline.weight(.bold))
            .frame(maxWidth: .infinity)
            .frame(height: height)
            .background(color)
            .clipShape(Capsule())
            .foregroundColor(textColor)
            .padding(.horizontal, 16) // Narrower button
            .opacity(configuration.isPressed ? 0.8 : 1.0)
            .scaleEffect(configuration.isPressed ? 0.96 : 1.0)
    }
}

/// A subtle bordered button style
struct SubtleButtonStyle: ButtonStyle {
    var height: CGFloat = 44
    
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline.weight(.bold))
            .frame(maxWidth: .infinity)
            .frame(height: height)
            .background(Color.white.opacity(0.15))
            .clipShape(Capsule())
            .foregroundColor(.white)
            .padding(.horizontal, 16) // Narrower button
            .opacity(configuration.isPressed ? 0.7 : 1.0)
    }
}

struct ScrollingText: View {
    let text: String
    let color: Color
    
    @State private var offset: CGFloat = 0
    @State private var textWidth: CGFloat = 0
    @State private var containerWidth: CGFloat = 0
    
    private var isScrolling: Bool {
        textWidth > containerWidth
    }
    
    var body: some View {
        GeometryReader { geometry in
            ZStack {
                Text(text)
                    .headerStyle(color: color)
                    .background(GeometryReader { textGeometry in
                        Color.clear.onAppear {
                            textWidth = textGeometry.size.width
                            containerWidth = geometry.size.width
                        }
                        .onChange(of: text) { _, _ in
                            textWidth = textGeometry.size.width
                        }
                    })
                    .fixedSize(horizontal: true, vertical: false)
                    .offset(x: offset)
                    .frame(maxWidth: .infinity, alignment: isScrolling ? .leading : .center)
            }
            .frame(width: geometry.size.width, height: geometry.size.height)
            .onAppear {
                containerWidth = geometry.size.width
                startAnimation()
            }
            .onChange(of: text) { _, _ in
                // Reset and restart animation if text changes
                offset = 0
                startAnimation()
            }
        }
        .frame(height: 32) // Reduced to fit absolute baseline
        .clipped()
    }
    
    private func startAnimation() {
        // Only animate if text is longer than container
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            guard isScrolling else { 
                offset = 0
                return 
            }
            
            let totalDistance = textWidth + 40 // More space before restart
            let duration = Double(totalDistance) / 25.0 // Constant speed
            
            withAnimation(.linear(duration: duration).repeatForever(autoreverses: false)) {
                offset = -totalDistance
            }
        }
    }
}

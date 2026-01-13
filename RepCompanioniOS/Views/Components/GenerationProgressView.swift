import SwiftUI

struct GenerationProgressView: View {
    let progress: Int
    let status: String
    let iconName: String // Kept for compatibility but not used
    let onDismiss: () -> Void
    
    @State private var stepIndex = 0
    @State private var showTimeoutMessage = false
    @State private var animateIcon = false
    @State private var animateSparkles = false
    
    private let buildingSteps: [(text: LocalizedStringKey, icon: String)] = [
        (text: "Analyzing your goals...", icon: "target"),
        (text: "Choosing exercises...", icon: "dumbbell.fill"),
        (text: "Optimizing schedule...", icon: "calendar"),
        (text: "Building your workout program...", icon: "sparkles")
    ]
    
    var body: some View {
        ZStack {
            Color.black.opacity(0.7)
                .ignoresSafeArea()
            
            VStack(spacing: 32) {
                // Icon with animation
                ZStack {
                    // Pulsing background circle
                    Circle()
                        .fill(Color.white.opacity(0.1))
                        .frame(width: 80, height: 80)
                        .scaleEffect(animateIcon ? 1.2 : 1.0)
                        .opacity(animateIcon ? 0.3 : 0.5)
                        .animation(
                            Animation.easeInOut(duration: 1.5)
                                .repeatForever(autoreverses: true),
                            value: animateIcon
                        )
                    
                    // Main icon
                    Image(systemName: currentStep.icon)
                        .font(.system(size: 40))
                        .foregroundColor(.white)
                        .scaleEffect(animateIcon ? 1.1 : 1.0)
                        .animation(
                            Animation.easeInOut(duration: 1.0)
                                .repeatForever(autoreverses: true),
                            value: animateIcon
                        )
                    
                    // Sparkles icon rotating
                    Image(systemName: "sparkles")
                        .font(.system(size: 24))
                        .foregroundColor(.white.opacity(0.8))
                        .offset(x: 35, y: -35)
                        .rotationEffect(.degrees(animateSparkles ? 360 : 0))
                        .animation(
                            Animation.linear(duration: 3.0)
                                .repeatForever(autoreverses: false),
                            value: animateSparkles
                        )
                }
                .onAppear {
                    animateIcon = true
                    animateSparkles = true
                }
                
                // Text content
                VStack(spacing: 16) {
                    Text(currentStep.text)
                        .font(.title3)
                        .fontWeight(.semibold)
                        .foregroundColor(.white)
                        .multilineTextAlignment(.center)
                        .animation(.easeInOut(duration: 0.3), value: stepIndex)
                    
                    if !showTimeoutMessage {
                        Text(String(localized: "This can take up to 2 minutes. Please be patient..."))
                            .font(.subheadline)
                            .foregroundColor(.white.opacity(0.8))
                            .multilineTextAlignment(.center)
                    } else {
                        VStack(spacing: 12) {
                            HStack(spacing: 8) {
                                Image(systemName: "clock.fill")
                                    .font(.system(size: 16))
                                Text(String(localized: "High traffic - taking a bit longer than usual"))
                                    .font(.subheadline)
                                    .fontWeight(.medium)
                            }
                            .foregroundColor(.orange)
                            .padding()
                            .background(Color.orange.opacity(0.1))
                            .cornerRadius(12)
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(Color.orange.opacity(0.3), lineWidth: 1)
                            )
                            
                            Text(String(localized: "Your training plan is still being generated. We appreciate your patience!"))
                                .font(.caption)
                                .foregroundColor(.white.opacity(0.7))
                                .multilineTextAlignment(.center)
                        }
                    }
                    
                    // Progress dots
                    HStack(spacing: 8) {
                        ForEach(0..<buildingSteps.count, id: \.self) { index in
                            Capsule()
                                .fill(index == stepIndex ? Color.white : Color.white.opacity(0.3))
                                .frame(width: index == stepIndex ? 24 : 8, height: 8)
                                .animation(.easeInOut(duration: 0.3), value: stepIndex)
                        }
                    }
                    .padding(.top, 8)
                }
                .padding(.horizontal, 32)
            }
            .padding()
        }
        .task {
            // Rotate through steps every 2 seconds
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 2_000_000_000) // 2 seconds
                withAnimation(.easeInOut(duration: 0.3)) {
                    stepIndex = (stepIndex + 1) % buildingSteps.count
                }
            }
        }
        .onAppear {
            // Show timeout message after 60 seconds
            Task {
                try? await Task.sleep(nanoseconds: 60_000_000_000) // 60 seconds
                await MainActor.run {
                    withAnimation {
                        showTimeoutMessage = true
                    }
                }
            }
        }
    }
    
    private var currentStep: (text: LocalizedStringKey, icon: String) {
        buildingSteps[stepIndex]
    }
}

struct TimeoutMessageView: View {
    let onDismiss: () -> Void
    @State private var animate = false
    
    var body: some View {
        ZStack {
            Color.black.opacity(0.7)
                .ignoresSafeArea()
            
            VStack(spacing: 16) {
                Text(String(localized: "High traffic right now..."))
                    .font(.headline)
                    .foregroundColor(.white)
                
                Text(String(localized: "High traffic... Program is generating, please wait. This can take up to 2 minutes."))
                    .font(.subheadline)
                    .foregroundColor(.white.opacity(0.9))
                    .multilineTextAlignment(.center)
                
                Button(action: onDismiss) {
                    Text(String(localized: "OK"))
                        .foregroundColor(.white)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 12)
                        .background(Color.primary)
                        .cornerRadius(12)
                }
            }
            .padding(24)
            .background(Color.secondary.opacity(0.9))
            .cornerRadius(16)
            .padding()
        }
        .onTapGesture {
            onDismiss()
        }
    }
}

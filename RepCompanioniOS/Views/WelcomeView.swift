import SwiftUI

struct WelcomeView: View {
    @Environment(\.colorScheme) private var colorScheme
    @AppStorage("welcomeAccepted") private var welcomeAccepted = false
    @State private var hasConsented = false
    @State private var showFullLegal = false
    
    var body: some View {
        ZStack {
            BrandBackground()
            
            VStack(spacing: 0) {
                ScrollView(showsIndicators: false) {
                    VStack(spacing: 24) {
                        // Header
                        Image("AppLogo")
                            .resizable()
                            .scaledToFit()
                            .frame(width: 140, height: 140)
                            .shadow(color: Color.black.opacity(0.1), radius: 10, x: 0, y: 5)
                            .padding(.top, 40)
                        
                        VStack(spacing: 12) {
                            Text("Maximize your workout!")
                                .font(.system(size: 28, weight: .bold, design: .rounded))
                                .foregroundColor(Color(hex: "1A237E"))
                            
                            Text("RepCompanion is a simple and smart tool that helps you put together a training setup that fits your goals and daily life.")
                                .font(.body)
                                .multilineTextAlignment(.center)
                                .foregroundColor(Color(hex: "546E7A"))
                                .padding(.horizontal, 32)
                        }
                        
                        // Feature Cards
                        VStack(spacing: 16) {
                            FeatureCard(
                                icon: "list.clipboard.fill",
                                iconBg: Color(hex: "E0F2F1"),
                                iconColor: Color(hex: "00897B"),
                                title: "Personal training programs",
                                subtitle: "Customize your schedule based on your goals and needs."
                            )
                            
                            FeatureCard(
                                icon: "lightbulb.fill",
                                iconBg: Color(hex: "FFF9C4"),
                                iconColor: Color(hex: "FBC02D"),
                                title: "Tips & advice along the way",
                                subtitle: "Get expert tips and motivation to keep you on track."
                            )
                            
                            FeatureCard(
                                icon: "bag.fill",
                                iconBg: Color(hex: "E1F5FE"),
                                iconColor: Color(hex: "0288D1"),
                                title: "Exklusiva erbjudanden",
                                subtitle: "Get discounts on training equipment and supplements."
                            )
                        }
                        .padding(.horizontal, 24)
                        
                        // Description expansion
                        Text("Whether you want to lose weight, rehabilitate an injury, or train for ice hockey, we help you with the right focus.")
                            .font(.subheadline)
                            .multilineTextAlignment(.center)
                            .foregroundColor(Color(hex: "78909C"))
                            .padding(.horizontal, 40)
                            .padding(.top, 8)
                    }
                    .padding(.bottom, 24)
                }
                
                // Footer (Compliance & Actions)
                VStack(spacing: 16) {
                    // Consent Checkbox
                    Toggle(isOn: $hasConsented) {
                        Text("I agree to our Terms & Privacy Policy to receive tailored offers from our partners and fitness-related marketing.")
                            .font(.caption)
                            .foregroundColor(Color(hex: "546E7A"))
                    }
                    .toggleStyle(CheckboxStyle())
                    .padding(.horizontal, 24)
                    
                    HStack(spacing: 16) {
                        Button(action: { /* Do nothing or dismiss */ }) {
                            Text("Decline")
                                .font(.headline)
                                .frame(maxWidth: .infinity)
                                .frame(height: 56)
                                .background(Color.white)
                                .foregroundColor(Color(hex: "546E7A"))
                                .cornerRadius(28)
                                .shadow(color: Color.black.opacity(0.05), radius: 5, x: 0, y: 3)
                        }
                        
                        Button(action: {
                            withAnimation {
                                welcomeAccepted = true
                            }
                        }) {
                            Text("Continue")
                                .font(.headline)
                                .frame(maxWidth: .infinity)
                                .frame(height: 56)
                                .background(
                                    LinearGradient(
                                        gradient: Gradient(colors: [Color(hex: "66BB6A"), Color(hex: "43A047")]),
                                        startPoint: .topLeading,
                                        endPoint: .bottomTrailing
                                    )
                                )
                                .foregroundColor(.white)
                                .cornerRadius(28)
                                .shadow(color: Color(hex: "43A047").opacity(0.3), radius: 10, x: 0, y: 5)
                        }
                        .disabled(!hasConsented)
                        .opacity(hasConsented ? 1.0 : 0.6)
                    }
                    .padding(.horizontal, 24)
                    .padding(.bottom, 30)
                }
                .background(
                    Color.white.opacity(0.8)
                        .background(.ultraThinMaterial)
                        .ignoresSafeArea()
                )
            }
        }
        .fullScreenCover(isPresented: $showFullLegal) {
            LegalDetailView()
        }
    }
}

// MARK: - Supporting Views

struct FeatureCard: View {
    let icon: String
    let iconBg: Color
    let iconColor: Color
    let title: String
    let subtitle: String
    
    var body: some View {
        HStack(spacing: 16) {
            ZStack {
                RoundedRectangle(cornerRadius: 12)
                    .fill(iconBg)
                    .frame(width: 48, height: 48)
                
                Image(systemName: icon)
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundColor(iconColor)
            }
            
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.headline)
                    .foregroundColor(Color(hex: "1A237E"))
                
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundColor(Color(hex: "546E7A"))
                    .fixedSize(horizontal: false, vertical: true)
            }
            
            Spacer()
        }
        .padding(16)
        .background(Color.white)
        .cornerRadius(20)
        .shadow(color: Color.black.opacity(0.05), radius: 10, x: 0, y: 5)
    }
}

struct CheckboxStyle: ToggleStyle {
    func makeBody(configuration: Configuration) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: configuration.isOn ? "checkmark.square.fill" : "square")
                .foregroundColor(configuration.isOn ? Color(hex: "43A047") : Color(hex: "B0BEC5"))
                .font(.system(size: 20))
                .onTapGesture {
                    configuration.isOn.toggle()
                }
            
            configuration.label
        }
    }
}

struct LegalDetailView: View {
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    Group {
                        Text("Terms of Use – RepCompanion")
                            .font(.title2.bold())
                        
                        Text("By creating an account or using RepCompanion, you agree to these terms.")
                        
                        Text("RepCompanion is a training and planning app that provides general information, guidance, and suggestions about training and physical activity. The content in the app is intended for information and inspiration purposes and does not constitute medical advice or professional treatment.")
                        
                        Text("You are responsible for:")
                        VStack(alignment: .leading, spacing: 8) {
                            BulletItem(text: "Assess whether suggested training is suitable for you")
                            BulletItem(text: "Train safely")
                            BulletItem(text: "Consult with a doctor, physiotherapist or other qualified healthcare professional when needed")
                        }
                    }
                    
                    Divider()
                    
                    Group {
                        Text("Sekretess & Dataskydd")
                            .font(.title2.bold())
                        
                        Text("RepCompanion values your privacy and handles personal data in accordance with applicable data protection legislation, including GDPR.")
                        
                        Text("Vilken information vi samlar in:")
                        VStack(alignment: .leading, spacing: 8) {
                            BulletItem(text: "Basic profile information (e.g. age, gender, height, weight)")
                            BulletItem(text: "Information about training goals, level and preferences")
                            BulletItem(text: "Usage data about how the app features are used")
                        }
                        
                        Text("Advertising and affiliate links:")
                        Text("RepCompanion contains ads and partnerships with third-party companies. This means the app may show advertising, offers, or links to products and services.")
                    }
                }
                .padding()
            }
            .navigationTitle("Villkor & Sekretess")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}

struct BulletItem: View {
    let text: String
    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            Text("•")
            Text(text)
        }
        .font(.subheadline)
        .foregroundColor(Color(hex: "546E7A"))
    }
}

#Preview {
    WelcomeView()
}

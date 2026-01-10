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
                        BrandLogo(size: 80)
                            .padding(.top, 40)
                        
                        VStack(spacing: 12) {
                            Text("Maximera din träning!")
                                .font(.system(size: 28, weight: .bold, design: .rounded))
                                .foregroundColor(Color(hex: "1A237E"))
                            
                            Text("RepCompanion är ett enkelt och smart verktyg som hjälper dig att sätta ihop ett träningsupplägg som passar just dina mål och din vardag.")
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
                                title: "Personliga träningsprogram",
                                subtitle: "Skräddarsy ditt schema baserat på dina mål och behov."
                            )
                            
                            FeatureCard(
                                icon: "lightbulb.fill",
                                iconBg: Color(hex: "FFF9C4"),
                                iconColor: Color(hex: "FBC02D"),
                                title: "Tips & råd på vägen",
                                subtitle: "Få experttips och motivation för att hålla dig på rätt spår."
                            )
                            
                            FeatureCard(
                                icon: "bag.fill",
                                iconBg: Color(hex: "E1F5FE"),
                                iconColor: Color(hex: "0288D1"),
                                title: "Exklusiva erbjudanden",
                                subtitle: "Ta del av rabatter på träningsutrustning och kosttillskott."
                            )
                        }
                        .padding(.horizontal, 24)
                        
                        // Description expansion
                        Text("Oavsett om du vill gå ner i vikt, rehabilitera en skada eller träna för ishockey, hjälper vi dig med rätt fokus.")
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
                        Text("Jag godkänner våra Villkor & Sekretesspolicy för att ta emot skräddarsydda erbjudanden från våra samarbetspartners samt träningsrelaterad marknadsföring.")
                            .font(.caption)
                            .foregroundColor(Color(hex: "546E7A"))
                    }
                    .toggleStyle(CheckboxStyle())
                    .padding(.horizontal, 24)
                    
                    HStack(spacing: 16) {
                        Button(action: { /* Do nothing or dismiss */ }) {
                            Text("Avböj")
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
                            Text("Fortsätt")
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
                        Text("Användarvillkor – RepCompanion")
                            .font(.title2.bold())
                        
                        Text("Genom att skapa ett konto eller använda RepCompanion godkänner du dessa villkor.")
                        
                        Text("RepCompanion är en tränings- och planeringsapp som tillhandahåller generell information, vägledning och förslag kring träning och fysisk aktivitet. Innehållet i appen är avsedd för informations- och inspirationssyfte och utgör inte medicinsk rådgivning eller professionell behandling.")
                        
                        Text("Du ansvarar själv för att:")
                        VStack(alignment: .leading, spacing: 8) {
                            BulletItem(text: "Bedöma om föreslagen träning är lämplig för dig")
                            BulletItem(text: "Träna på ett säkert sätt")
                            BulletItem(text: "Vid behov rådgöra med läkare, fysioterapeut eller annan kvalificerad vårdpersonal")
                        }
                    }
                    
                    Divider()
                    
                    Group {
                        Text("Sekretess & Dataskydd")
                            .font(.title2.bold())
                        
                        Text("RepCompanion värnar om din integritet och hanterar personuppgifter i enlighet med gällande dataskyddslagstiftning, inklusive GDPR.")
                        
                        Text("Vilken information vi samlar in:")
                        VStack(alignment: .leading, spacing: 8) {
                            BulletItem(text: "Grundläggande profilinformation (t.ex. ålder, kön, längd, vikt)")
                            BulletItem(text: "Uppgifter om träningsmål, träningsnivå och preferenser")
                            BulletItem(text: "Användningsdata som rör hur appens funktioner används")
                        }
                        
                        Text("Reklam och affiliate-länkar:")
                        Text("RepCompanion innehåller annonser och samarbeten med tredjepartsföretag. Detta innebär att appen kan visa reklam, erbjudanden eller länkar till produkter och tjänster.")
                    }
                }
                .padding()
            }
            .navigationTitle("Villkor & Sekretess")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Klar") { dismiss() }
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

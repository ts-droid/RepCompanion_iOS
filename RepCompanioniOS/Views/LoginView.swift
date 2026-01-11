import SwiftUI
import AuthenticationServices
import SwiftData

/// Login view with Google, Apple, and Email authentication options
struct LoginView: View {
    @StateObject private var authService = AuthService.shared
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.modelContext) private var modelContext
    @State private var showEmailSignIn = false
    @State private var showEmailSignUp = false
    @State private var email = ""
    @State private var password = ""
    @State private var name = ""
    @State private var isLoading = false
    @State private var errorMessage: String?
    
    var body: some View {
        NavigationView {
            ZStack {
                BrandBackground()
                
                VStack(spacing: 24) {
                    Spacer()
                    
                    // Logo and Branding
                    Image("AppLogo")
                        .resizable()
                        .scaledToFit()
                        .frame(width: 140, height: 140)
                        .shadow(color: Color.black.opacity(0.1), radius: 10, x: 0, y: 5)
                    
                    VStack(spacing: 8) {
                        Text("Välkommen!")
                            .font(.system(size: 34, weight: .bold, design: .rounded))
                            .foregroundColor(Color(hex: "1A237E"))
                        
                        Text("Din träningskompanjon")
                            .font(.headline)
                            .foregroundColor(Color(hex: "546E7A"))
                    }
                    
                    Spacer()
                    
                    // Authentication Options
                    VStack(spacing: 16) {
                        Button(action: { signInWithGoogle() }) {
                            HStack(spacing: 12) {
                                Image("GoogleLogo")
                                    .resizable()
                                    .scaledToFit()
                                    .frame(width: 24, height: 24)
                                Text("Fortsätt med Google")
                            }
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .frame(height: 56)
                            .background(Color.white)
                            .foregroundColor(.black)
                            .cornerRadius(28)
                            .shadow(color: Color.black.opacity(0.1), radius: 10, x: 0, y: 5)
                        }
                        .disabled(!GoogleSignInService.shared.isAvailable)
                        .opacity(GoogleSignInService.shared.isAvailable ? 1.0 : 0.6)
                        
                        // Apple Button
                        SignInWithAppleButton(
                            onRequest: { request in
                                request.requestedScopes = [.fullName, .email]
                            },
                            onCompletion: { result in
                                handleAppleSignIn(result: result)
                            }
                        )
                        .signInWithAppleButtonStyle(.white)
                        .frame(height: 56)
                        .frame(maxWidth: 375) // Avoid layout constraint conflicts (max width is 375 for this button)
                        .clipShape(Capsule())
                        .shadow(color: Color.black.opacity(0.1), radius: 10, x: 0, y: 5)
                        
                        // Magic Link / Email Flow
                        Button(action: { showEmailSignUp = true }) {
                            HStack {
                                Image(systemName: "link")
                                Text("Logga in med Magic Link")
                            }
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
                        
                        // Already have an account? - Removed in favor of single Magic Link flow
                    }
                    .padding(.horizontal, 32)
                    
                    Spacer()
                    
                    // Terms Footer
                    VStack(spacing: 4) {
                        Text("Genom att fortsätta går du med på")
                            .font(.caption)
                            .foregroundColor(Color(hex: "546E7A"))
                        
                        HStack(spacing: 4) {
                            Button("Villkor") { /* Show Terms */ }
                            Text("&")
                            Button("Sekretesspolicy") { /* Show Privacy */ }
                        }
                        .font(.caption.bold())
                        .foregroundColor(Color(hex: "00ACC1"))
                    }
                    .padding(.bottom, 20)
                }
            }
            .navigationBarHidden(true)
            .sheet(isPresented: $showEmailSignIn) {
                EmailSignInView(
                    email: $email,
                    password: $password,
                    isLoading: $isLoading,
                    errorMessage: $errorMessage,
                    onSignIn: { signInWithEmail() }
                )
            }
            .sheet(isPresented: $showEmailSignUp) {
                MagicLinkLoginView(
                    email: $email,
                    isLoading: $isLoading,
                    errorMessage: $errorMessage,
                    onSendLink: { completion in sendMagicLink(completion: completion) }
                )
            }
            .alert("Fel", isPresented: .constant(errorMessage != nil)) {
                Button("OK") {
                    errorMessage = nil
                }
            } message: {
                if let error = errorMessage {
                    Text(error)
                }
            }
        }
    }
    
    // MARK: - Authentication Handlers
    
    private func handleAppleSignIn(result: Result<ASAuthorization, Error>) {
        switch result {
        case .success(let authorization):
            Task {
                do {
                    try await authService.signInWithApple(authorization: authorization, modelContext: modelContext)
                } catch {
                    await MainActor.run {
                        if let authError = error as? AuthError {
                            errorMessage = authError.localizedDescription
                        } else {
                            errorMessage = "Kunde inte logga in med Apple: \(error.localizedDescription)"
                        }
                    }
                }
            }
        case .failure(let error):
            // Handle different error types
            if let authError = error as? ASAuthorizationError {
                switch authError.code {
                case .canceled:
                    // User canceled - don't show error
                    return
                case .failed:
                    errorMessage = "Inloggning misslyckades. Försök igen."
                case .invalidResponse:
                    errorMessage = "Ogiltigt svar från Apple. Försök igen."
                case .notHandled:
                    errorMessage = "Inloggning kunde inte hanteras. Försök igen."
                case .unknown:
                    errorMessage = "Ett okänt fel uppstod. Försök igen."
                default:
                    errorMessage = "Ett oväntat fel uppstod med Apple Sign-In (\(authError.code.rawValue))."
                }
            } else {
                errorMessage = "Kunde inte logga in med Apple: \(error.localizedDescription)"
            }
        }
    }
    
    private func signInWithGoogle() {
        let googleService = GoogleSignInService.shared
        
        guard googleService.isAvailable else {
            errorMessage = "Google Sign-In är inte konfigurerad ännu. Använd Apple Sign-In eller e-post för nu."
            return
        }
        
        // Get the root view controller to present Google Sign-In
        guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let rootViewController = windowScene.windows.first?.rootViewController else {
            errorMessage = "Kunde inte hitta view controller för Google Sign-In"
            return
        }
        
        Task {
            do {
                let (idToken, accessToken) = try await googleService.signIn(presentingViewController: rootViewController)
                try await authService.signInWithGoogle(
                    idToken: idToken,
                    accessToken: accessToken,
                    modelContext: modelContext
                )
            } catch {
                await MainActor.run {
                    if let googleError = error as? GoogleSignInError {
                        errorMessage = googleError.localizedDescription
                    } else {
                        errorMessage = "Kunde inte logga in med Google: \(error.localizedDescription)"
                    }
                }
            }
        }
    }
    
    private func sendMagicLink(completion: @escaping (Bool) -> Void) {
        guard !email.isEmpty else {
            errorMessage = "Vänligen fyll i din e-post"
            completion(false)
            return
        }
        
        isLoading = true
        Task {
            do {
                try await authService.sendMagicLink(email: email)
                await MainActor.run {
                    isLoading = false
                    completion(true)
                }
            } catch {
                await MainActor.run {
                    isLoading = false
                    errorMessage = "Kunde inte skicka länk: \(error.localizedDescription)"
                    completion(false)
                }
            }
        }
    }
}

// MARK: - Magic Link Login View

struct MagicLinkLoginView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme
    @Binding var email: String
    @Binding var isLoading: Bool
    @Binding var errorMessage: String?
    @State private var linkSent = false
    let onSendLink: (@escaping (Bool) -> Void) -> Void
    
    var body: some View {
        NavigationView {
            ZStack {
                BrandBackground()
                
                VStack(spacing: 24) {
                    if !linkSent {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Ange din e-post")
                                .font(.headline)
                                .foregroundColor(Color(hex: "1A237E"))
                            
                            TextField("din@epost.se", text: $email)
                                .textFieldStyle(PlainTextFieldStyle())
                                .padding()
                                .background(Color.white)
                                .cornerRadius(12)
                                .shadow(color: Color.black.opacity(0.05), radius: 5, x: 0, y: 2)
                                .keyboardType(.emailAddress)
                                .autocapitalization(.none)
                        }
                        
                        Text("Vi skickar en länk till din e-post som loggar in dig direkt. Inget lösenord behövs!")
                            .font(.subheadline)
                            .foregroundColor(Color(hex: "546E7A"))
                            .multilineTextAlignment(.center)
                            .padding(.horizontal)
                        
                        Button(action: {
                            onSendLink { success in
                                withAnimation {
                                    linkSent = success
                                }
                            }
                        }) {
                            if isLoading {
                                ProgressView()
                                    .progressViewStyle(CircularProgressViewStyle(tint: .white))
                            } else {
                                Text("Skicka Magic Link")
                            }
                        }
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .frame(height: 56)
                        .background(Color(hex: "1A237E"))
                        .foregroundColor(.white)
                        .cornerRadius(28)
                        .disabled(isLoading || email.isEmpty)
                    } else {
                        VStack(spacing: 20) {
                            Image(systemName: "envelope.badge.shield.half.filled")
                                .font(.system(size: 80))
                                .foregroundColor(Color(hex: "43A047"))
                            
                            Text("Kolla din e-post!")
                                .font(.title2.bold())
                                .foregroundColor(Color(hex: "1A237E"))
                            
                            Text("Vi har skickat en inloggningslänk till **\(email)**. Klicka på länken i mejlet för att logga in.")
                                .multilineTextAlignment(.center)
                                .foregroundColor(Color(hex: "546E7A"))
                            
                            Button("Stäng") {
                                dismiss()
                            }
                            .font(.headline)
                            .padding()
                        }
                        .padding()
                    }
                    
                    Spacer()
                }
                .padding(32)
            }
            .navigationTitle("Logga in")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Avbryt") {
                        dismiss()
                    }
                }
            }
            .onChange(of: isLoading) { _, newValue in
                if !newValue && errorMessage == nil && !email.isEmpty {
                    // This is a simple way to detect success if the parent doesn't handle it
                    // Actually, it's better to stay in sync with parent
                }
            }
        }
    }
}


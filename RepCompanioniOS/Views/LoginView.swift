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
                Color.appBackground(for: colorScheme).ignoresSafeArea()
                
                VStack(spacing: 32) {
                    Spacer()
                    
                    // Logo/App Name
                    VStack(spacing: 16) {
                        Image(systemName: "dumbbell.fill")
                            .font(.system(size: 60))
                            .foregroundColor(.accentBlue)
                        
                        Text("RepCompanion")
                            .font(.largeTitle)
                            .fontWeight(.bold)
                            .foregroundColor(Color.textPrimary(for: colorScheme))
                        
                        Text("Din AI-drivna träningspartner")
                            .font(.subheadline)
                            .foregroundColor(Color.textSecondary(for: colorScheme))
                    }
                    
                    Spacer()
                    
                    // Login Options
                    VStack(spacing: 16) {
                        // Sign in with Apple
                        SignInWithAppleButton(
                            onRequest: { request in
                                request.requestedScopes = [.fullName, .email]
                            },
                            onCompletion: { result in
                                handleAppleSignIn(result: result)
                            }
                        )
                        .signInWithAppleButtonStyle(colorScheme == .dark ? .white : .black)
                        .frame(height: 50)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                        
                        // Sign in with Google
                        Button(action: { signInWithGoogle() }) {
                            HStack {
                                Image(systemName: "globe")
                                Text("Fortsätt med Google")
                            }
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .frame(height: 50)
                            .background(Color.cardBackground(for: colorScheme))
                            .foregroundColor(Color.textPrimary(for: colorScheme))
                            .cornerRadius(12)
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(Color.textSecondary(for: colorScheme).opacity(0.2), lineWidth: 1)
                            )
                        }
                        .disabled(!GoogleSignInService.shared.isAvailable)
                        .opacity(GoogleSignInService.shared.isAvailable ? 1.0 : 0.6)
                        
                        // Email sign in/up
                        VStack(spacing: 12) {
                            Button(action: { showEmailSignIn = true }) {
                                Text("Logga in med e-post")
                                    .font(.subheadline)
                                    .foregroundColor(Color.accentBlue)
                            }
                            
                            Button(action: { showEmailSignUp = true }) {
                                Text("Skapa konto med e-post")
                                    .font(.subheadline)
                                    .foregroundColor(Color.textSecondary(for: colorScheme))
                            }
                        }
                    }
                    .padding(.horizontal)
                    
                    Spacer()
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
                EmailSignUpView(
                    email: $email,
                    password: $password,
                    name: $name,
                    isLoading: $isLoading,
                    errorMessage: $errorMessage,
                    onSignUp: { signUpWithEmail() }
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
                @unknown default:
                    errorMessage = "Ett oväntat fel uppstod med Apple Sign-In."
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
    
    private func signInWithEmail() {
        guard !email.isEmpty, !password.isEmpty else {
            errorMessage = "Vänligen fyll i e-post och lösenord"
            return
        }
        
        isLoading = true
        Task {
            do {
                try await authService.signInWithEmail(email: email, password: password, modelContext: modelContext)
                await MainActor.run {
                    isLoading = false
                    showEmailSignIn = false
                }
            } catch {
                await MainActor.run {
                    isLoading = false
                    errorMessage = "Kunde inte logga in: \(error.localizedDescription)"
                }
            }
        }
    }
    
    private func signUpWithEmail() {
        guard !email.isEmpty, !password.isEmpty, !name.isEmpty else {
            errorMessage = "Vänligen fyll i alla fält"
            return
        }
        
        guard password.count >= 6 else {
            errorMessage = "Lösenordet måste vara minst 6 tecken"
            return
        }
        
        isLoading = true
        Task {
            do {
                try await authService.signUpWithEmail(email: email, password: password, name: name, modelContext: modelContext)
                await MainActor.run {
                    isLoading = false
                    showEmailSignUp = false
                }
            } catch {
                await MainActor.run {
                    isLoading = false
                    errorMessage = "Kunde inte skapa konto: \(error.localizedDescription)"
                }
            }
        }
    }
}

// MARK: - Email Sign In View

struct EmailSignInView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme
    @Binding var email: String
    @Binding var password: String
    @Binding var isLoading: Bool
    @Binding var errorMessage: String?
    let onSignIn: () -> Void
    
    var body: some View {
        NavigationView {
            ZStack {
                Color.appBackground(for: colorScheme).ignoresSafeArea()
                
                VStack(spacing: 24) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("E-post")
                            .font(.subheadline)
                            .foregroundColor(Color.textPrimary(for: colorScheme))
                        TextField("din@epost.se", text: $email)
                            .textFieldStyle(RoundedBorderTextFieldStyle())
                            .keyboardType(.emailAddress)
                            .autocapitalization(.none)
                    }
                    
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Lösenord")
                            .font(.subheadline)
                            .foregroundColor(Color.textPrimary(for: colorScheme))
                        SecureField("Lösenord", text: $password)
                            .textFieldStyle(RoundedBorderTextFieldStyle())
                    }
                    
                    Button(action: onSignIn) {
                        if isLoading {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: .white))
                        } else {
                            Text("Logga in")
                        }
                    }
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.accentBlue)
                    .foregroundColor(.white)
                    .cornerRadius(12)
                    .disabled(isLoading)
                    
                    Spacer()
                }
                .padding()
            }
            .navigationTitle("Logga in")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Stäng") {
                        dismiss()
                    }
                }
            }
        }
    }
}

// MARK: - Email Sign Up View

struct EmailSignUpView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme
    @Binding var email: String
    @Binding var password: String
    @Binding var name: String
    @Binding var isLoading: Bool
    @Binding var errorMessage: String?
    let onSignUp: () -> Void
    
    var body: some View {
        NavigationView {
            ZStack {
                Color.appBackground(for: colorScheme).ignoresSafeArea()
                
                VStack(spacing: 24) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Namn")
                            .font(.subheadline)
                            .foregroundColor(Color.textPrimary(for: colorScheme))
                        TextField("Ditt namn", text: $name)
                            .textFieldStyle(RoundedBorderTextFieldStyle())
                    }
                    
                    VStack(alignment: .leading, spacing: 8) {
                        Text("E-post")
                            .font(.subheadline)
                            .foregroundColor(Color.textPrimary(for: colorScheme))
                        TextField("din@epost.se", text: $email)
                            .textFieldStyle(RoundedBorderTextFieldStyle())
                            .keyboardType(.emailAddress)
                            .autocapitalization(.none)
                    }
                    
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Lösenord")
                            .font(.subheadline)
                            .foregroundColor(Color.textPrimary(for: colorScheme))
                        SecureField("Minst 6 tecken", text: $password)
                            .textFieldStyle(RoundedBorderTextFieldStyle())
                    }
                    
                    Button(action: onSignUp) {
                        if isLoading {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: .white))
                        } else {
                            Text("Skapa konto")
                        }
                    }
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.accentBlue)
                    .foregroundColor(.white)
                    .cornerRadius(12)
                    .disabled(isLoading)
                    
                    Spacer()
                }
                .padding()
            }
            .navigationTitle("Skapa konto")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Stäng") {
                        dismiss()
                    }
                }
            }
        }
    }
}


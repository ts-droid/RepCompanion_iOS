import SwiftUI
import AuthenticationServices
import SwiftData

/// Login view with Google, Apple, and Email authentication options
struct LoginView: View {
    @StateObject private var authService = AuthService.shared
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.modelContext) private var modelContext
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
                        Text("Welcome!")
                            .font(.system(size: 34, weight: .bold, design: .rounded))
                            .foregroundColor(Color(hex: "1A237E"))

                        Text("Your training companion")
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
                                Text("Continue with Google")
                                    .font(.system(size: 19, weight: .semibold))
                            }
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
                            HStack(spacing: 12) {
                                Image(systemName: "link")
                                    .font(.system(size: 19, weight: .semibold))
                                Text("Sign in with Magic Link")
                                    .font(.system(size: 19, weight: .semibold))
                            }
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
                        Text("By continuing you agree to")
                            .font(.caption)
                            .foregroundColor(Color(hex: "546E7A"))

                        HStack(spacing: 4) {
                            Button("Terms") { /* Show Terms */ }
                            Text("&")
                            Button("Privacy Policy") { /* Show Privacy */ }
                        }
                        .font(.caption.bold())
                        .foregroundColor(Color(hex: "00ACC1"))
                    }
                    .padding(.bottom, 20)
                }
            }
            .navigationBarHidden(true)
            .sheet(isPresented: $showEmailSignUp) {
                MagicLinkLoginView(
                    email: $email,
                    isLoading: $isLoading,
                    errorMessage: $errorMessage,
                    onSendLink: { completion in sendMagicLink(completion: completion) }
                )
            }
            .alert("Error", isPresented: .constant(errorMessage != nil)) {
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
                            errorMessage = String(localized: "Could not sign in with Apple: \(error.localizedDescription)")
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
                    errorMessage = String(localized: "Sign in failed. Please try again.")
                case .invalidResponse:
                    errorMessage = String(localized: "Invalid response from Apple. Please try again.")
                case .notHandled:
                    errorMessage = String(localized: "Sign in could not be handled. Please try again.")
                case .unknown:
                    errorMessage = String(localized: "An unknown error occurred. Please try again.")
                default:
                    errorMessage = String(localized: "An unexpected error occurred with Apple Sign-In (\(authError.code.rawValue)).")
                }
            } else {
                errorMessage = String(localized: "Could not sign in with Apple: \(error.localizedDescription)")
            }
        }
    }

    private func signInWithGoogle() {
        let googleService = GoogleSignInService.shared

        guard googleService.isAvailable else {
            errorMessage = String(localized: "Google Sign-In is not configured yet. Use Apple Sign-In or email for now.")
            return
        }

        // Get the root view controller to present Google Sign-In
        guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let rootViewController = windowScene.windows.first?.rootViewController else {
            errorMessage = String(localized: "Could not find view controller for Google Sign-In")
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
                    // Handle specific network errors with user-friendly messages
                    if let urlError = error as? URLError {
                        switch urlError.code {
                        case .notConnectedToInternet:
                            errorMessage = String(localized: "No internet connection. Check your connection.")
                        case .timedOut:
                            errorMessage = String(localized: "Server did not respond. Please try again.")
                        case .cannotConnectToHost, .cannotFindHost:
                            errorMessage = String(localized: "Could not connect to server. Please try again later.")
                        case .networkConnectionLost:
                            errorMessage = String(localized: "Network connection lost. Please try again.")
                        default:
                            errorMessage = String(localized: "Network error. Check your connection and try again.")
                        }
                    } else if let googleError = error as? GoogleSignInError {
                        errorMessage = googleError.localizedDescription
                    } else {
                        errorMessage = String(localized: "Could not sign in with Google: \(error.localizedDescription)")
                    }
                }
            }
        }
    }

    private func sendMagicLink(completion: @escaping (Bool) -> Void) {
        guard !email.isEmpty else {
            errorMessage = String(localized: "Please enter your email")
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
                    errorMessage = String(localized: "Could not send link: \(error.localizedDescription)")
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
                            Text("Enter your email")
                                .font(.headline)
                                .foregroundColor(Color(hex: "1A237E"))

                            TextField("your@email.com", text: $email)
                                .textFieldStyle(PlainTextFieldStyle())
                                .foregroundColor(Color(hex: "1A237E")) // Dark text color
                                .accentColor(Color(hex: "43A047")) // Green cursor
                                .padding()
                                .background(Color.white)
                                .cornerRadius(12)
                                .shadow(color: Color.black.opacity(0.05), radius: 5, x: 0, y: 2)
                                .keyboardType(.emailAddress)
                                .autocapitalization(.none)
                                .autocorrectionDisabled()
                        }

                        Text("We'll send a link to your email that logs you in directly. No password needed!")
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
                                Text("Send Magic Link")
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

                            Text("Check your email!")
                                .font(.title2.bold())
                                .foregroundColor(Color(hex: "1A237E"))

                            Text("We've sent a login link to **\(email)**. Click the link in the email to log in.")
                                .multilineTextAlignment(.center)
                                .foregroundColor(Color(hex: "546E7A"))

                            Button("Close") {
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
            .navigationTitle("Sign in")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Cancel") {
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

import StoreKit
import SwiftUI

// MARK: - Data Model

struct GymAdCampaign: Codable, Identifiable {
    let id: String
    let gymName: String
    let logoUrl: String?
    let offerText: String
    let ctaLabel: String
    let ctaUrl: String
}

// MARK: - View

/// Full-screen interstitial ad shown on app launch.
/// Displays partner gym campaigns fetched from the backend.
/// The ad can be permanently removed via a one-time IAP ("Remove Ads").
struct LaunchAdView: View {
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.dismiss) private var dismiss

    @StateObject private var storeKit = StoreKitManager.shared

    @State private var campaigns: [GymAdCampaign] = []
    @State private var currentIndex = 0
    @State private var isLoading = true
    @State private var loadError = false

    var onDismiss: () -> Void

    var body: some View {
        ZStack {
            Color.appBackground(for: colorScheme).ignoresSafeArea()

            VStack(spacing: 0) {
                // Top bar
                HStack {
                    Text(String(localized: "Partner offer"))
                        .font(.caption)
                        .foregroundStyle(Color.textSecondary(for: colorScheme))
                    Spacer()
                    Button(String(localized: "Continue to app")) {
                        onDismiss()
                    }
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundColor(Color.accentBlue)
                }
                .padding()

                Divider()

                if isLoading {
                    Spacer()
                    ProgressView()
                    Spacer()
                } else if loadError || campaigns.isEmpty {
                    // No campaigns available — dismiss immediately
                    Color.clear.onAppear { onDismiss() }
                } else {
                    let campaign = campaigns[currentIndex]

                    ScrollView {
                        VStack(spacing: 24) {
                            // Logo placeholder / gym name
                            VStack(spacing: 12) {
                                if let logoUrl = campaign.logoUrl, let url = URL(string: logoUrl) {
                                    AsyncImage(url: url) { image in
                                        image
                                            .resizable()
                                            .scaledToFit()
                                    } placeholder: {
                                        Image(systemName: "building.2.fill")
                                            .font(.system(size: 48))
                                            .foregroundStyle(Color.textSecondary(for: colorScheme))
                                    }
                                    .frame(height: 80)
                                } else {
                                    Image(systemName: "building.2.fill")
                                        .font(.system(size: 48))
                                        .foregroundStyle(Color.textSecondary(for: colorScheme))
                                }

                                Text(campaign.gymName)
                                    .font(.title2)
                                    .fontWeight(.bold)
                                    .foregroundStyle(Color.textPrimary(for: colorScheme))
                                    .multilineTextAlignment(.center)
                            }
                            .padding(.top, 32)

                            // Offer text
                            Text(campaign.offerText)
                                .font(.body)
                                .foregroundStyle(Color.textPrimary(for: colorScheme))
                                .multilineTextAlignment(.center)
                                .padding(.horizontal)

                            // CTA button
                            if let url = URL(string: campaign.ctaUrl) {
                                Link(destination: url) {
                                    Text(campaign.ctaLabel)
                                        .font(.headline)
                                        .fontWeight(.bold)
                                        .frame(maxWidth: .infinity)
                                        .padding()
                                        .background(Color.accentBlue)
                                        .foregroundColor(.white)
                                        .cornerRadius(12)
                                }
                                .padding(.horizontal)
                            }

                            // Pagination dots (if multiple campaigns)
                            if campaigns.count > 1 {
                                HStack(spacing: 8) {
                                    ForEach(0..<campaigns.count, id: \.self) { i in
                                        Circle()
                                            .fill(i == currentIndex ? Color.accentBlue : Color.gray.opacity(0.4))
                                            .frame(width: 8, height: 8)
                                    }
                                }
                            }
                        }
                        .padding(.bottom, 32)
                    }
                }

                Divider()

                // Bottom bar: Remove Ads IAP
                VStack(spacing: 8) {
                    if storeKit.isPurchasing {
                        ProgressView()
                            .padding(8)
                    } else {
                        Button {
                            Task { await storeKit.purchaseRemoveAds() }
                        } label: {
                            if let product = storeKit.removeAdsProduct {
                                Text(String(format: String(localized: "Remove ads for %@"), product.displayPrice))
                                    .font(.subheadline)
                                    .foregroundColor(.secondary)
                            } else {
                                Text(String(localized: "Remove ads"))
                                    .font(.subheadline)
                                    .foregroundColor(.secondary)
                            }
                        }

                        Button(String(localized: "Restore purchase")) {
                            Task { await storeKit.restorePurchases() }
                        }
                        .font(.caption)
                        .foregroundColor(.secondary)
                    }

                    if let error = storeKit.purchaseError {
                        Text(error)
                            .font(.caption)
                            .foregroundColor(.red)
                            .multilineTextAlignment(.center)
                    }
                }
                .padding()
            }
        }
        .onAppear {
            Task { await loadCampaigns() }
        }
        .onChange(of: storeKit.adsRemoved) { _, removed in
            if removed { onDismiss() }
        }
    }

    // MARK: - Load campaigns from backend

    private func loadCampaigns() async {
        isLoading = true
        loadError = false
        do {
            let url = URL(string: "\(APIService.shared.baseURL)/gym-campaigns/active")!
            let (data, response) = try await URLSession.shared.data(from: url)
            guard (response as? HTTPURLResponse)?.statusCode == 200 else {
                loadError = true
                isLoading = false
                return
            }
            campaigns = try JSONDecoder().decode([GymAdCampaign].self, from: data)
        } catch {
            loadError = true
        }
        isLoading = false
    }
}

// MARK: - Localization keys needed:
// "Partner offer" → "Partnererbjudande"
// "Continue to app" → "Fortsätt till appen"
// "Remove ads for %@" → "Ta bort annonser för %@"
// "Remove ads" → "Ta bort annonser"
// "Restore purchase" → "Återställ köp"

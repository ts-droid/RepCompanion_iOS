import Combine
import StoreKit
import SwiftUI

/// Manages the "Remove Ads" in-app purchase.
/// Product ID must match what is configured in App Store Connect.
@MainActor
class StoreKitManager: ObservableObject {
    static let shared = StoreKitManager()

    /// The App Store Connect product ID for the Remove Ads non-consumable IAP.
    static let removeAdsProductId = "com.repcompanion.removeads"

    @AppStorage("adsRemoved") var adsRemoved: Bool = false

    @Published var removeAdsProduct: Product?
    @Published var isPurchasing = false
    @Published var purchaseError: String?

    private var transactionListener: Task<Void, Never>?

    private init() {
        transactionListener = listenForTransactions()
        Task { await loadProducts() }
    }

    deinit {
        transactionListener?.cancel()
    }

    // MARK: - Load Products

    func loadProducts() async {
        do {
            let products = try await Product.products(for: [Self.removeAdsProductId])
            removeAdsProduct = products.first
        } catch {
            print("[StoreKit] Failed to load products: \(error)")
        }
    }

    // MARK: - Purchase

    func purchaseRemoveAds() async {
        guard let product = removeAdsProduct else { return }
        isPurchasing = true
        purchaseError = nil
        do {
            let result = try await product.purchase()
            switch result {
            case .success(let verification):
                let transaction = try checkVerified(verification)
                adsRemoved = true
                await transaction.finish()
            case .userCancelled:
                break
            case .pending:
                break
            @unknown default:
                break
            }
        } catch {
            purchaseError = error.localizedDescription
        }
        isPurchasing = false
    }

    // MARK: - Restore Purchases

    func restorePurchases() async {
        do {
            try await AppStore.sync()
            for await result in Transaction.currentEntitlements {
                if case .verified(let transaction) = result,
                   transaction.productID == Self.removeAdsProductId {
                    adsRemoved = true
                    await transaction.finish()
                }
            }
        } catch {
            purchaseError = error.localizedDescription
        }
    }

    // MARK: - Transaction Listener

    private func listenForTransactions() -> Task<Void, Never> {
        Task(priority: .background) {
            for await result in Transaction.updates {
                do {
                    let transaction = try self.checkVerified(result)
                    if transaction.productID == Self.removeAdsProductId {
                        await MainActor.run { self.adsRemoved = true }
                        await transaction.finish()
                    }
                } catch {
                    print("[StoreKit] Transaction verification failed: \(error)")
                }
            }
        }
    }

    // MARK: - Verification Helper

    private func checkVerified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .unverified:
            throw StoreError.failedVerification
        case .verified(let value):
            return value
        }
    }

    enum StoreError: Error {
        case failedVerification
    }
}

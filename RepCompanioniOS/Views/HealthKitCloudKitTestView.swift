import SwiftUI
import HealthKit
import CloudKit

/// Test view for verifying HealthKit and CloudKit integration
/// Add this to your app temporarily to test the services
struct HealthKitCloudKitTestView: View {
    @State private var healthKitStatus = "Not tested"
    @State private var cloudKitStatus = "Not tested"
    @State private var testResults: [String] = []
    @State private var isLoading = false
    
    var body: some View {
        NavigationView {
            List {
                Section("HealthKit") {
                    HStack {
                        Text("Status")
                        Spacer()
                        Text(healthKitStatus)
                            .foregroundColor(statusColor(healthKitStatus))
                    }
                    
                    Button("Test HealthKit") {
                        testHealthKit()
                    }
                    .disabled(isLoading)
                }
                
                Section("CloudKit") {
                    HStack {
                        Text("Status")
                        Spacer()
                        Text(cloudKitStatus)
                            .foregroundColor(statusColor(cloudKitStatus))
                    }
                    
                    Button("Test CloudKit") {
                        testCloudKit()
                    }
                    .disabled(isLoading)
                }
                
                if !testResults.isEmpty {
                    Section("Test Results") {
                        ForEach(testResults, id: \.self) { result in
                            Text(result)
                                .font(.system(.caption, design: .monospaced))
                        }
                    }
                }
            }
            .navigationTitle("Service Tests")
            .toolbar {
                if isLoading {
                    ProgressView()
                }
            }
        }
    }
    
    private func statusColor(_ status: String) -> Color {
        switch status {
        case "✅ Working": return .green
        case "❌ Failed": return .red
        case "⚠️ Warning": return .orange
        default: return .secondary
        }
    }
    
    private func testHealthKit() {
        isLoading = true
        testResults.removeAll()
        
        Task {
            do {
                // Check if HealthKit is available
                guard HKHealthStore.isHealthDataAvailable() else {
                    await MainActor.run {
                        healthKitStatus = "❌ Failed"
                        testResults.append("HealthKit not available on this device")
                        isLoading = false
                    }
                    return
                }
                
                await MainActor.run {
                    testResults.append("✓ HealthKit is available")
                }
                
                // Request authorization
                try await HealthKitService.shared.requestAuthorization()
                await MainActor.run {
                    testResults.append("✓ Authorization requested")
                }
                
                // Try to read some data
                let steps = try await HealthKitService.shared.getTodaySteps()
                await MainActor.run {
                    testResults.append("✓ Steps today: \(steps)")
                }
                
                let energy = try await HealthKitService.shared.getTodayActiveEnergy()
                await MainActor.run {
                    testResults.append("✓ Active energy: \(String(format: "%.1f", energy)) kcal")
                }
                
                // Success
                await MainActor.run {
                    healthKitStatus = "✅ Working"
                    testResults.append("✅ HealthKit test passed!")
                    isLoading = false
                }
                
            } catch {
                await MainActor.run {
                    healthKitStatus = "❌ Failed"
                    testResults.append("❌ Error: \(error.localizedDescription)")
                    isLoading = false
                }
            }
        }
    }
    
    private func testCloudKit() {
        isLoading = true
        testResults.removeAll()
        
        Task {
            do {
                // Check if CloudKit is available
                guard CloudKitSyncService.shared.isAvailable else {
                    await MainActor.run {
                        cloudKitStatus = "❌ Failed"
                        testResults.append("CloudKit not available - missing entitlement")
                        testResults.append("Make sure to add iCloud capability in Xcode")
                        isLoading = false
                    }
                    return
                }
                
                await MainActor.run {
                    testResults.append("✓ CloudKit entitlement found")
                }
                
                // Check account status
                let status = try await CloudKitSyncService.shared.checkAccountStatus()
                await MainActor.run {
                    testResults.append("✓ Account status: \(statusDescription(status))")
                }
                
                if status == .available {
                    await MainActor.run {
                        cloudKitStatus = "✅ Working"
                        testResults.append("✅ CloudKit test passed!")
                    }
                } else {
                    await MainActor.run {
                        cloudKitStatus = "⚠️ Warning"
                        testResults.append("⚠️ CloudKit available but account not ready")
                        testResults.append("Make sure you're signed in to iCloud")
                    }
                }
                
                await MainActor.run {
                    isLoading = false
                }
                
            } catch {
                await MainActor.run {
                    cloudKitStatus = "❌ Failed"
                    testResults.append("❌ Error: \(error.localizedDescription)")
                    isLoading = false
                }
            }
        }
    }
    
    private func statusDescription(_ status: CKAccountStatus) -> String {
        switch status {
        case .available:
            return "Available ✅"
        case .noAccount:
            return "No iCloud account"
        case .restricted:
            return "Restricted"
        case .couldNotDetermine:
            return "Could not determine"
        case .temporarilyUnavailable:
            return "Temporarily unavailable"
        @unknown default:
            return "Unknown"
        }
    }
}

#Preview {
    HealthKitCloudKitTestView()
}

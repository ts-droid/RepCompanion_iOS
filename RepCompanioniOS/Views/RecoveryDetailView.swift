import SwiftUI
import HealthKit

struct RecoveryDetailView: View {
    let recoveryPercent: Int
    let colorScheme: ColorScheme
    let healthKitService: HealthKitService
    
    @State private var sleepHours: Double = 0.0
    @State private var hrv: Double? = nil
    @State private var restingHeartRate: Double? = nil
    @State private var averageHeartRate: Double? = nil
    @State private var vo2Max: Double? = nil
    @State private var sleepScore: Double? = nil // Sleep score (0.0-1.0)
    @State private var isLoading = true
    
    // TEST: Force test data for debugging
    #if DEBUG
    private let useTestData = false
    #else
    private let useTestData = false
    #endif
    
    // Computed property for inner progress - always use sleepScore
    private var innerProgressValue: Double? {
        return sleepScore // Will be 0.93 with test data
    }
    
    // Calculate sleep score based on sleep hours, HRV, and resting heart rate
    private func calculateSleepScore(sleep: Double, hrv: Double?, restingHR: Double?) -> Double? {
        // Need at least sleep hours to calculate score
        guard sleep > 0 else { return nil }
        
        var score: Double = 0.0
        var factors: Int = 0
        
        // 1. Sleep duration (50% weight) - Optimal: 7-9 hours
        let sleepScore: Double
        if sleep >= 7.0 && sleep <= 9.0 {
            sleepScore = 100.0 // Perfect range
        } else if sleep >= 6.0 && sleep < 7.0 {
            sleepScore = 80.0 - (7.0 - sleep) * 20.0 // 6h = 80%, 6.5h = 90%
        } else if sleep > 9.0 && sleep <= 10.0 {
            sleepScore = 100.0 - (sleep - 9.0) * 10.0 // 9h = 100%, 10h = 90%
        } else if sleep < 6.0 {
            sleepScore = max(0.0, 80.0 - (6.0 - sleep) * 20.0) // Below 6h decreases quickly
        } else {
            sleepScore = max(0.0, 90.0 - (sleep - 10.0) * 10.0) // Above 10h decreases
        }
        score += sleepScore * 0.5
        factors += 1
        
        // 2. HRV (25% weight) - Higher is better
        if let hrvValue = hrv {
            let hrvScore: Double
            if hrvValue >= 60 {
                hrvScore = 100.0
            } else if hrvValue >= 50 {
                hrvScore = 80.0 + (hrvValue - 50) * 2.0 // 50ms = 80%, 60ms = 100%
            } else if hrvValue >= 40 {
                hrvScore = 60.0 + (hrvValue - 40) * 2.0 // 40ms = 60%, 50ms = 80%
            } else {
                hrvScore = max(0.0, 40.0 + (hrvValue - 20) * 1.0) // Below 40ms
            }
            score += hrvScore * 0.25
            factors += 1
        }
        
        // 3. Resting heart rate (25% weight) - Lower is better
        if let restingHRValue = restingHR {
            let hrScore: Double
            if restingHRValue <= 55 {
                hrScore = 100.0
            } else if restingHRValue <= 60 {
                hrScore = 90.0 - (restingHRValue - 55) * 2.0 // 55bpm = 100%, 60bpm = 90%
            } else if restingHRValue <= 65 {
                hrScore = 80.0 - (restingHRValue - 60) * 2.0 // 60bpm = 90%, 65bpm = 80%
            } else if restingHRValue <= 70 {
                hrScore = 70.0 - (restingHRValue - 65) * 2.0 // 65bpm = 80%, 70bpm = 70%
            } else {
                hrScore = max(0.0, 60.0 - (restingHRValue - 70) * 2.0) // Above 70bpm
            }
            score += hrScore * 0.25
            factors += 1
        }
        
        // Normalize based on available factors
        if factors == 0 {
            return nil
        }
        
        // If only sleep duration, return that score directly
        if factors == 1 {
            return sleepScore / 100.0
        }
        
        // Otherwise return weighted average
        return min(1.0, max(0.0, score / 100.0))
    }
    
    var body: some View {
        VStack(spacing: 24) {
            // Large Recovery Circle
            VStack(spacing: 16) {
                StatusCard(
                    title: "ÅTERHÄMTNING",
                    value: "\(recoveryPercent)%",
                    subtitle: "optimal",
                    color: .recoveryPurple,
                    progress: Double(recoveryPercent) / 100.0,
                    icon: "heart",
                    colorScheme: colorScheme,
                    size: .large,
                    innerProgress: innerProgressValue, // Inner ring for sleep score
                    innerColor: .teal // Teal color for sleep ring - better differentiation
                )
            }
            .padding(.horizontal)
            
            // Recovery Specifications
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("Total återhämtning:")
                        .font(.subheadline)
                        .foregroundStyle(Color.textSecondary(for: colorScheme))
                    Spacer()
                    Text("\(recoveryPercent)%")
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundStyle(Color.textPrimary(for: colorScheme))
                }
                
                HStack {
                    Text("Sömn:")
                        .font(.subheadline)
                        .foregroundStyle(Color.textSecondary(for: colorScheme))
                    Spacer()
                    if let sleepScore = sleepScore {
                        Text("\(Int(sleepScore * 100))%")
                            .font(.subheadline)
                            .fontWeight(.semibold)
                            .foregroundStyle(Color.teal)
                    } else {
                        Text("0%")
                            .font(.subheadline)
                            .fontWeight(.semibold)
                            .foregroundStyle(Color.teal.opacity(0.5))
                    }
                }
            }
            .padding()
            .background(Color.cardBackground(for: colorScheme))
            .cornerRadius(12)
            .padding(.horizontal)
            
            // Recovery Details Card
            VStack(alignment: .leading, spacing: 16) {
                Text("ÅTERHÄMTNINGSDETALJER")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(Color.textSecondary(for: colorScheme))
                    .tracking(1)
                
                if isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .padding()
                } else {
                    // Sleep
                    HStack {
                        HStack(spacing: 8) {
                            Image(systemName: "moon.fill")
                                .foregroundStyle(Color.textSecondary(for: colorScheme))
                            Text("Sömn (senaste natten)")
                                .font(.subheadline)
                                .foregroundStyle(Color.textSecondary(for: colorScheme))
                        }
                        Spacer()
                        Text(String(format: "%.1f h", sleepHours))
                            .font(.subheadline)
                            .fontWeight(.semibold)
                            .foregroundStyle(Color.textPrimary(for: colorScheme))
                    }
                    
                    Divider()
                    
                    // HRV
                    HStack {
                        HStack(spacing: 8) {
                            Image(systemName: "heart.fill")
                                .foregroundStyle(Color.textSecondary(for: colorScheme))
                            Text("HRV")
                                .font(.subheadline)
                                .foregroundStyle(Color.textSecondary(for: colorScheme))
                        }
                        Spacer()
                        if let hrv = hrv {
                            Text("\(Int(hrv)) ms")
                                .font(.subheadline)
                                .fontWeight(.semibold)
                                .foregroundStyle(Color.textPrimary(for: colorScheme))
                        } else {
                            Text("—")
                                .font(.subheadline)
                                .foregroundStyle(Color.textSecondary(for: colorScheme))
                        }
                    }
                    
                    Text("Kräver Apple Watch för HRV")
                        .font(.caption2)
                        .foregroundStyle(Color.textSecondary(for: colorScheme).opacity(0.7))
                        .padding(.leading, 32)
                    
                    Divider()
                    
                    // Resting Heart Rate
                    HStack {
                        HStack(spacing: 8) {
                            Image(systemName: "waveform.path.ecg")
                                .foregroundStyle(Color.textSecondary(for: colorScheme))
                            Text("Vilopuls")
                                .font(.subheadline)
                                .foregroundStyle(Color.textSecondary(for: colorScheme))
                        }
                        Spacer()
                        if let restingHR = restingHeartRate {
                            Text("\(Int(restingHR)) bpm")
                                .font(.subheadline)
                                .fontWeight(.semibold)
                                .foregroundStyle(Color.textPrimary(for: colorScheme))
                        } else {
                            Text("—")
                                .font(.subheadline)
                                .foregroundStyle(Color.textSecondary(for: colorScheme))
                        }
                    }
                    
                    Text("Kräver Apple Watch för vilopuls")
                        .font(.caption2)
                        .foregroundStyle(Color.textSecondary(for: colorScheme).opacity(0.7))
                        .padding(.leading, 32)
                    
                    Divider()
                    
                    // Average Heart Rate
                    HStack {
                        HStack(spacing: 8) {
                            Image(systemName: "heart.circle.fill")
                                .foregroundStyle(Color.textSecondary(for: colorScheme))
                            Text("Genomsnittlig puls")
                                .font(.subheadline)
                                .foregroundStyle(Color.textSecondary(for: colorScheme))
                        }
                        Spacer()
                        if let avgHR = averageHeartRate {
                            Text("\(Int(avgHR)) bpm")
                                .font(.subheadline)
                                .fontWeight(.semibold)
                                .foregroundStyle(Color.textPrimary(for: colorScheme))
                        } else {
                            Text("—")
                                .font(.subheadline)
                                .foregroundStyle(Color.textSecondary(for: colorScheme))
                        }
                    }
                    
                    Divider()
                    
                    // VO2 Max
                    HStack {
                        HStack(spacing: 8) {
                            Image(systemName: "lungs.fill")
                                .foregroundStyle(Color.textSecondary(for: colorScheme))
                            Text("VO₂ Max")
                                .font(.subheadline)
                                .foregroundStyle(Color.textSecondary(for: colorScheme))
                        }
                        Spacer()
                        if let vo2 = vo2Max {
                            Text(String(format: "%.1f", vo2))
                                .font(.subheadline)
                                .fontWeight(.semibold)
                                .foregroundStyle(Color.textPrimary(for: colorScheme))
                        } else {
                            Text("—")
                                .font(.subheadline)
                                .foregroundStyle(Color.textSecondary(for: colorScheme))
                        }
                    }
                    
                    Text("Kräver Apple Watch för kondition")
                        .font(.caption2)
                        .foregroundStyle(Color.textSecondary(for: colorScheme).opacity(0.7))
                        .padding(.leading, 32)
                }
            }
            .padding()
            .background(Color.cardBackground(for: colorScheme))
            .cornerRadius(12)
            .padding(.horizontal)
            
            // Personal Tips Section
            PersonalTipsSection()
        }
        .onAppear {
            loadRecoveryData()
            
            #if DEBUG
            print("[DEBUG RecoveryDetailView] onAppear - innerProgressValue: \(innerProgressValue?.description ?? "nil"), useTestData: \(useTestData), sleepScore: \(sleepScore?.description ?? "nil")")
            #endif
        }
        .onChange(of: sleepHours) { _, newSleep in
            sleepScore = calculateSleepScore(sleep: newSleep, hrv: hrv, restingHR: restingHeartRate)
        }
        .onChange(of: hrv) { _, newHrv in
            sleepScore = calculateSleepScore(sleep: sleepHours, hrv: newHrv, restingHR: restingHeartRate)
        }
        .onChange(of: restingHeartRate) { _, newHR in
            sleepScore = calculateSleepScore(sleep: sleepHours, hrv: hrv, restingHR: newHR)
        }
    }
    
    private func loadRecoveryData() {
        if useTestData {
            // Set dummy data for testing - adjusted to give ~93% sleep score
            sleepHours = 8.2 // Slightly more sleep for better score
            hrv = 62.0 // Higher HRV for better score
            restingHeartRate = 56.0 // Lower resting HR for better score
            averageHeartRate = 70.0
            vo2Max = 45.0
            // Calculate sleep score - should give ~93%
            sleepScore = calculateSleepScore(sleep: 8.2, hrv: 62.0, restingHR: 56.0)
            print("[DEBUG RecoveryDetailView] Test data - sleepScore: \(sleepScore?.description ?? "nil")")
            isLoading = false
            return
        }
        
        guard healthKitService.isAuthorized else {
            isLoading = false
            return
        }
        
        Task {
            let calendar = Calendar.current
            let now = Date()
            let yesterday = calendar.date(byAdding: .day, value: -1, to: now) ?? now
            let startOfYesterday = calendar.startOfDay(for: yesterday)
            let endOfYesterday = calendar.date(byAdding: .day, value: 1, to: startOfYesterday) ?? now
            
            do {
                // Sleep from last night
                let sleep = try await healthKitService.getSleepHours(for: startOfYesterday, to: endOfYesterday)
                
                // Resting heart rate
                let restingHR = try? await healthKitService.getRestingHeartRate()
                
                // HRV
                let hrvValue = try? await healthKitService.getLatestHRV()
                
                // Average heart rate (last 24 hours)
                let twentyFourHoursAgo = calendar.date(byAdding: .hour, value: -24, to: now) ?? now
                let avgHR = try? await healthKitService.getAverageHeartRate(for: twentyFourHoursAgo, to: now)
                
                // VO2 Max
                let vo2 = try? await healthKitService.getLatestVO2Max()
                
                await MainActor.run {
                    sleepHours = sleep
                    restingHeartRate = restingHR
                    hrv = hrvValue
                    averageHeartRate = avgHR
                    vo2Max = vo2
                    
                    // Calculate sleep score with actual values
                    sleepScore = calculateSleepScore(sleep: sleep, hrv: hrvValue, restingHR: restingHR)
                    
                    isLoading = false
                }
            } catch {
                await MainActor.run {
                    isLoading = false
                    print("Error loading recovery data: \(error)")
                }
            }
        }
    }
}


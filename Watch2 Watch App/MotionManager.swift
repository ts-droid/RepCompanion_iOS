#if targetEnvironment(simulator)
import Foundation
import Combine

class MotionManager: ObservableObject {
    @Published var repCount = 0
    @Published var isDetecting = false
    
    func startDetecting() {
        print("[MotionManager] Simulated start (Stub)")
    }
    
    func stopDetecting() {
        print("[MotionManager] Simulated stop (Stub)")
    }
    
    func resetCount() {
        repCount = 0
    }
}
#else
import Foundation
import CoreMotion
import Combine

class MotionManager: ObservableObject {
    @Published var repCount = 0
    @Published var isDetecting = false
    
    private let motionManager = CMMotionManager()
    private let updateInterval = 0.1
    
    // Algorithm parameters
    private let threshold: Double = 1.2
    private let cooldownTime: TimeInterval = 0.8
    private var lastRepTime = Date.distantPast
    private var isGoingUp = false
    
    func startDetecting() {
        guard motionManager.isAccelerometerAvailable else { return }
        
        repCount = 0
        isDetecting = true
        
        motionManager.accelerometerUpdateInterval = updateInterval
        motionManager.startAccelerometerUpdates(to: .main) { [weak self] data, error in
            guard let self = self, let data = data else { return }
            self.processMotionData(data.acceleration)
        }
    }
    
    func stopDetecting() {
        motionManager.stopAccelerometerUpdates()
        isDetecting = false
    }
    
    func resetCount() {
        repCount = 0
    }
    
    private func processMotionData(_ acceleration: CMAcceleration) {
        // Calculate magnitude of acceleration (simplified for quick detection)
        // We focus on the change in acceleration
        let magnitude = sqrt(pow(acceleration.x, 2) + pow(acceleration.y, 2) + pow(acceleration.z, 2))
        
        // Simple peak detection
        if magnitude > threshold {
            if !isGoingUp {
                // Potential start of a rep
                isGoingUp = true
            }
        } else if magnitude < (threshold * 0.8) {
            if isGoingUp {
                // Completed a peak section
                isGoingUp = false
                
                // Check cooldown to avoid double counting
                let now = Date()
                if now.timeIntervalSince(lastRepTime) > cooldownTime {
                    repCount += 1
                    lastRepTime = now
                    print("[Motion] Rep detected! Count: \(repCount)")
                }
            }
        }
    }
}
#endif

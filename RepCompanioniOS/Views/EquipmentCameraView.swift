import SwiftUI
import AVFoundation
import UIKit
import Combine

struct EquipmentCameraView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var cameraManager = CameraManager()
    @State private var capturedImage: UIImage?
    @State private var isRecognizing = false
    @State private var recognizedEquipment: [String] = []
    @State private var errorMessage: String?
    
    let onEquipmentDetected: ([String]) -> Void
    
    var body: some View {
        NavigationView {
            ZStack {
                if let image = capturedImage {
                    // Show captured image
                    Image(uiImage: image)
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .overlay(
                            VStack {
                                Spacer()
                                if isRecognizing {
                                    ProgressView("Känner igen utrustning...")
                                        .padding()
                                        .background(Color.black.opacity(0.7))
                                        .cornerRadius(12)
                                } else if !recognizedEquipment.isEmpty {
                                    VStack(alignment: .leading, spacing: 8) {
                                        Text("Identifierad utrustning:")
                                            .font(.headline)
                                            .foregroundColor(.white)
                                        ForEach(recognizedEquipment, id: \.self) { equipment in
                                            Text("• \(equipment)")
                                                .foregroundColor(.white)
                                        }
                                        Button("Lägg till") {
                                            onEquipmentDetected(recognizedEquipment)
                                            dismiss()
                                        }
                                        .buttonStyle(.borderedProminent)
                                    }
                                    .padding()
                                    .background(Color.black.opacity(0.8))
                                    .cornerRadius(12)
                                }
                            }
                            .padding()
                        )
                } else {
                    // Camera preview
                    CameraPreview(cameraManager: cameraManager)
                        .ignoresSafeArea()
                        .overlay(
                            VStack {
                                Spacer()
                                Button(action: capturePhoto) {
                                    Circle()
                                        .fill(Color.white)
                                        .frame(width: 70, height: 70)
                                        .overlay(
                                            Circle()
                                                .stroke(Color.accentBlue, lineWidth: 4)
                                                .frame(width: 60, height: 60)
                                        )
                                }
                                .padding(.bottom, 40)
                            }
                        )
                }
            }
            .navigationTitle("Skanna utrustning")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Avbryt") {
                        dismiss()
                    }
                }
                if capturedImage != nil {
                    ToolbarItem(placement: .navigationBarTrailing) {
                        Button("Ta om") {
                            capturedImage = nil
                            recognizedEquipment = []
                        }
                    }
                }
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
        .onAppear {
            cameraManager.requestPermission()
        }
    }
    
    private func capturePhoto() {
        cameraManager.capturePhoto { image in
            if let image = image {
                capturedImage = image
                recognizeEquipment(image: image)
            }
        }
    }
    
    private func recognizeEquipment(image: UIImage) {
        isRecognizing = true
        recognizedEquipment = []
        
        Task {
            do {
                // Convert image to base64
                guard let imageData = image.jpegData(compressionQuality: 0.8) else {
                    throw NSError(domain: "Camera", code: 1, userInfo: [NSLocalizedDescriptionKey: "Kunde inte konvertera bild"])
                }
                let base64String = imageData.base64EncodedString()
                
                // Call API
                let response = try await APIService.shared.recognizeEquipment(imageBase64: base64String)
                
                await MainActor.run {
                    recognizedEquipment = response.equipment
                    isRecognizing = false
                }
            } catch {
                await MainActor.run {
                    errorMessage = "Kunde inte känna igen utrustning: \(error.localizedDescription)"
                    isRecognizing = false
                }
            }
        }
    }
}

// MARK: - Camera Manager

@MainActor
class CameraManager: NSObject, ObservableObject {
    private let session = AVCaptureSession()
    private let photoOutput = AVCapturePhotoOutput()
    private var videoDeviceInput: AVCaptureDeviceInput?
    @Published var permissionGranted = false
    
    override init() {
        super.init()
        setupSession()
    }
    
    func requestPermission() {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            permissionGranted = true
            startSession()
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
                Task { @MainActor in
                    self?.permissionGranted = granted
                    if granted {
                        self?.startSession()
                    }
                }
            }
        default:
            permissionGranted = false
        }
    }
    
    private func setupSession() {
        session.beginConfiguration()
        session.sessionPreset = .photo
        
        // Try to use ultra-wide camera first (better for scanning equipment), fallback to wide angle
        var videoDevice: AVCaptureDevice?
        
        // First try ultra-wide camera (best for equipment scanning)
        if let ultraWideDevice = AVCaptureDevice.default(.builtInUltraWideCamera, for: .video, position: .back) {
            videoDevice = ultraWideDevice
        } else if let wideDevice = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back) {
            videoDevice = wideDevice
        }
        
        guard let videoDevice = videoDevice,
              let videoInput = try? AVCaptureDeviceInput(device: videoDevice) else {
            session.commitConfiguration()
            return
        }
        
        if session.canAddInput(videoInput) {
            session.addInput(videoInput)
            videoDeviceInput = videoInput
        }
        
        if session.canAddOutput(photoOutput) {
            session.addOutput(photoOutput)
        }
        
        session.commitConfiguration()
    }
    
    func startSession() {
        if !session.isRunning {
            DispatchQueue.global(qos: .userInitiated).async { [weak self] in
                self?.session.startRunning()
            }
        }
    }
    
    func stopSession() {
        if session.isRunning {
            DispatchQueue.global(qos: .userInitiated).async { [weak self] in
                self?.session.stopRunning()
            }
        }
    }
    
    func capturePhoto(completion: @escaping (UIImage?) -> Void) {
        let settings = AVCapturePhotoSettings()
        photoOutput.capturePhoto(with: settings, delegate: PhotoCaptureDelegate(completion: completion))
    }
    
    var sessionOutput: AVCaptureSession {
        session
    }
}

// MARK: - Photo Capture Delegate

class PhotoCaptureDelegate: NSObject, AVCapturePhotoCaptureDelegate {
    private let completion: (UIImage?) -> Void
    
    init(completion: @escaping (UIImage?) -> Void) {
        self.completion = completion
    }
    
    func photoOutput(_ output: AVCapturePhotoOutput, didFinishProcessingPhoto photo: AVCapturePhoto, error: Error?) {
        if let error = error {
            print("Error capturing photo: \(error)")
            completion(nil)
            return
        }
        
        guard let imageData = photo.fileDataRepresentation(),
              let image = UIImage(data: imageData) else {
            completion(nil)
            return
        }
        
        completion(image)
    }
}

// MARK: - Camera Preview

struct CameraPreview: UIViewControllerRepresentable {
    let cameraManager: CameraManager
    
    func makeUIViewController(context: Context) -> CameraPreviewController {
        let controller = CameraPreviewController()
        controller.cameraManager = cameraManager
        return controller
    }
    
    func updateUIViewController(_ uiViewController: CameraPreviewController, context: Context) {}
}

class CameraPreviewController: UIViewController {
    var cameraManager: CameraManager?
    private var previewLayer: AVCaptureVideoPreviewLayer?
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        guard let cameraManager = cameraManager else { return }
        
        let previewLayer = AVCaptureVideoPreviewLayer(session: cameraManager.sessionOutput)
        previewLayer.videoGravity = .resizeAspectFill
        view.layer.addSublayer(previewLayer)
        self.previewLayer = previewLayer
    }
    
    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        previewLayer?.frame = view.bounds
    }
    
    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        cameraManager?.startSession()
    }
    
    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        cameraManager?.stopSession()
    }
}


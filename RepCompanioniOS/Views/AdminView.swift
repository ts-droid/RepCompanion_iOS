import SwiftUI

/// Admin view for managing pending exercises and equipment (Dev only)
struct AdminView: View {
    private let apiService = APIService.shared
    @StateObject private var authService = AuthService.shared
    
    @State private var pendingExercises: [PendingExercise] = []
    @State private var pendingEquipment: [PendingEquipment] = []
    @State private var selectedTab = 0 // 0: Exercises, 1: Equipment
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var showRejectDialog = false
    @State private var selectedItemId: String?
    @State private var rejectReason: String = ""
    @State private var isRejecting = false
    
    private var isDev: Bool {
        authService.currentUserEmail == "dev@recompute.it" || 
        authService.currentUserEmail == "dev@test.com"
    }
    
    var body: some View {
        NavigationView {
            if !isDev {
                VStack(spacing: 20) {
                    Image(systemName: "lock.shield.fill")
                        .font(.system(size: 60))
                        .foregroundColor(.red)
                    Text("Access denied")
                        .font(.title2)
                        .fontWeight(.bold)
                    Text("Only developers have access to this view.")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                }
                .navigationTitle("Admin")
            } else {
                VStack(spacing: 0) {
                    // Tab selector
                    Picker("Type", selection: $selectedTab) {
                        Text("Exercises").tag(0)
                        Text("Utrustning").tag(1)
                    }
                    .pickerStyle(.segmented)
                    .padding()
                    
                    if isLoading {
                        Spacer()
                        ProgressView()
                        Spacer()
                    } else if let error = errorMessage {
                        Spacer()
                        VStack(spacing: 12) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .font(.system(size: 40))
                                .foregroundColor(.orange)
                            Text("Fel")
                                .font(.headline)
                            Text(error)
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                                .multilineTextAlignment(.center)
                                .padding(.horizontal)
                            Button("Try again") {
                                loadPendingItems()
                            }
                            .buttonStyle(.borderedProminent)
                        }
                        Spacer()
                    } else {
                        if selectedTab == 0 {
                            exercisesList
                        } else {
                            equipmentList
                        }
                    }
                }
                .navigationTitle("Admin")
                .toolbar {
                    ToolbarItem(placement: .navigationBarTrailing) {
                        Button {
                            loadPendingItems()
                        } label: {
                            Image(systemName: "arrow.clockwise")
                        }
                    }
                }
                .task {
                    loadPendingItems()
                }
                .alert("Avvisa", isPresented: $showRejectDialog) {
                    TextField("Reason (optional)", text: $rejectReason)
                    Button("Avbryt", role: .cancel) {
                        rejectReason = ""
                        selectedItemId = nil
                    }
                    Button("Avvisa", role: .destructive) {
                        if let id = selectedItemId {
                            rejectItem(id: id)
                        }
                    }
                } message: {
                    Text("Do you want to reject this item? You can provide a reason.")
                }
            }
        }
    }
    
    private var exercisesList: some View {
        Group {
            if pendingExercises.isEmpty {
                VStack(spacing: 16) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 50))
                        .foregroundColor(.green)
                    Text("No pending exercises")
                        .font(.headline)
                    Text("All exercises have been reviewed.")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List {
                    ForEach(pendingExercises) { exercise in
                        AdminExerciseCard(exercise: exercise) {
                            approveExercise(id: exercise.id)
                        } onReject: {
                            selectedItemId = exercise.id
                            showRejectDialog = true
                        }
                    }
                }
            }
        }
    }
    
    private var equipmentList: some View {
        Group {
            if pendingEquipment.isEmpty {
                VStack(spacing: 16) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 50))
                        .foregroundColor(.green)
                    Text("No pending equipment")
                        .font(.headline)
                    Text("All equipment has been reviewed.")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List {
                    ForEach(pendingEquipment) { equipment in
                        AdminEquipmentCard(equipment: equipment) {
                            approveEquipment(id: equipment.id)
                        } onReject: {
                            selectedItemId = equipment.id
                            showRejectDialog = true
                        }
                    }
                }
            }
        }
    }
    
    private func loadPendingItems() {
        // #region agent log
        let _ = try? FileHandle(forWritingTo: URL(fileURLWithPath: "/Users/thomassoderberg/.gemini/antigravity/scratch/Test/RepCompanion 2/RepCompanion 2 Antigravity.xcodeproj/.cursor/debug.log")).seekToEndOfFile()
        let logData1 = "{\"sessionId\":\"debug-session\",\"runId\":\"run1\",\"hypothesisId\":\"C\",\"location\":\"AdminView.swift:170\",\"message\":\"loadPendingItems called\",\"data\":{},\"timestamp\":\(Int(Date().timeIntervalSince1970 * 1000))}\n".data(using: .utf8)!
        try? logData1.write(to: URL(fileURLWithPath: "/Users/thomassoderberg/.gemini/antigravity/scratch/Test/RepCompanion 2/RepCompanion 2 Antigravity.xcodeproj/.cursor/debug.log"), options: .atomic)
        // #endregion
        isLoading = true
        errorMessage = nil
        
        Task {
            do {
                // #region agent log
                let _ = try? FileHandle(forWritingTo: URL(fileURLWithPath: "/Users/thomassoderberg/.gemini/antigravity/scratch/Test/RepCompanion 2/RepCompanion 2 Antigravity.xcodeproj/.cursor/debug.log")).seekToEndOfFile()
                let logData2 = "{\"sessionId\":\"debug-session\",\"runId\":\"run1\",\"hypothesisId\":\"C\",\"location\":\"AdminView.swift:176\",\"message\":\"Starting API calls\",\"data\":{},\"timestamp\":\(Int(Date().timeIntervalSince1970 * 1000))}\n".data(using: .utf8)!
                try? logData2.write(to: URL(fileURLWithPath: "/Users/thomassoderberg/.gemini/antigravity/scratch/Test/RepCompanion 2/RepCompanion 2 Antigravity.xcodeproj/.cursor/debug.log"), options: .atomic)
                // #endregion
                async let exercises = apiService.fetchPendingExercises()
                async let equipment = apiService.fetchPendingEquipment()
                
                let (exercisesResult, equipmentResult) = try await (exercises, equipment)
                
                // #region agent log
                let _ = try? FileHandle(forWritingTo: URL(fileURLWithPath: "/Users/thomassoderberg/.gemini/antigravity/scratch/Test/RepCompanion 2/RepCompanion 2 Antigravity.xcodeproj/.cursor/debug.log")).seekToEndOfFile()
                let logData3 = "{\"sessionId\":\"debug-session\",\"runId\":\"run1\",\"hypothesisId\":\"C\",\"location\":\"AdminView.swift:181\",\"message\":\"API calls succeeded\",\"data\":{\"exercisesCount\":\(exercisesResult.count),\"equipmentCount\":\(equipmentResult.count)},\"timestamp\":\(Int(Date().timeIntervalSince1970 * 1000))}\n".data(using: .utf8)!
                try? logData3.write(to: URL(fileURLWithPath: "/Users/thomassoderberg/.gemini/antigravity/scratch/Test/RepCompanion 2/RepCompanion 2 Antigravity.xcodeproj/.cursor/debug.log"), options: .atomic)
                // #endregion
                await MainActor.run {
                    self.pendingExercises = exercisesResult
                    self.pendingEquipment = equipmentResult
                    self.isLoading = false
                }
            } catch {
                // #region agent log
                let _ = try? FileHandle(forWritingTo: URL(fileURLWithPath: "/Users/thomassoderberg/.gemini/antigravity/scratch/Test/RepCompanion 2/RepCompanion 2 Antigravity.xcodeproj/.cursor/debug.log")).seekToEndOfFile()
                let errorDesc = "\(error)"
                let errorType = "\(type(of: error))"
                let logData4 = "{\"sessionId\":\"debug-session\",\"runId\":\"run1\",\"hypothesisId\":\"C\",\"location\":\"AdminView.swift:186\",\"message\":\"API calls failed\",\"data\":{\"error\":\"\(errorDesc)\",\"errorType\":\"\(errorType)\"},\"timestamp\":\(Int(Date().timeIntervalSince1970 * 1000))}\n".data(using: .utf8)!
                try? logData4.write(to: URL(fileURLWithPath: "/Users/thomassoderberg/.gemini/antigravity/scratch/Test/RepCompanion 2/RepCompanion 2 Antigravity.xcodeproj/.cursor/debug.log"), options: .atomic)
                // #endregion
                await MainActor.run {
                    self.errorMessage = error.localizedDescription
                    self.isLoading = false
                }
            }
        }
    }
    
    private func approveExercise(id: String) {
        isLoading = true
        Task {
            do {
                _ = try await apiService.approvePendingExercise(id: id)
                await MainActor.run {
                    pendingExercises.removeAll { $0.id == id }
                    isLoading = false
                }
            } catch {
                await MainActor.run {
                    errorMessage = error.localizedDescription
                    isLoading = false
                }
            }
        }
    }
    
    private func approveEquipment(id: String) {
        isLoading = true
        Task {
            do {
                _ = try await apiService.approvePendingEquipment(id: id)
                await MainActor.run {
                    pendingEquipment.removeAll { $0.id == id }
                    isLoading = false
                }
            } catch {
                await MainActor.run {
                    errorMessage = error.localizedDescription
                    isLoading = false
                }
            }
        }
    }
    
    private func rejectItem(id: String) {
        isRejecting = true
        Task {
            do {
                if selectedTab == 0 {
                    try await apiService.rejectPendingExercise(id: id, reason: rejectReason.isEmpty ? nil : rejectReason)
                    await MainActor.run {
                        pendingExercises.removeAll { $0.id == id }
                    }
                } else {
                    try await apiService.rejectPendingEquipment(id: id, reason: rejectReason.isEmpty ? nil : rejectReason)
                    await MainActor.run {
                        pendingEquipment.removeAll { $0.id == id }
                    }
                }
                await MainActor.run {
                    rejectReason = ""
                    selectedItemId = nil
                    isRejecting = false
                }
            } catch {
                await MainActor.run {
                    errorMessage = error.localizedDescription
                    isRejecting = false
                }
            }
        }
    }
}

struct AdminExerciseCard: View {
    let exercise: PendingExercise
    let onApprove: () -> Void
    let onReject: () -> Void
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(exercise.nameEn ?? exercise.name)
                        .font(.headline)
                    if let aiName = exercise.aiGeneratedName, aiName != exercise.name {
                        Text("AI: \(aiName)")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
                Spacer()
                Text(exercise.createdAt, style: .relative)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            if let description = exercise.description, !description.isEmpty {
                Text(description)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
            
            HStack(spacing: 12) {
                if let category = exercise.category {
                    Label(category, systemImage: "tag.fill")
                        .font(.caption)
                        .foregroundColor(.blue)
                }
                if let difficulty = exercise.difficulty {
                    Label(difficulty, systemImage: "chart.bar.fill")
                        .font(.caption)
                        .foregroundColor(.orange)
                }
            }
            
            if let muscles = exercise.primaryMuscles, !muscles.isEmpty {
                Text("Muskler: \(muscles.joined(separator: ", "))")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            HStack(spacing: 12) {
                Button {
                    onApprove()
                } label: {
                    Label("Approve", systemImage: "checkmark.circle.fill")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(.green)
                
                Button {
                    onReject()
                } label: {
                    Label("Avvisa", systemImage: "xmark.circle.fill")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .tint(.red)
            }
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
    }
}

struct AdminEquipmentCard: View {
    let equipment: PendingEquipment
    let onApprove: () -> Void
    let onReject: () -> Void
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(equipment.nameEn ?? equipment.name)
                        .font(.headline)
                    if let aiName = equipment.aiGeneratedName, aiName != equipment.name {
                        Text("AI: \(aiName)")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
                Spacer()
                Text(equipment.createdAt, style: .relative)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            if let description = equipment.description, !description.isEmpty {
                Text(description)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
            
            HStack(spacing: 12) {
                if let category = equipment.category {
                    Label(category, systemImage: "tag.fill")
                        .font(.caption)
                        .foregroundColor(.blue)
                }
                if let type = equipment.type {
                    Label(type, systemImage: "cube.fill")
                        .font(.caption)
                        .foregroundColor(.purple)
                }
            }
            
            HStack(spacing: 12) {
                Button {
                    onApprove()
                } label: {
                    Label("Approve", systemImage: "checkmark.circle.fill")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(.green)
                
                Button {
                    onReject()
                } label: {
                    Label("Avvisa", systemImage: "xmark.circle.fill")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .tint(.red)
            }
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
    }
}

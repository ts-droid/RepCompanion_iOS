import SwiftUI
import SwiftData
import AVKit

/// View for displaying exercise details with video
struct ExerciseDetailView: View {
    let exercise: ExerciseCatalog
    @Environment(\.colorScheme) private var colorScheme
    @State private var showVideo = false
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                // Video Section
                if let youtubeUrl = exercise.youtubeUrl {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Videoinstruktion")
                            .font(.headline)
                            .foregroundStyle(Color.textPrimary(for: colorScheme))
                        
                        Button(action: {
                            showVideo = true
                        }) {
                            ZStack {
                                RoundedRectangle(cornerRadius: 12)
                                    .fill(Color.black)
                                    .aspectRatio(16/9, contentMode: .fit)
                                
                                Image(systemName: "play.circle.fill")
                                    .font(.system(size: 60))
                                    .foregroundColor(.white)
                            }
                        }
                        .sheet(isPresented: $showVideo) {
                            if let url = URL(string: youtubeUrl) {
                                SafariView(url: url)
                            }
                        }
                    }
                }
                
                // Exercise Info
                VStack(alignment: .leading, spacing: 16) {
                    Text("Information")
                        .font(.headline)
                        .foregroundStyle(Color.textPrimary(for: colorScheme))
                    
                    InfoRow(label: "Kategori", value: exercise.category)
                    InfoRow(label: "Difficulty level", value: exercise.difficulty.capitalized)
                    InfoRow(label: "Type", value: exercise.isCompound ? "Sammansatt" : "Isolerad")
                    
                    if let pattern = exercise.movementPattern {
                        InfoRow(label: "Movement patterns", value: pattern)
                    }
                }
                .padding()
                .background(Color.cardBackground(for: colorScheme))
                .cornerRadius(12)
                
                // Muscles
                VStack(alignment: .leading, spacing: 12) {
                    Text("Muscle groups")
                        .font(.headline)
                        .foregroundStyle(Color.textPrimary(for: colorScheme))
                    
                    VStack(alignment: .leading, spacing: 8) {
                        if !exercise.primaryMuscles.isEmpty {
                            Text("Primary")
                                .font(.subheadline)
                                .foregroundStyle(Color.textSecondary(for: colorScheme))
                            TagView(tags: exercise.primaryMuscles, colorScheme: colorScheme)
                        }
                        
                        if !exercise.secondaryMuscles.isEmpty {
                            Text("Secondary")
                                .font(.subheadline)
                                .foregroundStyle(Color.textSecondary(for: colorScheme))
                            TagView(tags: exercise.secondaryMuscles, colorScheme: colorScheme)
                        }
                    }
                }
                .padding()
                .background(Color.cardBackground(for: colorScheme))
                .cornerRadius(12)
                
                // Required Equipment
                if !exercise.requiredEquipment.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Utrustning")
                            .font(.headline)
                            .foregroundStyle(Color.textPrimary(for: colorScheme))
                        
                        TagView(tags: exercise.requiredEquipment, colorScheme: colorScheme)
                    }
                    .padding()
                    .background(Color.cardBackground(for: colorScheme))
                    .cornerRadius(12)
                }
                
                // Description
                if let description = exercise.exerciseDescription {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Description")
                            .font(.headline)
                            .foregroundStyle(Color.textPrimary(for: colorScheme))
                        
                        Text(description)
                            .font(.body)
                            .foregroundStyle(Color.textSecondary(for: colorScheme))
                    }
                    .padding()
                    .background(Color.cardBackground(for: colorScheme))
                    .cornerRadius(12)
                }
                
                // Instructions
                if let instructions = exercise.instructions {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Instruktioner")
                            .font(.headline)
                            .foregroundStyle(Color.textPrimary(for: colorScheme))
                        
                        Text(instructions)
                            .font(.body)
                            .foregroundStyle(Color.textSecondary(for: colorScheme))
                    }
                    .padding()
                    .background(Color.cardBackground(for: colorScheme))
                    .cornerRadius(12)
                }
            }
            .padding()
        }
        .background(Color.appBackground(for: colorScheme))
        .navigationTitle(exercise.name)
        .navigationBarTitleDisplayMode(.large)
    }
}

struct InfoRow: View {
    let label: String
    let value: String
    @Environment(\.colorScheme) private var colorScheme
    
    var body: some View {
        HStack {
            Text(label)
                .foregroundStyle(Color.textSecondary(for: colorScheme))
            Spacer()
            Text(value)
                .foregroundStyle(Color.textPrimary(for: colorScheme))
                .fontWeight(.medium)
        }
    }
}

struct TagView: View {
    let tags: [String]
    let colorScheme: ColorScheme
    
    var body: some View {
        FlowLayout(spacing: 8) {
            ForEach(tags, id: \.self) { tag in
                Text(tag)
                    .font(.caption)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(Color.accentBlue.opacity(0.2))
                    .foregroundColor(Color.accentBlue)
                    .cornerRadius(8)
            }
        }
    }
}

struct FlowLayout: Layout {
    var spacing: CGFloat = 8
    
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = FlowResult(
            in: proposal.replacingUnspecifiedDimensions().width,
            subviews: subviews,
            spacing: spacing
        )
        return result.size
    }
    
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = FlowResult(
            in: bounds.width,
            subviews: subviews,
            spacing: spacing
        )
        for (index, subview) in subviews.enumerated() {
            subview.place(at: CGPoint(x: bounds.minX + result.frames[index].minX, y: bounds.minY + result.frames[index].minY), proposal: .unspecified)
        }
    }
    
    struct FlowResult {
        var size: CGSize = .zero
        var frames: [CGRect] = []
        
        init(in maxWidth: CGFloat, subviews: Subviews, spacing: CGFloat) {
            var currentX: CGFloat = 0
            var currentY: CGFloat = 0
            var lineHeight: CGFloat = 0
            
            for subview in subviews {
                let size = subview.sizeThatFits(.unspecified)
                
                if currentX + size.width > maxWidth && currentX > 0 {
                    currentX = 0
                    currentY += lineHeight + spacing
                    lineHeight = 0
                }
                
                frames.append(CGRect(x: currentX, y: currentY, width: size.width, height: size.height))
                lineHeight = max(lineHeight, size.height)
                currentX += size.width + spacing
            }
            
            self.size = CGSize(
                width: maxWidth,
                height: currentY + lineHeight
            )
        }
    }
}

import SafariServices

struct SafariView: UIViewControllerRepresentable {
    let url: URL
    
    func makeUIViewController(context: Context) -> SFSafariViewController {
        return SFSafariViewController(url: url)
    }
    
    func updateUIViewController(_ uiViewController: SFSafariViewController, context: Context) {}
}


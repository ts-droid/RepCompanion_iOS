import SwiftUI

struct FocusTagChip: View {
    let title: String
    let isSelected: Bool
    let colorScheme: ColorScheme
    let selectedTheme: String
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.subheadline)
                .fontWeight(.medium)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(
                    ZStack {
                        if isSelected {
                            Color.themePrimaryColor(theme: selectedTheme, colorScheme: colorScheme)
                        } else {
                            Color.cardBackground(for: colorScheme)
                        }
                    }
                )
                .foregroundColor(isSelected ? .white : Color.textPrimary(for: colorScheme).opacity(0.8))
                .cornerRadius(20)
                .overlay(
                    RoundedRectangle(cornerRadius: 20)
                        .stroke(
                            isSelected 
                                ? Color.themePrimaryColor(theme: selectedTheme, colorScheme: colorScheme)
                                : Color.textSecondary(for: colorScheme).opacity(0.4),
                            lineWidth: 1.5
                        )
                )
        }
    }
}

struct FocusFlowLayout: Layout {
    var spacing: CGFloat = 8
    
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = layout(proposal: proposal, subviews: subviews)
        return result.size
    }
    
    private func layout(proposal: ProposedViewSize, subviews: Subviews, bounds: CGRect? = nil) -> (size: CGSize, positions: [CGPoint]) {
        let maxWidth = proposal.width ?? bounds?.width ?? .infinity
        var currentX: CGFloat = bounds?.minX ?? 0
        var currentY: CGFloat = bounds?.minY ?? 0
        var lineHeight: CGFloat = 0
        var totalWidth: CGFloat = 0
        var totalHeight: CGFloat = 0
        var positions: [CGPoint] = []
        
        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            
            if currentX + size.width > (bounds?.minX ?? 0) + maxWidth && currentX > (bounds?.minX ?? 0) {
                currentX = bounds?.minX ?? 0
                currentY += lineHeight + spacing
                lineHeight = 0
            }
            
            positions.append(CGPoint(x: currentX + size.width / 2, y: currentY + size.height / 2))
            
            lineHeight = max(lineHeight, size.height)
            currentX += size.width + spacing
            totalWidth = max(totalWidth, currentX)
            totalHeight = max(totalHeight, currentY + lineHeight)
        }
        
        return (CGSize(width: totalWidth, height: totalHeight), positions)
    }
    
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = layout(proposal: proposal, subviews: subviews, bounds: bounds)
        for (index, subview) in subviews.enumerated() {
            subview.place(at: result.positions[index], proposal: .unspecified)
        }
    }
    
    // Helper to fix the layout implementation if needed
    func placeSubviewsManual(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let maxWidth = bounds.width
        var x = bounds.minX
        var y = bounds.minY
        var rowHeight: CGFloat = 0
        
        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x + size.width > bounds.maxX {
                x = bounds.minX
                y += rowHeight + spacing
                rowHeight = 0
            }
            subview.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }

    // Standard Layout protocol implementation
    static var layoutProperties: LayoutProperties {
        var properties = LayoutProperties()
        properties.stackOrientation = .horizontal
        return properties
    }
}

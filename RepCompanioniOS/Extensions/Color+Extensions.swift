import SwiftUI

extension Color {
    // Dark mode colors
    static let appBackgroundDark = Color(hex: "0B0F19")
    static let cardBackgroundDark = Color(hex: "151A25")
    static let textPrimaryDark = Color.white
    static let textSecondaryDark = Color(hex: "8F9BB3")
    
    // Light mode colors
    static let appBackgroundLight = Color(hex: "F5F5F7")
    static let cardBackgroundLight = Color.white
    static let textPrimaryLight = Color.black
    static let textSecondaryLight = Color(hex: "6E6E73")
    
    // Legacy accent color - now uses theme colors
    static var accentBlue: Color {
        primaryColor(for: .light) // Default to light mode for backward compatibility
    }
    static let nutritionGreen = Color(hex: "2E7D32")
    static let activityBlue = Color(hex: "6395B8")
    static let recoveryPurple = Color(hex: "5E5CE6")
    
    // MARK: - Theme Colors with Gradients
    
    /// Get primary color for a theme (based on selected theme from UserDefaults)
    static func primaryColor(for colorScheme: ColorScheme) -> Color {
        let theme = UserDefaults.standard.string(forKey: "selectedTheme") ?? "Main"
        return themePrimaryColor(theme: theme, colorScheme: colorScheme)
    }
    
    /// Get gradient colors for a theme
    static func themeGradient(theme: String, colorScheme: ColorScheme) -> LinearGradient {
        let colors = themeGradientColors(theme: theme, colorScheme: colorScheme)
        return LinearGradient(
            gradient: Gradient(colors: colors),
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }
    
    /// Get gradient colors array for a theme
    static func themeGradientColors(theme: String, colorScheme: ColorScheme) -> [Color] {
        switch theme.lowercased() {
        case "main":
            return colorScheme == .dark 
                ? [Color(hex: "06B6D4"), Color(hex: "14B8A6"), Color(hex: "22C55E")]
                : [Color(hex: "06B6D4"), Color(hex: "14B8A6"), Color(hex: "22C55E")]
        case "forest":
            return colorScheme == .dark
                ? [Color(hex: "22C55E"), Color(hex: "10B981")]
                : [Color(hex: "22C55E"), Color(hex: "10B981")]
        case "purple":
            return colorScheme == .dark
                ? [Color(hex: "A855F7"), Color(hex: "3B82F6")]
                : [Color(hex: "A855F7"), Color(hex: "3B82F6")]
        case "ocean":
            return colorScheme == .dark
                ? [Color(hex: "3B82F6"), Color(hex: "06B6D4")]
                : [Color(hex: "3B82F6"), Color(hex: "06B6D4")]
        case "sunset":
            return colorScheme == .dark
                ? [Color(hex: "F59E0B"), Color(hex: "F97316")]
                : [Color(hex: "F59E0B"), Color(hex: "F97316")]
        case "slate":
            return colorScheme == .dark
                ? [Color(hex: "64748B"), Color(hex: "475569")]
                : [Color(hex: "64748B"), Color(hex: "475569")]
        case "crimson":
            return colorScheme == .dark
                ? [Color(hex: "DC2626"), Color(hex: "991B1B")]
                : [Color(hex: "DC2626"), Color(hex: "991B1B")]
        case "pink":
            return colorScheme == .dark
                ? [Color(hex: "EC4899"), Color(hex: "F472B6")]
                : [Color(hex: "EC4899"), Color(hex: "F472B6")]
        default:
            return [Color(hex: "06B6D4"), Color(hex: "14B8A6"), Color(hex: "22C55E")]
        }
    }
    
    /// Get primary color for a theme (single color, first gradient color)
    static func themePrimaryColor(theme: String, colorScheme: ColorScheme) -> Color {
        return themeGradientColors(theme: theme, colorScheme: colorScheme).first ?? Color(hex: "06B6D4")
    }
    
    /// Get average color from gradient (for solid backgrounds)
    static func themeAverageColor(theme: String, colorScheme: ColorScheme) -> Color {
        let colors = themeGradientColors(theme: theme, colorScheme: colorScheme)
        // Return middle color or first if only one
        if colors.count > 1 {
            return colors[colors.count / 2]
        }
        return colors.first ?? Color(hex: "06B6D4")
    }
    
    // Dynamic colors based on color scheme
    static func appBackground(for colorScheme: ColorScheme) -> Color {
        colorScheme == .dark ? appBackgroundDark : appBackgroundLight
    }
    
    static func cardBackground(for colorScheme: ColorScheme) -> Color {
        colorScheme == .dark ? cardBackgroundDark : cardBackgroundLight
    }
    
    static func textPrimary(for colorScheme: ColorScheme) -> Color {
        colorScheme == .dark ? textPrimaryDark : textPrimaryLight
    }
    
    static func textSecondary(for colorScheme: ColorScheme) -> Color {
        colorScheme == .dark ? textSecondaryDark : textSecondaryLight
    }
    
    // Legacy static properties for backward compatibility (default to dark)
    static var appBackground: Color {
        appBackgroundDark
    }
    
    static var cardBackground: Color {
        cardBackgroundDark
    }
    
    static var textPrimary: Color {
        textPrimaryDark
    }
    
    static var textSecondary: Color {
        textSecondaryDark
    }
}

// View extension to get dynamic colors based on current color scheme
extension View {
    @ViewBuilder
    func dynamicBackground(for colorScheme: ColorScheme) -> some View {
        self.background(Color.appBackground(for: colorScheme))
    }
    
    @ViewBuilder
    func dynamicCardBackground(for colorScheme: ColorScheme) -> some View {
        self.background(Color.cardBackground(for: colorScheme))
    }
    
    /// Apply theme gradient background to buttons and primary elements
    @ViewBuilder
    func themeGradientBackground(colorScheme: ColorScheme) -> some View {
        let theme = UserDefaults.standard.string(forKey: "selectedTheme") ?? "Main"
        self.background(Color.themeGradient(theme: theme, colorScheme: colorScheme))
    }
}

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (1, 1, 1, 0)
        }

        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue:  Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

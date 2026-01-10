import Foundation

extension Double {
    /// Formats a weight value for display, removing trailing .0 if it's an integer
    var formattedWeight: String {
        self.truncatingRemainder(dividingBy: 1) == 0 ? String(format: "%.0f", self) : String(self)
    }
}

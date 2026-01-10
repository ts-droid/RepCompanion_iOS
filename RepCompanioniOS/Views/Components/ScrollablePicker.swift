import SwiftUI

struct ScrollablePicker: View {
    let label: String
    @Binding var value: Int?
    let range: ClosedRange<Int>
    let step: Int
    let unit: String?
    let colorScheme: ColorScheme
    let selectedTheme: String
    let displayFormatter: ((Int) -> String)?

    init(
        label: String,
        value: Binding<Int?>,
        range: ClosedRange<Int>,
        step: Int = 1,
        unit: String? = nil,
        colorScheme: ColorScheme,
        selectedTheme: String = "Main",
        displayFormatter: ((Int) -> String)? = nil
    ) {
        self.label = label
        self._value = value
        self.range = range
        self.step = step
        self.unit = unit
        self.colorScheme = colorScheme
        self.selectedTheme = selectedTheme
        self.displayFormatter = displayFormatter
    }

    private var values: [Int] {
        Array(stride(from: range.lowerBound, through: range.upperBound, by: step))
    }

    // Binder som gör optional-värdet icke-optional för Picker
    private var selectionBinding: Binding<Int> {
        Binding(
            get: {
                if let current = value, values.contains(current) {
                    return current
                }
                // Fallback till första värdet i intervallet
                return values.first ?? range.lowerBound
            },
            set: { newValue in
                value = newValue
            }
        )
    }

    private func displayText(for value: Int) -> String {
        if let formatter = displayFormatter {
            return formatter(value)
        }
        return "\(value)"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.caption)
                .foregroundColor(Color.textSecondary(for: colorScheme))

            ZStack {
                RoundedRectangle(cornerRadius: 10)
                    .fill(Color.cardBackground(for: colorScheme))

                Picker("", selection: selectionBinding) {
                    ForEach(values, id: \.self) { itemValue in
                        Text(displayText(for: itemValue))
                            .font(.system(size: 18, weight: .semibold))
                            .tag(itemValue)
                    }
                }
                .labelsHidden()
                .pickerStyle(.wheel)
                .frame(height: 120)
                .clipped()
            }
            .frame(height: 120)

            if let unit = unit {
                HStack {
                    Spacer()
                    Text(unit)
                        .font(.caption)
                        .foregroundColor(Color.textSecondary(for: colorScheme))
                        .padding(.top, 4)
                }
            }
        }
    }
}

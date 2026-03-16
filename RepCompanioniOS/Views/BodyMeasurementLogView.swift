import SwiftUI
import SwiftData

/// Sheet för att logga vikt och kroppsmått.
/// Prioriterade fält visas direkt; övriga fält kan expanderas.
struct BodyMeasurementLogView: View {

    let userId: String
    let focus: MeasurementFocus
    let previousMeasurement: BodyMeasurement?
    let onSaved: () -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var modelContext
    @Environment(\.colorScheme) private var colorScheme
    @AppStorage("colorScheme") private var colorSchemePref = "System"

    // ── Vikt ──────────────────────────────────────────────────
    @State private var weight: String = ""

    // ── Viktnedgångsmått ──────────────────────────────────────
    @State private var waist: String = ""
    @State private var hips: String = ""
    @State private var neck: String = ""
    @State private var chest: String = ""
    @State private var thighRight: String = ""
    @State private var thighLeft: String = ""

    // ── Muskeluppbyggnadsmått ─────────────────────────────────
    @State private var bicepRight: String = ""
    @State private var bicepLeft: String = ""
    @State private var calfRight: String = ""
    @State private var calfLeft: String = ""
    @State private var forearmRight: String = ""
    @State private var forearmLeft: String = ""
    @State private var shoulders: String = ""
    @State private var abdomen: String = ""

    @State private var showSecondary = false
    @State private var isSaving = false

    private var effectiveColorScheme: ColorScheme {
        switch colorSchemePref {
        case "Light": return .light
        case "Dark": return .dark
        default: return colorScheme
        }
    }

    var body: some View {
        NavigationView {
            ZStack {
                Color.appBackground(for: effectiveColorScheme).ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 20) {

                        // ── Vikt ──────────────────────────────
                        sectionCard(icon: "scalemass.fill", title: String(localized: "Vikt")) {
                            MeasurementField(
                                label: String(localized: "Vikt"),
                                unit: "kg",
                                value: $weight,
                                placeholder: previousMeasurement?.weight.map { formatVal($0) }
                            )
                        }

                        // ── Prioriterade mått ─────────────────
                        sectionCard(
                            icon: "ruler.fill",
                            title: focus == .weightLoss
                                ? String(localized: "Viktnedgångsmått")
                                : String(localized: "Muskeluppbyggnadsmått")
                        ) {
                            if focus == .weightLoss {
                                weightLossFields
                            } else {
                                muscleBuildFields
                            }
                        }

                        // ── Ytterligare mått (expandable) ──────
                        VStack(spacing: 0) {
                            Button {
                                withAnimation(.easeInOut(duration: 0.25)) {
                                    showSecondary.toggle()
                                }
                            } label: {
                                HStack {
                                    Image(systemName: showSecondary ? "chevron.up" : "chevron.down")
                                        .foregroundColor(Color.textSecondary(for: effectiveColorScheme))
                                    Text(String(localized: "Ytterligare mått"))
                                        .font(.subheadline)
                                        .fontWeight(.semibold)
                                        .foregroundColor(Color.textPrimary(for: effectiveColorScheme))
                                    Spacer()
                                }
                                .padding()
                                .background(Color.cardBackground(for: effectiveColorScheme))
                                .cornerRadius(showSecondary ? 0 : 12)
                            }

                            if showSecondary {
                                VStack(spacing: 12) {
                                    if focus == .weightLoss {
                                        muscleBuildFields
                                    } else {
                                        weightLossFields
                                    }
                                    // Mage alltid i sekundär
                                    MeasurementField(
                                        label: String(localized: "Mage (vid naveln)"),
                                        unit: "cm",
                                        value: $abdomen,
                                        placeholder: previousMeasurement?.abdomen.map { formatVal($0) }
                                    )
                                }
                                .padding()
                                .background(Color.cardBackground(for: effectiveColorScheme))
                                .cornerRadius(0)
                            }

                            // Bottom rounded corners of card
                            Rectangle()
                                .fill(Color.cardBackground(for: effectiveColorScheme))
                                .frame(height: 8)
                                .cornerRadius(12)
                        }
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                        .shadow(color: Color.black.opacity(0.04), radius: 4, x: 0, y: 2)
                        .padding(.horizontal)

                        Spacer(minLength: 24)
                    }
                    .padding(.top, 8)
                }
            }
            .navigationTitle(String(localized: "Logga mått"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button(String(localized: "Avbryt")) { dismiss() }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        save()
                    } label: {
                        if isSaving {
                            ProgressView().scaleEffect(0.8)
                        } else {
                            Text(String(localized: "Spara"))
                                .fontWeight(.semibold)
                        }
                    }
                    .disabled(isSaving || !hasAnyValue)
                }
            }
        }
    }

    // MARK: - Field groups

    @ViewBuilder
    private var weightLossFields: some View {
        MeasurementField(label: String(localized: "Midja"), unit: "cm", value: $waist,
                         placeholder: previousMeasurement?.waist.map { formatVal($0) })
        MeasurementField(label: String(localized: "Höfter / Stuss"), unit: "cm", value: $hips,
                         placeholder: previousMeasurement?.hips.map { formatVal($0) })
        MeasurementField(label: String(localized: "Hals"), unit: "cm", value: $neck,
                         placeholder: previousMeasurement?.neck.map { formatVal($0) })
        MeasurementField(label: String(localized: "Bröst"), unit: "cm", value: $chest,
                         placeholder: previousMeasurement?.chest.map { formatVal($0) })
        MeasurementField(label: String(localized: "Lår höger"), unit: "cm", value: $thighRight,
                         placeholder: previousMeasurement?.thighRight.map { formatVal($0) })
        MeasurementField(label: String(localized: "Lår vänster"), unit: "cm", value: $thighLeft,
                         placeholder: previousMeasurement?.thighLeft.map { formatVal($0) })
    }

    @ViewBuilder
    private var muscleBuildFields: some View {
        MeasurementField(label: String(localized: "Bicep höger"), unit: "cm", value: $bicepRight,
                         placeholder: previousMeasurement?.bicepRight.map { formatVal($0) })
        MeasurementField(label: String(localized: "Bicep vänster"), unit: "cm", value: $bicepLeft,
                         placeholder: previousMeasurement?.bicepLeft.map { formatVal($0) })
        MeasurementField(label: String(localized: "Bröst"), unit: "cm", value: $chest,
                         placeholder: previousMeasurement?.chest.map { formatVal($0) })
        MeasurementField(label: String(localized: "Axlar"), unit: "cm", value: $shoulders,
                         placeholder: previousMeasurement?.shoulders.map { formatVal($0) })
        MeasurementField(label: String(localized: "Vader höger"), unit: "cm", value: $calfRight,
                         placeholder: previousMeasurement?.calfRight.map { formatVal($0) })
        MeasurementField(label: String(localized: "Vader vänster"), unit: "cm", value: $calfLeft,
                         placeholder: previousMeasurement?.calfLeft.map { formatVal($0) })
        MeasurementField(label: String(localized: "Underarm höger"), unit: "cm", value: $forearmRight,
                         placeholder: previousMeasurement?.forearmRight.map { formatVal($0) })
        MeasurementField(label: String(localized: "Underarm vänster"), unit: "cm", value: $forearmLeft,
                         placeholder: previousMeasurement?.forearmLeft.map { formatVal($0) })
    }

    // MARK: - Helpers

    private var hasAnyValue: Bool {
        ![weight, waist, hips, neck, chest, thighRight, thighLeft,
          bicepRight, bicepLeft, calfRight, calfLeft,
          forearmRight, forearmLeft, shoulders, abdomen]
            .allSatisfy { $0.trimmingCharacters(in: .whitespaces).isEmpty }
    }

    private func formatVal(_ v: Double) -> String {
        v.truncatingRemainder(dividingBy: 1) == 0
            ? String(Int(v))
            : String(format: "%.1f", v)
    }

    private func double(_ s: String) -> Double? {
        Double(s.replacingOccurrences(of: ",", with: ".").trimmingCharacters(in: .whitespaces))
    }

    private func save() {
        isSaving = true
        let m = BodyMeasurement(
            userId: userId,
            date: Date(),
            weight: double(weight),
            waist: double(waist),
            hips: double(hips),
            neck: double(neck),
            chest: double(chest),
            thighRight: double(thighRight),
            thighLeft: double(thighLeft),
            bicepRight: double(bicepRight),
            bicepLeft: double(bicepLeft),
            calfRight: double(calfRight),
            calfLeft: double(calfLeft),
            forearmRight: double(forearmRight),
            forearmLeft: double(forearmLeft),
            shoulders: double(shoulders),
            abdomen: double(abdomen)
        )
        BodyMeasurementService.shared.save(m, modelContext: modelContext)
        Task {
            await BodyMeasurementService.shared.createOnServer(m, modelContext: modelContext)
        }
        isSaving = false
        onSaved()
        dismiss()
    }

    // MARK: - Section card builder

    @ViewBuilder
    private func sectionCard<Content: View>(icon: String, title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Image(systemName: icon)
                    .foregroundColor(Color.accentBlue)
                Text(title)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundColor(Color.textPrimary(for: effectiveColorScheme))
            }
            .padding(.horizontal)
            .padding(.top, 14)

            VStack(spacing: 12) {
                content()
            }
            .padding(.horizontal)
            .padding(.bottom, 14)
        }
        .background(Color.cardBackground(for: effectiveColorScheme))
        .cornerRadius(12)
        .shadow(color: Color.black.opacity(0.04), radius: 4, x: 0, y: 2)
        .padding(.horizontal)
    }
}

// MARK: - MeasurementField

private struct MeasurementField: View {
    let label: String
    let unit: String
    @Binding var value: String
    var placeholder: String?

    @Environment(\.colorScheme) private var colorScheme
    @AppStorage("colorScheme") private var colorSchemePref = "System"

    private var effectiveCS: ColorScheme {
        switch colorSchemePref {
        case "Light": return .light
        case "Dark": return .dark
        default: return colorScheme
        }
    }

    var body: some View {
        HStack {
            Text(label)
                .font(.subheadline)
                .foregroundColor(Color.textPrimary(for: effectiveCS))
            Spacer()
            HStack(spacing: 4) {
                TextField(placeholder ?? "–", text: $value)
                    .keyboardType(.decimalPad)
                    .multilineTextAlignment(.trailing)
                    .frame(width: 72)
                    .font(.subheadline)
                    .foregroundColor(Color.textPrimary(for: effectiveCS))
                Text(unit)
                    .font(.caption)
                    .foregroundColor(Color.textSecondary(for: effectiveCS))
                    .frame(width: 22, alignment: .leading)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 7)
            .background(Color.appBackground(for: effectiveCS))
            .cornerRadius(8)
        }
    }
}

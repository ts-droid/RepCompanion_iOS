import SwiftUI
import SwiftData
import Charts

/// Visar vikt- och kroppsmåttsutveckling över tid med interaktiva chart.
struct BodyProgressView: View {

    let userId: String
    let focus: MeasurementFocus

    @Environment(\.modelContext) private var modelContext
    @Environment(\.colorScheme) private var colorScheme
    @AppStorage("colorScheme") private var colorSchemePref = "System"

    @State private var selectedRange: TimeRange = .threeMonths
    @State private var showLogSheet = false

    private var effectiveColorScheme: ColorScheme {
        switch colorSchemePref {
        case "Light": return .light
        case "Dark": return .dark
        default: return colorScheme
        }
    }

    // MARK: - Data

    private var allMeasurements: [BodyMeasurement] {
        BodyMeasurementService.shared.fetchAll(userId: userId, modelContext: modelContext)
    }

    private var filtered: [BodyMeasurement] {
        let cutoff = Calendar.current.date(byAdding: .day, value: -selectedRange.days, to: Date()) ?? Date()
        return allMeasurements.filter { $0.date >= cutoff }.sorted { $0.date < $1.date }
    }

    private var latestMeasurement: BodyMeasurement? { allMeasurements.first }

    // MARK: - Body

    var body: some View {
        ZStack {
            Color.appBackground(for: effectiveColorScheme).ignoresSafeArea()

            ScrollView {
                VStack(spacing: 20) {

                    // ── Tidsfilter ────────────────────────────
                    timeRangePicker

                    // ── Viktkort ──────────────────────────────
                    weightSection

                    // ── Mätkort (goal-relevanta mått) ─────────
                    measurementCardsSection

                    Spacer(minLength: 24)
                }
                .padding(.top, 8)
            }
        }
        .navigationTitle(String(localized: "Vikt & Kroppsmått"))
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button {
                    showLogSheet = true
                } label: {
                    Label(String(localized: "Logga"), systemImage: "plus.circle.fill")
                }
            }
        }
        .sheet(isPresented: $showLogSheet) {
            BodyMeasurementLogView(
                userId: userId,
                focus: focus,
                previousMeasurement: latestMeasurement,
                onSaved: {}
            )
        }
    }

    // MARK: - Subviews

    private var timeRangePicker: some View {
        HStack(spacing: 8) {
            ForEach(TimeRange.allCases) { range in
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) { selectedRange = range }
                } label: {
                    Text(range.label)
                        .font(.subheadline)
                        .fontWeight(selectedRange == range ? .bold : .regular)
                        .foregroundColor(selectedRange == range ? .white : Color.textSecondary(for: effectiveColorScheme))
                        .padding(.horizontal, 14)
                        .padding(.vertical, 7)
                        .background(
                            selectedRange == range
                                ? Color.accentBlue
                                : Color.cardBackground(for: effectiveColorScheme)
                        )
                        .cornerRadius(20)
                }
            }
        }
        .padding(.horizontal)
    }

    // MARK: Weight chart

    @ViewBuilder
    private var weightSection: some View {
        let points = filtered.compactMap { m -> (Date, Double)? in
            guard let w = m.weight else { return nil }
            return (m.date, w)
        }
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "scalemass.fill").foregroundColor(Color.accentBlue)
                Text(String(localized: "Viktutveckling")).font(.headline)
                    .foregroundColor(Color.textPrimary(for: effectiveColorScheme))
                Spacer()
                if let latest = points.last {
                    Text(formatVal(latest.1) + " kg")
                        .font(.headline).fontWeight(.bold)
                        .foregroundColor(Color.textPrimary(for: effectiveColorScheme))
                }
            }

            if points.count >= 2 {
                Chart {
                    ForEach(points, id: \.0) { date, val in
                        AreaMark(
                            x: .value("Datum", date),
                            y: .value("Vikt", val)
                        )
                        .foregroundStyle(
                            LinearGradient(
                                colors: [Color.accentBlue.opacity(0.3), Color.accentBlue.opacity(0.0)],
                                startPoint: .top, endPoint: .bottom
                            )
                        )
                        .interpolationMethod(.catmullRom)
                        LineMark(
                            x: .value("Datum", date),
                            y: .value("Vikt", val)
                        )
                        .foregroundStyle(Color.accentBlue)
                        .lineStyle(StrokeStyle(lineWidth: 2.5))
                        .interpolationMethod(.catmullRom)
                        PointMark(
                            x: .value("Datum", date),
                            y: .value("Vikt", val)
                        )
                        .foregroundStyle(Color.accentBlue)
                        .symbolSize(30)
                    }
                }
                .frame(height: 180)
                .chartXAxis {
                    AxisMarks(values: .stride(by: selectedRange.strideComponent, count: selectedRange.strideCount)) { _ in
                        AxisGridLine()
                        AxisValueLabel(format: .dateTime.month(.abbreviated).day())
                    }
                }
                .chartYAxis {
                    AxisMarks(position: .leading) { _ in
                        AxisGridLine()
                        AxisValueLabel()
                    }
                }

                // Start / Nu / Delta
                if let first = points.first, let last = points.last {
                    let delta = last.1 - first.1
                    HStack(spacing: 0) {
                        statPill(label: String(localized: "Start"), value: formatVal(first.1) + " kg")
                        Spacer()
                        statPill(label: String(localized: "Nu"), value: formatVal(last.1) + " kg")
                        Spacer()
                        statPill(
                            label: String(localized: "Förändring"),
                            value: (delta >= 0 ? "+" : "") + formatVal(delta) + " kg",
                            valueColor: delta < 0 ? .green : (delta > 0 ? .red : Color.textPrimary(for: effectiveColorScheme))
                        )
                    }
                }
            } else {
                emptyState(message: String(localized: "Logga minst 2 vikter för att se ett diagram"))
            }
        }
        .padding()
        .background(Color.cardBackground(for: effectiveColorScheme))
        .cornerRadius(16)
        .shadow(color: Color.black.opacity(0.04), radius: 4, x: 0, y: 2)
        .padding(.horizontal)
    }

    // MARK: Measurement cards

    @ViewBuilder
    private var measurementCardsSection: some View {
        let fields = focus.primaryFields

        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "ruler.fill").foregroundColor(Color.accentBlue)
                Text(focus == .weightLoss
                     ? String(localized: "Viktnedgångsmått")
                     : String(localized: "Muskeluppbyggnadsmått"))
                    .font(.headline)
                    .foregroundColor(Color.textPrimary(for: effectiveColorScheme))
            }
            .padding(.horizontal)
            .padding(.top, 4)

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                ForEach(fields, id: \.label) { field in
                    measurementCard(label: field.label, keyPath: field.keyPath)
                }
            }
            .padding(.horizontal)
            .padding(.bottom, 8)
        }
        .background(Color.cardBackground(for: effectiveColorScheme))
        .cornerRadius(16)
        .shadow(color: Color.black.opacity(0.04), radius: 4, x: 0, y: 2)
        .padding(.horizontal)
    }

    @ViewBuilder
    private func measurementCard(label: String, keyPath: KeyPath<BodyMeasurement, Double?>) -> some View {
        let points = filtered.compactMap { m -> (Date, Double)? in
            guard let v = m[keyPath: keyPath] else { return nil }
            return (m.date, v)
        }
        let latest = points.last?.1
        let first = points.first?.1
        let delta: Double? = (latest != nil && first != nil) ? latest! - first! : nil

        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.caption)
                .fontWeight(.semibold)
                .foregroundColor(Color.textSecondary(for: effectiveColorScheme))
                .lineLimit(1)

            if let val = latest {
                Text(formatVal(val) + " cm")
                    .font(.title3).fontWeight(.bold)
                    .foregroundColor(Color.textPrimary(for: effectiveColorScheme))
            } else {
                Text("–")
                    .font(.title3).fontWeight(.bold)
                    .foregroundColor(Color.textSecondary(for: effectiveColorScheme))
            }

            if let d = delta {
                Text((d >= 0 ? "+" : "") + formatVal(d) + " cm")
                    .font(.caption2)
                    .foregroundColor(deltaColor(d, focus: focus, keyPath: keyPath))
            }

            if points.count >= 2 {
                Chart {
                    ForEach(points, id: \.0) { date, val in
                        LineMark(x: .value("D", date), y: .value("V", val))
                            .foregroundStyle(Color.accentBlue)
                            .lineStyle(StrokeStyle(lineWidth: 1.5))
                            .interpolationMethod(.catmullRom)
                    }
                }
                .frame(height: 40)
                .chartXAxis(.hidden)
                .chartYAxis(.hidden)
            }
        }
        .padding(12)
        .background(Color.appBackground(for: effectiveColorScheme))
        .cornerRadius(12)
    }

    // MARK: - Helpers

    private func statPill(label: String, value: String, valueColor: Color? = nil) -> some View {
        VStack(spacing: 2) {
            Text(label).font(.caption2).foregroundColor(Color.textSecondary(for: effectiveColorScheme))
            Text(value).font(.subheadline).fontWeight(.bold)
                .foregroundColor(valueColor ?? Color.textPrimary(for: effectiveColorScheme))
        }
    }

    private func emptyState(message: String) -> some View {
        Text(message)
            .font(.caption)
            .foregroundColor(Color.textSecondary(for: effectiveColorScheme))
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity)
            .padding()
    }

    private func formatVal(_ v: Double) -> String {
        v.truncatingRemainder(dividingBy: 1) == 0
            ? String(Int(v))
            : String(format: "%.1f", v)
    }

    /// Grön = förbättring beroende på mål + mätpunkt
    private func deltaColor(_ d: Double, focus: MeasurementFocus, keyPath: KeyPath<BodyMeasurement, Double?>) -> Color {
        // För viktnedgång: minskade mått = grönt
        // För muskeluppbyggnad:ökade mått = grönt
        let positiveIsGood: Bool
        switch focus {
        case .weightLoss: positiveIsGood = false
        case .muscleBuild: positiveIsGood = true
        }
        if d == 0 { return Color.textSecondary(for: effectiveColorScheme) }
        return (d > 0) == positiveIsGood ? .green : .red
    }
}

// MARK: - TimeRange

enum TimeRange: String, CaseIterable, Identifiable {
    case oneMonth = "1M"
    case threeMonths = "3M"
    case sixMonths = "6M"
    case oneYear = "1Å"

    var id: String { rawValue }
    var label: String { rawValue }

    var days: Int {
        switch self {
        case .oneMonth: return 30
        case .threeMonths: return 90
        case .sixMonths: return 180
        case .oneYear: return 365
        }
    }

    var strideComponent: Calendar.Component { .month }
    var strideCount: Int {
        switch self {
        case .oneMonth: return 1
        case .threeMonths: return 1
        case .sixMonths: return 2
        case .oneYear: return 2
        }
    }
}

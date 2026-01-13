import SwiftUI

struct MuscleBalanceView: View {
    @Environment(\.colorScheme) var colorScheme
    @AppStorage("selectedTheme") private var selectedTheme = "Main"
    
    @StateObject private var generationService = WorkoutGenerationService.shared
    @State private var analysis: MuscleBalanceAnalysis?
    @State private var isLoading = true
    @State private var errorMessage: String?
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                if isLoading {
                    ProgressView("Analyserar ditt program...")
                        .frame(maxWidth: .infinity, minHeight: 200)
                } else if let errorMessage = errorMessage {
                    ContentUnavailableView("Gick inte att hämta analys", systemImage: "exclamationmark.triangle", description: Text(errorMessage))
                } else if let analysis = analysis {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Muskelbalans")
                            .font(.title2)
                            .fontWeight(.bold)
                            .foregroundColor(Color.textPrimary(for: colorScheme))
                        
                        Text("Fördelning av set baserat på dina programmallar.")
                            .font(.subheadline)
                            .foregroundColor(.gray)
                    }
                    .padding(.horizontal)
                    
                    VStack(spacing: 16) {
                        ForEach(analysis.stats) { stat in
                            MuscleStatRow(stat: stat, colorScheme: colorScheme, selectedTheme: selectedTheme)
                        }
                    }
                    .padding()
                    .background(Color.cardBackground(for: colorScheme))
                    .cornerRadius(16)
                    .padding(.horizontal)
                    
                    if let under = analysis.stats.last, analysis.stats.count > 1 {
                        VStack(alignment: .leading, spacing: 12) {
                            HStack {
                                Image(systemName: "lightbulb.fill")
                                    .foregroundColor(.yellow)
                                Text("Inblick")
                                    .fontWeight(.semibold)
                            }
                            
                            Text("Ditt program har lägst fokus på **\(under.muscleGroup.lowercased())**. Överväg att lägga till en övning för denna muskelgrupp för en mer balanserad fysik.")
                                .font(.subheadline)
                                .foregroundColor(Color.textSecondary(for: colorScheme))
                        }
                        .padding()
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.yellow.opacity(0.1))
                        .cornerRadius(12)
                        .padding(.horizontal)
                    }
                }
            }
            .padding(.vertical)
        }
        .navigationTitle("Analys")
        .task {
            await loadAnalysis()
        }
        .refreshable {
            await loadAnalysis()
        }
    }
    
    private func loadAnalysis() async {
        isLoading = true
        do {
            analysis = try await generationService.fetchMuscleBalanceAnalysis()
            isLoading = false
        } catch {
            errorMessage = error.localizedDescription
            isLoading = false
        }
    }
}

struct MuscleStatRow: View {
    let stat: MuscleGroupStats
    let colorScheme: ColorScheme
    let selectedTheme: String
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(stat.muscleGroup)
                    .font(.body)
                    .fontWeight(.medium)
                    .foregroundColor(Color.textPrimary(for: colorScheme))
                Spacer()
                Text("\(stat.totalSets) set")
                    .font(.caption)
                    .foregroundColor(.gray)
            }
            
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color.gray.opacity(0.2))
                        .frame(height: 8)
                    
                    RoundedRectangle(cornerRadius: 4)
                        .fill(
                            LinearGradient(
                                gradient: Gradient(colors: [
                                    Color.themePrimaryColor(theme: selectedTheme, colorScheme: colorScheme),
                                    Color.themePrimaryColor(theme: selectedTheme, colorScheme: colorScheme).opacity(0.7)
                                ]),
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .frame(width: geo.size.width * CGFloat(stat.percentage) / 100.0, height: 8)
                }
            }
            .frame(height: 8)
        }
    }
}

import SwiftUI
import Combine

struct ActiveSessionView: View {
    @State private var timeElapsed: TimeInterval = 0
    let timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()
    
    var body: some View {
        VStack {
            // Header
            HStack {
                VStack(alignment: .leading) {
                    Text("Ongoing Session")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text("00:00") // Placeholder for timer
                        .font(.largeTitle)
                        .fontWeight(.bold)
                        .monospacedDigit()
                }
                Spacer()
                Button("Avsluta") {
                    // Action to end workout
                }
                .foregroundColor(.red)
            }
            .padding()
            
            Divider()
            
            // Exercise List (Placeholder)
            List {
                Section(header: Text("Bench press")) {
                    HStack {
                        Text("Set 1")
                        Spacer()
                        Text("10 reps @ 60kg")
                            .foregroundStyle(.secondary)
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(.green)
                    }
                    HStack {
                        Text("Set 2")
                        Spacer()
                        Button("Log") { }
                            .buttonStyle(.bordered)
                    }
                }
            }
            .listStyle(.insetGrouped)
        }
        .onReceive(timer) { _ in
            timeElapsed += 1
        }
    }
}

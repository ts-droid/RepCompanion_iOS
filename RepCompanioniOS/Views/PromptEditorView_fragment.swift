struct PromptEditorView: View {
    @Environment(\.dismiss) var dismiss
    @State var prompt: AiPrompt
    let onSave: (AiPrompt) -> Void
    
    @State private var editedContent: String = ""
    @State private var editedVersion: String = ""
    @State private var editedDescription: String = ""
    
    var body: some View {
        NavigationView {
            Form {
                Section(header: Text("ID: \(prompt.id)")) {
                    TextField("Version", text: $editedVersion)
                    TextField("Description", text: $editedDescription)
                }
                
                Section(header: Text("Content")) {
                    TextEditor(text: $editedContent)
                        .font(.system(.body, design: .monospaced))
                        .frame(minHeight: 300)
                }
            }
            .navigationTitle("Edit Prompt")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Save") {
                        let updated = AiPrompt(
                            id: prompt.id,
                            content: editedContent,
                            version: editedVersion,
                            description: editedDescription.isEmpty ? nil : editedDescription,
                            updatedAt: Date()
                        )
                        onSave(updated)
                        dismiss()
                    }
                    .disabled(editedContent.isEmpty || editedVersion.isEmpty)
                }
            }
            .onAppear {
                editedContent = prompt.content
                editedVersion = prompt.version
                editedDescription = prompt.description ?? ""
            }
        }
    }
}

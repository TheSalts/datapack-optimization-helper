import * as vscode from "vscode";

const NAMING_CONVENTION_KEYS = new Set(["scoreboardObjective", "tag", "team"]);
const CASE_PRESETS = [
    { label: "camelCase", detail: "exampleVariable" },
    { label: "snake_case", detail: "example_variable" },
    { label: "PascalCase", detail: "ExampleVariable" },
    { label: "kebab-case", detail: "example-variable" },
    { label: "SCREAMING_SNAKE_CASE", detail: "EXAMPLE_VARIABLE" },
];

class ConfigCompletionProvider implements vscode.CompletionItemProvider {
    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
    ): vscode.CompletionItem[] | undefined {
        const lineText = document.lineAt(position.line).text;
        const textBeforeCursor = lineText.substring(0, position.character);

        // Check if we are inside a value for namingConvention keys
        const keyMatch = /"(\w+)"\s*:\s*"[^"]*$/.exec(textBeforeCursor);
        if (!keyMatch || !NAMING_CONVENTION_KEYS.has(keyMatch[1])) {
            return undefined;
        }

        return CASE_PRESETS.map((preset) => {
            const item = new vscode.CompletionItem(preset.label, vscode.CompletionItemKind.EnumMember);
            item.detail = preset.detail;
            return item;
        });
    }
}

export function registerConfigCompletion(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            { pattern: "**/datapack.config.json", scheme: "file" },
            new ConfigCompletionProvider(),
            "\"",
        ),
    );
}

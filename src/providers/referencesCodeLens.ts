import * as vscode from "vscode";
import { getCallers, getFunctionInfoByFile, getFunctionInfo, isIndexInitialized } from "../analyzer/functionIndex";
import { t } from "../utils/i18n";

export class ReferencesCodeLensProvider implements vscode.CodeLensProvider {
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

    public refresh(): void {
        this._onDidChangeCodeLenses.fire();
    }

    provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] | null {
        if (!document.fileName.endsWith(".mcfunction")) {
            return null;
        }

        if (!isIndexInitialized()) {
            return null;
        }

        const funcInfo = getFunctionInfoByFile(document.uri.fsPath);
        if (!funcInfo) {
            return null;
        }

        const callers = getCallers(funcInfo.fullPath);
        const range = new vscode.Range(0, 0, 0, 0);

        if (callers.length === 0) {
            return [
                new vscode.CodeLens(range, {
                    title: `$(symbol-reference) ${t("codeLens.noReferences")}`,
                    command: "",
                }),
            ];
        }

        return [
            new vscode.CodeLens(range, {
                title: `$(symbol-reference) ${t("codeLens.references", { count: callers.length })}`,
                command: "datapack-optimization.showReferences",
                arguments: [document.uri, funcInfo.fullPath, callers],
            }),
        ];
    }
}

export function registerReferencesCodeLens(context: vscode.ExtensionContext): ReferencesCodeLensProvider {
    const provider = new ReferencesCodeLensProvider();

    context.subscriptions.push(
        vscode.languages.registerCodeLensProvider(
            { pattern: "**/*.mcfunction", scheme: "file" },
            provider
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            "datapack-optimization.showReferences",
            async (uri: vscode.Uri, functionPath: string, callers: { callerPath: string; line: number }[]) => {
                const locations: vscode.Location[] = [];

                for (const caller of callers) {
                    const callerInfo = getFunctionInfo(caller.callerPath);
                    if (callerInfo) {
                        const callerUri = vscode.Uri.file(callerInfo.filePath);
                        const position = new vscode.Position(caller.line, 0);
                        locations.push(new vscode.Location(callerUri, position));
                    }
                }

                if (locations.length > 0) {
                    await vscode.commands.executeCommand(
                        "editor.action.showReferences",
                        uri,
                        new vscode.Position(0, 0),
                        locations
                    );
                }
            }
        )
    );

    return provider;
}


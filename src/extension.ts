import * as vscode from "vscode";
import { McfunctionCodeActionProvider } from "./codeActions/provider";
import { analyzeCommand } from "./rules";
import { isTerminatingCommand, createUnreachableDiagnostics } from "./unreachable";
import { registerRenameHandler } from "./refactor/renameHandler";
import { getPackMeta, watchPackMeta } from "./utils/packMeta";
import { checkExecuteGroup } from "./rules/executeGroup";
import { checkUnreachableCondition } from "./rules/unreachableCondition";
import { indexWorkspace, watchMcfunctionFiles } from "./analyzer/functionIndex";

let diagnosticCollection: vscode.DiagnosticCollection;

export async function activate(context: vscode.ExtensionContext) {
    diagnosticCollection = vscode.languages.createDiagnosticCollection("datapack-optimization");
    context.subscriptions.push(diagnosticCollection);

    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider(
            { pattern: "**/*.mcfunction", scheme: "file" },
            new McfunctionCodeActionProvider(),
            { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] }
        )
    );

    context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(analyzeDocument));
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument((e) => analyzeDocument(e.document)));
    context.subscriptions.push(vscode.workspace.onDidCloseTextDocument((doc) => diagnosticCollection.delete(doc.uri)));

    registerRenameHandler(context);
    watchPackMeta(context);
    getPackMeta();
    watchMcfunctionFiles(context);

    await indexWorkspace();

    vscode.workspace.textDocuments.forEach(analyzeDocument);
}

function isMcfunction(document: vscode.TextDocument): boolean {
    return document.fileName.endsWith(".mcfunction") || document.languageId === "mcfunction";
}

function analyzeDocument(document: vscode.TextDocument) {
    if (!isMcfunction(document)) {
        return;
    }

    const diagnostics: vscode.Diagnostic[] = [];
    const text = document.getText();
    const lines = text.split(/\r?\n/);

    let unreachableFrom: number | null = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();

        if (trimmedLine.startsWith("#") || trimmedLine === "") {
            continue;
        }

        if (unreachableFrom !== null) {
            continue;
        }

        if (isTerminatingCommand(trimmedLine)) {
            unreachableFrom = i + 1;
        }

        const lineDiagnostics = analyzeCommand(i, line);
        diagnostics.push(...lineDiagnostics);
    }

    if (unreachableFrom !== null) {
        const unreachableDiagnostics = createUnreachableDiagnostics(lines, unreachableFrom);
        diagnostics.push(...unreachableDiagnostics);
    }

    diagnostics.push(...checkExecuteGroup(lines));
    const conditionResult = checkUnreachableCondition(lines, document.uri.fsPath);
    diagnostics.push(...conditionResult.diagnostics);

    if (conditionResult.alwaysReturns.length > 0 && unreachableFrom === null) {
        const firstReturn = conditionResult.alwaysReturns[0];
        unreachableFrom = firstReturn.line + 1;
        const unreachableDiagnostics = createUnreachableDiagnostics(lines, unreachableFrom);
        diagnostics.push(...unreachableDiagnostics);
    }

    diagnosticCollection.set(document.uri, diagnostics);
}

export function deactivate() {
    if (diagnosticCollection) {
        diagnosticCollection.dispose();
    }
}

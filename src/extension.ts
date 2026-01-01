import * as vscode from "vscode";
import { McfunctionCodeActionProvider } from "./codeActions/provider";
import { analyzeCommand } from "./rules";
import { isTerminatingCommand, createUnreachableDiagnostics } from "./unreachable";
import { registerRenameHandler } from "./refactor/renameHandler";
import { getPackMeta, watchPackMeta } from "./utils/packMeta";
import { checkExecuteGroup } from "./rules/executeGroup";
import { checkUnreachableCondition } from "./rules/unreachableCondition";
import { checkAlwaysPassCondition } from "./rules/alwaysPassCondition";
import { indexWorkspace, watchMcfunctionFiles } from "./analyzer/functionIndex";
import { getRuleConfig } from "./utils/config";

let diagnosticCollection: vscode.DiagnosticCollection;

export async function activate(context: vscode.ExtensionContext) {
    console.log("Datapack Optimization extension activated");
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
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration("datapackOptimization")) {
                console.log("Configuration changed, reanalyzing documents");
                const mcfunctionDocs = vscode.workspace.textDocuments.filter((doc) => isMcfunction(doc));
                console.log(`Found ${mcfunctionDocs.length} mcfunction documents`);
                mcfunctionDocs.forEach((doc) => {
                    analyzeDocument(doc);
                });
            }
        })
    );

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

    const config = getRuleConfig();
    if (config.executeGroup) {
        diagnostics.push(...checkExecuteGroup(lines));
    }
    if (config.unreachableCondition) {
        diagnostics.push(...checkUnreachableCondition(lines, document.uri.fsPath));
    }
    
    if (config.alwaysPassCondition) {
        const alwaysPassResult = checkAlwaysPassCondition(lines, document.uri.fsPath);
        diagnostics.push(...alwaysPassResult.diagnostics);

        if (alwaysPassResult.alwaysReturns.length > 0) {
            const firstReturn = alwaysPassResult.alwaysReturns[0];
            const alwaysPassUnreachableFrom = firstReturn.line + 1;
            
            if (unreachableFrom === null || alwaysPassUnreachableFrom < unreachableFrom) {
                unreachableFrom = alwaysPassUnreachableFrom;
            }
        }
    }

    if (config.unreachableCode && unreachableFrom !== null) {
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

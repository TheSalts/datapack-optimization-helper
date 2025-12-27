import * as vscode from "vscode";
import { t } from "../utils/i18n";

export function createExecuteReturnRedundantFix(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
): vscode.CodeAction {
    const action = new vscode.CodeAction(t("executeReturnRedundantFix"), vscode.CodeActionKind.QuickFix);
    action.diagnostics = [diagnostic];

    const line = document.lineAt(diagnostic.range.start.line).text;
    const match = line.match(/\srun\s+(return\s.*)$/);

    if (match) {
        const optimized = match[1];
        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(
            document.uri,
            new vscode.Range(diagnostic.range.start.line, 0, diagnostic.range.start.line, line.length),
            optimized
        );
    }

    return action;
}

export function createExecuteReturnWithAsFix(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
): vscode.CodeAction {
    const action = new vscode.CodeAction(t("executeReturnWithAsFix"), vscode.CodeActionKind.QuickFix);
    action.diagnostics = [diagnostic];

    const line = document.lineAt(diagnostic.range.start.line).text;
    const asMatch = line.match(/(?<!positioned\s)\bas\s+(@[aepnrs](?:\[[^\]]*\])?)/);
    const runMatch = line.match(/\srun\s+(return\s.*)$/);

    if (asMatch && runMatch) {
        const selector = asMatch[1];
        const returnPart = runMatch[1];
        const optimized = `execute if entity ${selector} run ${returnPart}`;

        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(
            document.uri,
            new vscode.Range(diagnostic.range.start.line, 0, diagnostic.range.start.line, line.length),
            optimized
        );
    }

    return action;
}


import * as vscode from "vscode";
import { t } from "../utils/i18n";
import { getOptimizedExecute } from "../rules/executeRedundant";

export function createExecuteDuplicateFix(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];
    const line = document.lineAt(diagnostic.range.start.line).text;

    // 1. Safe Fix (Convert to if entity)
    const safeOptimized = getOptimizedExecute(line, 'preserve-semantics');
    if (safeOptimized) {
        const action = new vscode.CodeAction(t("executeDuplicateFix"), vscode.CodeActionKind.QuickFix);
        action.diagnostics = [diagnostic];
        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(
            document.uri,
            new vscode.Range(diagnostic.range.start.line, 0, diagnostic.range.start.line, line.length),
            safeOptimized
        );
        action.isPreferred = true;
        actions.push(action);
    }

    // 2. Aggressive Fix (Remove)
    const aggressiveOptimized = getOptimizedExecute(line, 'remove');
    if (aggressiveOptimized && aggressiveOptimized !== safeOptimized) {
        const action = new vscode.CodeAction(t("executeDuplicateRemoveFix"), vscode.CodeActionKind.QuickFix);
        action.diagnostics = [diagnostic];
        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(
            document.uri,
            new vscode.Range(diagnostic.range.start.line, 0, diagnostic.range.start.line, line.length),
            aggressiveOptimized
        );
        actions.push(action);
    }

    return actions;
}
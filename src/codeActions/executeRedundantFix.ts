import * as vscode from "vscode";
import { t } from "../utils/i18n";
import { getOptimizedExecute } from "../rules/executeRedundant";

export function createExecuteDuplicateFix(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
): vscode.CodeAction {
    const action = new vscode.CodeAction(t("executeDuplicateFix"), vscode.CodeActionKind.QuickFix);
    action.diagnostics = [diagnostic];

    const line = document.lineAt(diagnostic.range.start.line).text;
    const optimized = getOptimizedExecute(line);

    if (optimized) {
        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(
            document.uri,
            new vscode.Range(diagnostic.range.start.line, 0, diagnostic.range.start.line, line.length),
            optimized
        );
    }

    return action;
}

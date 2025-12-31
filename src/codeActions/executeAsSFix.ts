import * as vscode from "vscode";
import { t } from "../utils/i18n";

export function createExecuteAsSRedundantFix(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
): vscode.CodeAction {
    const action = new vscode.CodeAction(t("executeAsSRedundantFix"), vscode.CodeActionKind.QuickFix);
    action.diagnostics = [diagnostic];

    const line = document.lineAt(diagnostic.range.start.line).text;
    let optimized = line.replace(/(?<!(positioned|rotated)\s)\bas\s+@s\s+/, "");

    if (/^execute\s+run\s+/.test(optimized.trim())) {
        optimized = optimized.replace(/execute\s+run\s+/, "");
    }

    action.edit = new vscode.WorkspaceEdit();
    action.edit.replace(
        document.uri,
        new vscode.Range(diagnostic.range.start.line, 0, diagnostic.range.start.line, line.length),
        optimized
    );

    return action;
}


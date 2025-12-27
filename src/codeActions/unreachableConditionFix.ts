import * as vscode from "vscode";
import { t } from "../utils/i18n";

export function createUnreachableConditionFix(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
): vscode.CodeAction {
    const action = new vscode.CodeAction(t("unreachableConditionFix"), vscode.CodeActionKind.QuickFix);
    action.diagnostics = [diagnostic];

    const line = document.lineAt(diagnostic.range.start.line);
    action.edit = new vscode.WorkspaceEdit();
    action.edit.delete(document.uri, line.rangeIncludingLineBreak);

    return action;
}

export function createAlwaysPassConditionFix(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
): vscode.CodeAction {
    const action = new vscode.CodeAction(t("alwaysPassConditionFix"), vscode.CodeActionKind.QuickFix);
    action.diagnostics = [diagnostic];

    const line = document.lineAt(diagnostic.range.start.line).text;
    const conditionText = document.getText(diagnostic.range);

    let optimized = line.replace(conditionText, "").replace(/\s+/g, " ").trim();

    if (optimized.match(/^execute\s+run\s+/)) {
        optimized = optimized.replace(/^execute\s+run\s+/, "");
    }

    action.edit = new vscode.WorkspaceEdit();
    action.edit.replace(
        document.uri,
        new vscode.Range(diagnostic.range.start.line, 0, diagnostic.range.start.line, line.length),
        optimized
    );

    return action;
}


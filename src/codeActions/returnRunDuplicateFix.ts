import * as vscode from "vscode";
import { t } from "../utils/i18n";

export function createReturnRunDuplicateFix(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
): vscode.CodeAction {
    const action = new vscode.CodeAction(t("returnRunDuplicateFix"), vscode.CodeActionKind.QuickFix);
    action.diagnostics = [diagnostic];

    const line = document.lineAt(diagnostic.range.start.line);
    action.edit = new vscode.WorkspaceEdit();
    action.edit.delete(document.uri, line.rangeIncludingLineBreak);

    return action;
}


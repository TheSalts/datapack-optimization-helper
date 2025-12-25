import * as vscode from "vscode";
import { t } from "../utils/i18n";

export function createRemoveUnreachableFix(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
): vscode.CodeAction {
    const action = new vscode.CodeAction(t("unreachableCodeFix"), vscode.CodeActionKind.QuickFix);
    action.diagnostics = [diagnostic];

    const lineIndex = diagnostic.range.start.line;
    const deleteRange = new vscode.Range(lineIndex, 0, lineIndex + 1, 0);

    action.edit = new vscode.WorkspaceEdit();
    action.edit.delete(document.uri, deleteRange);

    return action;
}

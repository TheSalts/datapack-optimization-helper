import * as vscode from "vscode";
import { t } from "../utils/i18n";

export function createReturnRunDuplicateFix(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
): vscode.CodeAction {
    const action = new vscode.CodeAction(t("returnRunDuplicateFix"), vscode.CodeActionKind.QuickFix);
    action.diagnostics = [diagnostic];

    const line = document.lineAt(diagnostic.range.start.line).text;
    
    // Find "return run " pattern
    const match = line.match(/\breturn\s+run\s+/);
    if (match && match.index !== undefined) {
        const editRange = new vscode.Range(
            diagnostic.range.start.line,
            match.index,
            diagnostic.range.start.line,
            match.index + match[0].length
        );
        
        action.edit = new vscode.WorkspaceEdit();
        action.edit.delete(document.uri, editRange);
    }

    return action;
}

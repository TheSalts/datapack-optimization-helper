import * as vscode from "vscode";

export function createRemoveUnreachableFix(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
): vscode.CodeAction {
    const action = new vscode.CodeAction("도달할 수 없는 코드 삭제", vscode.CodeActionKind.QuickFix);
    action.diagnostics = [diagnostic];

    const lineIndex = diagnostic.range.start.line;
    const deleteRange = new vscode.Range(lineIndex, 0, lineIndex + 1, 0);

    action.edit = new vscode.WorkspaceEdit();
    action.edit.delete(document.uri, deleteRange);

    return action;
}


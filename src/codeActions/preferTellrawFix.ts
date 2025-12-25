import * as vscode from "vscode";

export function createTellrawFix(document: vscode.TextDocument, diagnostic: vscode.Diagnostic): vscode.CodeAction {
    const line = document.lineAt(diagnostic.range.start.line).text;
    const sayMatch = line.match(/^(\s*)say\s+(.+)$/);

    const action = new vscode.CodeAction("tellraw로 변환", vscode.CodeActionKind.QuickFix);
    action.diagnostics = [diagnostic];
    action.isPreferred = true;

    if (sayMatch) {
        const indent = sayMatch[1];
        const message = sayMatch[2];
        const escapedMessage = message.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
        const newText = `${indent}tellraw @a {"text":"${escapedMessage}"}`;

        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(
            document.uri,
            new vscode.Range(diagnostic.range.start.line, 0, diagnostic.range.start.line, line.length),
            newText
        );
    }

    return action;
}


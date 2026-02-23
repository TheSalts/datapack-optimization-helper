import * as vscode from "vscode";

/**
 * Creates a QuickFix CodeAction that replaces the full text of the diagnostic's
 * line by applying `transformFn` to it.  Returns null (no action) when the
 * transform returns null or produces no change.
 */
export function createLineReplaceFix(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
    label: string,
    transformFn: (lineText: string) => string | null,
): vscode.CodeAction | null {
    const lineIndex = diagnostic.range.start.line;
    const lineText = document.lineAt(lineIndex).text;
    const newText = transformFn(lineText);

    if (newText === null || newText === lineText) {
        return null;
    }

    const action = new vscode.CodeAction(label, vscode.CodeActionKind.QuickFix);
    action.diagnostics = [diagnostic];
    action.edit = new vscode.WorkspaceEdit();
    action.edit.replace(
        document.uri,
        new vscode.Range(lineIndex, 0, lineIndex, lineText.length),
        newText,
    );

    return action;
}

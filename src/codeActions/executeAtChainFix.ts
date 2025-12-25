import * as vscode from "vscode";
import { t } from "../utils/i18n";

export function createExecuteAtChainRedundantFix(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
): vscode.CodeAction {
    const action = new vscode.CodeAction(t("executeAtChainRedundantFix"), vscode.CodeActionKind.QuickFix);
    action.diagnostics = [diagnostic];

    const line = document.lineAt(diagnostic.range.start.line).text;
    const rangeText = line.substring(diagnostic.range.start.character, diagnostic.range.end.character);

    const optimized = line.substring(0, diagnostic.range.start.character) +
        line.substring(diagnostic.range.end.character).replace(/^\s+/, " ").replace(/^\s/, "");

    action.edit = new vscode.WorkspaceEdit();
    action.edit.replace(
        document.uri,
        new vscode.Range(diagnostic.range.start.line, 0, diagnostic.range.start.line, line.length),
        optimized.replace(/\s+/g, " ").trim()
    );

    return action;
}


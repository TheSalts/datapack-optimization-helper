import * as vscode from "vscode";
import { t } from "../utils/i18n";

export function createScoreboardFakePlayerFix(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
): vscode.CodeAction {
    const action = new vscode.CodeAction(t("scoreboardFakePlayerMissingHashFix"), vscode.CodeActionKind.QuickFix);
    action.diagnostics = [diagnostic];

    const line = document.lineAt(diagnostic.range.start.line).text;
    const targetName = line.substring(diagnostic.range.start.character, diagnostic.range.end.character);

    if (targetName && !targetName.startsWith("#")) {
        const newName = `#${targetName}`;
        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(document.uri, diagnostic.range, newName);
    }

    return action;
}


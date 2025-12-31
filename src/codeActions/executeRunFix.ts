import * as vscode from "vscode";
import { t } from "../utils/i18n";

export function createExecuteRunRedundantFix(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
): vscode.CodeAction {
    const action = new vscode.CodeAction(t("executeRunRedundantFix"), vscode.CodeActionKind.QuickFix);
    action.diagnostics = [diagnostic];

    const line = document.lineAt(diagnostic.range.start.line).text;
    const optimized = line.replace(/^(\s*)execute\s+run\s+/, "$1");

    action.edit = new vscode.WorkspaceEdit();
    action.edit.replace(
        document.uri,
        new vscode.Range(diagnostic.range.start.line, 0, diagnostic.range.start.line, line.length),
        optimized
    );

    return action;
}

export function createExecuteRunRedundantNestedFix(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
): vscode.CodeAction {
    const action = new vscode.CodeAction(t("executeRunRedundantFix"), vscode.CodeActionKind.QuickFix);
    action.diagnostics = [diagnostic];

    const line = document.lineAt(diagnostic.range.start.line).text;
    const optimized = line.replace(/run\s+execute\s+run\s+/, "run ");

    action.edit = new vscode.WorkspaceEdit();
    action.edit.replace(
        document.uri,
        new vscode.Range(diagnostic.range.start.line, 0, diagnostic.range.start.line, line.length),
        optimized
    );

    return action;
}

export function createExecuteRunRedundantRunExecuteFix(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
): vscode.CodeAction {
    const action = new vscode.CodeAction(t("executeRunRedundantRunExecuteFix"), vscode.CodeActionKind.QuickFix);
    action.diagnostics = [diagnostic];

    const line = document.lineAt(diagnostic.range.start.line).text;
    const optimized = line.replace(/(?<!return\s)run\s+execute\s+/, "");

    action.edit = new vscode.WorkspaceEdit();
    action.edit.replace(
        document.uri,
        new vscode.Range(diagnostic.range.start.line, 0, diagnostic.range.start.line, line.length),
        optimized
    );

    return action;
}


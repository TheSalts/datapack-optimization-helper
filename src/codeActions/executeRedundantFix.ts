import * as vscode from "vscode";
import { t } from "../utils/i18n";
import { getOptimizedExecute } from "../rules/executeRedundant";

function createExecuteRedundantFixInternal(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
    fixKey: "executeDuplicateFix" | "executeUnnecessaryFix",
    removeFixKey: "executeDuplicateRemoveFix" | "executeUnnecessaryRemoveFix"
): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];
    const line = document.lineAt(diagnostic.range.start.line).text;

    // 1. Safe Fix (Convert to if entity)
    const safeOptimized = getOptimizedExecute(line, "preserve-semantics");
    if (safeOptimized) {
        const action = new vscode.CodeAction(t(fixKey), vscode.CodeActionKind.QuickFix);
        action.diagnostics = [diagnostic];
        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(
            document.uri,
            new vscode.Range(diagnostic.range.start.line, 0, diagnostic.range.start.line, line.length),
            safeOptimized
        );
        action.isPreferred = true;
        actions.push(action);
    }

    // 2. Aggressive Fix (Remove)
    const aggressiveOptimized = getOptimizedExecute(line, "remove");
    if (aggressiveOptimized && aggressiveOptimized !== safeOptimized) {
        const action = new vscode.CodeAction(t(removeFixKey), vscode.CodeActionKind.QuickFix);
        action.diagnostics = [diagnostic];
        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(
            document.uri,
            new vscode.Range(diagnostic.range.start.line, 0, diagnostic.range.start.line, line.length),
            aggressiveOptimized
        );
        actions.push(action);
    }

    return actions;
}

export function createExecuteDuplicateFix(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
): vscode.CodeAction[] {
    return createExecuteRedundantFixInternal(document, diagnostic, "executeDuplicateFix", "executeDuplicateRemoveFix");
}

export function createExecuteUnnecessaryFix(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
): vscode.CodeAction[] {
    return createExecuteRedundantFixInternal(
        document,
        diagnostic,
        "executeUnnecessaryFix",
        "executeUnnecessaryRemoveFix"
    );
}
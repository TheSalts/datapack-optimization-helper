import * as vscode from "vscode";
import { t } from "../utils/i18n";
import { getOptimizedExecute } from "../rules/executeRedundant";

function createExecuteRedundantFixInternal(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
    fixKey: "executeDuplicateFix" | "executeUnnecessaryFix",
    removeFixKey: "executeDuplicateRemoveFix" | "executeUnnecessaryRemoveFix",
    noSelectorFixKey: "executeDuplicateFixNoSelector" | "executeUnnecessaryFixNoSelector"
): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];
    const line = document.lineAt(diagnostic.range.start.line).text;

    const safeOptimized = getOptimizedExecute(line, "preserve-semantics");
    const aggressiveOptimized = getOptimizedExecute(line, "remove");

    const hasSelector = safeOptimized !== aggressiveOptimized;

    if (hasSelector && safeOptimized) {
        // 1. If entity conversion (when selector exists)
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

        // 2. Remove (when selector exists, show both options)
        if (aggressiveOptimized) {
            const removeAction = new vscode.CodeAction(t(removeFixKey), vscode.CodeActionKind.QuickFix);
            removeAction.diagnostics = [diagnostic];
            removeAction.edit = new vscode.WorkspaceEdit();
            removeAction.edit.replace(
                document.uri,
                new vscode.Range(diagnostic.range.start.line, 0, diagnostic.range.start.line, line.length),
                aggressiveOptimized
            );
            actions.push(removeAction);
        }
    } else if (aggressiveOptimized) {
        // No selector - just remove
        const action = new vscode.CodeAction(t(noSelectorFixKey), vscode.CodeActionKind.QuickFix);
        action.diagnostics = [diagnostic];
        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(
            document.uri,
            new vscode.Range(diagnostic.range.start.line, 0, diagnostic.range.start.line, line.length),
            aggressiveOptimized
        );
        action.isPreferred = true;
        actions.push(action);
    }

    return actions;
}

export function createExecuteDuplicateFix(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
): vscode.CodeAction[] {
    return createExecuteRedundantFixInternal(
        document,
        diagnostic,
        "executeDuplicateFix",
        "executeDuplicateRemoveFix",
        "executeDuplicateFixNoSelector"
    );
}

export function createExecuteUnnecessaryFix(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
): vscode.CodeAction[] {
    return createExecuteRedundantFixInternal(
        document,
        diagnostic,
        "executeUnnecessaryFix",
        "executeUnnecessaryRemoveFix",
        "executeUnnecessaryFixNoSelector"
    );
}

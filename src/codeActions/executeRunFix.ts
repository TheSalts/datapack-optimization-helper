import * as vscode from "vscode";
import { t } from "../utils/i18n";
import { createLineReplaceFix } from "./utils";

// ── Pure line-transform functions (also used by provider.ts applyAllFixes) ──

export function fixExecuteRunRedundant(line: string): string | null {
    const result = line.replace(/^(\s*)execute\s+run\s+/, "$1");
    return result !== line ? result : null;
}

export function fixExecuteRunRedundantNested(line: string): string | null {
    const result = line.replace(/run\s+execute\s+run\s+/, "run ");
    return result !== line ? result : null;
}

export function fixExecuteRunRedundantRunExecute(line: string): string | null {
    const result = line.replace(/(?<!return\s)run\s+execute\s+/, "");
    return result !== line ? result : null;
}

export function createExecuteRunRedundantFix(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
): vscode.CodeAction {
    return (
        createLineReplaceFix(document, diagnostic, t("executeRunRedundantFix"), fixExecuteRunRedundant) ??
        new vscode.CodeAction(t("executeRunRedundantFix"), vscode.CodeActionKind.QuickFix)
    );
}

export function createExecuteRunRedundantNestedFix(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
): vscode.CodeAction {
    return (
        createLineReplaceFix(document, diagnostic, t("executeRunRedundantFix"), fixExecuteRunRedundantNested) ??
        new vscode.CodeAction(t("executeRunRedundantFix"), vscode.CodeActionKind.QuickFix)
    );
}

export function createExecuteRunRedundantRunExecuteFix(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
): vscode.CodeAction {
    return (
        createLineReplaceFix(document, diagnostic, t("executeRunRedundantRunExecuteFix"), fixExecuteRunRedundantRunExecute) ??
        new vscode.CodeAction(t("executeRunRedundantRunExecuteFix"), vscode.CodeActionKind.QuickFix)
    );
}

import * as vscode from "vscode";
import { t } from "../utils/i18n";
import { createLineReplaceFix } from "./utils";

// ── Pure line-transform function ─────────────────────────────────────────────

export function fixExecuteAsS(line: string): string | null {
    let result = line.replace(/(?<!(positioned|rotated)\s)\bas\s+@s\s+/, "");
    if (/^execute\s+run\s+/.test(result.trim())) {
        result = result.replace(/execute\s+run\s+/, "");
    }
    return result !== line ? result : null;
}

export function createExecuteAsSRedundantFix(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
): vscode.CodeAction {
    return (
        createLineReplaceFix(document, diagnostic, t("executeAsSRedundantFix"), fixExecuteAsS) ??
        new vscode.CodeAction(t("executeAsSRedundantFix"), vscode.CodeActionKind.QuickFix)
    );
}

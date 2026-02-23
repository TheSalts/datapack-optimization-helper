import * as vscode from "vscode";
import { t } from "../utils/i18n";
import { createLineReplaceFix } from "./utils";

export function createExecuteRunRedundantFix(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
): vscode.CodeAction {
    return (
        createLineReplaceFix(document, diagnostic, t("executeRunRedundantFix"), (line) =>
            line.replace(/^(\s*)execute\s+run\s+/, "$1")
        ) ?? new vscode.CodeAction(t("executeRunRedundantFix"), vscode.CodeActionKind.QuickFix)
    );
}

export function createExecuteRunRedundantNestedFix(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
): vscode.CodeAction {
    return (
        createLineReplaceFix(document, diagnostic, t("executeRunRedundantFix"), (line) =>
            line.replace(/run\s+execute\s+run\s+/, "run ")
        ) ?? new vscode.CodeAction(t("executeRunRedundantFix"), vscode.CodeActionKind.QuickFix)
    );
}

export function createExecuteRunRedundantRunExecuteFix(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
): vscode.CodeAction {
    return (
        createLineReplaceFix(document, diagnostic, t("executeRunRedundantRunExecuteFix"), (line) =>
            line.replace(/(?<!return\s)run\s+execute\s+/, "")
        ) ?? new vscode.CodeAction(t("executeRunRedundantRunExecuteFix"), vscode.CodeActionKind.QuickFix)
    );
}

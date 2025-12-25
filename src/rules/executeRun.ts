import * as vscode from "vscode";
import { DIAGNOSTIC_SOURCE } from "../constants";
import { t } from "../utils/i18n";

export function checkExecuteRun(lineIndex: number, line: string): vscode.Diagnostic | null {
    const trimmed = line.trim();

    if (/^execute\s+run\s+/.test(trimmed)) {
        const startIndex = line.indexOf("execute");
        const runIndex = line.indexOf("run", startIndex);
        const range = new vscode.Range(lineIndex, startIndex, lineIndex, runIndex + 4);
        const diagnostic = new vscode.Diagnostic(range, t("executeRunRedundant"), vscode.DiagnosticSeverity.Warning);
        diagnostic.source = DIAGNOSTIC_SOURCE;
        diagnostic.code = "execute-run-redundant";
        return diagnostic;
    }

    return null;
}


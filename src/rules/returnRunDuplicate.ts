import * as vscode from "vscode";
import { DIAGNOSTIC_SOURCE } from "../constants";
import { t } from "../utils/i18n";

export function checkReturnRunDuplicate(lineIndex: number, line: string): vscode.Diagnostic | null {
    const trimmed = line.trim();

    const match = trimmed.match(/\breturn\s+run\s+.*\breturn\b/);
    if (match) {
        const startIndex = line.indexOf("return");
        const range = new vscode.Range(lineIndex, startIndex, lineIndex, line.length);
        const diagnostic = new vscode.Diagnostic(range, t("returnRunDuplicate"), vscode.DiagnosticSeverity.Warning);
        diagnostic.source = DIAGNOSTIC_SOURCE;
        diagnostic.code = "return-run-duplicate";
        return diagnostic;
    }

    return null;
}


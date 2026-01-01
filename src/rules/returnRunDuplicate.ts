import * as vscode from "vscode";
import { DIAGNOSTIC_SOURCE } from "../constants";
import { t } from "../utils/i18n";
import { RuleConfig, getRuleConfig } from "../utils/config";

export function checkReturnRunDuplicate(lineIndex: number, line: string, config?: RuleConfig): vscode.Diagnostic | null {
    const effectiveConfig = config || getRuleConfig();
    if (!effectiveConfig.returnRunDuplicate) {
        return null;
    }

    const trimmed = line.trim();

    const match = trimmed.match(/\breturn\s+run\s+.*\breturn\b/);
    if (match) {
        const startIndex = line.indexOf("return");
        const range = new vscode.Range(lineIndex, startIndex, lineIndex, line.length);
        const message = t("returnRunDuplicate");
        const diagnostic = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Warning);
        diagnostic.source = DIAGNOSTIC_SOURCE;
        diagnostic.code = "return-run-duplicate";
        return diagnostic;
    }

    return null;
}
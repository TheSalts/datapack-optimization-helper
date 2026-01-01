import * as vscode from "vscode";
import { DIAGNOSTIC_SOURCE } from "../constants";
import { t } from "../utils/i18n";
import { RuleConfig, getRuleConfig } from "../utils/config";

export function checkExecuteAsS(lineIndex: number, line: string, config?: RuleConfig): vscode.Diagnostic | null {
    const effectiveConfig = config || getRuleConfig();
    if (!effectiveConfig.executeAsSRedundant) {
        return null;
    }

    const trimmed = line.trim();
    if (!trimmed.startsWith("execute ")) {
        return null;
    }

    const match = trimmed.match(/(?<!(positioned|rotated)\s)\bas\s+@s(?![[\w])/);
    if (match) {
        const startIndex = line.indexOf(match[0]);
        const range = new vscode.Range(lineIndex, startIndex, lineIndex, startIndex + match[0].length);
        const message = t("executeAsSRedundant");
        const diagnostic = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Warning);
        diagnostic.source = DIAGNOSTIC_SOURCE;
        diagnostic.code = "execute-as-s-redundant";
        return diagnostic;
    }

    return null;
}


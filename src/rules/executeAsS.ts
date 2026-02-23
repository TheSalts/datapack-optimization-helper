import * as vscode from "vscode";
import { RuleConfig } from "../utils/config";
import { createDiagnostic } from "../utils/diagnostic";

export function checkExecuteAsS(lineIndex: number, line: string, config: RuleConfig): vscode.Diagnostic | null {
    if (!config.executeAsSRedundant) {
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
        return createDiagnostic(range, "executeAsSRedundant", "execute-as-s-redundant");
    }

    return null;
}

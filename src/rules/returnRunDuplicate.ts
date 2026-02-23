import * as vscode from "vscode";
import { RuleConfig } from "../utils/config";
import { createDiagnostic } from "../utils/diagnostic";

export function checkReturnRunDuplicate(lineIndex: number, line: string, config: RuleConfig): vscode.Diagnostic | null {
    if (!config.returnRunDuplicate) {
        return null;
    }

    const trimmed = line.trim();

    const match = trimmed.match(/\breturn\s+run\s+.*\breturn\b/);
    if (match) {
        const startIndex = line.indexOf("return");
        const range = new vscode.Range(lineIndex, startIndex, lineIndex, line.length);
        return createDiagnostic(range, "returnRunDuplicate", "return-run-duplicate");
    }

    return null;
}

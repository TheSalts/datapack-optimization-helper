import * as vscode from "vscode";
import { DIAGNOSTIC_SOURCE } from "../constants";
import { t } from "../utils/i18n";

export function checkExecuteReturn(lineIndex: number, line: string): vscode.Diagnostic | null {
    const trimmed = line.trim();

    if (!trimmed.startsWith("execute ")) {
        return null;
    }

    const runMatch = trimmed.match(/\srun\s+(return\s.*)$/);
    if (!runMatch) {
        return null;
    }

    const hasIfUnless = /\b(if|unless)\b/.test(trimmed);
    if (hasIfUnless) {
        return null;
    }

    const hasAs = /(?<!positioned\s)\bas\s+@[aepnrs]/.test(trimmed);
    const startIndex = line.indexOf("execute");
    const range = new vscode.Range(lineIndex, startIndex, lineIndex, line.length);

    if (hasAs) {
        const diagnostic = new vscode.Diagnostic(range, t("executeReturnWithAs"), vscode.DiagnosticSeverity.Warning);
        diagnostic.source = DIAGNOSTIC_SOURCE;
        diagnostic.code = "execute-return-with-as";
        return diagnostic;
    } else {
        const diagnostic = new vscode.Diagnostic(range, t("executeReturnRedundant"), vscode.DiagnosticSeverity.Warning);
        diagnostic.source = DIAGNOSTIC_SOURCE;
        diagnostic.code = "execute-return-redundant";
        return diagnostic;
    }
}


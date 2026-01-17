import * as vscode from "vscode";
import { DIAGNOSTIC_SOURCE } from "../constants";
import { t } from "../utils/i18n";
import { RuleConfig, getRuleConfig } from "../utils/config";

export function checkExecuteRun(lineIndex: number, line: string, config?: RuleConfig): vscode.Diagnostic[] {
    const diagnostics: vscode.Diagnostic[] = [];
    const trimmed = line.trim();
    const effectiveConfig = config || getRuleConfig();

    if (effectiveConfig.executeRunRedundant && /^execute\s+run\s+/.test(trimmed)) {
        const startIndex = line.indexOf("execute");
        const runIndex = line.indexOf("run", startIndex);
        const range = new vscode.Range(lineIndex, startIndex, lineIndex, runIndex + 3);
        const message = t("executeRunRedundant");
        const diagnostic = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Warning);
        diagnostic.source = DIAGNOSTIC_SOURCE;
        diagnostic.code = "execute-run-redundant";
        diagnostics.push(diagnostic);
    }

    if (effectiveConfig.executeRunRedundant) {
        const nestedMatch = trimmed.match(/run\s+(execute\s+run\s+)/);
        if (nestedMatch) {
            const matchIndex = line.indexOf(nestedMatch[1]);
            const range = new vscode.Range(lineIndex, matchIndex, lineIndex, matchIndex + nestedMatch[1].length - 1);
            const message = t("executeRunRedundant");
            const diagnostic = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Warning);
            diagnostic.source = DIAGNOSTIC_SOURCE;
            diagnostic.code = "execute-run-redundant-nested";
            diagnostics.push(diagnostic);
        }
    }

    if (effectiveConfig.executeRunRedundantRunExecute) {
        const runExecuteMatch = trimmed.match(/(?<!return\s)run\s+(execute\s+)/);
        if (runExecuteMatch) {
            const matchText = runExecuteMatch[0];
            const matchIndex = line.indexOf(matchText);
            if (matchIndex !== -1) {
                const range = new vscode.Range(lineIndex, matchIndex, lineIndex, matchIndex + matchText.length - 1);
                const message = t("executeRunRedundantRunExecute");
                const diagnostic = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Warning);
                diagnostic.source = DIAGNOSTIC_SOURCE;
                diagnostic.code = "execute-run-redundant-run-execute";
                diagnostics.push(diagnostic);
            }
        }
    }

    return diagnostics;
}

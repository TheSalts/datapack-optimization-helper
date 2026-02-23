import * as vscode from "vscode";
import { RuleConfig } from "../utils/config";
import { createDiagnostic } from "../utils/diagnostic";

export function checkExecuteRun(lineIndex: number, line: string, config: RuleConfig): vscode.Diagnostic[] {
    const diagnostics: vscode.Diagnostic[] = [];
    const trimmed = line.trim();

    if (config.executeRunRedundant && /^execute\s+run\s+/.test(trimmed)) {
        const startIndex = line.indexOf("execute");
        const runIndex = line.indexOf("run", startIndex);
        const range = new vscode.Range(lineIndex, startIndex, lineIndex, runIndex + 3);
        diagnostics.push(createDiagnostic(range, "executeRunRedundant", "execute-run-redundant"));
    }

    if (config.executeRunRedundant) {
        const nestedMatch = trimmed.match(/run\s+(execute\s+run\s+)/);
        if (nestedMatch) {
            const matchIndex = line.indexOf(nestedMatch[1]);
            const range = new vscode.Range(lineIndex, matchIndex, lineIndex, matchIndex + nestedMatch[1].length - 1);
            diagnostics.push(createDiagnostic(range, "executeRunRedundant", "execute-run-redundant-nested"));
        }
    }

    if (config.executeRunRedundantRunExecute) {
        const runExecuteMatch = trimmed.match(/(?<!return\s)run\s+(execute\s+)/);
        if (runExecuteMatch) {
            const matchText = runExecuteMatch[0];
            const matchIndex = line.indexOf(matchText);
            if (matchIndex !== -1) {
                const range = new vscode.Range(lineIndex, matchIndex, lineIndex, matchIndex + matchText.length - 1);
                diagnostics.push(
                    createDiagnostic(range, "executeRunRedundantRunExecute", "execute-run-redundant-run-execute"),
                );
            }
        }
    }

    return diagnostics;
}

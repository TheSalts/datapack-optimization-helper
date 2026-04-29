import * as vscode from "vscode";
import { RuleConfig } from "../utils/config";
import { functionIndexInstance } from "../analyzer/functionIndex";
import { createDiagnostic } from "../utils/diagnostic";

export function checkMacroSafety(document: vscode.TextDocument, config: RuleConfig): vscode.Diagnostic[] {
    if (!config.macroFunctionWithoutWith) {
        return [];
    }

    const funcInfo = functionIndexInstance.getFunctionInfoByFile(document.uri.fsPath);
    if (!funcInfo) {
        return [];
    }

    const diagnostics: vscode.Diagnostic[] = [];

    for (const call of funcInfo.calls) {
        const calledFunc = functionIndexInstance.getFunctionInfo(call.functionName);
        if (!calledFunc?.hasMacro) {
            continue;
        }

        const lineText = document.lineAt(call.line).text;
        const escapedName = call.functionName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const match = new RegExp(`\\bfunction\\s+${escapedName}\\b`).exec(lineText);
        if (!match) {
            continue;
        }

        const after = lineText.slice(match.index + match[0].length).trimStart();
        if (after.startsWith("with") || after.startsWith("{")) {
            continue;
        }

        const range = new vscode.Range(call.line, match.index, call.line, match.index + match[0].length);
        diagnostics.push(
            createDiagnostic(
                range,
                "macroFunctionWithoutWith",
                "macro-function-without-with",
                vscode.DiagnosticSeverity.Error,
                { function: call.functionName },
            ),
        );
    }

    return diagnostics;
}

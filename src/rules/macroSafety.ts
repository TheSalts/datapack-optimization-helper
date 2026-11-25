import * as vscode from "vscode";
import { RuleConfig } from "../utils/config";
import { FunctionIndex, functionIndexInstance } from "../analyzer/functionIndex";
import { createDiagnostic } from "../utils/diagnostic";

export function isInsideString(line: string, targetIndex: number): boolean {
    let stringChar: string | null = null;

    for (let i = 0; i < targetIndex && i < line.length; i++) {
        const char = line[i];
        if (stringChar !== null) {
            if (char === "\\") {
                i++;
                continue;
            }
            if (char === stringChar) {
                stringChar = null;
            }
        } else if (char === '"' || char === "'") {
            stringChar = char;
        }
    }

    return stringChar !== null;
}

export function checkMacroSafety(
    document: vscode.TextDocument,
    config: RuleConfig,
    index: FunctionIndex = functionIndexInstance,
): vscode.Diagnostic[] {
    if (!config.macroFunctionWithoutWith) {
        return [];
    }

    const funcInfo = index.getFunctionInfoByFile(document.uri.fsPath);
    if (!funcInfo) {
        return [];
    }

    const diagnostics: vscode.Diagnostic[] = [];

    for (const call of funcInfo.calls) {
        const calledFunc = index.getFunctionInfo(call.functionName);
        if (!calledFunc?.hasMacro) {
            continue;
        }

        if (call.line < 0 || call.line >= document.lineCount) {
            continue;
        }

        const lineText = document.lineAt(call.line).text;
        const escapedName = call.functionName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`\\bfunction\\s+${escapedName}\\b`, "g");
        let match: RegExpExecArray | null;

        while ((match = regex.exec(lineText)) !== null) {
            if (isInsideString(lineText, match.index)) {
                continue;
            }

            const after = lineText.slice(match.index + match[0].length).trimStart();
            if (after.startsWith("with") || after.startsWith("{")) {
                continue;
            }

            const range = new vscode.Range(call.line, match.index, call.line, match.index + match[0].length);
            const messageKey =
                calledFunc.macroArgs.length > 0 ? "macroFunctionWithoutWithArgs" : "macroFunctionWithoutWith";
            diagnostics.push(
                createDiagnostic(
                    range,
                    messageKey,
                    "macro-function-without-with",
                    vscode.DiagnosticSeverity.Error,
                    {
                        function: call.functionName,
                        args: calledFunc.macroArgs.join(", "),
                    },
                ),
            );
        }
    }

    return diagnostics;
}

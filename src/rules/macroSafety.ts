import * as vscode from "vscode";
import { getMacroFunctionWithoutWithFullCommandOnly, RuleConfig } from "../utils/config";
import { functionIndexInstance } from "../analyzer/functionIndex";
import { createDiagnostic } from "../utils/diagnostic";
import { tokenize } from "../parser/tokenizer";

export function checkMacroSafety(document: vscode.TextDocument, config: RuleConfig): vscode.Diagnostic[] {
    if (!config.macroFunctionWithoutWith) {
        return [];
    }

    const fullCommandOnly = getMacroFunctionWithoutWithFullCommandOnly();
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

        if (fullCommandOnly) {
            const tokens = tokenize(lineText.slice(0, match.index));
            let i = 0;
            if (tokens.length > 0 && tokens[0].text === "$") {
                i++;
            }
            if (tokens.length > i && tokens[i].text === "execute") {
                while (i < tokens.length) {
                    if (tokens[i].text === "run") {
                        if (i + 1 < tokens.length && tokens[i + 1].text === "execute") {
                            i += 2;
                            continue;
                        } else {
                            i++;
                            break;
                        }
                    }
                    i++;
                }
            }
            if (tokens.length > i && tokens[i].text === "return") {
                i++;
                if (tokens.length > i && tokens[i].text === "run") {
                    i++;
                }
            }
            if (tokens.length > i && tokens[i].text === "schedule") {
                i++;
                if (tokens.length > i && tokens[i].text === "function") {
                    i++;
                }
            }
            if (i !== tokens.length) {
                continue; // Not a clean prefix
            }
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

    return diagnostics;
}

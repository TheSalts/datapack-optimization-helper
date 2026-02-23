import * as vscode from "vscode";
import { RuleConfig } from "../utils/config";
import { getFunctionInfoByFile, getFunctionInfo } from "../analyzer/functionIndex";
import { createDiagnostic } from "../utils/diagnostic";

function isInfiniteRecursion(targetFunc: string, currentFunc: string, visited: Set<string>): boolean {
    if (visited.has(currentFunc)) {
        return currentFunc === targetFunc;
    }
    visited.add(currentFunc);

    const funcInfo = getFunctionInfo(currentFunc);
    if (!funcInfo) {
        visited.delete(currentFunc);
        return false;
    }

    for (const call of funcInfo.calls) {
        if (call.isConditional || call.hasUnconditionalReturnBefore) {
            continue;
        }
        if (call.functionName === targetFunc) {
            visited.delete(currentFunc);
            return true;
        }
        if (isInfiniteRecursion(targetFunc, call.functionName, visited)) {
            visited.delete(currentFunc);
            return true;
        }
    }
    visited.delete(currentFunc);
    return false;
}

export function checkInfiniteRecursion(document: vscode.TextDocument, config: RuleConfig): vscode.Diagnostic[] {
    if (!config.infiniteRecursion) {
        return [];
    }

    const diagnostics: vscode.Diagnostic[] = [];
    const funcInfo = getFunctionInfoByFile(document.uri.fsPath);
    if (!funcInfo) {
        return [];
    }

    const cache = new Map<string, boolean>();

    for (const call of funcInfo.calls) {
        if (call.isConditional || call.hasUnconditionalReturnBefore) {
            continue;
        }

        let isInfinite: boolean;
        if (call.functionName === funcInfo.fullPath) {
            isInfinite = true;
        } else if (cache.has(call.functionName)) {
            isInfinite = cache.get(call.functionName)!;
        } else {
            isInfinite = isInfiniteRecursion(funcInfo.fullPath, call.functionName, new Set([funcInfo.fullPath]));
            cache.set(call.functionName, isInfinite);
        }

        if (isInfinite) {
            const lineText = document.lineAt(call.line).text;
            const funcMatch = lineText.match(/\bfunction\s+([a-z0-9_.-]+:[a-z0-9_./-]+)/i);
            if (funcMatch) {
                const startIndex = lineText.indexOf(funcMatch[0]);
                const range = new vscode.Range(call.line, startIndex, call.line, startIndex + funcMatch[0].length);
                diagnostics.push(
                    createDiagnostic(
                        range,
                        "infiniteRecursion",
                        "infinite-recursion",
                        vscode.DiagnosticSeverity.Warning,
                        { path: call.functionName.split(":").pop() || "" },
                    ),
                );
            }
        }
    }

    return diagnostics;
}

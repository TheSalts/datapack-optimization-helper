import * as vscode from "vscode";
import { DIAGNOSTIC_SOURCE } from "../constants";
import { t } from "../utils/i18n";
import { RuleConfig, getRuleConfig } from "../utils/config";
import { getFunctionInfoByFile, getFunctionInfo } from "../analyzer/functionIndex";

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

export function checkInfiniteRecursion(document: vscode.TextDocument, config?: RuleConfig): vscode.Diagnostic[] {
    const effectiveConfig = config || getRuleConfig();
    if (!effectiveConfig.infiniteRecursion) {
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
                const message = t("infiniteRecursion", { path: call.functionName.split(":").pop() || "" });
                const diagnostic = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Warning);
                diagnostic.source = DIAGNOSTIC_SOURCE;
                diagnostic.code = "infinite-recursion";
                diagnostics.push(diagnostic);
            }
        }
    }

    return diagnostics;
}

import * as vscode from "vscode";
import { RuleConfig } from "../utils/config";
import { parseArgs, DUPLICABLE_KEYS, COMPLEX_KEYS, extractSelector } from "../parser/selectorParser";
import { createDiagnostic } from "../utils/diagnostic";

function analyzeMerge(asArgsStr: string, sArgsStr: string): "SAFE" | "CONFLICT" | "COMPLEX" {
    const asArgs = parseArgs(asArgsStr);
    const sArgs = parseArgs(sArgsStr);

    const asMap = new Map<string, string>();
    const sMap = new Map<string, string>();

    for (const arg of asArgs) {
        asMap.set(arg.key, arg.raw);
    }
    for (const arg of sArgs) {
        sMap.set(arg.key, arg.raw);
    }

    let isComplex = false;

    for (const [key, asRaw] of asMap.entries()) {
        if (DUPLICABLE_KEYS.includes(key)) {
            continue;
        }

        const sRaw = sMap.get(key);
        if (sRaw !== undefined) {
            if (asRaw !== sRaw) {
                if (COMPLEX_KEYS.includes(key)) {
                    isComplex = true;
                } else {
                    return "CONFLICT";
                }
            }
        }
    }
    return isComplex ? "COMPLEX" : "SAFE";
}

export function checkExecuteAsIfEntity(lineIndex: number, line: string, config: RuleConfig): vscode.Diagnostic[] {
    const trimmed = line.trim();
    const diagnostics: vscode.Diagnostic[] = [];

    if (!trimmed.startsWith("execute ")) {
        return diagnostics;
    }

    const asKeywordMatch = trimmed.match(/(?<!(positioned|rotated)\s)\bas\s+(@[aepnrs])/);
    if (!asKeywordMatch) {
        return diagnostics;
    }

    const ifKeywordMatch = trimmed.match(/\b(if|unless)\s+entity\s+(@[aepnrs])/);
    if (!ifKeywordMatch) {
        return diagnostics;
    }

    if (asKeywordMatch.index! > ifKeywordMatch.index!) {
        return diagnostics;
    }

    const asSelectorMatch = extractSelector(trimmed, asKeywordMatch.index! + asKeywordMatch[0].length - 2);
    const ifSelectorMatch = extractSelector(trimmed, ifKeywordMatch.index! + ifKeywordMatch[0].length - 2);

    if (!asSelectorMatch || !ifSelectorMatch) {
        return diagnostics;
    }

    const entityBase = ifSelectorMatch.raw.substring(0, 2);
    const leadingWhitespace = line.length - line.trimStart().length;

    const asEndIndex = asKeywordMatch.index! + asKeywordMatch[0].length - 2 + asSelectorMatch.raw.length;
    const ifIndex = ifKeywordMatch.index!;
    const between = trimmed.substring(asEndIndex, ifIndex);
    if (/\b(on|positioned|at|in)\s/.test(between)) {
        return diagnostics;
    }

    const asStartCol = leadingWhitespace + asKeywordMatch.index!;
    const asEndCol = leadingWhitespace + asEndIndex;
    const ifStartCol = leadingWhitespace + ifKeywordMatch.index!;
    const ifEndCol =
        leadingWhitespace + ifKeywordMatch.index! + ifKeywordMatch[0].length - 2 + ifSelectorMatch.raw.length;

    if (entityBase === "@s") {
        const asArgsStr =
            asSelectorMatch.raw.length > 2 && asSelectorMatch.raw.includes("[") ? asSelectorMatch.raw.slice(3, -1) : "";
        const sArgsStr =
            ifSelectorMatch.raw.length > 2 && ifSelectorMatch.raw.includes("[") ? ifSelectorMatch.raw.slice(3, -1) : "";
        const condition = ifKeywordMatch[1];

        const status = analyzeMerge(asArgsStr, sArgsStr);

        if (status === "SAFE") {
            if (config.executeAsIfEntitySMerge) {
                const asRange = new vscode.Range(lineIndex, asStartCol, lineIndex, asEndCol);
                const ifRange = new vscode.Range(lineIndex, ifStartCol, lineIndex, ifEndCol);
                diagnostics.push(
                    createDiagnostic(
                        asRange,
                        "executeAsIfEntitySMerge",
                        "execute-as-if-entity-s-merge",
                        vscode.DiagnosticSeverity.Warning,
                        { condition },
                    ),
                    createDiagnostic(
                        ifRange,
                        "executeAsIfEntitySMerge",
                        "execute-as-if-entity-s-merge",
                        vscode.DiagnosticSeverity.Warning,
                        { condition },
                    ),
                );
            }
        } else if (status === "CONFLICT") {
            if (config.unreachableCondition) {
                const asRange = new vscode.Range(lineIndex, asStartCol, lineIndex, asEndCol);
                const ifRange = new vscode.Range(lineIndex, ifStartCol, lineIndex, ifEndCol);
                diagnostics.push(
                    createDiagnostic(asRange, "unreachableCondition", "unreachable-condition"),
                    createDiagnostic(ifRange, "unreachableCondition", "unreachable-condition"),
                );
            }
        } else {
            if (config.executeAsIfEntitySConvert) {
                const asRange = new vscode.Range(lineIndex, asStartCol, lineIndex, asEndCol);
                const ifRange = new vscode.Range(lineIndex, ifStartCol, lineIndex, ifEndCol);
                diagnostics.push(
                    createDiagnostic(
                        asRange,
                        "executeAsIfEntitySConvert",
                        "execute-as-if-entity-s-convert",
                        vscode.DiagnosticSeverity.Warning,
                        { condition },
                    ),
                    createDiagnostic(
                        ifRange,
                        "executeAsIfEntitySConvert",
                        "execute-as-if-entity-s-convert",
                        vscode.DiagnosticSeverity.Warning,
                        { condition },
                    ),
                );
            }
        }
    }

    return diagnostics;
}

import * as vscode from "vscode";
import { RuleConfig } from "../utils/config";
import { parseArgs, DUPLICABLE_KEYS, COMPLEX_KEYS } from "../parser/selectorParser";
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

    const asMatch = trimmed.match(/(?<!(positioned|rotated)\s)\bas\s+(@[aepnrs])(\[[^\]]*\])?/);
    if (!asMatch) {
        return diagnostics;
    }

    const ifEntityMatch = trimmed.match(/\b(if|unless)\s+entity\s+(@[aepnrs])(\[[^\]]*\])?/);
    if (!ifEntityMatch) {
        return diagnostics;
    }

    if (asMatch.index! > ifEntityMatch.index!) {
        return diagnostics;
    }

    const entityBase = ifEntityMatch[2];
    const leadingWhitespace = line.length - line.trimStart().length;

    const asEndIndex = asMatch.index! + asMatch[0].length;
    const ifIndex = ifEntityMatch.index!;
    const between = trimmed.substring(asEndIndex, ifIndex);
    if (/\b(on|positioned|at|in)\s/.test(between)) {
        return diagnostics;
    }

    const asStartCol = leadingWhitespace + asMatch.index!;
    const asEndCol = asStartCol + asMatch[0].length;
    const ifStartCol = leadingWhitespace + ifEntityMatch.index!;
    const ifEndCol = ifStartCol + ifEntityMatch[0].length;

    if (entityBase === "@s") {
        const asArgsStr = asMatch[3] ? asMatch[3].slice(1, -1) : "";
        const sArgsStr = ifEntityMatch[3] ? ifEntityMatch[3].slice(1, -1) : "";
        const condition = ifEntityMatch[1];

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

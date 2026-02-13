import * as vscode from "vscode";
import { DIAGNOSTIC_SOURCE } from "../constants";
import { t } from "../utils/i18n";
import { RuleConfig, getRuleConfig } from "../utils/config";

const DUPLICABLE_KEYS = ["predicate", "tag", "nbt"];
const COMPLEX_KEYS = ["scores", "advancements"];

function parseArgs(argsStr: string): { key: string; raw: string }[] {
    if (!argsStr) {
        return [];
    }
    const args: { key: string; raw: string }[] = [];
    let current = "";
    let depth = 0;

    for (let i = 0; i < argsStr.length; i++) {
        const char = argsStr[i];
        if (char === "{" || char === "[") {
            depth++;
            current += char;
        } else if (char === "}" || char === "]") {
            depth--;
            current += char;
        } else if (char === "," && depth === 0) {
            if (current.trim()) {
                const eqIndex = current.indexOf("=");
                const key = eqIndex !== -1 ? current.slice(0, eqIndex).trim() : current.trim();
                args.push({ key, raw: current.trim() });
            }
            current = "";
        } else {
            current += char;
        }
    }

    if (current.trim()) {
        const eqIndex = current.indexOf("=");
        const key = eqIndex !== -1 ? current.slice(0, eqIndex).trim() : current.trim();
        args.push({ key, raw: current.trim() });
    }

    return args;
}

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

export function checkExecuteAsIfEntity(lineIndex: number, line: string, config?: RuleConfig): vscode.Diagnostic[] {
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

    const effectiveConfig = config || getRuleConfig();

    if (entityBase === "@s") {
        const asArgsStr = asMatch[3] ? asMatch[3].slice(1, -1) : "";
        const sArgsStr = ifEntityMatch[3] ? ifEntityMatch[3].slice(1, -1) : "";
        const condition = ifEntityMatch[1];

        const status = analyzeMerge(asArgsStr, sArgsStr);

        if (status === "SAFE") {
            if (effectiveConfig.executeAsIfEntitySMerge) {
                const message = t("executeAsIfEntitySMerge", { condition });

                const asRange = new vscode.Range(lineIndex, asStartCol, lineIndex, asEndCol);
                const asDiag = new vscode.Diagnostic(asRange, message, vscode.DiagnosticSeverity.Warning);
                asDiag.source = DIAGNOSTIC_SOURCE;
                asDiag.code = "execute-as-if-entity-s-merge";

                const ifRange = new vscode.Range(lineIndex, ifStartCol, lineIndex, ifEndCol);
                const ifDiag = new vscode.Diagnostic(ifRange, message, vscode.DiagnosticSeverity.Warning);
                ifDiag.source = DIAGNOSTIC_SOURCE;
                ifDiag.code = "execute-as-if-entity-s-merge";

                diagnostics.push(asDiag, ifDiag);
            }
        } else if (status === "CONFLICT") {
            if (effectiveConfig.unreachableCondition) {
                const message = t("unreachableCondition");

                const asRange = new vscode.Range(lineIndex, asStartCol, lineIndex, asEndCol);
                const asDiag = new vscode.Diagnostic(asRange, message, vscode.DiagnosticSeverity.Warning);
                asDiag.source = DIAGNOSTIC_SOURCE;
                asDiag.code = "unreachable-condition";

                const ifRange = new vscode.Range(lineIndex, ifStartCol, lineIndex, ifEndCol);
                const ifDiag = new vscode.Diagnostic(ifRange, message, vscode.DiagnosticSeverity.Warning);
                ifDiag.source = DIAGNOSTIC_SOURCE;
                ifDiag.code = "unreachable-condition";

                diagnostics.push(asDiag, ifDiag);
            }
        } else {
            if (effectiveConfig.executeAsIfEntitySConvert) {
                const message = t("executeAsIfEntitySConvert", { condition });

                const asRange = new vscode.Range(lineIndex, asStartCol, lineIndex, asEndCol);
                const asDiag = new vscode.Diagnostic(asRange, message, vscode.DiagnosticSeverity.Warning);
                asDiag.source = DIAGNOSTIC_SOURCE;
                asDiag.code = "execute-as-if-entity-s-convert";

                const ifRange = new vscode.Range(lineIndex, ifStartCol, lineIndex, ifEndCol);
                const ifDiag = new vscode.Diagnostic(ifRange, message, vscode.DiagnosticSeverity.Warning);
                ifDiag.source = DIAGNOSTIC_SOURCE;
                ifDiag.code = "execute-as-if-entity-s-convert";

                diagnostics.push(asDiag, ifDiag);
            }
        }
    }

    return diagnostics;
}

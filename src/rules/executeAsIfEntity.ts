import * as vscode from "vscode";
import { DIAGNOSTIC_SOURCE } from "../constants";
import { t } from "../utils/i18n";

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

export function checkExecuteAsIfEntity(lineIndex: number, line: string): vscode.Diagnostic | null {
    const trimmed = line.trim();

    if (!trimmed.startsWith("execute ")) {
        return null;
    }

    const asMatch = trimmed.match(/(?<!(positioned|rotated)\s)\bas\s+(@[aepnrs])(\[[^\]]*\])?/);
    if (!asMatch) {
        return null;
    }

    const ifEntityMatch = trimmed.match(/\b(if|unless)\s+entity\s+(@[aepnrs])(\[[^\]]*\])?/);
    if (!ifEntityMatch) {
        return null;
    }

    const entityBase = ifEntityMatch[2];
    const startIndex = line.indexOf("execute");
    const range = new vscode.Range(lineIndex, startIndex, lineIndex, line.length);

    if (entityBase === "@s") {
        const asArgsStr = asMatch[3] ? asMatch[3].slice(1, -1) : "";
        const sArgsStr = ifEntityMatch[3] ? ifEntityMatch[3].slice(1, -1) : "";

        const status = analyzeMerge(asArgsStr, sArgsStr);

        if (status === "SAFE") {
            const message = t("executeAsIfEntitySMerge");
            const diagnostic = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Warning);
            diagnostic.source = DIAGNOSTIC_SOURCE;
            diagnostic.code = "execute-as-if-entity-s-merge";
            return diagnostic;
        } else if (status === "CONFLICT") {
            const message = t("unreachableCondition");
            const diagnostic = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Warning);
            diagnostic.source = DIAGNOSTIC_SOURCE;
            diagnostic.code = "unreachable-condition";
            return diagnostic;
        } else {
            const message = t("executeAsIfEntitySConvert");
            const diagnostic = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Warning);
            diagnostic.source = DIAGNOSTIC_SOURCE;
            diagnostic.code = "execute-as-if-entity-s-convert";
            return diagnostic;
        }
    }

    return null;
}

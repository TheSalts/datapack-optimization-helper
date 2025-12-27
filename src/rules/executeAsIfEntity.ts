import * as vscode from "vscode";
import { DIAGNOSTIC_SOURCE } from "../constants";
import { t } from "../utils/i18n";

const DUPLICABLE_KEYS = ["predicate", "tag", "nbt"];

function parseArgs(argsStr: string): { key: string; raw: string }[] {
    if (!argsStr) return [];
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

function canMerge(asArgsStr: string, sArgsStr: string): boolean {
    const asArgs = parseArgs(asArgsStr);
    const sArgs = parseArgs(sArgsStr);

    const asKeys = asArgs.map(a => a.key).filter(k => !DUPLICABLE_KEYS.includes(k));
    const sKeys = sArgs.map(a => a.key).filter(k => !DUPLICABLE_KEYS.includes(k));

    for (const key of asKeys) {
        if (sKeys.includes(key)) {
            return false;
        }
    }
    return true;
}

export function checkExecuteAsIfEntity(lineIndex: number, line: string): vscode.Diagnostic | null {
    const trimmed = line.trim();

    if (!trimmed.startsWith("execute ")) {
        return null;
    }

    const asMatch = trimmed.match(/(?<!positioned\s)\bas\s+(@[aepnrs])(\[[^\]]*\])?/);
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
        const asArgsStr = asMatch[2] ? asMatch[2].slice(1, -1) : "";
        const sArgsStr = ifEntityMatch[3] ? ifEntityMatch[3].slice(1, -1) : "";

        if (canMerge(asArgsStr, sArgsStr)) {
            const diagnostic = new vscode.Diagnostic(range, t("executeAsIfEntitySMerge"), vscode.DiagnosticSeverity.Warning);
            diagnostic.source = DIAGNOSTIC_SOURCE;
            diagnostic.code = "execute-as-if-entity-s-merge";
            return diagnostic;
        } else {
            const diagnostic = new vscode.Diagnostic(range, t("executeAsIfEntitySConvert"), vscode.DiagnosticSeverity.Warning);
            diagnostic.source = DIAGNOSTIC_SOURCE;
            diagnostic.code = "execute-as-if-entity-s-convert";
            return diagnostic;
        }
    } else {
        const diagnostic = new vscode.Diagnostic(range, t("executeAsIfEntityRemoveAs"), vscode.DiagnosticSeverity.Warning);
        diagnostic.source = DIAGNOSTIC_SOURCE;
        diagnostic.code = "execute-as-if-entity-remove-as";
        return diagnostic;
    }
}


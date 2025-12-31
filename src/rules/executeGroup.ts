import * as vscode from "vscode";
import { DIAGNOSTIC_SOURCE } from "../constants";
import { t } from "../utils/i18n";

export interface ExecuteGroup {
    commonPrefix: string;
    suffixes: string[];
    lineIndices: number[];
    startLine: number;
    endLine: number;
}

interface ExecuteLine {
    lineIndex: number;
    fullLine: string;
}

export function findExecuteGroups(lines: string[]): ExecuteGroup[] {
    const groups: ExecuteGroup[] = [];
    const executeLines: ExecuteLine[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmed === "" || trimmed.startsWith("#")) {
            if (executeLines.length >= 2) {
                const group = createGroupFromLines(executeLines);
                if (group) {
                    groups.push(group);
                }
            }
            executeLines.length = 0;
            continue;
        }

        if (trimmed.startsWith("execute ")) {
            executeLines.push({ lineIndex: i, fullLine: trimmed });
        } else {
            if (executeLines.length >= 2) {
                const group = createGroupFromLines(executeLines);
                if (group) {
                    groups.push(group);
                }
            }
            executeLines.length = 0;
        }
    }

    if (executeLines.length >= 2) {
        const group = createGroupFromLines(executeLines);
        if (group) {
            groups.push(group);
        }
    }

    return groups;
}

const EXECUTE_SUBCOMMANDS = [
    "as",
    "at",
    "positioned",
    "rotated",
    "facing",
    "align",
    "anchored",
    "in",
    "summon",
    "on",
    "if",
    "unless",
    "store",
];

function createGroupFromLines(executeLines: ExecuteLine[]): ExecuteGroup | null {
    if (executeLines.length < 2) {
        return null;
    }

    const allTokens = executeLines.map((e) => tokenizeExecuteNormalized(e.fullLine));
    const { commonPrefix, commonTokenCount } = findCommonExecutePrefix(allTokens);

    if (!commonPrefix) {
        return null;
    }

    const suffixes = allTokens.map((tokens) => {
        let suffixTokens = tokens.slice(commonTokenCount);
        if (suffixTokens[0] === "run") {
            suffixTokens = suffixTokens.slice(1);
        }
        const suffix = suffixTokens.join(" ");
        if (!suffix) {
            return "";
        }
        const firstToken = suffixTokens[0];
        if (EXECUTE_SUBCOMMANDS.includes(firstToken)) {
            return `execute ${suffix}`;
        }
        return suffix;
    });

    return {
        commonPrefix,
        suffixes,
        lineIndices: executeLines.map((e) => e.lineIndex),
        startLine: executeLines[0].lineIndex,
        endLine: executeLines[executeLines.length - 1].lineIndex,
    };
}

function findCommonExecutePrefix(allTokens: string[][]): { commonPrefix: string | null; commonTokenCount: number } {
    if (allTokens.length === 0) {
        return { commonPrefix: null, commonTokenCount: 0 };
    }

    let commonLength = 0;
    const minLength = Math.min(...allTokens.map((t) => t.length));

    for (let i = 0; i < minLength; i++) {
        const token = allTokens[0][i];
        if (allTokens.every((t) => t[i] === token)) {
            commonLength = i + 1;
        } else {
            break;
        }
    }

    if (commonLength < 2) {
        return { commonPrefix: null, commonTokenCount: 0 };
    }

    const commonTokens = allTokens[0].slice(0, commonLength);
    const lastRunIndex = findLastRunIndex(commonTokens);

    if (lastRunIndex === -1) {
        return { commonPrefix: null, commonTokenCount: 0 };
    }

    const prefixTokens = commonTokens.slice(0, lastRunIndex + 1);
    return { commonPrefix: prefixTokens.join(" ") + " ", commonTokenCount: lastRunIndex + 1 };
}

function normalizeSelector(selector: string): string {
    const match = selector.match(/^(@[aepnrs])(\[([^\]]*)\])?$/);
    if (!match) {
        return selector;
    }

    const base = match[1];
    const argsStr = match[3];

    if (!argsStr) {
        return selector;
    }

    const args: string[] = [];
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
                args.push(current.trim());
            }
            current = "";
        } else {
            current += char;
        }
    }

    if (current.trim()) {
        args.push(current.trim());
    }

    args.sort();
    return `${base}[${args.join(",")}]`;
}

function tokenizeExecute(line: string): string[] {
    const tokens: string[] = [];
    let current = "";
    let depth = 0;
    let inQuote = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"' && (i === 0 || line[i - 1] !== "\\")) {
            inQuote = !inQuote;
            current += char;
        } else if (!inQuote && (char === "{" || char === "[")) {
            depth++;
            current += char;
        } else if (!inQuote && (char === "}" || char === "]")) {
            depth--;
            current += char;
        } else if (!inQuote && depth === 0 && char === " ") {
            if (current) {
                tokens.push(current);
                current = "";
            }
        } else {
            current += char;
        }
    }

    if (current) {
        tokens.push(current);
    }

    return tokens;
}

function tokenizeExecuteNormalized(line: string): string[] {
    const tokens = tokenizeExecute(line);
    return tokens.map((token) => {
        if (token.startsWith("@")) {
            return normalizeSelector(token);
        }
        return token;
    });
}

function findLastRunIndex(tokens: string[]): number {
    for (let i = tokens.length - 1; i >= 0; i--) {
        if (tokens[i] === "run") {
            return i;
        }
    }
    return -1;
}

export function checkExecuteGroup(lines: string[]): vscode.Diagnostic[] {
    const groups = findExecuteGroups(lines);
    const diagnostics: vscode.Diagnostic[] = [];

    for (const group of groups) {
        const range = new vscode.Range(group.startLine, 0, group.endLine, lines[group.endLine].length);
        const message = t("executeGroup");
        const diagnostic = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Warning);
        diagnostic.source = DIAGNOSTIC_SOURCE;
        diagnostic.code = "execute-group";
        diagnostics.push(diagnostic);
    }

    return diagnostics;
}

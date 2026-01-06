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
    tokens: string[];
}

export function findExecuteGroups(lines: string[]): ExecuteGroup[] {
    const groups: ExecuteGroup[] = [];
    const executeLines: ExecuteLine[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmed === "" || trimmed.startsWith("#")) {
            continue;
        }

        if (trimmed.startsWith("execute ")) {
            executeLines.push({
                lineIndex: i,
                fullLine: trimmed,
                tokens: tokenizeExecuteNormalized(trimmed),
            });
        } else {
            if (executeLines.length >= 2) {
                groups.push(...extractGroupsFromBlock(executeLines));
            }
            executeLines.length = 0;
        }
    }

    if (executeLines.length >= 2) {
        groups.push(...extractGroupsFromBlock(executeLines));
    }

    return groups;
}

function extractGroupsFromBlock(lines: ExecuteLine[]): ExecuteGroup[] {
    const results: ExecuteGroup[] = [];
    if (lines.length < 2) {
        return results;
    }

    let currentBatch: ExecuteLine[] = [lines[0]];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];

        // Check if adding this line maintains a valid group
        const testBatch = [...currentBatch, line];
        const testTokens = testBatch.map((l) => l.tokens);
        const { commonPrefix } = findCommonExecutePrefix(testTokens);

        if (commonPrefix !== null) {
            currentBatch.push(line);
        } else {
            if (currentBatch.length >= 2) {
                const group = createGroupFromLines(currentBatch);
                if (group) {
                    results.push(group);
                }
            }
            currentBatch = [line];
        }
    }

    if (currentBatch.length >= 2) {
        const group = createGroupFromLines(currentBatch);
        if (group) {
            results.push(group);
        }
    }

    return results;
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

    const allTokens = executeLines.map((e) => e.tokens);
    const { commonPrefix, commonTokenCount } = findCommonExecutePrefix(allTokens);

    if (!commonPrefix) {
        return null;
    }

    const suffixes = allTokens.map((tokens) => {
        let suffixTokens = tokens.slice(commonTokenCount);
        let hadRun = false;
        if (suffixTokens[0] === "run") {
            suffixTokens = suffixTokens.slice(1);
            hadRun = true;
        }
        const suffix = suffixTokens.join(" ");
        if (!suffix) {
            return "";
        }
        const firstToken = suffixTokens[0];
        if (!hadRun && EXECUTE_SUBCOMMANDS.includes(firstToken)) {
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

    while (commonLength > 0) {
        const commonTokens = allTokens[0].slice(0, commonLength);
        const lastRunIndex = findLastRunIndex(commonTokens);

        if (lastRunIndex !== -1) {
            const prefixTokens = commonTokens.slice(0, lastRunIndex + 1);
            return { commonPrefix: prefixTokens.join(" ") + " ", commonTokenCount: lastRunIndex + 1 };
        }

        const validNextTokens = [...EXECUTE_SUBCOMMANDS, "run"];
        let isValid = true;

        for (const tokens of allTokens) {
            if (tokens.length <= commonLength) {
                isValid = false;
                break;
            }
            const nextToken = tokens[commonLength];
            if (!validNextTokens.includes(nextToken)) {
                isValid = false;
                break;
            }
        }

        if (isValid) {
            const lastToken = commonTokens[commonTokens.length - 1];
            if (lastToken === "positioned" || lastToken === "rotated") {
                const nextTokens = allTokens.map((tokens) => tokens[commonLength]);
                if (nextTokens.every((t) => t === "as")) {
                    const selectorTokens = allTokens.map((tokens) => tokens[commonLength + 1]);
                    if (!selectorTokens.every((t) => t === selectorTokens[0])) {
                        isValid = false;
                    }
                }
            }

            if (isValid && commonLength >= 2) {
                return { commonPrefix: commonTokens.join(" ") + " ", commonTokenCount: commonLength };
            }
        }

        commonLength--;
    }

    return { commonPrefix: null, commonTokenCount: 0 };
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

    args.sort((a, b) => {
        const aIsType = a.startsWith("type=") || a.startsWith("type!=") || a.startsWith("type=!");
        const bIsType = b.startsWith("type=") || b.startsWith("type!=") || b.startsWith("type=!");
        if (aIsType && !bIsType) {
            return 1;
        }
        if (!aIsType && bIsType) {
            return -1;
        }
        return a.localeCompare(b);
    });
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

import * as vscode from "vscode";
import { DIAGNOSTIC_SOURCE } from "../constants";
import { t } from "../utils/i18n";

interface ExecuteToken {
    subcommand: string;
    args: string;
    raw: string;
}

export function checkExecuteRedundant(lineIndex: number, line: string): vscode.Diagnostic[] {
    const trimmed = line.trim();
    if (!trimmed.startsWith("execute ")) {
        return [];
    }

    if (/^execute\s+run\s+/.test(trimmed)) {
        return [];
    }

    const diagnostics: vscode.Diagnostic[] = [];
    const tokens = parseExecuteTokens(trimmed);
    const duplicates = findDuplicateSubcommands(tokens);

    if (duplicates.length > 0) {
        const range = new vscode.Range(lineIndex, 0, lineIndex, line.length);
        const diagnostic = new vscode.Diagnostic(range, t("executeDuplicate"), vscode.DiagnosticSeverity.Warning);
        diagnostic.source = DIAGNOSTIC_SOURCE;
        diagnostic.code = "execute-duplicate";
        diagnostics.push(diagnostic);
    }

    return diagnostics;
}

function parseExecuteTokens(line: string): ExecuteToken[] {
    const tokens: ExecuteToken[] = [];
    const subcommands = ["as", "at", "positioned", "rotated", "facing", "align", "anchored", "in", "summon", "on", "if", "unless", "store"];

    const words = tokenizeLine(line);
    if (words[0] !== "execute") {
        return tokens;
    }

    let i = 1;
    while (i < words.length) {
        const word = words[i];

        if (word === "run") {
            break;
        }

        if (subcommands.includes(word)) {
            const subcommand = word;
            const argsStart = i + 1;
            let argsEnd = argsStart;

            while (argsEnd < words.length && !subcommands.includes(words[argsEnd]) && words[argsEnd] !== "run") {
                argsEnd++;
            }

            const args = words.slice(argsStart, argsEnd).join(" ");
            tokens.push({
                subcommand,
                args,
                raw: `${subcommand} ${args}`.trim(),
            });
            i = argsEnd;
        } else {
            i++;
        }
    }

    return tokens;
}

function tokenizeLine(line: string): string[] {
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

function hasSortNearest(selector: string): boolean {
    if (selector === "@p" || selector === "@n") {
        return true;
    }
    if (selector.startsWith("@p[") || selector.startsWith("@n[")) {
        return true;
    }
    if (/sort\s*=\s*nearest/.test(selector)) {
        return true;
    }
    return false;
}

function findDuplicateSubcommands(tokens: ExecuteToken[]): number[] {
    const duplicates: number[] = [];
    const seen: Map<string, number> = new Map();

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const key = `${token.subcommand}:${token.args}`;

        if (seen.has(key)) {
            duplicates.push(i);
        } else {
            if (token.subcommand === "at" || token.subcommand === "as") {
                if (hasSortNearest(token.args)) {
                    continue;
                }
            }
            seen.set(key, i);
        }
    }

    return duplicates;
}

export function getOptimizedExecute(line: string): string | null {
    const trimmed = line.trim();
    if (!trimmed.startsWith("execute ")) {
        return null;
    }

    if (/^execute\s+run\s+/.test(trimmed)) {
        return null;
    }

    const tokens = parseExecuteTokens(trimmed);
    const seen: Map<string, boolean> = new Map();
    const keptTokens: ExecuteToken[] = [];

    for (const token of tokens) {
        const key = `${token.subcommand}:${token.args}`;

        if (token.subcommand === "at" || token.subcommand === "as") {
            if (hasSortNearest(token.args)) {
                keptTokens.push(token);
                continue;
            }
        }

        if (!seen.has(key)) {
            seen.set(key, true);
            keptTokens.push(token);
        }
    }

    if (keptTokens.length === tokens.length) {
        return null;
    }

    const runMatch = trimmed.match(/\s+run\s+(.+)$/);
    const runPart = runMatch ? ` run ${runMatch[1]}` : "";

    return `execute ${keptTokens.map((t) => t.raw).join(" ")}${runPart}`;
}


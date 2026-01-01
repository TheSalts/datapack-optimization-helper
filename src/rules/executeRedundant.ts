import * as vscode from "vscode";
import { DIAGNOSTIC_SOURCE } from "../constants";
import { t } from "../utils/i18n";
import { RuleConfig, getRuleConfig } from "../utils/config";

interface ExecuteToken {
    subcommand: string;
    args: string;
    raw: string;
    index: number;
    range: vscode.Range;
}

export function checkExecuteRedundant(lineIndex: number, line: string, config?: RuleConfig): vscode.Diagnostic[] {
    const effectiveConfig = config || getRuleConfig();
    if (!effectiveConfig.executeDuplicate) {
        return [];
    }

    const trimmed = line.trim();
    if (!trimmed.startsWith("execute ")) {
        return [];
    }

    if (/^execute\s+run\s+/.test(trimmed)) {
        return [];
    }

    const diagnostics: vscode.Diagnostic[] = [];
    const tokens = parseExecuteTokens(lineIndex, line);
    const duplicates = findRedundantSubcommands(tokens);

    for (const token of duplicates) {
        const message = t("executeDuplicate");
        const diagnostic = new vscode.Diagnostic(token.range, message, vscode.DiagnosticSeverity.Warning);
        diagnostic.source = DIAGNOSTIC_SOURCE;
        diagnostic.code = "execute-duplicate";
        diagnostics.push(diagnostic);
    }

    return diagnostics;
}

function parseExecuteTokens(lineIndex: number, line: string): ExecuteToken[] {
    const tokens: ExecuteToken[] = [];
    const subcommands = [
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

    const words = tokenizeLine(line);
    if (words[0].text !== "execute") {
        return tokens;
    }

    let i = 1;
    while (i < words.length) {
        const word = words[i];

        if (word.text === "run") {
            break;
        }

        if (subcommands.includes(word.text)) {
            let subcommand = word.text;
            let argsStart = i + 1;
            let startChar = word.start;

            if ((word.text === "positioned" || word.text === "rotated") && words[argsStart]?.text === "as") {
                subcommand = `${word.text} as`;
                argsStart = i + 2;
            } else if (word.text === "facing" && words[argsStart]?.text === "entity") {
                subcommand = "facing entity";
                argsStart = i + 2;
            }

            let argsEnd = argsStart;
            while (argsEnd < words.length && !subcommands.includes(words[argsEnd].text) && words[argsEnd].text !== "run") {
                argsEnd++;
            }

            const argTokens = words.slice(argsStart, argsEnd);
            const args = argTokens.map(t => t.text).join(" ");
            
            // Calculate range
            const endChar = argTokens.length > 0 ? argTokens[argTokens.length - 1].end : words[i].end;
            
            tokens.push({
                subcommand,
                args,
                raw: line.substring(startChar, endChar),
                index: tokens.length,
                range: new vscode.Range(lineIndex, startChar, lineIndex, endChar),
            });
            i = argsEnd;
        } else {
            i++;
        }
    }

    return tokens;
}

interface TokenInfo {
    text: string;
    start: number;
    end: number;
}

function tokenizeLine(line: string): TokenInfo[] {
    const tokens: TokenInfo[] = [];
    let current = "";
    let start = -1;
    let depth = 0;
    let inQuote = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (start === -1 && char !== " ") {
            start = i;
        }

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
                tokens.push({ text: current, start, end: i });
                current = "";
                start = -1;
            }
        } else {
            current += char;
        }
    }

    if (current) {
        tokens.push({ text: current, start, end: line.length });
    }

    return tokens;
}

type StateComponent = 'executor' | 'position' | 'rotation' | 'dimension' | 'anchor';

function findRedundantSubcommands(tokens: ExecuteToken[]): ExecuteToken[] {
    const redundantTokens: ExecuteToken[] = [];
    const required = new Set<StateComponent>(['executor', 'position', 'rotation', 'dimension', 'anchor']);

    for (let i = tokens.length - 1; i >= 0; i--) {
        const token = tokens[i];
        const sub = token.subcommand;
        const args = token.args;

        const uses: StateComponent[] = [];
        
        // Analyze usages
        if (args.includes("~")) {
            uses.push('position');
        }
        if (args.includes("^")) {
            uses.push('position', 'rotation');
        }
        if (args.includes("@s")) {
            uses.push('executor');
        }
        if (
            args.includes("@p") || 
            args.includes("@n") || 
            args.includes("@r") || 
            args.match(/\bdistance=/) ||
            args.match(/\bd[xyz]=/) ||
            args.match(/\bsort=(nearest|furthest)/)
        ) {
            uses.push('position', 'dimension');
        }

        // Subcommand-specific usage
        if (sub === "facing entity") {
            uses.push('position');
        } else if (sub === "align") {
            uses.push('position');
        } else if (sub === "positioned as" || sub === "rotated as") {
            uses.push('executor');
        } else if (sub === "on") {
            uses.push('executor');
        }

        // Determine Provided Components (Sets)
        const sets: StateComponent[] = [];
        if (sub === "as") {
            sets.push('executor');
        } else if (sub === "at") {
            sets.push('position', 'rotation', 'dimension');
        } else if (sub === "positioned") {
            sets.push('position');
        } else if (sub === "positioned as") {
            sets.push('position');
        } else if (sub === "rotated") {
            sets.push('rotation');
        } else if (sub === "rotated as") {
            sets.push('rotation');
        } else if (sub === "facing") {
            sets.push('rotation');
        } else if (sub === "facing entity") {
            sets.push('rotation');
        } else if (sub === "align") {
            sets.push('position');
        } else if (sub === "anchored") {
            sets.push('anchor');
        } else if (sub === "in") {
            sets.push('dimension');
        } else if (sub === "summon") {
            sets.push('executor', 'position', 'rotation', 'dimension');
        } else if (sub === "on") {
            sets.push('executor');
        }

        const isSetter = sets.length > 0;
        let isValid = !isSetter; // Non-setters are always valid

        if (isSetter) {
            // Valid if it provides at least one required component
            if (sets.some(comp => required.has(comp))) {
                isValid = true;
            }
        }

        if (isValid) {
            // It was useful.
            // 1. Remove provided components from requirement (satisfied)
            for (const comp of sets) {
                required.delete(comp);
            }
            // 2. Add dependencies to requirement
            for (const comp of uses) {
                required.add(comp);
            }
        } else {
            redundantTokens.push(token);
        }
    }

    return redundantTokens.reverse();
}

export function getOptimizedExecute(line: string, strategy: 'preserve-semantics' | 'remove' = 'preserve-semantics'): string | null {
    const tokens = parseExecuteTokens(0, line);
    const duplicates = findRedundantSubcommands(tokens);
    
    if (duplicates.length === 0) {
        return null;
    }

    const redundantIndices = new Set(duplicates.map(t => t.index));
    const newTokens: string[] = [];

    for (const token of tokens) {
        if (redundantIndices.has(token.index)) {
            if (strategy === 'preserve-semantics') {
                const sub = token.subcommand;
                let selector = "";

                if (sub === "at" || sub === "as" || sub === "positioned as" || sub === "rotated as") {
                    selector = token.args;
                } else if (sub === "facing entity") {
                    selector = token.args.split(" ")[0];
                }

                if (selector) {
                    newTokens.push(`if entity ${selector}`);
                }
            }
            // If strategy is 'remove', we do nothing here, so the token is skipped.
        } else {
            newTokens.push(token.raw);
        }
    }
    
    const runMatch = line.match(/\s+run\s+(.+)$/);
    const runPart = runMatch ? ` run ${runMatch[1]}` : "";
    
    return `execute ${newTokens.join(" ")}${runPart}`;
}

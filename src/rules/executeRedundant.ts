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

type RedundancyReason = "duplicate" | "unnecessary";

interface RedundantToken {
    token: ExecuteToken;
    reason: RedundancyReason;
}

export function checkExecuteRedundant(lineIndex: number, line: string, config?: RuleConfig): vscode.Diagnostic[] {
    const effectiveConfig = config || getRuleConfig();
    if (!effectiveConfig.executeDuplicate && !effectiveConfig.executeUnnecessary) {
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
    const redundants = findRedundantSubcommands(tokens);

    for (const { token, reason } of redundants) {
        if (reason === "duplicate" && !effectiveConfig.executeDuplicate) {
            continue;
        }
        if (reason === "unnecessary" && !effectiveConfig.executeUnnecessary) {
            continue;
        }

        const messageKey = reason === "duplicate" ? "executeDuplicate" : "executeUnnecessary";
        const message = t(messageKey);
        const diagnostic = new vscode.Diagnostic(token.range, message, vscode.DiagnosticSeverity.Warning);
        diagnostic.source = DIAGNOSTIC_SOURCE;
        diagnostic.code = reason === "duplicate" ? "execute-duplicate" : "execute-unnecessary";
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
            while (
                argsEnd < words.length &&
                !subcommands.includes(words[argsEnd].text) &&
                words[argsEnd].text !== "run"
            ) {
                argsEnd++;
            }

            const argTokens = words.slice(argsStart, argsEnd);
            const args = argTokens.map((t) => t.text).join(" ");

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

type StateComponent = "executor" | "position" | "rotation" | "dimension" | "anchor";

function hasRelativeCoordinate(args: string): boolean {
    return args.includes("~") || args.includes("^");
}

function hasLocalCoordinate(args: string): boolean {
    return args.includes("^");
}

function hasNearestSelector(args: string): boolean {
    return args.includes("@p") || args.includes("@n") || /\bsort=(nearest|furthest)/.test(args);
}

function hasNearestSelectorDependency(tokens: ExecuteToken[], index: number): boolean {
    const token = tokens[index];
    const args = token.args;

    if (!hasNearestSelector(args)) {
        return false;
    }

    // Check if preceded by "positioned as" or "at"
    const prevToken = index > 0 ? tokens[index - 1] : null;
    const isAfterPositionSetter =
        prevToken && (prevToken.subcommand === "positioned as" || prevToken.subcommand === "at");

    if (!isAfterPositionSetter) {
        // Not after position setter, has position dependency
        return true;
    }

    // After position setter - inherit dependency from previous token's chain
    return hasNearestSelectorDependency(tokens, index - 1);
}

function getSubcommandSets(sub: string): StateComponent[] {
    const sets: StateComponent[] = [];
    switch (sub) {
        case "as":
            sets.push("executor");
            break;
        case "at":
            sets.push("position", "rotation", "dimension");
            break;
        case "positioned":
        case "positioned as":
            sets.push("position");
            break;
        case "rotated":
        case "rotated as":
        case "facing":
        case "facing entity":
            sets.push("rotation");
            break;
        case "align":
            sets.push("position");
            break;
        case "anchored":
            sets.push("anchor");
            break;
        case "in":
            sets.push("dimension");
            break;
        case "summon":
            sets.push("executor", "position", "rotation", "dimension");
            break;
        case "on":
            sets.push("executor");
            break;
    }
    return sets;
}

function findRedundantSubcommands(tokens: ExecuteToken[]): RedundantToken[] {
    const redundantTokens: RedundantToken[] = [];
    const required = new Set<StateComponent>(["executor", "position", "rotation", "dimension", "anchor"]);
    const seenSubcommands = new Set<string>();

    for (let i = tokens.length - 1; i >= 0; i--) {
        const token = tokens[i];
        const sub = token.subcommand;
        const args = token.args;

        if (sub === "summon") {
            break;
        }

        const uses: StateComponent[] = [];

        // Analyze usages based on subcommand type
        if (sub === "positioned") {
            // "positioned over ..." uses current x, z position
            if (args.startsWith("over ")) {
                uses.push("position");
            } else if (hasRelativeCoordinate(args)) {
                uses.push("position");
                if (hasLocalCoordinate(args)) {
                    uses.push("rotation");
                }
            }
        } else if (sub === "rotated") {
            // "rotated X Y" with relative rotation
            if (hasRelativeCoordinate(args)) {
                uses.push("rotation");
            }
        } else {
            // For other subcommands, check args for coordinate dependencies
            if (args.includes("~")) {
                uses.push("position");
            }
            if (args.includes("^")) {
                uses.push("position", "rotation");
            }
        }

        if (args.includes("@s")) {
            uses.push("executor");
        }
        // @p, @n, sort=nearest/furthest → HAS position dependency (different entity may be selected based on position)
        // Exception: if preceded by "positioned as" or "at", distance becomes 0 and same entity is re-selected
        // But we need to check the chain - inherit position dependency from previous positioned as/at
        // @r = sort=random → no position dependency (random is position-independent)
        if (args.match(/\bdistance=/) || args.match(/\bd[xyz]=/) || args.match(/\b[xyz]=/)) {
            uses.push("position", "dimension");
        }
        // @p, @n, sort=nearest/furthest - check chain for position dependency
        if (hasNearestSelectorDependency(tokens, i)) {
            uses.push("position", "dimension");
        }

        // Subcommand-specific usage
        if (sub === "facing entity") {
            uses.push("position");
        } else if (sub === "align") {
            uses.push("position");
        } else if (sub === "positioned as" || sub === "rotated as") {
            uses.push("executor");
        } else if (sub === "on") {
            uses.push("executor");
        }

        // Determine Provided Components (Sets)
        const sets = getSubcommandSets(sub);

        const isSetter = sets.length > 0;
        let isValid = !isSetter; // Non-setters are always valid

        if (isSetter) {
            // Valid if it provides at least one required component
            if (sets.some((comp) => required.has(comp))) {
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
            seenSubcommands.add(sub);
        } else {
            const reason: RedundancyReason = seenSubcommands.has(sub) ? "duplicate" : "unnecessary";
            redundantTokens.push({ token, reason });
        }
    }

    return redundantTokens.reverse();
}

export function getOptimizedExecute(
    line: string,
    strategy: "preserve-semantics" | "remove" = "preserve-semantics"
): string | null {
    const tokens = parseExecuteTokens(0, line);
    const redundants = findRedundantSubcommands(tokens);

    if (redundants.length === 0) {
        return null;
    }

    const redundantIndices = new Set(redundants.map((r) => r.token.index));
    const newTokens: string[] = [];

    for (const token of tokens) {
        if (redundantIndices.has(token.index)) {
            if (strategy === "preserve-semantics") {
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

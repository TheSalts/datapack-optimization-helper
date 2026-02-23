/**
 * Shared tokenizer for mcfunction execute lines.
 *
 * Handles bracket/brace depth and quoted strings so that selector arguments,
 * NBT compounds, etc. are kept as a single token.
 *
 * Previously two near-identical implementations existed:
 *   - executeGroup.ts  → tokenizeExecute() returning string[]
 *   - executeRedundant.ts → tokenizeLine() returning TokenInfo[]
 *
 * This module provides TokenInfo[] as the canonical form; callers that only
 * need the text can use `tokenize(line).map(t => t.text)`.
 */

export interface TokenInfo {
    text: string;
    start: number;
    end: number;
}

export function tokenize(line: string): TokenInfo[] {
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

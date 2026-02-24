/**
 * Shared selector-argument parser.
 *
 * Previously parseArgs() was copy-pasted identically in both
 * executeAsIfEntity.ts and executeAsIfEntityFix.ts.  The shared constants
 * DUPLICABLE_KEYS / COMPLEX_KEYS also existed in both files.
 *
 * Additionally, nbtItems.ts had parseAllSelectors() which was nearly
 * identical to targetSelector.ts's parseSelectors() — the only difference
 * was the set of selector characters matched.  A selectorTypes parameter
 * now unifies those two.
 */

// ── Shared selector-argument parser ────────────────────────────────────────

/** Parses a raw args string (without the surrounding brackets) into key/raw pairs. */
export function parseArgs(argsStr: string): { key: string; raw: string }[] {
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

// ── Constants shared by executeAsIfEntity.ts / executeAsIfEntityFix.ts ─────

export const DUPLICABLE_KEYS = ["predicate", "tag", "nbt"];
export const COMPLEX_KEYS = ["scores", "advancements"];

// ── Unified selector scanner ─────────────────────────────────────────────────

export interface SelectorMatch {
    /** Full matched selector text, e.g. `@e[type=player]` */
    raw: string;
    startIndex: number;
    endIndex: number;
}

/**
 * Find all entity selectors on a line.
 *
 * @param selectorTypes  Characters to match after `@`.
 *   - `"en"` (default) → only @e and @n  (targetSelector.ts behaviour)
 *   - `"aepnrs"`        → all selectors   (nbtItems.ts behaviour)
 */
export function findSelectors(line: string, selectorTypes = "en"): SelectorMatch[] {
    const results: SelectorMatch[] = [];
    const typeSet = new Set(selectorTypes.split(""));

    for (let i = 0; i < line.length - 1; i++) {
        if (line[i] !== "@" || !typeSet.has(line[i + 1])) {
            continue;
        }
        if (i > 0 && line[i - 1] === '"') {
            continue;
        }

        const start = i;
        i += 2;

        if (i < line.length && line[i] === "[") {
            let depth = 1;
            let inQuote = false;
            i++;
            while (i < line.length && depth > 0) {
                const ch = line[i];
                if (ch === '"' && (i === 0 || line[i - 1] !== "\\")) {
                    inQuote = !inQuote;
                } else if (!inQuote) {
                    if (ch === "[" || ch === "{") {
                        depth++;
                    } else if (ch === "]" || ch === "}") {
                        depth--;
                    }
                }
                i++;
            }
        }

        results.push({
            raw: line.slice(start, i),
            startIndex: start,
            endIndex: i,
        });
        i--;
    }
    return results;
}

export function extractSelector(line: string, startIndex: number): SelectorMatch | null {
    if (startIndex < 0 || startIndex >= line.length || line[startIndex] !== "@") {
        return null;
    }

    let i = startIndex + 2;
    if (i < line.length && line[i] === "[") {
        let depth = 1;
        let inQuote = false;
        i++;
        while (i < line.length && depth > 0) {
            const ch = line[i];
            if (ch === '"' && (i === 0 || line[i - 1] !== "\\")) {
                inQuote = !inQuote;
            } else if (!inQuote) {
                if (ch === "[" || ch === "{") {
                    depth++;
                } else if (ch === "]" || ch === "}") {
                    depth--;
                }
            }
            i++;
        }
    }

    return {
        raw: line.slice(startIndex, i),
        startIndex,
        endIndex: i,
    };
}

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
    const regex = new RegExp(`(?<!")@([${selectorTypes}])(\\[[^\\]]*\\])?`, "g");
    let match;
    while ((match = regex.exec(line)) !== null) {
        results.push({
            raw: match[0],
            startIndex: match.index,
            endIndex: match.index + match[0].length,
        });
    }
    return results;
}

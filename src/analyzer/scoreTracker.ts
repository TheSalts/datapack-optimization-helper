/**
 * Shared score-tracking utilities used by unreachableCondition, alwaysPassCondition,
 * and conditionDefinition. Consolidates the previously duplicated ScoreState /
 * ScoreRange interfaces and all related helper functions.
 */

export interface ScoreState {
    target: string;
    objective: string;
    type: "known" | "unknown" | "reset";
    value: number | null;
    line: number;
    filePath?: string;
}

export interface ScoreRange {
    min: number | null;
    max: number | null;
}

export function parseRange(rangeStr: string): ScoreRange {
    if (rangeStr.includes("..")) {
        const parts = rangeStr.split("..");
        const minParsed = parts[0] === "" ? null : parseInt(parts[0], 10);
        const maxParsed = parts[1] === "" ? null : parseInt(parts[1], 10);
        return {
            min: minParsed !== null && !isNaN(minParsed) ? minParsed : null,
            max: maxParsed !== null && !isNaN(maxParsed) ? maxParsed : null,
        };
    }
    const value = parseInt(rangeStr, 10);
    return { min: isNaN(value) ? null : value, max: isNaN(value) ? null : value };
}

export function matchesRange(value: number, range: ScoreRange): boolean {
    if (range.min !== null && value < range.min) return false;
    if (range.max !== null && value > range.max) return false;
    return true;
}

export function isConditionUnreachable(state: ScoreState, condType: string, rangeStr: string): boolean {
    if (state.type === "unknown") return false;
    if (state.type === "reset") return condType === "if";
    if (state.type === "known" && state.value !== null) {
        const range = parseRange(rangeStr);
        const matches = matchesRange(state.value, range);
        return condType === "if" ? !matches : matches;
    }
    return false;
}

export function isConditionAlwaysTrue(state: ScoreState, condType: string, rangeStr: string): boolean {
    if (state.type !== "known" || state.value === null) return false;
    const range = parseRange(rangeStr);
    const matches = matchesRange(state.value, range);
    return condType === "if" ? matches : !matches;
}

export function isExecuteConditional(trimmed: string, scoreStates: Map<string, ScoreState>): boolean {
    if (!trimmed.startsWith("execute")) return false;
    if (/\bon\s/.test(trimmed)) return true;
    if (/\b(as|at|positioned\s+as|rotated\s+as|facing\s+entity)\s+@[aepnr]/.test(trimmed)) return true;
    if (/\b(if|unless)\s+(?!score\b)/.test(trimmed)) return true;
    if (/\b(if|unless)\s+score\b/.test(trimmed)) {
        const scoreCondRegex = /\b(if|unless)\s+score\s+(\S+)\s+(\S+)\s+matches\s+(\S+)/g;
        let condMatch;
        while ((condMatch = scoreCondRegex.exec(trimmed)) !== null) {
            const [, condType, target, objective, rangeStr] = condMatch;
            const key = `${target}:${objective}`;
            const state = scoreStates.get(key);
            if (!state || !isConditionAlwaysTrue(state, condType, rangeStr)) return true;
        }
    }
    return false;
}

/**
 * Apply a single score change (from a scoreboard command or function call)
 * to the given state map.
 */
export function applyScoreChange(
    scoreStates: Map<string, ScoreState>,
    change: { target: string; objective: string; operation: string; value: number | null; isConditional: boolean },
    lineIndex: number,
    filePath?: string,
): void {
    const key = `${change.target}:${change.objective}`;

    if (change.isConditional) {
        scoreStates.set(key, {
            target: change.target,
            objective: change.objective,
            type: "unknown",
            value: null,
            line: lineIndex,
            filePath,
        });
        return;
    }

    if (change.operation === "set") {
        scoreStates.set(key, {
            target: change.target,
            objective: change.objective,
            type: "known",
            value: change.value,
            line: lineIndex,
            filePath,
        });
        return;
    }

    if (change.operation === "add" || change.operation === "remove") {
        const existing = scoreStates.get(key);
        if (existing?.type === "known" && existing.value !== null && change.value !== null) {
            existing.value += change.operation === "add" ? change.value : -change.value;
            existing.line = lineIndex;
            if (filePath !== undefined) existing.filePath = filePath;
        } else {
            scoreStates.set(key, {
                target: change.target,
                objective: change.objective,
                type: "unknown",
                value: null,
                line: lineIndex,
                filePath,
            });
        }
        return;
    }

    if (change.operation === "reset") {
        if (change.objective === "*") {
            for (const [k, state] of scoreStates.entries()) {
                if (k.startsWith(`${change.target}:`)) {
                    state.type = "reset";
                    state.value = null;
                    state.line = lineIndex;
                    if (filePath !== undefined) state.filePath = filePath;
                }
            }
        } else {
            scoreStates.set(key, {
                target: change.target,
                objective: change.objective,
                type: "reset",
                value: null,
                line: lineIndex,
                filePath,
            });
        }
        return;
    }

    // "unknown" or any unrecognised operation
    scoreStates.set(key, {
        target: change.target,
        objective: change.objective,
        type: "unknown",
        value: null,
        line: lineIndex,
        filePath,
    });
}

// ── Regex constants used when parsing scoreboard commands ──────────────────

export const SCORE_SET_RE =
    /^(?:\$?execute\s+.*\s+run\s+)?scoreboard\s+players\s+set\s+(\S+)\s+(\S+)\s+(-?\d+)/;

export const SCORE_ADD_RE =
    /^(?:\$?execute\s+.*\s+run\s+)?scoreboard\s+players\s+(add|remove)\s+(\S+)\s+(\S+)\s+(-?\d+)/;

export const SCORE_RESET_RE =
    /^(?:\$?execute\s+.*\s+run\s+)?scoreboard\s+players\s+reset\s+(\S+)(?:\s+(\S+))?/;

export const SCORE_OPERATION_RE =
    /^(?:\$?execute\s+.*\s+run\s+)?scoreboard\s+players\s+operation\s+(\S+)\s+(\S+)\s+/;

export const SCORE_STORE_RE = /\bstore\s+(?:result|success)\s+score\s+(\S+)\s+(\S+)/;

export const SCORE_CONDITION_RE = /\b(if|unless)\s+score\s+(\S+)\s+(\S+)\s+matches\s+(\S+)/g;

/**
 * Process a single (trimmed) line and update scoreStates in-place.
 * Returns true when a scoreboard command was found (caller may skip
 * further processing of this line, as unreachableCondition.ts does).
 */
export function processScoreboardLine(
    trimmed: string,
    scoreStates: Map<string, ScoreState>,
    lineIndex: number,
    filePath?: string,
): boolean {
    const isConditional = trimmed.startsWith("execute");

    const storeMatch = trimmed.match(SCORE_STORE_RE);
    if (storeMatch) {
        const [, target, objective] = storeMatch;
        if (!target.startsWith("@") && target !== "*") {
            scoreStates.set(`${target}:${objective}`, {
                target,
                objective,
                type: "unknown",
                value: null,
                line: lineIndex,
                filePath,
            });
        }
        // store is part of execute; do NOT return early — the run part follows.
    }

    const setMatch = trimmed.match(SCORE_SET_RE);
    if (setMatch) {
        const [, target, objective, rawValue] = setMatch;
        const value = parseInt(rawValue, 10);
        if (!target.startsWith("@") && target !== "*") {
            const key = `${target}:${objective}`;
            if (isConditional) {
                scoreStates.set(key, { target, objective, type: "unknown", value: null, line: lineIndex, filePath });
            } else {
                scoreStates.set(key, { target, objective, type: "known", value, line: lineIndex, filePath });
            }
        }
        return true;
    }

    const addMatch = trimmed.match(SCORE_ADD_RE);
    if (addMatch) {
        const [, op, target, objective, rawAmount] = addMatch;
        const amount = parseInt(rawAmount, 10);
        if (!target.startsWith("@") && target !== "*") {
            const key = `${target}:${objective}`;
            const existing = scoreStates.get(key);
            if (existing) {
                if (isConditional) {
                    existing.type = "unknown";
                    existing.value = null;
                } else if (existing.type === "known" && existing.value !== null) {
                    existing.value += op === "add" ? amount : -amount;
                } else if (existing.type === "reset") {
                    existing.type = "unknown";
                    existing.value = null;
                }
                existing.line = lineIndex;
                if (filePath !== undefined) existing.filePath = filePath;
            } else {
                scoreStates.set(key, { target, objective, type: "unknown", value: null, line: lineIndex, filePath });
            }
        }
        return true;
    }

    const resetMatch = trimmed.match(SCORE_RESET_RE);
    if (resetMatch) {
        const [, target, objective] = resetMatch;
        if (!target.startsWith("@") && target !== "*") {
            if (objective) {
                const key = `${target}:${objective}`;
                if (isConditional) {
                    scoreStates.set(key, { target, objective, type: "unknown", value: null, line: lineIndex, filePath });
                } else {
                    scoreStates.set(key, { target, objective, type: "reset", value: null, line: lineIndex, filePath });
                }
            } else {
                for (const [key, state] of scoreStates.entries()) {
                    if (key.startsWith(`${target}:`)) {
                        if (isConditional) {
                            state.type = "unknown";
                            state.value = null;
                        } else {
                            state.type = "reset";
                            state.value = null;
                        }
                        state.line = lineIndex;
                        if (filePath !== undefined) state.filePath = filePath;
                    }
                }
            }
        }
        return true;
    }

    const operationMatch = trimmed.match(SCORE_OPERATION_RE);
    if (operationMatch) {
        const [, target, objective] = operationMatch;
        if (!target.startsWith("@") && target !== "*") {
            scoreStates.set(`${target}:${objective}`, {
                target,
                objective,
                type: "unknown",
                value: null,
                line: lineIndex,
                filePath,
            });
        }
        return true;
    }

    return false;
}

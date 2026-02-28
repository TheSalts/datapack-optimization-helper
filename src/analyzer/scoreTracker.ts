import { SCORE_SET_RE, SCORE_ADD_RE, SCORE_RESET_RE, SCORE_OPERATION_RE, SCORE_STORE_RE } from "../parser/patterns";
import { BinOp, ExprNode, varNode, numNode, binNode, toInt32 } from "./exprNode";

export interface ScoreState {
    target: string;
    objective: string;
    type: "known" | "unknown" | "reset";
    value: number | null;
    line: number;
    filePath?: string;
    expression?: ExprNode;
}

function isTrackableTarget(target: string): boolean {
    return !target.startsWith("@") && target !== "*";
}

function mkUnknown(target: string, objective: string, lineIndex: number, filePath?: string): ScoreState {
    return { target, objective, type: "unknown", value: null, line: lineIndex, filePath };
}

/** Non-store execute subcommand keywords — any of these before `run` makes the command conditional. */
const CONDITIONAL_EXECUTE_RE = /\b(as|at|if|unless|on|positioned|rotated|facing|align|anchored|summon|in)\b/;

export function isExecuteConditionalBeforeRun(trimmed: string): boolean {
    const runIdx = trimmed.indexOf(" run ");
    const prefix = runIdx >= 0 ? trimmed.substring(0, runIdx) : trimmed;
    return CONDITIONAL_EXECUTE_RE.test(prefix);
}

const OP_TO_MATH: Record<string, BinOp> = {
    "+=": "+",
    "-=": "-",
    "*=": "*",
    "/=": "/",
    "%=": "%",
};

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
    if (range.min !== null && value < range.min) {
        return false;
    }
    if (range.max !== null && value > range.max) {
        return false;
    }
    return true;
}

export function isConditionUnreachable(state: ScoreState, condType: string, rangeStr: string): boolean {
    if (state.type === "unknown") {
        return false;
    }
    if (state.type === "reset") {
        return condType === "if";
    }
    if (state.type === "known" && state.value !== null) {
        const range = parseRange(rangeStr);
        const matches = matchesRange(state.value, range);
        return condType === "if" ? !matches : matches;
    }
    return false;
}

export function isConditionAlwaysTrue(state: ScoreState, condType: string, rangeStr: string): boolean {
    if (state.type !== "known" || state.value === null) {
        return false;
    }
    const range = parseRange(rangeStr);
    const matches = matchesRange(state.value, range);
    return condType === "if" ? matches : !matches;
}

export function isExecuteConditional(trimmed: string, scoreStates: Map<string, ScoreState>): boolean {
    if (!trimmed.startsWith("execute")) {
        return false;
    }
    if (/\bon\s/.test(trimmed)) {
        return true;
    }
    if (/\b(as|at|positioned\s+as|rotated\s+as|facing\s+entity)\s+@[aepnr]/.test(trimmed)) {
        return true;
    }
    if (/\b(if|unless)\s+(?!score\b)/.test(trimmed)) {
        return true;
    }
    if (/\b(if|unless)\s+score\b/.test(trimmed)) {
        const scoreCondRegex = /\b(if|unless)\s+score\s+(\S+)\s+(\S+)\s+matches\s+(\S+)/g;
        let condMatch;
        while ((condMatch = scoreCondRegex.exec(trimmed)) !== null) {
            const [, condType, target, objective, rangeStr] = condMatch;
            const key = `${target}:${objective}`;
            const state = scoreStates.get(key);
            if (!state || !isConditionAlwaysTrue(state, condType, rangeStr)) {
                return true;
            }
        }
    }
    return false;
}

export function applyScoreChange(
    scoreStates: Map<string, ScoreState>,
    change: { target: string; objective: string; operation: string; value: number | null; isConditional: boolean },
    lineIndex: number,
    filePath?: string,
): void {
    const key = `${change.target}:${change.objective}`;

    if (change.isConditional) {
        scoreStates.set(key, mkUnknown(change.target, change.objective, lineIndex, filePath));
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
            if (filePath !== undefined) {
                existing.filePath = filePath;
            }
        } else {
            scoreStates.set(key, mkUnknown(change.target, change.objective, lineIndex, filePath));
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
                    if (filePath !== undefined) {
                        state.filePath = filePath;
                    }
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

    scoreStates.set(key, mkUnknown(change.target, change.objective, lineIndex, filePath));
}

export {
    SCORE_SET_RE,
    SCORE_ADD_RE,
    SCORE_RESET_RE,
    SCORE_OPERATION_RE,
    SCORE_STORE_RE,
    SCORE_CONDITION_RE,
} from "../parser/patterns";

export function loadInheritedScoreStates(
    inheritedStates: Map<string, { target: string; objective: string; value: number | null }>,
    scoreStates: Map<string, ScoreState>,
): void {
    for (const [key, state] of inheritedStates) {
        scoreStates.set(key, {
            target: state.target,
            objective: state.objective,
            type: state.value === null ? "unknown" : "known",
            value: state.value,
            line: -1,
        });
    }
}

export function processScoreboardLine(
    trimmed: string,
    scoreStates: Map<string, ScoreState>,
    lineIndex: number,
    filePath?: string,
): boolean {
    const hasExecute = trimmed.startsWith("execute");
    const isConditional = hasExecute && isExecuteConditionalBeforeRun(trimmed);

    const storeMatch = hasExecute ? trimmed.match(SCORE_STORE_RE) : null;
    let storeKey: string | null = null;
    if (storeMatch) {
        const [, , target, objective] = storeMatch;
        storeKey = `${target}:${objective}`;
        scoreStates.set(storeKey, mkUnknown(target, objective, lineIndex, filePath));
        // store is part of execute; do NOT return early — the run part follows.
        // The run subcommand (set/add/operation) may also modify scores,
        // but the store target is overwritten by the subcommand's return value.
    }

    const restoreStoreKey = (result: boolean): boolean => {
        if (storeKey) {
            const storeState = scoreStates.get(storeKey);
            if (storeState) {
                storeState.type = "unknown";
                storeState.value = null;
                storeState.expression = undefined;
                storeState.line = lineIndex;
            }
        }
        return result;
    };

    const setMatch = trimmed.match(SCORE_SET_RE);
    if (setMatch) {
        const [, target, objective, rawValue] = setMatch;
        const value = parseInt(rawValue, 10);
        if (isTrackableTarget(target)) {
            const key = `${target}:${objective}`;
            if (isConditional) {
                scoreStates.set(key, mkUnknown(target, objective, lineIndex, filePath));
            } else {
                scoreStates.set(key, { target, objective, type: "known", value, line: lineIndex, filePath });
            }
        }
        return restoreStoreKey(true);
    }

    const addMatch = trimmed.match(SCORE_ADD_RE);
    if (addMatch) {
        const [, op, target, objective, rawAmount] = addMatch;
        const amount = parseInt(rawAmount, 10);
        if (isTrackableTarget(target)) {
            const key = `${target}:${objective}`;
            const existing = scoreStates.get(key);
            if (existing) {
                if (isConditional) {
                    existing.type = "unknown";
                    existing.value = null;
                    existing.expression = undefined;
                } else if (existing.type === "known" && existing.value !== null) {
                    existing.value = toInt32(existing.value + (op === "add" ? amount : -amount));
                } else if (existing.type === "reset") {
                    existing.type = "known";
                    existing.value = toInt32(op === "add" ? amount : -amount);
                    existing.expression = undefined;
                } else if (existing.type === "unknown") {
                    const baseExpr = existing.expression ?? varNode(key);
                    const sign: BinOp = op === "add" ? "+" : "-";
                    existing.expression = binNode(sign, baseExpr, numNode(amount));
                }
                existing.line = lineIndex;
                if (filePath !== undefined) {
                    existing.filePath = filePath;
                }
            } else {
                scoreStates.set(key, mkUnknown(target, objective, lineIndex, filePath));
            }
        }
        return restoreStoreKey(true);
    }

    const resetMatch = trimmed.match(SCORE_RESET_RE);
    if (resetMatch) {
        const [, target, objective] = resetMatch;
        if (isTrackableTarget(target)) {
            if (objective) {
                const key = `${target}:${objective}`;
                if (isConditional) {
                    scoreStates.set(key, mkUnknown(target, objective, lineIndex, filePath));
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
                        if (filePath !== undefined) {
                            state.filePath = filePath;
                        }
                    }
                }
            }
        }
        return restoreStoreKey(true);
    }

    const operationMatch = trimmed.match(SCORE_OPERATION_RE);
    if (operationMatch) {
        const [, target, objective, op, srcTarget, srcObjective] = operationMatch;
        if (isTrackableTarget(target)) {
            const key = `${target}:${objective}`;
            const srcKey = `${srcTarget}:${srcObjective}`;

            if (isConditional) {
                scoreStates.set(key, mkUnknown(target, objective, lineIndex, filePath));
            } else {
                const existing = scoreStates.get(key);
                const srcState = scoreStates.get(srcKey);
                const targetVal = existing?.type === "known" ? existing.value : null;
                const srcVal = srcState?.type === "known" ? srcState.value : null;
                const targetExpr: ExprNode = targetVal !== null ? numNode(targetVal) : (existing?.expression ?? varNode(key));
                const srcExpr: ExprNode = srcVal !== null ? numNode(srcVal) : (srcState?.expression ?? varNode(srcKey));

                if (op === "=") {
                    if (srcVal !== null) {
                        scoreStates.set(key, {
                            target,
                            objective,
                            type: "known",
                            value: srcVal,
                            line: lineIndex,
                            filePath,
                        });
                    } else {
                        scoreStates.set(key, {
                            target,
                            objective,
                            type: "unknown",
                            value: null,
                            line: lineIndex,
                            filePath,
                            expression: srcExpr,
                        });
                    }
                } else if (op === "><") {
                    scoreStates.set(key, {
                        target,
                        objective,
                        type: srcVal !== null ? "known" : "unknown",
                        value: srcVal,
                        line: lineIndex,
                        filePath,
                        expression: srcVal === null ? srcExpr : undefined,
                    });
                    if (isTrackableTarget(srcTarget)) {
                        scoreStates.set(srcKey, {
                            target: srcTarget,
                            objective: srcObjective,
                            type: targetVal !== null ? "known" : "unknown",
                            value: targetVal,
                            line: lineIndex,
                            filePath,
                            expression: targetVal === null ? targetExpr : undefined,
                        });
                    }
                } else if (targetVal !== null && srcVal !== null) {
                    let result: number;
                    switch (op) {
                        case "+=":
                            result = toInt32(targetVal + srcVal);
                            break;
                        case "-=":
                            result = toInt32(targetVal - srcVal);
                            break;
                        case "*=":
                            result = Math.imul(targetVal, srcVal);
                            break;
                        case "/=":
                            if (srcVal === 0) {
                                result = targetVal;
                                break;
                            }
                            result = toInt32(Math.trunc(targetVal / srcVal));
                            break;
                        case "%=":
                            if (srcVal === 0) {
                                result = targetVal;
                                break;
                            }
                            result = toInt32(targetVal % srcVal);
                            break;
                        case "<":
                            result = Math.min(targetVal, srcVal);
                            break;
                        case ">":
                            result = Math.max(targetVal, srcVal);
                            break;
                        default:
                            scoreStates.set(key, mkUnknown(target, objective, lineIndex, filePath));
                            return restoreStoreKey(true);
                    }
                    existing!.value = result;
                    existing!.expression = undefined;
                    existing!.line = lineIndex;
                    if (filePath !== undefined) {
                        existing!.filePath = filePath;
                    }
                } else {
                    const mathOp = OP_TO_MATH[op] ?? op;
                    const expr = binNode(mathOp, targetExpr, srcExpr);
                    scoreStates.set(key, {
                        target,
                        objective,
                        type: "unknown",
                        value: null,
                        line: lineIndex,
                        filePath,
                        expression: expr,
                    });
                }
            }
        }
        return restoreStoreKey(true);
    }

    return restoreStoreKey(false);
}

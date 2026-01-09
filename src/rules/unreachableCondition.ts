import * as vscode from "vscode";
import { DIAGNOSTIC_SOURCE } from "../constants";
import { t } from "../utils/i18n";
import {
    getFunctionInfoByFile,
    getConsensusScoreStates,
    getFunctionInfo,
    isIndexInitialized,
} from "../analyzer/functionIndex";

interface ScoreState {
    target: string;
    objective: string;
    type: "known" | "unknown" | "reset";
    value: number | null;
    line: number;
}

interface ScoreRange {
    min: number | null;
    max: number | null;
}

function parseRange(rangeStr: string): ScoreRange {
    if (rangeStr.includes("..")) {
        const parts = rangeStr.split("..");
        const min = parts[0] === "" ? null : parseInt(parts[0], 10);
        const max = parts[1] === "" ? null : parseInt(parts[1], 10);
        return { min, max };
    }
    const value = parseInt(rangeStr, 10);
    return { min: value, max: value };
}

function matchesRange(value: number, range: ScoreRange): boolean {
    if (range.min !== null && value < range.min) {
        return false;
    }
    if (range.max !== null && value > range.max) {
        return false;
    }
    return true;
}

function isConditionUnreachable(state: ScoreState, condType: string, rangeStr: string): boolean {
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

function rangesOverlap(r1: ScoreRange, r2: ScoreRange): boolean {
    const min1 = r1.min ?? -2147483648;
    const max1 = r1.max ?? 2147483647;
    const min2 = r2.min ?? -2147483648;
    const max2 = r2.max ?? 2147483647;
    return min1 <= max2 && min2 <= max1;
}

function rangesEqual(r1: ScoreRange, r2: ScoreRange): boolean {
    return r1.min === r2.min && r1.max === r2.max;
}

interface ScoreCondition {
    condType: string;
    target: string;
    objective: string;
    rangeStr: string;
    range: ScoreRange;
    fullMatch: string;
    index: number;
}

function checkConflictingConditionsInLine(trimmed: string, line: string, lineIndex: number): vscode.Diagnostic[] {
    const diagnostics: vscode.Diagnostic[] = [];
    const conditionRegex = /\b(if|unless)\s+score\s+(\S+)\s+(\S+)\s+matches\s+(\S+)/g;
    const conditions: ScoreCondition[] = [];

    let match;
    while ((match = conditionRegex.exec(trimmed)) !== null) {
        const [fullMatch, condType, target, objective, rangeStr] = match;
        conditions.push({
            condType,
            target,
            objective,
            rangeStr,
            range: parseRange(rangeStr),
            fullMatch,
            index: match.index,
        });
    }

    // Group conditions by target:objective
    const grouped = new Map<string, ScoreCondition[]>();
    for (const cond of conditions) {
        const key = `${cond.target}:${cond.objective}`;
        if (!grouped.has(key)) {
            grouped.set(key, []);
        }
        grouped.get(key)!.push(cond);
    }

    for (const [, conds] of grouped) {
        if (conds.length < 2) continue;

        const ifConditions = conds.filter((c) => c.condType === "if");
        const unlessConditions = conds.filter((c) => c.condType === "unless");

        // Check if multiple 'if' conditions have non-overlapping ranges
        for (let i = 0; i < ifConditions.length; i++) {
            for (let j = i + 1; j < ifConditions.length; j++) {
                if (!rangesOverlap(ifConditions[i].range, ifConditions[j].range)) {
                    const startIndex = line.indexOf(ifConditions[j].fullMatch);
                    const diagRange = new vscode.Range(
                        lineIndex,
                        startIndex,
                        lineIndex,
                        startIndex + ifConditions[j].fullMatch.length
                    );
                    const diagnostic = new vscode.Diagnostic(
                        diagRange,
                        t("unreachableCondition"),
                        vscode.DiagnosticSeverity.Warning
                    );
                    diagnostic.source = DIAGNOSTIC_SOURCE;
                    diagnostic.code = "unreachable-condition";
                    diagnostics.push(diagnostic);
                }
            }
        }

        // Check if 'if' and 'unless' have the same exact range (always fails)
        for (const ifCond of ifConditions) {
            for (const unlessCond of unlessConditions) {
                if (rangesEqual(ifCond.range, unlessCond.range)) {
                    const startIndex = line.indexOf(unlessCond.fullMatch);
                    const diagRange = new vscode.Range(
                        lineIndex,
                        startIndex,
                        lineIndex,
                        startIndex + unlessCond.fullMatch.length
                    );
                    const diagnostic = new vscode.Diagnostic(
                        diagRange,
                        t("unreachableCondition"),
                        vscode.DiagnosticSeverity.Warning
                    );
                    diagnostic.source = DIAGNOSTIC_SOURCE;
                    diagnostic.code = "unreachable-condition";
                    diagnostics.push(diagnostic);
                }
            }
        }

        // Check if 'unless' range completely contains all 'if' ranges (always fails)
        for (const unlessCond of unlessConditions) {
            for (const ifCond of ifConditions) {
                const unlessMin = unlessCond.range.min ?? -2147483648;
                const unlessMax = unlessCond.range.max ?? 2147483647;
                const ifMin = ifCond.range.min ?? -2147483648;
                const ifMax = ifCond.range.max ?? 2147483647;

                // If unless range completely contains if range, it always fails
                if (unlessMin <= ifMin && unlessMax >= ifMax) {
                    const startIndex = line.indexOf(ifCond.fullMatch);
                    const diagRange = new vscode.Range(
                        lineIndex,
                        startIndex,
                        lineIndex,
                        startIndex + ifCond.fullMatch.length
                    );
                    const diagnostic = new vscode.Diagnostic(
                        diagRange,
                        t("unreachableCondition"),
                        vscode.DiagnosticSeverity.Warning
                    );
                    diagnostic.source = DIAGNOSTIC_SOURCE;
                    diagnostic.code = "unreachable-condition";
                    diagnostics.push(diagnostic);
                }
            }
        }
    }

    return diagnostics;
}

function isConditionAlwaysTrue(state: ScoreState, condType: string, rangeStr: string): boolean {
    if (state.type !== "known" || state.value === null) {
        return false;
    }

    const range = parseRange(rangeStr);
    const matches = matchesRange(state.value, range);
    return condType === "if" ? matches : !matches;
}

function isExecuteConditional(trimmed: string, scoreStates: Map<string, ScoreState>): boolean {
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

function applyScoreChange(
    scoreStates: Map<string, ScoreState>,
    change: { target: string; objective: string; operation: string; value: number | null; isConditional: boolean },
    line: number
): void {
    const key = `${change.target}:${change.objective}`;

    if (change.isConditional) {
        scoreStates.set(key, {
            target: change.target,
            objective: change.objective,
            type: "unknown",
            value: null,
            line,
        });
        return;
    }

    if (change.operation === "set") {
        scoreStates.set(key, {
            target: change.target,
            objective: change.objective,
            type: "known",
            value: change.value,
            line,
        });
        return;
    }

    if (change.operation === "add" || change.operation === "remove") {
        const existing = scoreStates.get(key);
        if (existing?.type === "known" && existing.value !== null && change.value !== null) {
            existing.value += change.operation === "add" ? change.value : -change.value;
            existing.line = line;
        } else {
            scoreStates.set(key, {
                target: change.target,
                objective: change.objective,
                type: "unknown",
                value: null,
                line,
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
                    state.line = line;
                }
            }
        } else {
            scoreStates.set(key, {
                target: change.target,
                objective: change.objective,
                type: "reset",
                value: null,
                line,
            });
        }
        return;
    }

    if (change.operation === "unknown") {
        scoreStates.set(key, {
            target: change.target,
            objective: change.objective,
            type: "unknown",
            value: null,
            line,
        });
    }
}

export function checkUnreachableCondition(lines: string[], filePath?: string): vscode.Diagnostic[] {
    const diagnostics: vscode.Diagnostic[] = [];
    const scoreStates: Map<string, ScoreState> = new Map();

    if (filePath && isIndexInitialized()) {
        const funcInfo = getFunctionInfoByFile(filePath);
        if (funcInfo) {
            const inheritedStates = getConsensusScoreStates(funcInfo.fullPath);
            for (const [key, state] of inheritedStates) {
                // Determine type based on inherited state.
                scoreStates.set(key, {
                    target: state.target,
                    objective: state.objective,
                    type: state.value === null ? "unknown" : "known", // Default to unknown for null in inheritance
                    value: state.value,
                    line: -1,
                });
            }
        }
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmed === "" || trimmed.startsWith("#")) {
            continue;
        }

        // Check for conflicting conditions in the same line
        const conflictDiagnostics = checkConflictingConditionsInLine(trimmed, line, i);
        diagnostics.push(...conflictDiagnostics);

        const isConditional = trimmed.startsWith("execute");

        // Parse 'execute store (result|success) score ...'
        const storeMatch = trimmed.match(/\bstore\s+(?:result|success)\s+score\s+(\S+)\s+(\S+)/);
        if (storeMatch) {
            const target = storeMatch[1];
            const objective = storeMatch[2];
            const key = `${target}:${objective}`;
            scoreStates.set(key, {
                target,
                objective,
                type: "unknown",
                value: null,
                line: i,
            });
        }

        const setMatch = trimmed.match(
            /^(?:execute\s+.*\s+run\s+)?scoreboard\s+players\s+set\s+(\S+)\s+(\S+)\s+(-?\d+)/
        );
        if (setMatch) {
            const target = setMatch[1];
            const objective = setMatch[2];
            const value = parseInt(setMatch[3], 10);

            if (!target.startsWith("@") && target !== "*") {
                const key = `${target}:${objective}`;
                if (isConditional) {
                    scoreStates.set(key, { target, objective, type: "unknown", value: null, line: i });
                } else {
                    scoreStates.set(key, { target, objective, type: "known", value, line: i });
                }
            }
            continue;
        }

        const addMatch = trimmed.match(
            /^(?:execute\s+.*\s+run\s+)?scoreboard\s+players\s+(add|remove)\s+(\S+)\s+(\S+)\s+(-?\d+)/
        );
        if (addMatch) {
            const op = addMatch[1];
            const target = addMatch[2];
            const objective = addMatch[3];
            const amount = parseInt(addMatch[4], 10);

            if (!target.startsWith("@") && target !== "*") {
                const key = `${target}:${objective}`;
                const existing = scoreStates.get(key);

                if (existing) {
                    if (isConditional) {
                        existing.type = "unknown";
                        existing.value = null;
                    } else if (existing.type === "known" && existing.value !== null) {
                        if (op === "add") {
                            existing.value += amount;
                        } else {
                            existing.value -= amount;
                        }
                    } else if (existing.type === "reset") {
                        existing.type = "unknown";
                        existing.value = null;
                    }
                    existing.line = i;
                } else {
                    scoreStates.set(key, { target, objective, type: "unknown", value: null, line: i });
                }
            }
            continue;
        }

        const resetMatch = trimmed.match(
            /^(?:execute\s+.*\s+run\s+)?scoreboard\s+players\s+reset\s+(\S+)(?:\s+(\S+))?/
        );
        if (resetMatch) {
            const target = resetMatch[1];
            const objective = resetMatch[2];

            if (!target.startsWith("@") && target !== "*") {
                if (objective) {
                    const key = `${target}:${objective}`;
                    if (isConditional) {
                        scoreStates.set(key, { target, objective, type: "unknown", value: null, line: i });
                    } else {
                        scoreStates.set(key, { target, objective, type: "reset", value: null, line: i });
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
                            state.line = i;
                        }
                    }
                }
            }
            continue;
        }

        const operationMatch = trimmed.match(
            /^(?:execute\s+.*\s+run\s+)?scoreboard\s+players\s+operation\s+(\S+)\s+(\S+)\s+/
        );
        if (operationMatch) {
            const target = operationMatch[1];
            const objective = operationMatch[2];

            if (!target.startsWith("@") && target !== "*") {
                scoreStates.set(`${target}:${objective}`, { target, objective, type: "unknown", value: null, line: i });
            }
            continue;
        }

        const conditionRegex = /\b(if|unless)\s+score\s+(\S+)\s+(\S+)\s+matches\s+(\S+)/g;
        let match;
        let hasUnreachableCondition = false;

        while ((match = conditionRegex.exec(trimmed)) !== null) {
            const [fullMatch, condType, target, objective, rangeStr] = match;
            const key = `${target}:${objective}`;
            const state = scoreStates.get(key);

            if (!state || !isConditionUnreachable(state, condType, rangeStr)) {
                continue;
            }

            hasUnreachableCondition = true;
            const startIndex = line.indexOf(fullMatch);
            const diagRange = new vscode.Range(i, startIndex, i, startIndex + fullMatch.length);

            const diagnostic = new vscode.Diagnostic(
                diagRange,
                t("unreachableCondition"),
                vscode.DiagnosticSeverity.Warning
            );
            diagnostic.source = DIAGNOSTIC_SOURCE;
            diagnostic.code = "unreachable-condition";
            diagnostics.push(diagnostic);
        }

        if (trimmed.match(/\b(if|unless)\b/)) {
            if (hasUnreachableCondition) {
                continue;
            }
        }

        const functionMatch = trimmed.match(/^(?:\$?execute\s+.*\s+run\s+)?function\s+([a-z0-9_.-]+:[a-z0-9_./-]+)/i);
        const ifFunctionMatch = trimmed.match(/\b(if|unless)\s+function\s+([a-z0-9_.-]+:[a-z0-9_./-]+)/i);

        if (hasUnreachableCondition) {
            continue;
        }

        if (functionMatch && isIndexInitialized()) {
            const calledFuncInfo = getFunctionInfo(functionMatch[1]);
            if (calledFuncInfo) {
                const isConditionalCall = isExecuteConditional(trimmed, scoreStates);
                for (const change of calledFuncInfo.scoreChanges) {
                    applyScoreChange(scoreStates, isConditionalCall ? { ...change, isConditional: true } : change, i);
                }
            }
        } else if (ifFunctionMatch && isIndexInitialized()) {
            const calledFuncInfo = getFunctionInfo(ifFunctionMatch[2]);
            if (calledFuncInfo) {
                for (const change of calledFuncInfo.scoreChanges) {
                    applyScoreChange(scoreStates, { ...change, isConditional: true }, i);
                }
            }
        }
    }

    return diagnostics;
}

import * as vscode from "vscode";
import { createDiagnostic } from "../utils/diagnostic";
import {
    getFunctionInfoByFile,
    getConsensusScoreStates,
    getFunctionInfo,
    isIndexInitialized,
    getAllScoreChanges,
} from "../analyzer/functionIndex";
import {
    ScoreState,
    ScoreRange,
    parseRange,
    matchesRange,
    isConditionUnreachable,
    isConditionAlwaysTrue,
    isExecuteConditional,
    applyScoreChange,
    processScoreboardLine,
    loadInheritedScoreStates,
    SCORE_CONDITION_RE,
} from "../analyzer/scoreTracker";
import { processTestScoreLine } from "../parser/testScore";

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
    const leadingWhitespace = line.length - line.trimStart().length;

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
                    const startIndex = leadingWhitespace + ifConditions[j].index;
                    const diagRange = new vscode.Range(
                        lineIndex,
                        startIndex,
                        lineIndex,
                        startIndex + ifConditions[j].fullMatch.length,
                    );
                    diagnostics.push(
                        createDiagnostic(
                            new vscode.Range(
                                lineIndex,
                                startIndex,
                                lineIndex,
                                startIndex + ifConditions[j].fullMatch.length,
                            ),
                            "unreachableCondition",
                            "unreachable-condition",
                        ),
                    );
                }
            }
        }

        // Check if 'if' and 'unless' have the same exact range (always fails)
        for (const ifCond of ifConditions) {
            for (const unlessCond of unlessConditions) {
                if (rangesEqual(ifCond.range, unlessCond.range)) {
                    const startIndex = leadingWhitespace + unlessCond.index;
                    const diagRange = new vscode.Range(
                        lineIndex,
                        startIndex,
                        lineIndex,
                        startIndex + unlessCond.fullMatch.length,
                    );
                    diagnostics.push(
                        createDiagnostic(
                            new vscode.Range(
                                lineIndex,
                                startIndex,
                                lineIndex,
                                startIndex + unlessCond.fullMatch.length,
                            ),
                            "unreachableCondition",
                            "unreachable-condition",
                        ),
                    );
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
                    const startIndex = leadingWhitespace + ifCond.index;
                    const diagRange = new vscode.Range(
                        lineIndex,
                        startIndex,
                        lineIndex,
                        startIndex + ifCond.fullMatch.length,
                    );
                    diagnostics.push(
                        createDiagnostic(
                            new vscode.Range(lineIndex, startIndex, lineIndex, startIndex + ifCond.fullMatch.length),
                            "unreachableCondition",
                            "unreachable-condition",
                        ),
                    );
                }
            }
        }
    }

    return diagnostics;
}

export function checkUnreachableCondition(lines: string[], filePath?: string): vscode.Diagnostic[] {
    const diagnostics: vscode.Diagnostic[] = [];
    const scoreStates: Map<string, ScoreState> = new Map();

    if (filePath && isIndexInitialized()) {
        const funcInfo = getFunctionInfoByFile(filePath);
        if (funcInfo) {
            loadInheritedScoreStates(getConsensusScoreStates(funcInfo.fullPath), scoreStates);
        }
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        const leadingWhitespace = line.length - line.trimStart().length;

        if (trimmed === "") {
            continue;
        }
        if (trimmed.startsWith("#")) {
            processTestScoreLine(trimmed, scoreStates, i);
            continue;
        }

        // Check for conflicting conditions in the same line
        const conflictDiagnostics = checkConflictingConditionsInLine(trimmed, line, i);
        diagnostics.push(...conflictDiagnostics);

        // Process scoreboard commands and advance to next line if one was found
        if (processScoreboardLine(trimmed, scoreStates, i)) {
            continue;
        }

        const conditionRegex = new RegExp(SCORE_CONDITION_RE.source, "g");
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
            const startIndex = leadingWhitespace + match.index;
            const diagRange = new vscode.Range(i, startIndex, i, startIndex + fullMatch.length);

            diagnostics.push(createDiagnostic(diagRange, "unreachableCondition", "unreachable-condition"));
        }

        if (hasUnreachableCondition) {
            continue;
        }

        const functionMatch = trimmed.match(/^(?:\$?execute\s+.*\s+run\s+)?function\s+([a-z0-9_.-]+:[a-z0-9_./-]+)/i);
        const ifFunctionMatch = trimmed.match(/\b(if|unless)\s+function\s+([a-z0-9_.-]+:[a-z0-9_./-]+)/i);

        if (functionMatch && isIndexInitialized()) {
            const calledFunctionPath = functionMatch[1];
            const calledFuncInfo = getFunctionInfo(calledFunctionPath);
            if (calledFuncInfo) {
                const isConditionalCall = isExecuteConditional(trimmed, scoreStates);
                const allChanges = getAllScoreChanges(calledFunctionPath);
                for (const change of allChanges) {
                    applyScoreChange(scoreStates, isConditionalCall ? { ...change, isConditional: true } : change, i);
                }
            }
        } else if (ifFunctionMatch && isIndexInitialized()) {
            const calledFunctionPath = ifFunctionMatch[2];
            const calledFuncInfo = getFunctionInfo(calledFunctionPath);
            if (calledFuncInfo) {
                const allChanges = getAllScoreChanges(calledFunctionPath);
                for (const change of allChanges) {
                    applyScoreChange(scoreStates, { ...change, isConditional: true }, i);
                }
            }
        }
    }

    return diagnostics;
}

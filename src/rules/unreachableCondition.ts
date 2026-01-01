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
    type: 'known' | 'unknown' | 'reset';
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
                    type: state.value === null ? 'unknown' : 'known', // Default to unknown for null in inheritance
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
                type: 'unknown', 
                value: null, 
                line: i 
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
                    scoreStates.set(key, { target, objective, type: 'unknown', value: null, line: i });
                } else {
                    scoreStates.set(key, { target, objective, type: 'known', value, line: i });
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
                        existing.type = 'unknown';
                        existing.value = null;
                    } else if (existing.type === 'known' && existing.value !== null) {
                        if (op === "add") {
                            existing.value += amount;
                        } else {
                            existing.value -= amount;
                        }
                    } else if (existing.type === 'reset') {
                        existing.type = 'unknown';
                        existing.value = null;
                    }
                    existing.line = i;
                } else {
                    scoreStates.set(key, { target, objective, type: 'unknown', value: null, line: i });
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
                        scoreStates.set(key, { target, objective, type: 'unknown', value: null, line: i });
                    } else {
                        scoreStates.set(key, { target, objective, type: 'reset', value: null, line: i });
                    }
                } else {
                    for (const [key, state] of scoreStates.entries()) {
                        if (key.startsWith(`${target}:`)) {
                            if (isConditional) {
                                state.type = 'unknown';
                                state.value = null;
                            } else {
                                state.type = 'reset';
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
                scoreStates.set(`${target}:${objective}`, { target, objective, type: 'unknown', value: null, line: i });
            }
            continue;
        }

        const conditionRegex = /\b(if|unless)\s+score\s+(\S+)\s+(\S+)\s+matches\s+(\S+)/g;
        let match;
        let hasUnreachableCondition = false;

        while ((match = conditionRegex.exec(trimmed)) !== null) {
            const condType = match[1];
            const target = match[2];
            const objective = match[3];
            const rangeStr = match[4];
            const key = `${target}:${objective}`;

            const state = scoreStates.get(key);
            if (state) {
                let unreachable = false;

                if (state.type === 'unknown') {
                    // Unknown -> reachable
                    unreachable = false;
                } else if (state.type === 'reset') {
                    if (condType === "if") {
                        // if score matches ... (requires existing score) -> Fail
                        unreachable = true;
                    } else {
                        // unless score matches ... (passes if score unset) -> Pass
                        unreachable = false;
                    }
                } else if (state.type === 'known' && state.value !== null) {
                    const range = parseRange(rangeStr);
                    const matches = matchesRange(state.value, range);

                    if (condType === "if") {
                        if (!matches) {
                            unreachable = true;
                        }
                    } else {
                        if (matches) {
                            unreachable = true;
                        }
                    }
                }

                if (unreachable) {
                    hasUnreachableCondition = true;
                    const startIndex = line.indexOf(match[0]);
                    const endIndex = startIndex + match[0].length;
                    const diagRange = new vscode.Range(i, startIndex, i, endIndex);

                    const message = t("unreachableCondition");
                    const diagnostic = new vscode.Diagnostic(
                        diagRange,
                        message,
                        vscode.DiagnosticSeverity.Warning
                    );
                    diagnostic.source = DIAGNOSTIC_SOURCE;
                    diagnostic.code = "unreachable-condition";
                    diagnostics.push(diagnostic);
                }
            }
        }

        if (trimmed.match(/\b(if|unless)\b/)) {
            if (hasUnreachableCondition) {
                continue;
            }
        }

        const functionMatch = trimmed.match(/^(?:execute\s+.*\s+run\s+)?function\s+([a-z0-9_.-]+:[a-z0-9_./-]+)/i);
        const ifFunctionMatch = trimmed.match(/\b(if|unless)\s+function\s+([a-z0-9_.-]+:[a-z0-9_./-]+)/i);

        if (functionMatch && isIndexInitialized()) {
            if (hasUnreachableCondition) {
                continue;
            }
            const calledFunctionPath = functionMatch[1];
            const calledFuncInfo = getFunctionInfo(calledFunctionPath);

            if (calledFuncInfo) {
                for (const change of calledFuncInfo.scoreChanges) {
                    const key = `${change.target}:${change.objective}`;

                    if (change.isConditional) {
                         // Conditional change -> unknown
                         scoreStates.set(key, {
                            target: change.target,
                            objective: change.objective,
                            type: 'unknown',
                            value: null,
                            line: i,
                        });
                        continue;
                    }

                    if (change.operation === "set") {
                        scoreStates.set(key, {
                            target: change.target,
                            objective: change.objective,
                            type: 'known',
                            value: change.value,
                            line: i,
                        });
                    } else if (change.operation === "add" || change.operation === "remove") {
                        const existing = scoreStates.get(key);
                        if (existing && existing.type === 'known' && existing.value !== null && change.value !== null) {
                            if (change.operation === "add") {
                                existing.value += change.value;
                            } else {
                                existing.value -= change.value;
                            }
                            existing.line = i;
                        } else {
                            // Adding to unknown/reset -> unknown
                            scoreStates.set(key, {
                                target: change.target,
                                objective: change.objective,
                                type: 'unknown',
                                value: null,
                                line: i,
                            });
                        }
                    } else if (change.operation === "reset") {
                        if (change.objective === "*") {
                            for (const [k, state] of scoreStates.entries()) {
                                if (k.startsWith(`${change.target}:`)) {
                                    state.type = 'reset';
                                    state.value = null;
                                    state.line = i;
                                }
                            }
                        } else {
                            scoreStates.set(key, {
                                target: change.target,
                                objective: change.objective,
                                type: 'reset',
                                value: null,
                                line: i,
                            });
                        }
                    } else if (change.operation === "unknown") {
                        scoreStates.set(key, {
                            target: change.target,
                            objective: change.objective,
                            type: 'unknown',
                            value: null,
                            line: i,
                        });
                    }
                }
            }
        } else if (ifFunctionMatch && isIndexInitialized()) {
            if (hasUnreachableCondition) {
                continue;
            }

            const calledFunctionPath = ifFunctionMatch[2];
            const calledFuncInfo = getFunctionInfo(calledFunctionPath);

            if (calledFuncInfo) {
                for (const change of calledFuncInfo.scoreChanges) {
                    const key = `${change.target}:${change.objective}`;

                    if (change.operation === "reset" && change.objective === "*") {
                        for (const k of scoreStates.keys()) {
                            if (k.startsWith(`${change.target}:`)) {
                                // Conditional reset * -> unknown or reset?
                                // If function call is conditional, we don't know if it ran.
                                // So previous state is preserved? No, we assume worse case (unknown).
                                // But if function resets * unconditionally, and we call it conditionally.
                                // Then scores are either old value OR reset. -> Unknown.
                                // But here we use delete() in previous logic. 
                                // Let's use 'unknown'.
                                const s = scoreStates.get(k);
                                if (s) {
                                    s.type = 'unknown';
                                    s.value = null;
                                }
                            }
                        }
                    } else {
                         // Treat all changes as unknown
                         scoreStates.set(key, {
                            target: change.target,
                            objective: change.objective,
                            type: 'unknown',
                            value: null,
                            line: i,
                        });
                    }
                }
            }
        }
    }

    return diagnostics;
}

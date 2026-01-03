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
        const minParsed = parts[0] === "" ? null : parseInt(parts[0], 10);
        const maxParsed = parts[1] === "" ? null : parseInt(parts[1], 10);
        
        const min = (minParsed !== null && !isNaN(minParsed)) ? minParsed : null;
        const max = (maxParsed !== null && !isNaN(maxParsed)) ? maxParsed : null;
        
        return { min, max };
    }
    const value = parseInt(rangeStr, 10);
    return { 
        min: isNaN(value) ? null : value, 
        max: isNaN(value) ? null : value 
    };
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

export interface AlwaysReturnInfo {
    line: number;
}

export function checkAlwaysPassCondition(
    lines: string[],
    filePath?: string
): { diagnostics: vscode.Diagnostic[]; alwaysReturns: AlwaysReturnInfo[] } {
    const diagnostics: vscode.Diagnostic[] = [];
    const alwaysReturns: AlwaysReturnInfo[] = [];
    const scoreStates: Map<string, ScoreState> = new Map();

    if (filePath && isIndexInitialized()) {
        const funcInfo = getFunctionInfoByFile(filePath);
        if (funcInfo) {
            const inheritedStates = getConsensusScoreStates(funcInfo.fullPath);
            for (const [key, state] of inheritedStates) {
                // Determine type based on inherited state. 
                // FunctionIndex uses value=null for unknown/conditional. 
                // It doesn't strictly store 'reset' state separately in consensus currently, 
                // but if value is null, we treat it as unknown for safety unless we change FunctionIndex.
                // However, based on user request, we should try to distinguish. 
                // But inherited state structure is simple. Let's assume unknown for null.
                scoreStates.set(key, {
                    target: state.target,
                    objective: state.objective,
                    type: state.value === null ? 'unknown' : 'known',
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
        // This makes the score unknown.
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
            // Continue parsing line for run command? 
            // store command IS part of execute. The 'run' part comes later.
            // But for state tracking, we process it now.
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
                    // Conditional set makes it unknown (unless it was reset, then it becomes unknown/reset mix -> unknown)
                    scoreStates.set(key, { target, objective, type: 'unknown', value: null, line: i });
                } else {
                    scoreStates.set(key, { target, objective, type: 'known', value, line: i });
                }
            }
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
                        // Add to reset -> technically invalid/reset depending on game version? 
                        // Usually implies 0 in some contexts or fails. Let's treat as unknown.
                        existing.type = 'unknown'; 
                        existing.value = null;
                    }
                    existing.line = i;
                } else {
                    // Implicit add to unknown score
                    scoreStates.set(key, { target, objective, type: 'unknown', value: null, line: i });
                }
            }
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
                    // Reset all objectives for target
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
        }

        const operationMatch = trimmed.match(
            /^(?:execute\s+.*\s+run\s+)?scoreboard\s+players\s+operation\s+(\S+)\s+(\S+)\s+/
        );
        if (operationMatch) {
            const target = operationMatch[1];
            const objective = operationMatch[2];
            
            if (!target.startsWith("@") && target !== "*") {
                // Operation makes value unknown (could be anything)
                scoreStates.set(`${target}:${objective}`, { target, objective, type: 'unknown', value: null, line: i });
            }
        }

        const conditionRegex = /\b(if|unless)\s+score\s+(\S+)\s+(\S+)\s+matches\s+(\S+)/g;
        let match;
        let allConditionsAlwaysPass = true;
        let hasScoreCondition = false;

        while ((match = conditionRegex.exec(trimmed)) !== null) {
            hasScoreCondition = true;
            const condType = match[1];
            const target = match[2];
            const objective = match[3];
            const rangeStr = match[4];
            const key = `${target}:${objective}`;

            const state = scoreStates.get(key);
            if (state) {
                let alwaysPass = false;

                if (state.type === 'unknown') {
                    // Unknown value -> Never always pass (could fail)
                    allConditionsAlwaysPass = false;
                } else if (state.type === 'reset') {
                    if (condType === "unless") {
                        // Unless score matches X -> if score is reset (doesn't exist), check fails?
                        // "if score ... matches" fails if score unset.
                        // "unless score ... matches" passes if score unset.
                        alwaysPass = true;
                    } else {
                        // if score matches ... -> Always Fails. Not "Always Pass".
                        allConditionsAlwaysPass = false;
                    }
                } else if (state.type === 'known' && state.value !== null) {
                    const range = parseRange(rangeStr);
                    const matches = matchesRange(state.value, range);

                    if (condType === "if") {
                        if (matches) {
                            alwaysPass = true;
                        } else {
                            allConditionsAlwaysPass = false;
                        }
                    } else {
                        if (!matches) {
                            alwaysPass = true;
                        } else {
                            allConditionsAlwaysPass = false;
                        }
                    }
                }

                if (alwaysPass) {
                    const startIndex = line.indexOf(match[0]);
                    const endIndex = startIndex + match[0].length;
                    const diagRange = new vscode.Range(i, startIndex, i, endIndex);

                    const message = t("alwaysPassCondition");
                    const diagnostic = new vscode.Diagnostic(
                        diagRange,
                        message,
                        vscode.DiagnosticSeverity.Warning
                    );
                    diagnostic.source = DIAGNOSTIC_SOURCE;
                    diagnostic.code = "always-pass-condition";
                    diagnostics.push(diagnostic);
                }
            } else {
                if (condType === "unless") {
                    // If not tracked (assumed unset/reset initially?), then unless passes?
                    // But maybe it's unknown. Safe to assume unknown if not in map.
                    allConditionsAlwaysPass = false;
                } else {
                    allConditionsAlwaysPass = false;
                }
            }
        }

        if (hasScoreCondition && allConditionsAlwaysPass && trimmed.startsWith("execute ")) {
            const hasAs = /(?<!positioned\s)\bas\s+@[aepnrs]/.test(trimmed);
            const hasReturn = /\srun\s+return\b/.test(trimmed);

            if (hasReturn && !hasAs) {
                const allScoreConditions = Array.from(
                    trimmed.matchAll(/\b(if|unless)\s+score\s+\S+\s+\S+\s+matches\s+\S+/g)
                );
                const allConditions = Array.from(trimmed.matchAll(/\b(if|unless)\s+\S+/g));
                const hasOtherCondition = allConditions.length > allScoreConditions.length;

                if (!hasOtherCondition) {
                    alwaysReturns.push({ line: i });
                }
            }
        }

        const functionMatch = trimmed.match(/^(?:execute\s+.*\s+run\s+)?function\s+([a-z0-9_.-]+:[a-z0-9_./-]+)/i);
        const ifFunctionMatch = trimmed.match(/\b(if|unless)\s+function\s+([a-z0-9_.-]+:[a-z0-9_./-]+)/i);

        if (functionMatch && isIndexInitialized()) {
            const calledFunctionPath = functionMatch[1];
            const calledFuncInfo = getFunctionInfo(calledFunctionPath);

            if (calledFuncInfo) {
                const isConditionalCall = isExecuteConditional(trimmed, scoreStates);
                for (const change of calledFuncInfo.scoreChanges) {
                    const key = `${change.target}:${change.objective}`;

                    if (change.isConditional || isConditionalCall) {
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
            if (!hasScoreCondition || allConditionsAlwaysPass) {
                const calledFunctionPath = ifFunctionMatch[2];
                const calledFuncInfo = getFunctionInfo(calledFunctionPath);

                if (calledFuncInfo) {
                    for (const change of calledFuncInfo.scoreChanges) {
                        const key = `${change.target}:${change.objective}`;
                        // Conditional function call -> always unknown
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

    return { diagnostics, alwaysReturns };
}

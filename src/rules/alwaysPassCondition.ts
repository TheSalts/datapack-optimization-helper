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
                scoreStates.set(key, {
                    target: state.target,
                    objective: state.objective,
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

        const setMatch = trimmed.match(
            /^(?:execute\s+.*\s+run\s+)?scoreboard\s+players\s+set\s+(\S+)\s+(\S+)\s+(-?\d+)/
        );
        if (setMatch) {
            const target = setMatch[1];
            const objective = setMatch[2];
            const value = parseInt(setMatch[3], 10);
            const key = `${target}:${objective}`;
            scoreStates.set(key, { target, objective, value, line: i });
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
            const key = `${target}:${objective}`;
            const existing = scoreStates.get(key);
            if (existing && existing.value !== null) {
                if (op === "add") {
                    existing.value += amount;
                } else {
                    existing.value -= amount;
                }
                existing.line = i;
            }
            continue;
        }

        const resetMatch = trimmed.match(
            /^(?:execute\s+.*\s+run\s+)?scoreboard\s+players\s+reset\s+(\S+)(?:\s+(\S+))?/
        );
        if (resetMatch) {
            const target = resetMatch[1];
            const objective = resetMatch[2];
            if (objective) {
                const key = `${target}:${objective}`;
                scoreStates.set(key, { target, objective, value: null, line: i });
            } else {
                for (const [key, state] of scoreStates.entries()) {
                    if (key.startsWith(`${target}:`)) {
                        state.value = null;
                        state.line = i;
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
            scoreStates.delete(`${target}:${objective}`);
            continue;
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

                if (state.value === null) {
                    if (condType === "unless") {
                        alwaysPass = true;
                    } else {
                        allConditionsAlwaysPass = false;
                    }
                } else {
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
                for (const change of calledFuncInfo.scoreChanges) {
                    const key = `${change.target}:${change.objective}`;

                    if (change.operation === "set") {
                        scoreStates.set(key, {
                            target: change.target,
                            objective: change.objective,
                            value: change.value,
                            line: i,
                        });
                    } else if (change.operation === "reset") {
                        if (change.objective === "*") {
                            for (const [k, state] of scoreStates.entries()) {
                                if (k.startsWith(`${change.target}:`)) {
                                    state.value = null;
                                    state.line = i;
                                }
                            }
                        } else {
                            scoreStates.set(key, {
                                target: change.target,
                                objective: change.objective,
                                value: null,
                                line: i,
                            });
                        }
                    } else if (change.operation === "unknown") {
                        scoreStates.delete(key);
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

                        if (change.operation === "set") {
                            scoreStates.set(key, {
                                target: change.target,
                                objective: change.objective,
                                value: change.value,
                                line: i,
                            });
                        } else if (change.operation === "reset") {
                            if (change.objective === "*") {
                                for (const [k, state] of scoreStates.entries()) {
                                    if (k.startsWith(`${change.target}:`)) {
                                        state.value = null;
                                        state.line = i;
                                    }
                                }
                            } else {
                                scoreStates.set(key, {
                                    target: change.target,
                                    objective: change.objective,
                                    value: null,
                                    line: i,
                                });
                            }
                        } else if (change.operation === "unknown") {
                            scoreStates.delete(key);
                        }
                    }
                }
            }
        }
    }

    return { diagnostics, alwaysReturns };
}

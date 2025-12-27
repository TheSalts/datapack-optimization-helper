import * as vscode from "vscode";
import { DIAGNOSTIC_SOURCE } from "../constants";
import { t } from "../utils/i18n";
import { getFunctionInfoByFile, getConsensusScoreStates, isIndexInitialized, ScoreState as IndexScoreState } from "../analyzer/functionIndex";

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

export function checkUnreachableCondition(lines: string[], filePath?: string): { diagnostics: vscode.Diagnostic[]; alwaysReturns: AlwaysReturnInfo[] } {
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
                    line: -1
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
        while ((match = conditionRegex.exec(trimmed)) !== null) {
            const condType = match[1];
            const target = match[2];
            const objective = match[3];
            const rangeStr = match[4];
            const key = `${target}:${objective}`;

            const state = scoreStates.get(key);
            if (state) {
                let unreachable = false;
                let alwaysPass = false;

                if (state.value === null) {
                    if (condType === "if") {
                        unreachable = true;
                    } else {
                        alwaysPass = true;
                    }
                } else {
                    const range = parseRange(rangeStr);
                    const matches = matchesRange(state.value, range);

                    if (condType === "if") {
                        if (!matches) {
                            unreachable = true;
                        } else {
                            alwaysPass = true;
                        }
                    } else {
                        if (matches) {
                            unreachable = true;
                        } else {
                            alwaysPass = true;
                        }
                    }
                }

                const startIndex = line.indexOf(match[0]);
                const endIndex = startIndex + match[0].length;
                const diagRange = new vscode.Range(i, startIndex, i, endIndex);

                if (unreachable) {
                    const diagnostic = new vscode.Diagnostic(
                        diagRange,
                        t("unreachableCondition"),
                        vscode.DiagnosticSeverity.Warning
                    );
                    diagnostic.source = DIAGNOSTIC_SOURCE;
                    diagnostic.code = "unreachable-condition";
                    diagnostics.push(diagnostic);
                } else if (alwaysPass) {
                    const diagnostic = new vscode.Diagnostic(
                        diagRange,
                        t("alwaysPassCondition"),
                        vscode.DiagnosticSeverity.Warning
                    );
                    diagnostic.source = DIAGNOSTIC_SOURCE;
                    diagnostic.code = "always-pass-condition";
                    diagnostics.push(diagnostic);

                    if (/\srun\s+return\b/.test(trimmed)) {
                        alwaysReturns.push({ line: i });
                    }
                }
            }
        }

        if (trimmed.match(/\b(if|unless)\b/)) {
            continue;
        }

        const functionMatch = trimmed.match(/^(?:execute\s+.*\s+run\s+)?function\s+/);
        if (functionMatch) {
            scoreStates.clear();
        }
    }

    return { diagnostics, alwaysReturns };
}

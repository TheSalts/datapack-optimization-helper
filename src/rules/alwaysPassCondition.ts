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
    parseRange,
    matchesRange,
    isConditionAlwaysTrue,
    isExecuteConditional,
    applyScoreChange,
    processScoreboardLine,
    SCORE_CONDITION_RE,
} from "../analyzer/scoreTracker";
import { processTestScoreLine } from "../parser/testScore";

export interface AlwaysReturnInfo {
    line: number;
}

export function checkAlwaysPassCondition(
    lines: string[],
    filePath?: string,
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
                    type: state.value === null ? "unknown" : "known",
                    value: state.value,
                    line: -1,
                });
            }
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

        // Update score state for this line (does NOT return early — we still
        // need to check conditions on lines like `execute store … run …`)
        processScoreboardLine(trimmed, scoreStates, i);

        const conditionRegex = new RegExp(SCORE_CONDITION_RE.source, "g");
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

                if (state.type === "unknown") {
                    allConditionsAlwaysPass = false;
                } else if (state.type === "reset") {
                    if (condType === "unless") {
                        alwaysPass = true;
                    } else {
                        allConditionsAlwaysPass = false;
                    }
                } else if (state.type === "known" && state.value !== null) {
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
                    const startIndex = leadingWhitespace + match.index;
                    const endIndex = startIndex + match[0].length;
                    const diagRange = new vscode.Range(i, startIndex, i, endIndex);
                    diagnostics.push(createDiagnostic(diagRange, "alwaysPassCondition", "always-pass-condition"));
                }
            } else {
                allConditionsAlwaysPass = false;
            }
        }

        if (hasScoreCondition && allConditionsAlwaysPass && trimmed.startsWith("execute ")) {
            const hasAs = /(?<!positioned\s)\bas\s+@[aepnrs]/.test(trimmed);
            const hasReturn = /\srun\s+return\b/.test(trimmed);

            if (hasReturn && !hasAs) {
                const allScoreConditions = Array.from(
                    trimmed.matchAll(/\b(if|unless)\s+score\s+\S+\s+\S+\s+matches\s+\S+/g),
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
                const allChanges = getAllScoreChanges(calledFunctionPath);
                for (const change of allChanges) {
                    applyScoreChange(scoreStates, isConditionalCall ? { ...change, isConditional: true } : change, i);
                }
            }
        } else if (ifFunctionMatch && isIndexInitialized()) {
            if (!hasScoreCondition || allConditionsAlwaysPass) {
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
    }

    return { diagnostics, alwaysReturns };
}

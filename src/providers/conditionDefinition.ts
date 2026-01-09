import * as vscode from "vscode";
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
    filePath?: string;
}

function parseRange(rangeStr: string): { min: number | null; max: number | null } {
    if (rangeStr.includes("..")) {
        const parts = rangeStr.split("..");
        const min = parts[0] === "" ? null : parseInt(parts[0], 10);
        const max = parts[1] === "" ? null : parseInt(parts[1], 10);
        return { min, max };
    }
    const value = parseInt(rangeStr, 10);
    return { min: value, max: value };
}

function matchesRange(value: number, range: { min: number | null; max: number | null }): boolean {
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

function isConditionAlwaysTrue(state: ScoreState, condType: string, rangeStr: string): boolean {
    if (state.type !== "known" || state.value === null) {
        return false;
    }
    const range = parseRange(rangeStr);
    const matches = matchesRange(state.value, range);
    return condType === "if" ? matches : !matches;
}

export class ConditionDefinitionProvider implements vscode.DefinitionProvider {
    provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position
    ): vscode.ProviderResult<vscode.Definition> {
        const line = document.lineAt(position.line).text;
        const trimmed = line.trim();

        const conditionRegex = /\b(if|unless)\s+score\s+(\S+)\s+(\S+)\s+matches\s+(\S+)/g;
        let match;

        while ((match = conditionRegex.exec(trimmed)) !== null) {
            const fullMatch = match[0];
            const condType = match[1];
            const target = match[2];
            const objective = match[3];
            const rangeStr = match[4];

            const startIndex = line.indexOf(fullMatch);
            const ifIndex = line.indexOf(condType, startIndex);
            const ifEndIndex = ifIndex + condType.length;

            if (position.character >= ifIndex && position.character <= ifEndIndex) {
                const scoreStates = this.collectScoreStates(document, position.line);
                const key = `${target}:${objective}`;
                const state = scoreStates.get(key);

                if (
                    state &&
                    (isConditionUnreachable(state, condType, rangeStr) ||
                        isConditionAlwaysTrue(state, condType, rangeStr))
                ) {
                    if (state.filePath && state.line >= 0) {
                        const targetUri = vscode.Uri.file(state.filePath);
                        return new vscode.Location(targetUri, new vscode.Position(state.line, 0));
                    } else if (state.line >= 0) {
                        return new vscode.Location(document.uri, new vscode.Position(state.line, 0));
                    }
                }
            }
        }

        return null;
    }

    private collectScoreStates(document: vscode.TextDocument, currentLine: number): Map<string, ScoreState> {
        const scoreStates: Map<string, ScoreState> = new Map();
        const filePath = document.uri.fsPath;

        if (isIndexInitialized()) {
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

        const lines = document.getText().split(/\r?\n/);

        for (let i = 0; i < currentLine && i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            if (trimmed === "" || trimmed.startsWith("#")) {
                continue;
            }

            const isConditional = trimmed.startsWith("execute");

            const storeMatch = trimmed.match(/\bstore\s+(?:result|success)\s+score\s+(\S+)\s+(\S+)/);
            if (storeMatch) {
                const target = storeMatch[1];
                const objective = storeMatch[2];
                scoreStates.set(`${target}:${objective}`, {
                    target,
                    objective,
                    type: "unknown",
                    value: null,
                    line: i,
                    filePath,
                });
            }

            const setMatch = trimmed.match(
                /^(?:\$?execute\s+.*\s+run\s+)?scoreboard\s+players\s+set\s+(\S+)\s+(\S+)\s+(-?\d+)/
            );
            if (setMatch) {
                const target = setMatch[1];
                const objective = setMatch[2];
                const value = parseInt(setMatch[3], 10);

                if (!target.startsWith("@") && target !== "*") {
                    const key = `${target}:${objective}`;
                    if (isConditional) {
                        scoreStates.set(key, { target, objective, type: "unknown", value: null, line: i, filePath });
                    } else {
                        scoreStates.set(key, { target, objective, type: "known", value, line: i, filePath });
                    }
                }
                continue;
            }

            const addMatch = trimmed.match(
                /^(?:\$?execute\s+.*\s+run\s+)?scoreboard\s+players\s+(add|remove)\s+(\S+)\s+(\S+)\s+(-?\d+)/
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
                        existing.filePath = filePath;
                    } else {
                        scoreStates.set(key, { target, objective, type: "unknown", value: null, line: i, filePath });
                    }
                }
                continue;
            }

            const resetMatch = trimmed.match(
                /^(?:\$?execute\s+.*\s+run\s+)?scoreboard\s+players\s+reset\s+(\S+)(?:\s+(\S+))?/
            );
            if (resetMatch) {
                const target = resetMatch[1];
                const objective = resetMatch[2];

                if (!target.startsWith("@") && target !== "*") {
                    if (objective) {
                        const key = `${target}:${objective}`;
                        if (isConditional) {
                            scoreStates.set(key, {
                                target,
                                objective,
                                type: "unknown",
                                value: null,
                                line: i,
                                filePath,
                            });
                        } else {
                            scoreStates.set(key, { target, objective, type: "reset", value: null, line: i, filePath });
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
                                state.filePath = filePath;
                            }
                        }
                    }
                }
                continue;
            }

            const operationMatch = trimmed.match(
                /^(?:\$?execute\s+.*\s+run\s+)?scoreboard\s+players\s+operation\s+(\S+)\s+(\S+)\s+/
            );
            if (operationMatch) {
                const target = operationMatch[1];
                const objective = operationMatch[2];

                if (!target.startsWith("@") && target !== "*") {
                    scoreStates.set(`${target}:${objective}`, {
                        target,
                        objective,
                        type: "unknown",
                        value: null,
                        line: i,
                        filePath,
                    });
                }
                continue;
            }

            const functionMatch = trimmed.match(
                /^(?:\$?execute\s+.*\s+run\s+)?function\s+([a-z0-9_.-]+:[a-z0-9_./-]+)/i
            );
            if (functionMatch && isIndexInitialized()) {
                const calledFuncInfo = getFunctionInfo(functionMatch[1]);
                if (calledFuncInfo) {
                    for (const change of calledFuncInfo.scoreChanges) {
                        const key = `${change.target}:${change.objective}`;
                        scoreStates.set(key, {
                            target: change.target,
                            objective: change.objective,
                            type: "unknown",
                            value: null,
                            line: change.line,
                            filePath: calledFuncInfo.filePath,
                        });
                    }
                }
            }
        }

        return scoreStates;
    }
}

export function registerConditionDefinition(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.languages.registerDefinitionProvider(
            { pattern: "**/*.mcfunction", scheme: "file" },
            new ConditionDefinitionProvider()
        )
    );
}

import * as vscode from "vscode";
import { t } from "../utils/i18n";
import { ScoreState, processScoreboardLine } from "../analyzer/scoreTracker";
import { processTestScoreLine, collectScoreReferences } from "../parser/testScore";
import {
    getFunctionInfoByFile,
    getConsensusScoreStates,
    isIndexInitialized,
} from "../analyzer/functionIndex";

interface ScorePickItem extends vscode.QuickPickItem {
    scoreTarget?: string;
    scoreObjective?: string;
}

function collectStatesAtLine(
    lines: string[],
    cursorLine: number,
    filePath: string,
): Map<string, ScoreState> {
    const scoreStates = new Map<string, ScoreState>();

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

    for (let i = 0; i <= cursorLine && i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (trimmed === "") {
            continue;
        }
        if (trimmed.startsWith("#")) {
            processTestScoreLine(trimmed, scoreStates, i);
            continue;
        }
        processScoreboardLine(trimmed, scoreStates, i);
    }

    return scoreStates;
}

function formatStateValue(state: ScoreState): string {
    if (state.type === "known" && state.value !== null) {
        return String(state.value);
    }
    if (state.type === "reset") {
        return "(reset)";
    }
    if (state.expression) {
        return state.expression;
    }
    return "?";
}

export async function addTestScoreCommand() {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !editor.document.fileName.endsWith(".mcfunction")) {
        return;
    }

    const document = editor.document;
    const cursorLine = editor.selection.active.line;
    const lines = document.getText().split(/\r?\n/);

    const scoreStates = collectStatesAtLine(lines, cursorLine, document.uri.fsPath);
    const allRefs = collectScoreReferences(lines);

    // Build QuickPick items
    const items: ScorePickItem[] = [];

    // Scores with tracked state at cursor position
    for (const [, state] of scoreStates) {
        const valueStr = formatStateValue(state);
        items.push({
            label: `${state.target} ${state.objective}`,
            description: `= ${valueStr}`,
            scoreTarget: state.target,
            scoreObjective: state.objective,
        });
    }

    // Scores referenced in file but not yet in state
    for (const ref of allRefs) {
        const key = `${ref.target}:${ref.objective}`;
        if (!scoreStates.has(key)) {
            items.push({
                label: `${ref.target} ${ref.objective}`,
                scoreTarget: ref.target,
                scoreObjective: ref.objective,
            });
        }
    }

    let target: string;
    let objective: string;

    if (items.length > 0) {
        // Add separator + custom option
        items.push({
            label: "",
            kind: vscode.QuickPickItemKind.Separator,
        });
        items.push({
            label: t("testScoreCustom"),
            description: t("testScoreCustomDesc"),
        });

        const picked = await vscode.window.showQuickPick(items, {
            placeHolder: t("testScoreSelectScore"),
        });

        if (!picked) {
            return;
        }

        if (picked.scoreTarget && picked.scoreObjective) {
            target = picked.scoreTarget;
            objective = picked.scoreObjective;
        } else {
            // Custom entry
            const custom = await askTargetObjective();
            if (!custom) {
                return;
            }
            target = custom.target;
            objective = custom.objective;
        }
    } else {
        // No scores in file — manual entry
        const custom = await askTargetObjective();
        if (!custom) {
            return;
        }
        target = custom.target;
        objective = custom.objective;
    }

    // Ask for value
    const existingState = scoreStates.get(`${target}:${objective}`);
    const defaultValue = existingState?.type === "known" && existingState.value !== null
        ? String(existingState.value)
        : "";

    const valueInput = await vscode.window.showInputBox({
        prompt: t("testScoreValuePrompt", { target, objective }),
        value: defaultValue,
        validateInput: (text) => {
            if (!text.trim()) {
                return null;
            }
            if (isNaN(parseInt(text.trim(), 10))) {
                return t("testScoreInvalidValue");
            }
            return null;
        },
    });

    if (valueInput === undefined) {
        return;
    }

    const value = parseInt(valueInput.trim(), 10);
    const comment = `# test-score ${target} ${objective} ${value}`;

    await editor.edit((editBuilder) => {
        editBuilder.insert(new vscode.Position(cursorLine, 0), comment + "\n");
    });
}

async function askTargetObjective(): Promise<{ target: string; objective: string } | undefined> {
    const input = await vscode.window.showInputBox({
        prompt: t("testScorePrompt"),
        placeHolder: "#player objective",
        validateInput: (text) => {
            if (!text.trim()) {
                return null;
            }
            const parts = text.trim().split(/\s+/);
            if (parts.length !== 2) {
                return t("testScoreInvalidFormat");
            }
            return null;
        },
    });

    if (!input) {
        return undefined;
    }

    const parts = input.trim().split(/\s+/);
    return { target: parts[0], objective: parts[1] };
}

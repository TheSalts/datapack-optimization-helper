import * as vscode from "vscode";
import { createDiagnostic } from "../utils/diagnostic";
import {
    ScoreState,
    processScoreboardLine,
    loadInheritedScoreStates,
    SCORE_SET_RE,
    SCORE_ADD_RE,
    SCORE_OPERATION_RE,
} from "../analyzer/scoreTracker";
import {
    getFunctionInfoByFile,
    getConsensusScoreStates,
    isIndexInitialized,
} from "../analyzer/functionIndex";
import { toInt32 } from "../analyzer/exprNode";
import { processTestScoreLine } from "../parser/testScore";

const INT32_MIN = -2147483648;
const INT32_MAX = 2147483647;

function overflows(value: number): boolean {
    return value < INT32_MIN || value > INT32_MAX;
}

export function checkScoreboardOverflow(lines: string[], filePath?: string): vscode.Diagnostic[] {
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

        if (trimmed === "" || trimmed.startsWith("#")) {
            if (trimmed.startsWith("#")) {
                processTestScoreLine(trimmed, scoreStates, i);
            }
            continue;
        }

        const leadingWs = line.length - line.trimStart().length;

        // Check add/remove overflow
        const addMatch = SCORE_ADD_RE.exec(trimmed);
        if (addMatch) {
            const [fullMatch, op, target, objective, rawAmount] = addMatch;
            const amount = parseInt(rawAmount, 10);
            const key = `${target}:${objective}`;
            const existing = scoreStates.get(key);
            if (existing?.type === "known" && existing.value !== null) {
                const raw = existing.value + (op === "add" ? amount : -amount);
                if (overflows(raw)) {
                    const startIndex = leadingWs + (addMatch.index ?? 0);
                    const range = new vscode.Range(i, startIndex, i, startIndex + fullMatch.length);
                    diagnostics.push(
                        createDiagnostic(range, "scoreboardOverflow", "scoreboard-overflow", vscode.DiagnosticSeverity.Warning),
                    );
                }
            }
        }

        // Check operation overflow
        const opMatch = SCORE_OPERATION_RE.exec(trimmed);
        if (opMatch) {
            const [fullMatch, target, objective, op, srcTarget, srcObjective] = opMatch;
            const key = `${target}:${objective}`;
            const srcKey = `${srcTarget}:${srcObjective}`;
            const existing = scoreStates.get(key);
            const srcState = scoreStates.get(srcKey);
            const targetVal = existing?.type === "known" ? existing.value : null;
            const srcVal = srcState?.type === "known" ? srcState.value : null;

            if (targetVal !== null && srcVal !== null) {
                let raw: number | null = null;
                switch (op) {
                    case "+=": raw = targetVal + srcVal; break;
                    case "-=": raw = targetVal - srcVal; break;
                    case "*=": raw = targetVal * srcVal; break;
                }
                if (raw !== null && overflows(raw)) {
                    const startIndex = leadingWs + (opMatch.index ?? 0);
                    const range = new vscode.Range(i, startIndex, i, startIndex + fullMatch.length);
                    diagnostics.push(
                        createDiagnostic(range, "scoreboardOverflow", "scoreboard-overflow", vscode.DiagnosticSeverity.Warning),
                    );
                }
            }
        }

        processScoreboardLine(trimmed, scoreStates, i, filePath);
    }

    return diagnostics;
}

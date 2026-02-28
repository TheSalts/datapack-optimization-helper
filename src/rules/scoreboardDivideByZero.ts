import * as vscode from "vscode";
import { createDiagnostic } from "../utils/diagnostic";
import {
    ScoreState,
    processScoreboardLine,
    loadInheritedScoreStates,
    SCORE_OPERATION_RE,
} from "../analyzer/scoreTracker";
import {
    getFunctionInfoByFile,
    getConsensusScoreStates,
    isIndexInitialized,
} from "../analyzer/functionIndex";
import { processTestScoreLine } from "../parser/testScore";

export function checkScoreboardDivideByZero(lines: string[], filePath?: string): vscode.Diagnostic[] {
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

        // Check for /= or %= with known zero source BEFORE processing
        const opMatch = SCORE_OPERATION_RE.exec(trimmed);
        if (opMatch) {
            const [fullMatch, , , op, srcTarget, srcObjective] = opMatch;
            if (op === "/=" || op === "%=") {
                const srcKey = `${srcTarget}:${srcObjective}`;
                const srcState = scoreStates.get(srcKey);
                if (srcState?.type === "known" && srcState.value === 0) {
                    const leadingWs = line.length - line.trimStart().length;
                    const startIndex = leadingWs + opMatch.index;
                    const range = new vscode.Range(i, startIndex, i, startIndex + fullMatch.length);
                    diagnostics.push(
                        createDiagnostic(
                            range,
                            "scoreboardDivideByZero",
                            "scoreboard-divide-by-zero",
                            vscode.DiagnosticSeverity.Error,
                        ),
                    );
                }
            }
        }

        processScoreboardLine(trimmed, scoreStates, i, filePath);
    }

    return diagnostics;
}

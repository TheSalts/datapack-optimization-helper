import * as vscode from "vscode";
import { RuleConfig } from "../utils/config";
import { createDiagnostic } from "../utils/diagnostic";

const SCOREBOARD_PLAYERS_PATTERN = /scoreboard\s+players\s+(add|remove|set|reset|get|list|operation)\s+/i;

function isTargetSelector(name: string): boolean {
    const trimmed = name.trim();
    return /^@[aenprs](\[[^\]]*\])?$/.test(trimmed);
}

function checkTarget(
    diagnostics: vscode.Diagnostic[],
    lineIndex: number,
    line: string,
    target: string,
    searchFrom: number = 0,
): number {
    const targetIndex = line.indexOf(target, searchFrom);
    if (!isTargetSelector(target) && !target.startsWith("#") && targetIndex !== -1) {
        const range = new vscode.Range(lineIndex, targetIndex, lineIndex, targetIndex + target.length);
        diagnostics.push(
            createDiagnostic(range, "scoreboardFakePlayerMissingHash", "scoreboard-fake-player-missing-hash"),
        );
    }
    return targetIndex;
}

export function checkScoreboardFakePlayer(lineIndex: number, line: string, config: RuleConfig): vscode.Diagnostic[] {
    const diagnostics: vscode.Diagnostic[] = [];
    if (!config.scoreboardFakePlayerMissingHash) {
        return diagnostics;
    }

    const trimmed = line.trim();

    const match = trimmed.match(SCOREBOARD_PLAYERS_PATTERN);
    if (!match) {
        return diagnostics;
    }

    const command = match[1].toLowerCase();
    const afterCommand = trimmed.substring(match.index! + match[0].length).trim();
    const parts = afterCommand.split(/\s+/);

    if (command === "operation") {
        if (parts.length >= 2) {
            const target = parts[0];
            const targetIndex = checkTarget(diagnostics, lineIndex, line, target);

            const source = parts[parts.length - 2];
            const searchFrom = targetIndex >= 0 ? targetIndex + target.length : 0;
            checkTarget(diagnostics, lineIndex, line, source, searchFrom);
        }
    } else {
        if (parts.length > 0 && parts[0]) {
            checkTarget(diagnostics, lineIndex, line, parts[0]);
        }
    }

    return diagnostics;
}

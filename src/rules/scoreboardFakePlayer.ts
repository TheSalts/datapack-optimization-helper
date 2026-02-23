import * as vscode from "vscode";
import { RuleConfig } from "../utils/config";
import { createDiagnostic } from "../utils/diagnostic";

const SCOREBOARD_PLAYERS_PATTERN = /scoreboard\s+players\s+(add|remove|set|reset|get|list|operation)\s+/i;

function isTargetSelector(name: string): boolean {
    const trimmed = name.trim();
    return /^@[aenprs](\[[^\]]*\])?$/.test(trimmed);
}

export function checkScoreboardFakePlayer(lineIndex: number, line: string, config: RuleConfig): vscode.Diagnostic[] {
    const diagnostics: vscode.Diagnostic[] = [];
    if (!config.scoreboardFakePlayerMissingHash) {
        return diagnostics;
    }

    const trimmed = line.trim();

    if (!SCOREBOARD_PLAYERS_PATTERN.test(trimmed)) {
        return diagnostics;
    }

    const match = trimmed.match(SCOREBOARD_PLAYERS_PATTERN);
    if (!match) {
        return diagnostics;
    }

    const command = match[1].toLowerCase();
    const afterCommand = trimmed.substring(match.index! + match[0].length).trim();

    if (command === "list") {
        const parts = afterCommand.split(/\s+/);
        if (parts.length > 0 && parts[0]) {
            const target = parts[0];
            if (!isTargetSelector(target) && !target.startsWith("#")) {
                const targetIndex = line.indexOf(target);
                const range = new vscode.Range(lineIndex, targetIndex, lineIndex, targetIndex + target.length);
                diagnostics.push(
                    createDiagnostic(range, "scoreboardFakePlayerMissingHash", "scoreboard-fake-player-missing-hash"),
                );
            }
        }
    } else if (command === "get") {
        const parts = afterCommand.split(/\s+/);
        if (parts.length > 0 && parts[0]) {
            const target = parts[0];
            if (!isTargetSelector(target) && !target.startsWith("#")) {
                const targetIndex = line.indexOf(target);
                const range = new vscode.Range(lineIndex, targetIndex, lineIndex, targetIndex + target.length);
                diagnostics.push(
                    createDiagnostic(range, "scoreboardFakePlayerMissingHash", "scoreboard-fake-player-missing-hash"),
                );
            }
        }
    } else if (command === "operation") {
        const parts = afterCommand.split(/\s+/);
        if (parts.length >= 2) {
            const target = parts[0];
            let targetIndex = -1;
            if (!isTargetSelector(target) && !target.startsWith("#")) {
                targetIndex = line.indexOf(target);
                const range = new vscode.Range(lineIndex, targetIndex, lineIndex, targetIndex + target.length);
                diagnostics.push(
                    createDiagnostic(range, "scoreboardFakePlayerMissingHash", "scoreboard-fake-player-missing-hash"),
                );
            } else {
                targetIndex = line.indexOf(target);
            }

            const source = parts[parts.length - 2];
            if (!isTargetSelector(source) && !source.startsWith("#")) {
                const sourceIndex = line.indexOf(source, targetIndex >= 0 ? targetIndex + target.length : 0);
                if (sourceIndex !== -1) {
                    const range = new vscode.Range(lineIndex, sourceIndex, lineIndex, sourceIndex + source.length);
                    diagnostics.push(
                        createDiagnostic(
                            range,
                            "scoreboardFakePlayerMissingHash",
                            "scoreboard-fake-player-missing-hash",
                        ),
                    );
                }
            }
        }
    } else {
        const parts = afterCommand.split(/\s+/);
        if (parts.length > 0 && parts[0]) {
            const target = parts[0];
            if (!isTargetSelector(target) && !target.startsWith("#")) {
                const targetIndex = line.indexOf(target);
                const range = new vscode.Range(lineIndex, targetIndex, lineIndex, targetIndex + target.length);
                diagnostics.push(
                    createDiagnostic(range, "scoreboardFakePlayerMissingHash", "scoreboard-fake-player-missing-hash"),
                );
            }
        }
    }

    return diagnostics;
}

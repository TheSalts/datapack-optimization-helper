import * as vscode from "vscode";
import { FUNCTION_CALL_RE } from "../parser/patterns";
import { ScoreState, processScoreboardLine } from "../analyzer/scoreTracker";
import {
    getFunctionInfoByFile,
    getConsensusScoreStates,
    getFunctionInfo,
    isIndexInitialized,
} from "../analyzer/functionIndex";

/**
 * Matches all contexts where a score target + objective appear:
 * - scoreboard players set/add/remove/reset/operation <TARGET> <OBJECTIVE>
 * - execute store result/success score <TARGET> <OBJECTIVE>
 * - execute if/unless score <TARGET> <OBJECTIVE> matches <range>
 *
 * Groups: (1) target  (2) whitespace  (3) objective
 */
const SCORE_HOVER_RE =
    /(?:scoreboard\s+players\s+(?:set|add|remove|reset|operation)\s+|store\s+(?:result|success)\s+score\s+|(?:if|unless)\s+score\s+)(\S+)(\s+)(\S+)/g;

export class ScoreboardHoverProvider implements vscode.HoverProvider {
    provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.Hover | null {
        const line = document.lineAt(position.line);
        const trimmed = line.text.trim();
        const leadingWs = line.text.length - line.text.trimStart().length;

        if (trimmed.startsWith("#") || trimmed === "") {
            return null;
        }

        const regex = new RegExp(SCORE_HOVER_RE.source, "g");
        let match;

        while ((match = regex.exec(trimmed)) !== null) {
            const target = match[1];
            const whitespace = match[2];
            const objective = match[3];

            const matchEnd = match.index + match[0].length;
            const targetStart = leadingWs + matchEnd - objective.length - whitespace.length - target.length;
            const targetEnd = targetStart + target.length;

            if (position.character >= targetStart && position.character < targetEnd) {
                return this.buildHover(document, position.line, target, objective, targetStart, targetEnd);
            }
        }

        return null;
    }

    private buildHover(
        document: vscode.TextDocument,
        currentLine: number,
        target: string,
        objective: string,
        startChar: number,
        endChar: number,
    ): vscode.Hover {
        const key = `${target}:${objective}`;
        const scoreStates = this.collectScoreStates(document, currentLine);
        const state = scoreStates.get(key);

        const md = new vscode.MarkdownString();
        if (state?.type === "known" && state.value !== null) {
            md.appendMarkdown(`\`${key}\` = \`${state.value}\``);
        } else if (state?.type === "reset") {
            md.appendMarkdown(`\`${key}\` = \`(reset)\``);
        } else if (state?.expression) {
            md.appendMarkdown(`\`${key}\` = \`${state.expression}\``);
        } else {
            md.appendMarkdown(`\`${key}\` = \`?\``);
        }

        return new vscode.Hover(md, new vscode.Range(currentLine, startChar, currentLine, endChar));
    }

    private collectScoreStates(document: vscode.TextDocument, currentLine: number): Map<string, ScoreState> {
        const scoreStates = new Map<string, ScoreState>();
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

        for (let i = 0; i <= currentLine && i < lines.length; i++) {
            const trimmed = lines[i].trim();
            if (trimmed === "" || trimmed.startsWith("#")) {
                continue;
            }

            if (processScoreboardLine(trimmed, scoreStates, i, filePath)) {
                continue;
            }

            const functionMatch = trimmed.match(FUNCTION_CALL_RE);
            if (functionMatch && isIndexInitialized()) {
                const calledFuncInfo = getFunctionInfo(functionMatch[1]);
                if (calledFuncInfo) {
                    for (const change of calledFuncInfo.scoreChanges) {
                        const changeKey = `${change.target}:${change.objective}`;
                        scoreStates.set(changeKey, {
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

export function registerScoreboardHover(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.languages.registerHoverProvider({ language: "mcfunction" }, new ScoreboardHoverProvider()),
    );
}

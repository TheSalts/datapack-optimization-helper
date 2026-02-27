import * as vscode from "vscode";
import { FUNCTION_CALL_RE, SCORE_HOVER_RE, SCORE_OP_SRC_RE, SCORE_IF_COMPARE_RE } from "../parser/patterns";
import { ScoreState, processScoreboardLine } from "../analyzer/scoreTracker";
import { exprToString, simplifyExpr } from "../analyzer/exprNode";
import {
    getFunctionInfoByFile,
    getConsensusScoreStates,
    getFunctionInfo,
    isIndexInitialized,
} from "../analyzer/functionIndex";
import { processTestScoreLine } from "../parser/testScore";

export class ScoreboardHoverProvider implements vscode.HoverProvider {
    async provideHover(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Hover | null> {
        const line = document.lineAt(position.line);
        const trimmed = line.text.trim();
        const leadingWs = line.text.length - line.text.trimStart().length;

        if (trimmed.startsWith("#") || trimmed === "") {
            return null;
        }

        const patterns = [SCORE_HOVER_RE, SCORE_OP_SRC_RE, SCORE_IF_COMPARE_RE];
        for (const pattern of patterns) {
            const regex = new RegExp(pattern.source, "g");
            let match;
            while ((match = regex.exec(trimmed)) !== null) {
                const target = match[1];
                const whitespace = match[2];
                const objective = match[3];

                const matchEnd = match.index + match[0].length;
                const targetStart = leadingWs + matchEnd - objective.length - whitespace.length - target.length;
                const targetEnd = targetStart + target.length;

                if (position.character >= targetStart && position.character < targetEnd) {
                    return await this.buildHover(document, position.line, target, objective, targetStart, targetEnd);
                }
            }
        }

        return null;
    }

    private async buildHover(
        document: vscode.TextDocument,
        currentLine: number,
        target: string,
        objective: string,
        startChar: number,
        endChar: number,
    ): Promise<vscode.Hover> {
        const key = `${target}:${objective}`;
        const scoreStates = this.collectScoreStates(document, currentLine);
        const state = scoreStates.get(key);

        const md = new vscode.MarkdownString();
        let valueStr: string;
        if (state?.type === "known" && state.value !== null) {
            valueStr = String(state.value);
        } else if (state?.type === "reset") {
            valueStr = "(reset)";
        } else if (state?.expression) {
            valueStr = exprToString(state.expression);
        } else {
            valueStr = "?";
        }
        md.appendMarkdown(`\`\`\`swift\n${key} = ${valueStr}\n\`\`\``);

        if (state?.expression) {
            const simplified = exprToString(simplifyExpr(state.expression));
            if (simplified !== valueStr) {
                md.appendMarkdown(`\n\n\`\`\`swift\n≈ ${key} = ${simplified}\n\`\`\``);
            }
        }

        if (state && state.filePath && state.line >= 0) {
            try {
                const sourceDoc = vscode.workspace.textDocuments.find((d) => d.uri.fsPath === state.filePath);
                let sourceLineText: string | undefined;
                if (sourceDoc) {
                    sourceLineText = sourceDoc.lineAt(state.line).text.trim();
                } else {
                    const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(state.filePath));
                    const lines = Buffer.from(bytes).toString("utf-8").split(/\r?\n/);
                    sourceLineText = lines[state.line]?.trim();
                }
                if (sourceLineText) {
                    md.appendMarkdown(`\n\n\`\`\`mcfunction\n${sourceLineText}\n\`\`\``);
                }
            } catch {}
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
            if (trimmed === "") {
                continue;
            }
            if (trimmed.startsWith("#")) {
                processTestScoreLine(trimmed, scoreStates, i);
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

import * as vscode from "vscode";
import { SCORE_SET_RE, SCORE_ADD_RE, SCORE_RESET_RE, SCORE_OPERATION_RE } from "../parser/patterns";
import { ScoreState, processScoreboardLine } from "../analyzer/scoreTracker";

export class ScoreboardInlayHintsProvider implements vscode.InlayHintsProvider {
    provideInlayHints(document: vscode.TextDocument, range: vscode.Range): vscode.InlayHint[] {
        const scoreStates = new Map<string, ScoreState>();
        const hints: vscode.InlayHint[] = [];

        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            const text = line.text.trim();

            if (text.startsWith("#") || text === "") {
                continue;
            }

            // Capture operation info + pre-operation values before processScoreboardLine mutates state
            const opMatch = SCORE_OPERATION_RE.exec(text);
            let opInfo: {
                key: string; op: string; srcKey: string;
                targetVal: number | null; srcVal: number | null;
            } | null = null;
            if (opMatch) {
                const key = `${opMatch[1]}:${opMatch[2]}`;
                const srcKey = `${opMatch[4]}:${opMatch[5]}`;
                const ts = scoreStates.get(key);
                const ss = scoreStates.get(srcKey);
                opInfo = {
                    key, op: opMatch[3], srcKey,
                    targetVal: ts?.type === "known" ? ts.value : null,
                    srcVal: ss?.type === "known" ? ss.value : null,
                };
            }

            processScoreboardLine(text, scoreStates, i);

            if (i < range.start.line || i > range.end.line) {
                continue;
            }

            let hintText: string | null = null;

            if (opInfo) {
                const state = scoreStates.get(opInfo.key);
                const srcState = scoreStates.get(opInfo.srcKey);

                if (state?.type === "known" && state.value !== null) {
                    hintText = ` ${opInfo.key} = ${state.value}`;
                } else {
                    const left = opInfo.targetVal !== null ? String(opInfo.targetVal) : opInfo.key;
                    const right = opInfo.srcVal !== null ? String(opInfo.srcVal) : opInfo.srcKey;
                    hintText = ` ${left} ${opInfo.op} ${right}`;
                }

                // Show source change too (e.g. >< swap)
                if (hintText && opInfo.srcVal !== null && srcState?.type === "known" && srcState.value !== opInfo.srcVal) {
                    hintText += ` | ${opInfo.srcKey} = ${srcState.value}`;
                }
            } else {
                const target = this.getTarget(text);
                if (target) {
                    const state = scoreStates.get(target.key);
                    if (state?.type === "known" && state.value !== null) {
                        hintText = ` ${target.key} = ${state.value}`;
                    } else if (state?.type === "reset") {
                        hintText = ` ${target.key} = (reset)`;
                    } else if (state?.expression) {
                        hintText = ` ${target.key} = ${state.expression}`;
                    }
                }
            }

            if (hintText) {
                const hint = new vscode.InlayHint(
                    new vscode.Position(i, line.range.end.character),
                    hintText,
                    vscode.InlayHintKind.Type,
                );
                hint.paddingLeft = true;
                hints.push(hint);
            }
        }

        return hints;
    }

    private getTarget(text: string): { key: string } | null {
        const setMatch = SCORE_SET_RE.exec(text);
        if (setMatch) {
            return { key: `${setMatch[1]}:${setMatch[2]}` };
        }
        const addMatch = SCORE_ADD_RE.exec(text);
        if (addMatch) {
            return { key: `${addMatch[2]}:${addMatch[3]}` };
        }
        const resetMatch = SCORE_RESET_RE.exec(text);
        if (resetMatch && resetMatch[2]) {
            return { key: `${resetMatch[1]}:${resetMatch[2]}` };
        }
        return null;
    }
}

export function registerScoreboardInlayHints(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.languages.registerInlayHintsProvider({ language: "mcfunction" }, new ScoreboardInlayHintsProvider()),
    );
}

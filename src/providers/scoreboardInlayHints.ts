import * as vscode from "vscode";
import { SCORE_SET_RE, SCORE_ADD_RE, SCORE_RESET_RE, SCORE_OPERATION_RE, SCORE_STORE_RE } from "../parser/patterns";
import { ScoreState, processScoreboardLine, isExecuteConditionalBeforeRun } from "../analyzer/scoreTracker";
import { ExprNode, exprToString, simplifyExpr, detectCompoundAssignment, stripCommonObjective, varNode, numNode, binNode } from "../analyzer/exprNode";
import { processTestScoreLine } from "../parser/testScore";

function formatExprHint(key: string, expr: ExprNode): string | null {
    const keyNode = varNode(key);
    const simplified = simplifyExpr(expr);
    const compound = detectCompoundAssignment(key, simplified);
    if (compound) {
        // Strip objective only when key + rhs share the same one
        const whole = stripCommonObjective(binNode(compound.op, keyNode, compound.rhs));
        if (whole.kind === "bin") {
            return ` ${exprToString(whole.left)} ${whole.op} ${exprToString(whole.right)}`;
        }
    }
    // key = expr form: include key in strip check
    const whole = stripCommonObjective(binNode("=", keyNode, simplified));
    if (whole.kind === "bin") {
        const left = exprToString(whole.left);
        const right = exprToString(whole.right);
        if (right === left) {
            return null;
        }
        return ` ${left} = ${right}`;
    }
    return null;
}

export class ScoreboardInlayHintsProvider implements vscode.InlayHintsProvider {
    provideInlayHints(document: vscode.TextDocument, range: vscode.Range): vscode.InlayHint[] {
        const config = vscode.workspace.getConfiguration("datapackOptimization");
        const isEnabled = config.get<boolean>("scoreboardInlayHints.enabled") ?? true;
        if (!isEnabled) {
            return [];
        }

        const rawPadding = config.get<number>("scoreboardInlayHints.padding") ?? 1;

        let hintOffset = 0;

        const spyglassConfig = vscode.workspace.getConfiguration("spyglassmc");
        const spyglassInlayHints = spyglassConfig.get<string[]>("env.feature.inlayHint.enabledNodes");
        if (spyglassInlayHints && spyglassInlayHints.includes("integer")) {
            hintOffset += 7;
        }

        const isDynamic = rawPadding === 0;
        const paddingCount = Math.max(1, rawPadding);
        const paddingStr = " ".repeat(paddingCount);

        const scoreStates = new Map<string, ScoreState>();
        const hints: vscode.InlayHint[] = [];

        interface PendingHint {
            lineIndex: number;
            lineLength: number;
            charIndex: number;
            hintText: string;
        }

        let currentBlockHints: PendingHint[] = [];
        let currentBlockMaxLen = 0;
        let blockHasScoreHint = false;

        const flushBlock = () => {
            if (currentBlockHints.length === 0) {
                currentBlockMaxLen = 0;
                blockHasScoreHint = false;
                return;
            }
            for (const ph of currentBlockHints) {
                if (ph.lineIndex < range.start.line || ph.lineIndex > range.end.line) {
                    continue;
                }
                let finalHintText = ph.hintText;
                if (isDynamic) {
                    let extraSpaces = Math.max(0, currentBlockMaxLen - ph.lineLength);

                    if (blockHasScoreHint && extraSpaces > 0) {
                        const originalText = document.lineAt(ph.lineIndex).text.trim();
                        const isScoreHintLine = SCORE_SET_RE.test(originalText) || SCORE_ADD_RE.test(originalText);
                        if (!isScoreHintLine) {
                            if (SCORE_RESET_RE.test(originalText)) {
                                extraSpaces = Math.max(0, extraSpaces - 1);
                            } else {
                                finalHintText = "\u2002" + finalHintText;
                            }
                        }
                    }

                    finalHintText = " ".repeat(extraSpaces) + paddingStr + finalHintText.trimStart();
                } else {
                    finalHintText = paddingStr + finalHintText.trimStart();
                }
                const hint = new vscode.InlayHint(
                    new vscode.Position(ph.lineIndex, ph.charIndex),
                    finalHintText,
                    vscode.InlayHintKind.Type,
                );
                hints.push(hint);
            }
            currentBlockHints = [];
            currentBlockMaxLen = 0;
            blockHasScoreHint = false;
        };

        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            const text = line.text.trim();

            if (text === "") {
                flushBlock();
                continue;
            }

            if (text.startsWith("#")) {
                processTestScoreLine(text, scoreStates, i);
                continue;
            }

            let logicalLineLength = line.text.length;
            const isScoreLine = SCORE_SET_RE.test(text) || SCORE_ADD_RE.test(text);
            if (isScoreLine) {
                logicalLineLength += hintOffset;
                if (hintOffset > 0) {
                    blockHasScoreHint = true;
                }
            }

            if (isDynamic) {
                currentBlockMaxLen = Math.max(currentBlockMaxLen, logicalLineLength);
            }

            const hasExecute = text.startsWith("execute");
            const isConditional = hasExecute && isExecuteConditionalBeforeRun(text);

            const storeMatch = hasExecute ? SCORE_STORE_RE.exec(text) : null;
            const storeInfo = storeMatch
                ? { key: `${storeMatch[2]}:${storeMatch[3]}`, type: storeMatch[1] as "result" | "success" }
                : null;

            const opMatch = SCORE_OPERATION_RE.exec(text);
            let opInfo: {
                key: string;
                op: string;
                srcKey: string;
                targetVal: number | null;
                srcVal: number | null;
            } | null = null;
            if (opMatch) {
                const key = `${opMatch[1]}:${opMatch[2]}`;
                const srcKey = `${opMatch[4]}:${opMatch[5]}`;
                const ts = scoreStates.get(key);
                const ss = scoreStates.get(srcKey);
                opInfo = {
                    key,
                    op: opMatch[3],
                    srcKey,
                    targetVal: ts?.type === "known" ? ts.value : null,
                    srcVal: ss?.type === "known" ? ss.value : null,
                };
            }

            const conditionalSetAdd = isConditional && !opMatch
                ? this.getConditionalSetAdd(text) : null;

            processScoreboardLine(text, scoreStates, i);

            let hintText: string | null = null;

            if (opInfo) {
                const state = scoreStates.get(opInfo.key);
                const srcState = scoreStates.get(opInfo.srcKey);

                if (state?.type === "known" && state.value !== null) {
                    hintText = ` ${opInfo.key} = ${state.value}`;
                } else if (state?.expression) {
                    hintText = formatExprHint(opInfo.key, state.expression);
                } else {
                    // Conditional or no expression — show pre-op known values
                    const qPrefix = isConditional ? "?" : "";
                    const leftExpr = opInfo.targetVal !== null ? numNode(opInfo.targetVal) : varNode(opInfo.key);
                    const rightExpr = opInfo.srcVal !== null ? numNode(opInfo.srcVal) : varNode(opInfo.srcKey);
                    const combined = stripCommonObjective(binNode(opInfo.op, leftExpr, rightExpr));
                    if (combined.kind === "bin") {
                        const left = exprToString(combined.left);
                        const right = exprToString(combined.right);
                        if (isConditional || left !== opInfo.key || right !== opInfo.srcKey) {
                            hintText = ` ${left} ${qPrefix}${combined.op} ${right}`;
                        }
                    }
                }

                if (
                    hintText &&
                    opInfo.key !== opInfo.srcKey &&
                    opInfo.srcVal !== null &&
                    srcState?.type === "known" &&
                    srcState.value !== opInfo.srcVal
                ) {
                    hintText += ` | ${opInfo.srcKey} = ${srcState.value}`;
                }
            } else if (conditionalSetAdd) {
                hintText = ` ${conditionalSetAdd.key} ${conditionalSetAdd.op} ${conditionalSetAdd.valueStr}`;
            } else {
                const target = this.getTarget(text);
                if (target) {
                    const state = scoreStates.get(target.key);
                    if (state?.type === "known" && state.value !== null) {
                        hintText = ` ${target.key} = ${state.value}`;
                    } else if (state?.type === "reset") {
                        hintText = ` ${target.key} = (reset)`;
                    } else if (state?.expression) {
                        hintText = formatExprHint(target.key, state.expression);
                    }
                }
            }

            if (storeInfo) {
                const storeLabel = storeInfo.type === "success" ? "0|1" : "result";
                const storeHint = `${storeInfo.key} ← ${storeLabel}`;
                if (hintText) {
                    hintText += ` | ${storeHint}`;
                } else {
                    hintText = ` ${storeHint}`;
                }
            }

            if (hintText) {
                currentBlockHints.push({
                    lineIndex: i,
                    lineLength: logicalLineLength,
                    charIndex: line.text.length,
                    hintText,
                });
            }
        }

        flushBlock();

        return hints;
    }

    private getConditionalSetAdd(text: string): { key: string; op: string; valueStr: string } | null {
        const setMatch = SCORE_SET_RE.exec(text);
        if (setMatch) {
            return { key: `${setMatch[1]}:${setMatch[2]}`, op: "?=", valueStr: setMatch[3] };
        }
        const addMatch = SCORE_ADD_RE.exec(text);
        if (addMatch) {
            const addOp = addMatch[1] === "add" ? "?+=" : "?-=";
            return { key: `${addMatch[2]}:${addMatch[3]}`, op: addOp, valueStr: addMatch[4] };
        }
        return null;
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

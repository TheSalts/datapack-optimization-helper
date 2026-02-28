import * as vscode from "vscode";
import {
    getFunctionInfoByFile,
    getConsensusScoreStates,
    getFunctionInfo,
    isIndexInitialized,
} from "../analyzer/functionIndex";
import { t } from "../utils/i18n";
import {
    ScoreState,
    isConditionUnreachable,
    isConditionAlwaysTrue,
    processScoreboardLine,
    loadInheritedScoreStates,
    SCORE_CONDITION_RE,
} from "../analyzer/scoreTracker";

export class ConditionDefinitionProvider implements vscode.DefinitionProvider {
    provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position
    ): vscode.ProviderResult<vscode.Definition> {
        const line = document.lineAt(position.line).text;
        const trimmed = line.trim();

        const conditionRegex = new RegExp(SCORE_CONDITION_RE.source, "g");
        let match;
        const leadingWhitespace = line.length - line.trimStart().length;

        while ((match = conditionRegex.exec(trimmed)) !== null) {
            const condType = match[1];
            const target = match[2];
            const objective = match[3];
            const rangeStr = match[4];

            const ifIndex = leadingWhitespace + match.index;
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
                    } else {
                        vscode.window
                            .showWarningMessage(t("conditionSourceNotFound"), t("reportIssue"))
                            .then((selection) => {
                                if (selection === t("reportIssue")) {
                                    vscode.env.openExternal(
                                        vscode.Uri.parse(
                                            "https://github.com/TheSalts/datapack-optimization-helper/issues/new?template=bug_report.md&title=Cannot+find+source+of+unreachable+condition"
                                        )
                                    );
                                }
                            });
                        return null;
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
                loadInheritedScoreStates(getConsensusScoreStates(funcInfo.fullPath), scoreStates);
            }
        }

        const lines = document.getText().split(/\r?\n/);

        for (let i = 0; i < currentLine && i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            if (trimmed === "" || trimmed.startsWith("#")) {
                continue;
            }

            if (processScoreboardLine(trimmed, scoreStates, i, filePath)) {
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

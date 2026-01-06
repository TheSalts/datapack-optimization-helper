import * as vscode from "vscode";
import { DIAGNOSTIC_SOURCE } from "../constants";
import { createRemoveUnreachableFix } from "./unreachableFix";
import { createTargetSelectorNoDimensionFix, createTargetSelectorTypeOrderFix } from "./targetSelectorFix";
import { createExecuteGroupFix } from "./executeGroupFix";
import { createExecuteDuplicateFix, createExecuteUnnecessaryFix } from "./executeRedundantFix";
import {
    createExecuteRunRedundantFix,
    createExecuteRunRedundantNestedFix,
    createExecuteRunRedundantRunExecuteFix,
} from "./executeRunFix";
import { createExecuteAsSRedundantFix } from "./executeAsSFix";
import { createExecuteAsIfEntitySMergeFix, createExecuteAsIfEntitySConvertFix } from "./executeAsIfEntityFix";
import { createUnreachableConditionFix, createAlwaysPassConditionFix } from "./unreachableConditionFix";
import { createScoreboardFakePlayerFix } from "./scoreboardFakePlayerFix";
import { createReturnRunDuplicateFix } from "./returnRunDuplicateFix";
import { t } from "../utils/i18n";

export class McfunctionCodeActionProvider implements vscode.CodeActionProvider {
    provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range,
        context: vscode.CodeActionContext
    ): vscode.CodeAction[] {
        const actions: vscode.CodeAction[] = [];
        const fixableEdits: vscode.WorkspaceEdit[] = [];

        for (const diagnostic of context.diagnostics) {
            if (diagnostic.source !== DIAGNOSTIC_SOURCE) {
                continue;
            }

            const actionOrActions = this.createFixForDiagnostic(document, diagnostic);
            if (actionOrActions) {
                if (Array.isArray(actionOrActions)) {
                    actions.push(...actionOrActions);
                    for (const action of actionOrActions) {
                        if (action.edit) {
                            fixableEdits.push(action.edit);
                        }
                    }
                } else {
                    actions.push(actionOrActions);
                    if (actionOrActions.edit) {
                        fixableEdits.push(actionOrActions.edit);
                    }
                }
            }

            const suppressActions = this.createSuppressWarningFixes(document, diagnostic);
            actions.push(...suppressActions);
        }

        if (fixableEdits.length > 1) {
            const fixAllAction = new vscode.CodeAction(t("fixAllAutoFixableFix"), vscode.CodeActionKind.QuickFix);
            fixAllAction.edit = new vscode.WorkspaceEdit();
            for (const edit of fixableEdits) {
                for (const [uri, textEdits] of edit.entries()) {
                    for (const textEdit of textEdits) {
                        fixAllAction.edit.replace(uri, textEdit.range, textEdit.newText);
                    }
                }
            }
            actions.push(fixAllAction);
        }

        return actions;
    }

    private createSuppressWarningFixes(
        document: vscode.TextDocument,
        diagnostic: vscode.Diagnostic
    ): vscode.CodeAction[] {
        const actions: vscode.CodeAction[] = [];
        const ruleId = typeof diagnostic.code === "string" ? diagnostic.code : "";
        if (!ruleId) {
            return actions;
        }

        const lineAction = new vscode.CodeAction(t("warnOffLineFix", { ruleId }), vscode.CodeActionKind.QuickFix);
        lineAction.edit = new vscode.WorkspaceEdit();
        const lineNum = diagnostic.range.start.line;
        const insertPos = new vscode.Position(lineNum, 0);
        lineAction.edit.insert(document.uri, insertPos, `# warn-off ${ruleId}\n`);
        lineAction.diagnostics = [diagnostic];
        actions.push(lineAction);

        const fileAction = new vscode.CodeAction(t("warnOffFileFix", { ruleId }), vscode.CodeActionKind.QuickFix);
        fileAction.edit = new vscode.WorkspaceEdit();
        const fileInsertPos = new vscode.Position(0, 0);
        fileAction.edit.insert(document.uri, fileInsertPos, `# warn-off-file ${ruleId}\n`);
        fileAction.diagnostics = [diagnostic];
        actions.push(fileAction);

        const docAction = new vscode.CodeAction(t("showDocumentationFix", { ruleId }), vscode.CodeActionKind.QuickFix);
        docAction.command = {
            title: t("showDocumentationFix", { ruleId }),
            command: "vscode.open",
            arguments: [vscode.Uri.parse(`https://github.com/TheSalts/datapack-optimization-helper/wiki/${ruleId}`)],
        };
        docAction.diagnostics = [diagnostic];
        actions.push(docAction);

        return actions;
    }

    private createFixForDiagnostic(
        document: vscode.TextDocument,
        diagnostic: vscode.Diagnostic
    ): vscode.CodeAction | vscode.CodeAction[] | undefined {
        switch (diagnostic.code) {
            case "unreachable-code":
                return createRemoveUnreachableFix(document, diagnostic);
            case "target-selector-no-dimension":
                return createTargetSelectorNoDimensionFix(document, diagnostic);
            case "target-selector-type-order":
                return createTargetSelectorTypeOrderFix(document, diagnostic);
            case "execute-group":
                return createExecuteGroupFix(document, diagnostic);
            case "execute-run-redundant":
                return createExecuteRunRedundantFix(document, diagnostic);
            case "execute-run-redundant-nested":
                return createExecuteRunRedundantNestedFix(document, diagnostic);
            case "execute-run-redundant-run-execute":
                return createExecuteRunRedundantRunExecuteFix(document, diagnostic);
            case "execute-duplicate":
                return createExecuteDuplicateFix(document, diagnostic);
            case "execute-unnecessary":
                return createExecuteUnnecessaryFix(document, diagnostic);
            case "execute-as-s-redundant":
                return createExecuteAsSRedundantFix(document, diagnostic);
            case "execute-as-if-entity-s-merge":
                return createExecuteAsIfEntitySMergeFix(document, diagnostic);
            case "execute-as-if-entity-s-convert":
                return createExecuteAsIfEntitySConvertFix(document, diagnostic);
            case "unreachable-condition":
                return createUnreachableConditionFix(document, diagnostic);
            case "always-pass-condition":
                return createAlwaysPassConditionFix(document, diagnostic);
            case "scoreboard-fake-player-missing-hash":
                return createScoreboardFakePlayerFix(document, diagnostic);
            case "return-run-duplicate":
                return createReturnRunDuplicateFix(document, diagnostic);
            default:
                return undefined;
        }
    }
}

import * as vscode from "vscode";
import { DIAGNOSTIC_SOURCE } from "../constants";
import { createRemoveUnreachableFix } from "./unreachableFix";
import { createTargetSelectorNoDimensionFix, createTargetSelectorTypeOrderFix } from "./targetSelectorFix";
import { createExecuteGroupFix } from "./executeGroupFix";
import { createExecuteDuplicateFix } from "./executeRedundantFix";
import { createExecuteRunRedundantFix, createExecuteRunRedundantNestedFix, createExecuteRunRedundantRunExecuteFix } from "./executeRunFix";
import { createExecuteAsSRedundantFix } from "./executeAsSFix";
import { createExecuteAsIfEntitySMergeFix, createExecuteAsIfEntitySConvertFix } from "./executeAsIfEntityFix";
import { createUnreachableConditionFix, createAlwaysPassConditionFix } from "./unreachableConditionFix";
import { createScoreboardFakePlayerFix } from "./scoreboardFakePlayerFix";
import { createReturnRunDuplicateFix } from "./returnRunDuplicateFix";

export class McfunctionCodeActionProvider implements vscode.CodeActionProvider {
    provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range,
        context: vscode.CodeActionContext
    ): vscode.CodeAction[] {
        const actions: vscode.CodeAction[] = [];

        for (const diagnostic of context.diagnostics) {
            if (diagnostic.source !== DIAGNOSTIC_SOURCE) {
                continue;
            }

            const actionOrActions = this.createFixForDiagnostic(document, diagnostic);
            if (actionOrActions) {
                if (Array.isArray(actionOrActions)) {
                    actions.push(...actionOrActions);
                } else {
                    actions.push(actionOrActions);
                }
            }
        }

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
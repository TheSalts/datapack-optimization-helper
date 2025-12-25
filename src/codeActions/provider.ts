import * as vscode from "vscode";
import { DIAGNOSTIC_SOURCE } from "../constants";
import { createRemoveUnreachableFix } from "./unreachableFix";
import { createTargetSelectorNoDimensionFix, createTargetSelectorTypeOrderFix } from "./targetSelectorFix";
import { createExecuteGroupFix } from "./executeGroupFix";
import { createExecuteDuplicateFix } from "./executeRedundantFix";
import { createExecuteRunRedundantFix } from "./executeRunFix";
import { createExecuteAsSRedundantFix } from "./executeAsSFix";
import { createExecuteAtChainRedundantFix } from "./executeAtChainFix";

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

            const action = this.createFixForDiagnostic(document, diagnostic);
            if (action) {
                actions.push(action);
            }
        }

        return actions;
    }

    private createFixForDiagnostic(
        document: vscode.TextDocument,
        diagnostic: vscode.Diagnostic
    ): vscode.CodeAction | undefined {
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
            case "execute-duplicate":
                return createExecuteDuplicateFix(document, diagnostic);
            case "execute-as-s-redundant":
                return createExecuteAsSRedundantFix(document, diagnostic);
            case "execute-at-chain-redundant":
                return createExecuteAtChainRedundantFix(document, diagnostic);
            default:
                return undefined;
        }
    }
}

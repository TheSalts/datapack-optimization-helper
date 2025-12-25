import * as vscode from "vscode";
import { DIAGNOSTIC_SOURCE } from "../constants";
import { createTellrawFix } from "./preferTellrawFix";
import { createRemoveUnreachableFix } from "./unreachableFix";

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
            case "prefer-tellraw":
                return createTellrawFix(document, diagnostic);
            case "unreachable-code":
                return createRemoveUnreachableFix(document, diagnostic);
            default:
                return undefined;
        }
    }
}


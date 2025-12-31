import * as vscode from "vscode";
import { t } from "../utils/i18n";
import { parseSelectors } from "../rules/targetSelector";

export function createTargetSelectorNoDimensionFix(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
): vscode.CodeAction {
    const action = new vscode.CodeAction(t("targetSelectorNoDimensionFix"), vscode.CodeActionKind.QuickFix);
    action.diagnostics = [diagnostic];

    const line = document.lineAt(diagnostic.range.start.line).text;
    const selectors = parseSelectors(line);
    const selector = selectors.find(
        (s) => s.startIndex === diagnostic.range.start.character && s.endIndex === diagnostic.range.end.character
    );

    if (selector) {
        let newSelector: string;
        if (selector.arguments.length === 0) {
            newSelector = `@${selector.type}[distance=0..]`;
        } else {
            const argsStr = selector.arguments.map((a) => a.raw).join(",");
            newSelector = `@${selector.type}[distance=0..,${argsStr}]`;
        }

        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(document.uri, diagnostic.range, newSelector);
    }

    return action;
}

export function createTargetSelectorTypeOrderFix(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
): vscode.CodeAction {
    const action = new vscode.CodeAction(t("targetSelectorTypeOrderFix"), vscode.CodeActionKind.QuickFix);
    action.diagnostics = [diagnostic];

    const line = document.lineAt(diagnostic.range.start.line).text;
    const selectors = parseSelectors(line);
    const selector = selectors.find(
        (s) => s.startIndex === diagnostic.range.start.character && s.endIndex === diagnostic.range.end.character
    );

    if (selector) {
        const typeArg = selector.arguments.find((a) => a.key === "type");
        const otherArgs = selector.arguments.filter((a) => a.key !== "type");

        if (typeArg) {
            const reorderedArgs = [...otherArgs, typeArg];
            const argsStr = reorderedArgs.map((a) => a.raw).join(",");
            const newSelector = `@${selector.type}[${argsStr}]`;

            action.edit = new vscode.WorkspaceEdit();
            action.edit.replace(document.uri, diagnostic.range, newSelector);
        }
    }

    return action;
}

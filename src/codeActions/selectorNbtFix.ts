import * as vscode from "vscode";
import { t } from "../utils/i18n";

export function createSelectorNbtToIfDataFix(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
): vscode.CodeAction {
    const action = new vscode.CodeAction(t("selectorNbtToIfDataFix"), vscode.CodeActionKind.QuickFix);
    action.diagnostics = [diagnostic];

    const line = document.lineAt(diagnostic.range.start.line).text;
    const selector = document.getText(diagnostic.range);

    const baseMatch = selector.match(/^(@[aepnrs])/);
    const nbtMatch = selector.match(/nbt\s*=\s*(\{[^}]*\})/);

    if (baseMatch && nbtMatch) {
        const base = baseMatch[1];
        const nbtValue = nbtMatch[1];

        let newSelector = selector.replace(/,?\s*nbt\s*=\s*\{[^}]*\}/, "");
        newSelector = newSelector.replace(/\[\s*,/, "[").replace(/,\s*\]/, "]");
        if (newSelector.match(/\[\s*\]$/)) {
            newSelector = newSelector.replace(/\[\s*\]$/, "");
        }

        const ifDataPart = `if data entity @s ${nbtValue}`;

        const asPattern = new RegExp(`(?<!positioned\\s)as\\s+${escapeRegex(selector)}`);
        let optimized: string;

        if (asPattern.test(line)) {
            optimized = line.replace(asPattern, `as ${newSelector} ${ifDataPart}`);
        } else {
            optimized = line.replace(selector, `${newSelector} ${ifDataPart}`);
        }

        optimized = optimized.replace(/\s+/g, " ").trim();

        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(
            document.uri,
            new vscode.Range(diagnostic.range.start.line, 0, diagnostic.range.start.line, line.length),
            optimized
        );
    }

    return action;
}

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}


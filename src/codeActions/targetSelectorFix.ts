import * as vscode from "vscode";
import { t } from "../utils/i18n";
import { parseSelectors } from "../rules/targetSelector";

// ── Pure line-transform functions ────────────────────────────────────────────

export function fixTargetSelectorTypeOrder(line: string): string | null {
    const result = line.replace(/@([aeprns])\[([^\]]*)\]/g, (match, selector: string, args: string) => {
        // Only move positive (non-negated, non-tag) type args to the end.
        // Negated (type=!...) and tag (type=#...) types can appear multiple
        // times and must stay in place — moving them causes infinite
        // oscillation in the applyAllFixes loop (issue #17).
        const typeMatch = args.match(/\btype\s*=\s*(?![!#])[^,\]]+/);
        if (typeMatch) {
            const typeArg = typeMatch[0];
            const otherArgs = args.replace(typeArg, "").replace(/^,|,$/g, "").replace(/,,/g, ",");
            const newArgs = otherArgs ? `${otherArgs},${typeArg}` : typeArg;
            return `@${selector}[${newArgs}]`;
        }
        return match;
    });
    return result !== line ? result : null;
}

export function fixTargetSelectorNoDimension(line: string): string | null {
    const DIMENSION_KEYS = ["x", "y", "z", "dx", "dy", "dz", "distance"];
    const result = line.replace(/@([aeprns])\[([^\]]*)\]/g, (match, selector: string, args: string) => {
        const hasDimension = DIMENSION_KEYS.some((key) => new RegExp(`\\b${key}\\s*=`).test(args));
        if (!hasDimension) {
            const newArgs = args ? `${args},distance=0..` : "distance=0..";
            return `@${selector}[${newArgs}]`;
        }
        return match;
    });
    return result !== line ? result : null;
}

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

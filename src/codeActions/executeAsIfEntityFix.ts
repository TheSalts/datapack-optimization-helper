import * as vscode from "vscode";
import { t } from "../utils/i18n";

function parseArgs(argsStr: string): { key: string; raw: string }[] {
    if (!argsStr) {
        return [];
    }
    const args: { key: string; raw: string }[] = [];
    let current = "";
    let depth = 0;

    for (let i = 0; i < argsStr.length; i++) {
        const char = argsStr[i];
        if (char === "{" || char === "[") {
            depth++;
            current += char;
        } else if (char === "}" || char === "]") {
            depth--;
            current += char;
        } else if (char === "," && depth === 0) {
            if (current.trim()) {
                const eqIndex = current.indexOf("=");
                const key = eqIndex !== -1 ? current.slice(0, eqIndex).trim() : current.trim();
                args.push({ key, raw: current.trim() });
            }
            current = "";
        } else {
            current += char;
        }
    }

    if (current.trim()) {
        const eqIndex = current.indexOf("=");
        const key = eqIndex !== -1 ? current.slice(0, eqIndex).trim() : current.trim();
        args.push({ key, raw: current.trim() });
    }

    return args;
}

export function createExecuteAsIfEntitySMergeFix(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
): vscode.CodeAction {
    const action = new vscode.CodeAction(t("executeAsIfEntitySMergeFix"), vscode.CodeActionKind.QuickFix);
    action.diagnostics = [diagnostic];

    const line = document.lineAt(diagnostic.range.start.line).text;

    const asMatch = line.match(/(?<!positioned\s)\bas\s+(@[aepnrs])(\[[^\]]*\])?/);
    const ifEntityMatch = line.match(/\b(if|unless)\s+entity\s+@s(\[[^\]]*\])?/);

    if (asMatch && ifEntityMatch) {
        const ifOrUnless = ifEntityMatch[1];
        const asBase = asMatch[1];
        const asArgsStr = asMatch[2] ? asMatch[2].slice(1, -1) : "";
        const sArgsStr = ifEntityMatch[2] ? ifEntityMatch[2].slice(1, -1) : "";

        const asArgsParsed = parseArgs(asArgsStr);
        const sArgsParsed = parseArgs(sArgsStr);

        const allArgs = [...asArgsParsed, ...sArgsParsed].map((a) => a.raw);
        const mergedArgs = allArgs.length > 0 ? `[${allArgs.join(",")}]` : "";
        const mergedSelector = `${asBase}${mergedArgs}`;

        let optimized = line.replace(/(?<!positioned\s)\bas\s+@[aepnrs](\[[^\]]*\])?\s*/, "");
        optimized = optimized.replace(
            /\b(if|unless)\s+entity\s+@s(\[[^\]]*\])?/,
            `${ifOrUnless} entity ${mergedSelector}`
        );
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

export function createExecuteAsIfEntitySConvertFix(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
): vscode.CodeAction {
    const action = new vscode.CodeAction(t("executeAsIfEntitySConvertFix"), vscode.CodeActionKind.QuickFix);
    action.diagnostics = [diagnostic];

    const line = document.lineAt(diagnostic.range.start.line).text;
    const asMatch = line.match(/(?<!positioned\s)\bas\s+(@[aepnrs])(\[[^\]]*\])?/);

    if (asMatch) {
        const asSelector = asMatch[1] + (asMatch[2] || "");
        let optimized = line.replace(/(?<!positioned\s)\bas\s+@[aepnrs](\[[^\]]*\])?/, `if entity ${asSelector}`);
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

export function createExecuteAsIfEntityRemoveAsFix(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
): vscode.CodeAction {
    const action = new vscode.CodeAction(t("executeAsIfEntityRemoveAsFix"), vscode.CodeActionKind.QuickFix);
    action.diagnostics = [diagnostic];

    const line = document.lineAt(diagnostic.range.start.line).text;
    let optimized = line.replace(/(?<!positioned\s)\bas\s+@[aepnrs](\[[^\]]*\])?\s*/, "");
    optimized = optimized.replace(/\s+/g, " ").trim();

    action.edit = new vscode.WorkspaceEdit();
    action.edit.replace(
        document.uri,
        new vscode.Range(diagnostic.range.start.line, 0, diagnostic.range.start.line, line.length),
        optimized
    );

    return action;
}

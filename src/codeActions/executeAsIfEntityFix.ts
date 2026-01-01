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

function getMergedSelector(
    asBase: string,
    asArgsParsed: { key: string; raw: string }[],
    sArgsParsed: { key: string; raw: string }[]
): string {
    const combined = [...asArgsParsed];

    for (const sArg of sArgsParsed) {
        const isDuplicate = combined.some((a) => a.raw === sArg.raw);
        if (!isDuplicate) {
            combined.push(sArg);
        }
    }

    const allRaw = combined.map((a) => a.raw);
    const mergedArgs = allRaw.length > 0 ? `[${allRaw.join(",")}]` : "";
    return `${asBase}${mergedArgs}`;
}

export function createExecuteAsIfEntitySMergeFix(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
): vscode.CodeAction {
    const action = new vscode.CodeAction(t("executeAsIfEntitySMergeFix"), vscode.CodeActionKind.QuickFix);
    action.diagnostics = [diagnostic];

    const line = document.lineAt(diagnostic.range.start.line).text;

    const asMatch = line.match(/(?<!(positioned|rotated)\s)\bas\s+(@[aepnrs])(\[[^\]]*\])?/);
    const ifEntityMatch = line.match(/\b(if|unless)\s+entity\s+@s(\[[^\]]*\])?/);

    if (asMatch && ifEntityMatch) {
        const asBase = asMatch[2];
        const asArgsStr = asMatch[3] ? asMatch[3].slice(1, -1) : "";
        const sArgsStr = ifEntityMatch[2] ? ifEntityMatch[2].slice(1, -1) : "";

        const asArgsParsed = parseArgs(asArgsStr);
        const sArgsParsed = parseArgs(sArgsStr);

        const mergedSelector = getMergedSelector(asBase, asArgsParsed, sArgsParsed);

        let optimized = line.replace(/\b(if|unless)\s+entity\s+@s(\[[^\]]*\])?\s*/, "");
        optimized = optimized.replace(
            /(?<!(positioned|rotated)\s)\bas\s+@[aepnrs](\[[^\]]*\])?/,
            `as ${mergedSelector}`
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
    const asMatch = line.match(/(?<!(positioned|rotated)\s)\bas\s+(@[aepnrs])(\[[^\]]*\])?/);
    const ifEntityMatch = line.match(/\b(if|unless)\s+entity\s+@s(\[[^\]]*\])?/);

    if (asMatch && ifEntityMatch) {
        const asBase = asMatch[2];
        const asArgsStr = asMatch[3] ? asMatch[3].slice(1, -1) : "";
        const sArgsStr = ifEntityMatch[2] ? ifEntityMatch[2].slice(1, -1) : "";

        const asArgsParsed = parseArgs(asArgsStr);
        const sArgsParsed = parseArgs(sArgsStr);

        const mergedSelector = getMergedSelector(asBase, asArgsParsed, sArgsParsed);

        let optimized = line.replace(/\b(if|unless)\s+entity\s+@s(\[[^\]]*\])?\s*/, "");
        optimized = optimized.replace(
            /(?<!(positioned|rotated)\s)\bas\s+@[aepnrs](\[[^\]]*\])?/,
            `as ${mergedSelector}`
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

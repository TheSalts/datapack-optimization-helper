import * as vscode from "vscode";
import { t } from "../utils/i18n";

const COMPLEX_KEYS = ["scores", "advancements"];

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

function negateArg(raw: string): string {
    const eqIndex = raw.indexOf("=");
    if (eqIndex === -1) {
        return raw;
    }
    const key = raw.slice(0, eqIndex);
    let value = raw.slice(eqIndex + 1);
    if (value.startsWith("!")) {
        value = value.slice(1);
    } else {
        value = "!" + value;
    }
    return `${key}=${value}`;
}

function mergeComplexValues(existingRaw: string, newRaw: string): string {
    const eqIndex1 = existingRaw.indexOf("=");
    const eqIndex2 = newRaw.indexOf("=");
    if (eqIndex1 === -1 || eqIndex2 === -1) {
        return existingRaw;
    }

    const key = existingRaw.slice(0, eqIndex1);
    const value1 = existingRaw.slice(eqIndex1 + 1);
    const value2 = newRaw.slice(eqIndex2 + 1);

    // Extract inner content from {inner}
    const inner1 = value1.startsWith("{") && value1.endsWith("}") ? value1.slice(1, -1) : value1;
    const inner2 = value2.startsWith("{") && value2.endsWith("}") ? value2.slice(1, -1) : value2;

    if (!inner1) {
        return `${key}={${inner2}}`;
    }
    if (!inner2) {
        return `${key}={${inner1}}`;
    }

    return `${key}={${inner1},${inner2}}`;
}

function getMergedSelector(
    asBase: string,
    asArgsParsed: { key: string; raw: string }[],
    sArgsParsed: { key: string; raw: string }[],
    isUnless: boolean
): string {
    const combined = [...asArgsParsed];

    for (const sArg of sArgsParsed) {
        const finalRaw = isUnless ? negateArg(sArg.raw) : sArg.raw;
        const existingIndex = combined.findIndex((a) => a.key === sArg.key);

        if (existingIndex !== -1) {
            // Key already exists
            if (COMPLEX_KEYS.includes(sArg.key)) {
                // Merge complex values (scores, advancements)
                const mergedRaw = mergeComplexValues(combined[existingIndex].raw, finalRaw);
                combined[existingIndex] = { key: sArg.key, raw: mergedRaw };
            }
            // For non-complex duplicate keys, skip (keep existing)
        } else {
            const isDuplicate = combined.some((a) => a.raw === finalRaw);
            if (!isDuplicate) {
                combined.push({ key: sArg.key, raw: finalRaw });
            }
        }
    }

    combined.sort((a, b) => {
        if (a.key === "type" && b.key !== "type") return 1;
        if (a.key !== "type" && b.key === "type") return -1;
        return 0;
    });

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
        const isUnless = ifEntityMatch[1] === "unless";

        const asArgsParsed = parseArgs(asArgsStr);
        const sArgsParsed = parseArgs(sArgsStr);

        const mergedSelector = getMergedSelector(asBase, asArgsParsed, sArgsParsed, isUnless);

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
        const isUnless = ifEntityMatch[1] === "unless";

        const asArgsParsed = parseArgs(asArgsStr);
        const sArgsParsed = parseArgs(sArgsStr);

        const mergedSelector = getMergedSelector(asBase, asArgsParsed, sArgsParsed, isUnless);

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

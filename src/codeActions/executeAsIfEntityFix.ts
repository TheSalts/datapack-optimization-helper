import * as vscode from "vscode";
import { t } from "../utils/i18n";
import { parseArgs, DUPLICABLE_KEYS, COMPLEX_KEYS, extractSelector } from "../parser/selectorParser";

function isDuplicableTypeArg(key: string, raw: string): boolean {
    if (key !== "type") return false;
    const eqIndex = raw.indexOf("=");
    if (eqIndex === -1) return false;
    const value = raw.slice(eqIndex + 1);
    return value.startsWith("!") || value.startsWith("#");
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
    isUnless: boolean,
): string {
    const combined = [...asArgsParsed];

    for (const sArg of sArgsParsed) {
        const finalRaw = isUnless ? negateArg(sArg.raw) : sArg.raw;
        const existingIndex = combined.findIndex((a) => a.key === sArg.key);

        if (existingIndex !== -1) {
            if (COMPLEX_KEYS.includes(sArg.key)) {
                const mergedRaw = mergeComplexValues(combined[existingIndex].raw, finalRaw);
                combined[existingIndex] = { key: sArg.key, raw: mergedRaw };
            } else if (DUPLICABLE_KEYS.includes(sArg.key) || isDuplicableTypeArg(sArg.key, finalRaw)) {
                const isDuplicate = combined.some((a) => a.raw === finalRaw);
                if (!isDuplicate) {
                    combined.push({ key: sArg.key, raw: finalRaw });
                }
            }
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
    diagnostic: vscode.Diagnostic,
): vscode.CodeAction {
    const action = new vscode.CodeAction(t("executeAsIfEntitySMergeFix"), vscode.CodeActionKind.QuickFix);
    action.diagnostics = [diagnostic];

    const line = document.lineAt(diagnostic.range.start.line).text;

    const asKeywordMatch = line.match(/(?<!(positioned|rotated)\s)\bas\s+(@[aepnrs])/);
    const ifEntityKeywordMatch = line.match(/\b(if|unless)\s+entity\s+(@s)/);

    if (asKeywordMatch && ifEntityKeywordMatch) {
        const asSelectorMatch = extractSelector(line, asKeywordMatch.index! + asKeywordMatch[0].length - 2);
        const ifSelectorMatch = extractSelector(line, ifEntityKeywordMatch.index! + ifEntityKeywordMatch[0].length - 2);

        if (asSelectorMatch && ifSelectorMatch) {
            const asBase = asKeywordMatch[2];
            const asArgsStr =
                asSelectorMatch.raw.length > 2 && asSelectorMatch.raw.includes("[")
                    ? asSelectorMatch.raw.slice(3, -1)
                    : "";
            const sArgsStr =
                ifSelectorMatch.raw.length > 2 && ifSelectorMatch.raw.includes("[")
                    ? ifSelectorMatch.raw.slice(3, -1)
                    : "";
            const isUnless = ifEntityKeywordMatch[1] === "unless";

            const asArgsParsed = parseArgs(asArgsStr);
            const sArgsParsed = parseArgs(sArgsStr);

            const mergedSelector = getMergedSelector(asBase, asArgsParsed, sArgsParsed, isUnless);

            let optimized =
                line.slice(0, ifEntityKeywordMatch.index!) +
                line.slice(
                    ifEntityKeywordMatch.index! + ifEntityKeywordMatch[0].length - 2 + ifSelectorMatch.raw.length,
                );
            const asStart = optimized.match(/(?<!(positioned|rotated)\s)\bas\s+@[aepnrs]/)!.index!;
            const asOriginalMatch = extractSelector(optimized, asStart + 3);
            if (asOriginalMatch) {
                optimized =
                    optimized.slice(0, asStart) +
                    `as ${mergedSelector}` +
                    optimized.slice(asStart + 3 + asOriginalMatch.raw.length);
            }
            optimized = optimized.replace(/\s+/g, " ").trim();

            action.edit = new vscode.WorkspaceEdit();
            action.edit.replace(
                document.uri,
                new vscode.Range(diagnostic.range.start.line, 0, diagnostic.range.start.line, line.length),
                optimized,
            );
        }
    }

    return action;
}

export function createExecuteAsIfEntitySConvertFix(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
): vscode.CodeAction {
    const action = new vscode.CodeAction(t("executeAsIfEntitySConvertFix"), vscode.CodeActionKind.QuickFix);
    action.diagnostics = [diagnostic];

    const line = document.lineAt(diagnostic.range.start.line).text;

    const asKeywordMatch = line.match(/(?<!(positioned|rotated)\s)\bas\s+(@[aepnrs])/);
    const ifEntityKeywordMatch = line.match(/\b(if|unless)\s+entity\s+(@s)/);

    if (asKeywordMatch && ifEntityKeywordMatch) {
        const asSelectorMatch = extractSelector(line, asKeywordMatch.index! + asKeywordMatch[0].length - 2);
        const ifSelectorMatch = extractSelector(line, ifEntityKeywordMatch.index! + ifEntityKeywordMatch[0].length - 2);

        if (asSelectorMatch && ifSelectorMatch) {
            const asBase = asKeywordMatch[2];
            const asArgsStr =
                asSelectorMatch.raw.length > 2 && asSelectorMatch.raw.includes("[")
                    ? asSelectorMatch.raw.slice(3, -1)
                    : "";
            const sArgsStr =
                ifSelectorMatch.raw.length > 2 && ifSelectorMatch.raw.includes("[")
                    ? ifSelectorMatch.raw.slice(3, -1)
                    : "";
            const isUnless = ifEntityKeywordMatch[1] === "unless";

            const asArgsParsed = parseArgs(asArgsStr);
            const sArgsParsed = parseArgs(sArgsStr);

            const mergedSelector = getMergedSelector(asBase, asArgsParsed, sArgsParsed, isUnless);

            let optimized =
                line.slice(0, ifEntityKeywordMatch.index!) +
                line.slice(
                    ifEntityKeywordMatch.index! + ifEntityKeywordMatch[0].length - 2 + ifSelectorMatch.raw.length,
                );
            const asStart = optimized.match(/(?<!(positioned|rotated)\s)\bas\s+@[aepnrs]/)!.index!;
            const asOriginalMatch = extractSelector(optimized, asStart + 3);
            if (asOriginalMatch) {
                optimized =
                    optimized.slice(0, asStart) +
                    `as ${mergedSelector}` +
                    optimized.slice(asStart + 3 + asOriginalMatch.raw.length);
            }
            optimized = optimized.replace(/\s+/g, " ").trim();

            action.edit = new vscode.WorkspaceEdit();
            action.edit.replace(
                document.uri,
                new vscode.Range(diagnostic.range.start.line, 0, diagnostic.range.start.line, line.length),
                optimized,
            );
        }
    }

    return action;
}

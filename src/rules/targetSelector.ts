import * as vscode from "vscode";
import { DIAGNOSTIC_SOURCE } from "../constants";
import { t } from "../utils/i18n";
import { RuleConfig, getRuleConfig } from "../utils/config";

export interface SelectorArgument {
    key: string;
    value: string;
    negated: boolean;
    raw: string;
}

export interface ParsedSelector {
    type: string;
    arguments: SelectorArgument[];
    raw: string;
    startIndex: number;
    endIndex: number;
}

export function parseSelectors(line: string): ParsedSelector[] {
    const selectors: ParsedSelector[] = [];
    const regex = /@([en])(\[[^\]]*\])?/g;

    let match;
    while ((match = regex.exec(line)) !== null) {
        const type = match[1];
        const argsRaw = match[2] || "";
        const args = parseArguments(argsRaw);

        selectors.push({
            type,
            arguments: args,
            raw: match[0],
            startIndex: match.index,
            endIndex: match.index + match[0].length,
        });
    }

    return selectors;
}

export function parseArguments(argsRaw: string): SelectorArgument[] {
    if (!argsRaw || argsRaw === "[]") {
        return [];
    }

    const inner = argsRaw.slice(1, -1);
    const args: SelectorArgument[] = [];

    let current = "";
    let depth = 0;

    for (let i = 0; i < inner.length; i++) {
        const char = inner[i];

        if (char === "{" || char === "[") {
            depth++;
            current += char;
        } else if (char === "}" || char === "]") {
            depth--;
            current += char;
        } else if (char === "," && depth === 0) {
            const parsed = parseArgument(current.trim());
            if (parsed) {
                args.push(parsed);
            }
            current = "";
        } else {
            current += char;
        }
    }

    if (current.trim()) {
        const parsed = parseArgument(current.trim());
        if (parsed) {
            args.push(parsed);
        }
    }

    return args;
}

function parseArgument(arg: string): SelectorArgument | null {
    const eqIndex = arg.indexOf("=");
    if (eqIndex === -1) {
        return null;
    }

    const key = arg.slice(0, eqIndex).trim();
    let value = arg.slice(eqIndex + 1).trim();
    let negated = false;

    if (value.startsWith("!")) {
        negated = true;
        value = value.slice(1);
    }

    return { key, value, negated, raw: arg };
}

const DIMENSION_KEYS = ["x", "y", "z", "distance"];

export function checkTargetSelector(lineIndex: number, line: string, config?: RuleConfig): vscode.Diagnostic[] {
    const selectors = parseSelectors(line);
    const diagnostics: vscode.Diagnostic[] = [];
    const effectiveConfig = config || getRuleConfig();

    for (const selector of selectors) {
        const keys = selector.arguments.map((arg) => arg.key);
        const range = new vscode.Range(lineIndex, selector.startIndex, lineIndex, selector.endIndex);

        if (effectiveConfig.targetSelectorNoType) {
            const hasType = keys.includes("type");
            if (!hasType) {
                const message = t("targetSelectorNoType");
                const diagnostic = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Warning);
                diagnostic.source = DIAGNOSTIC_SOURCE;
                diagnostic.code = "target-selector-no-type";
                diagnostics.push(diagnostic);
            }
        }

        if (effectiveConfig.targetSelectorNoDimension) {
            const hasDimension = DIMENSION_KEYS.some((key) => keys.includes(key));
            if (!hasDimension) {
                const message = t("targetSelectorNoDimension");
                const diagnostic = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Warning);
                diagnostic.source = DIAGNOSTIC_SOURCE;
                diagnostic.code = "target-selector-no-dimension";
                diagnostics.push(diagnostic);
            }
        }
    }

    return diagnostics;
}

export function checkTargetSelectorTypeOrder(lineIndex: number, line: string): vscode.Diagnostic[] {
    const selectors = parseSelectors(line);
    const diagnostics: vscode.Diagnostic[] = [];

    for (const selector of selectors) {
        const keys = selector.arguments.map((arg) => arg.key);
        const hasType = keys.includes("type");
        const typeIndex = keys.indexOf("type");

        if (hasType && typeIndex !== selector.arguments.length - 1) {
            const range = new vscode.Range(lineIndex, selector.startIndex, lineIndex, selector.endIndex);
            const message = t("targetSelectorTypeOrder");
            const diagnostic = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Warning);
            diagnostic.source = DIAGNOSTIC_SOURCE;
            diagnostic.code = "target-selector-type-order";
            diagnostics.push(diagnostic);
        }
    }

    return diagnostics;
}
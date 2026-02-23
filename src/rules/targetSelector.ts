import * as vscode from "vscode";
import { RuleConfig } from "../utils/config";
import { createDiagnostic } from "../utils/diagnostic";

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

import { findSelectors } from "../parser/selectorParser";

export function parseSelectors(line: string): ParsedSelector[] {
    const raw = findSelectors(line);
    return raw.map((s) => {
        const type = s.raw[1];
        const argsRaw = s.raw.length > 2 && s.raw[2] === "[" ? s.raw.slice(2) : "";
        return {
            type,
            arguments: parseArguments(argsRaw),
            raw: s.raw,
            startIndex: s.startIndex,
            endIndex: s.endIndex,
        };
    });
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

const DIMENSION_KEYS = ["x", "y", "z", "dx", "dy", "dz", "distance"];

export function checkTargetSelector(lineIndex: number, line: string, config: RuleConfig): vscode.Diagnostic[] {
    const selectors = parseSelectors(line);
    const diagnostics: vscode.Diagnostic[] = [];

    for (const selector of selectors) {
        const keys = selector.arguments.map((arg) => arg.key);
        const range = new vscode.Range(lineIndex, selector.startIndex, lineIndex, selector.endIndex);

        if (config.targetSelectorNoType) {
            const hasType = keys.includes("type");
            if (!hasType) {
                diagnostics.push(createDiagnostic(range, "targetSelectorNoType", "target-selector-no-type"));
            }
        }

        if (config.targetSelectorNoDimension) {
            const hasDimension = DIMENSION_KEYS.some((key) => keys.includes(key));
            if (!hasDimension) {
                diagnostics.push(createDiagnostic(range, "targetSelectorNoDimension", "target-selector-no-dimension"));
            }
        }
    }

    return diagnostics;
}

export function checkTargetSelectorTypeOrder(lineIndex: number, line: string): vscode.Diagnostic[] {
    const selectors = parseSelectors(line);
    const diagnostics: vscode.Diagnostic[] = [];

    for (const selector of selectors) {
        const positiveTypeIndex = selector.arguments.findIndex(
            (arg) => arg.key === "type" && !arg.negated && !arg.value.startsWith("#"),
        );

        if (positiveTypeIndex !== -1 && positiveTypeIndex !== selector.arguments.length - 1) {
            const range = new vscode.Range(lineIndex, selector.startIndex, lineIndex, selector.endIndex);
            diagnostics.push(createDiagnostic(range, "targetSelectorTypeOrder", "target-selector-type-order"));
        }
    }

    return diagnostics;
}

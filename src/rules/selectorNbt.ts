import * as vscode from "vscode";
import { DIAGNOSTIC_SOURCE } from "../constants";
import { t } from "../utils/i18n";

export function checkSelectorNbt(lineIndex: number, line: string): vscode.Diagnostic[] {
    const diagnostics: vscode.Diagnostic[] = [];
    const trimmed = line.trim();

    const selectorRegex = /@[aepnrs]\[[^\]]*nbt\s*=\s*\{[^}]*\}[^\]]*\]/g;
    let match;

    while ((match = selectorRegex.exec(trimmed)) !== null) {
        const selector = match[0];
        const nbtMatch = selector.match(/nbt\s*=\s*(\{[^}]*\})/);

        if (nbtMatch) {
            const startIndex = line.indexOf(selector);
            const range = new vscode.Range(lineIndex, startIndex, lineIndex, startIndex + selector.length);

            const beforeSelector = trimmed.slice(0, match.index);
            const isAfterAs = /\bas\s+$/.test(beforeSelector) && !/positioned\s+as\s+$/.test(beforeSelector);

            const diagnostic = new vscode.Diagnostic(
                range,
                t("selectorNbtToIfData"),
                vscode.DiagnosticSeverity.Warning
            );
            diagnostic.source = DIAGNOSTIC_SOURCE;
            diagnostic.code = isAfterAs ? "selector-nbt-to-if-data" : "selector-nbt-to-if-data-no-fix";
            diagnostics.push(diagnostic);
        }
    }

    return diagnostics;
}


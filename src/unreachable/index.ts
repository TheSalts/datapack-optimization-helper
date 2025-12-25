import * as vscode from "vscode";
import { DIAGNOSTIC_SOURCE } from "../constants";

export function isTerminatingCommand(line: string): boolean {
    return /^return\b/.test(line);
}

export function createUnreachableDiagnostics(lines: string[], startLine: number): vscode.Diagnostic[] {
    const diagnostics: vscode.Diagnostic[] = [];

    for (let i = startLine; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();

        if (trimmedLine === "" || trimmedLine.startsWith("#")) {
            continue;
        }

        const range = new vscode.Range(i, 0, i, line.length);
        const diagnostic = new vscode.Diagnostic(
            range,
            "이 코드는 실행되지 않습니다.",
            vscode.DiagnosticSeverity.Hint
        );
        diagnostic.source = DIAGNOSTIC_SOURCE;
        diagnostic.code = "unreachable-code";
        diagnostic.tags = [vscode.DiagnosticTag.Unnecessary];
        diagnostics.push(diagnostic);
    }

    return diagnostics;
}


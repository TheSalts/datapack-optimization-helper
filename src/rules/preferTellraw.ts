import * as vscode from "vscode";
import { DIAGNOSTIC_SOURCE } from "../constants";

export function checkPreferTellraw(lineIndex: number, line: string): vscode.Diagnostic | null {
    const sayMatch = line.match(/^(\s*)say\s+(.+)$/);
    if (!sayMatch) {
        return null;
    }

    const startCol = sayMatch[1].length;
    const range = new vscode.Range(lineIndex, startCol, lineIndex, line.length);

    const diagnostic = new vscode.Diagnostic(
        range,
        "say 명령어 대신 tellraw를 사용하면 더 많은 서식 옵션을 활용할 수 있습니다.",
        vscode.DiagnosticSeverity.Warning
    );
    diagnostic.source = DIAGNOSTIC_SOURCE;
    diagnostic.code = "prefer-tellraw";

    return diagnostic;
}


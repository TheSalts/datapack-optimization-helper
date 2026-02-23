import * as vscode from "vscode";

export function setDiagnosticData<T>(diagnostic: vscode.Diagnostic, data: T): void {
    (diagnostic as any).data = data;
}

export function getDiagnosticData<T>(diagnostic: vscode.Diagnostic): T | undefined {
    return (diagnostic as any).data as T | undefined;
}

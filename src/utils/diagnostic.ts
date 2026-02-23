import * as vscode from "vscode";
import { DIAGNOSTIC_SOURCE } from "../constants";
import { t, MessageKey } from "./i18n";

export function createDiagnostic(
    range: vscode.Range,
    messageKey: MessageKey,
    code: string,
    severity: vscode.DiagnosticSeverity = vscode.DiagnosticSeverity.Warning,
    messageParams?: Record<string, string | number>,
): vscode.Diagnostic {
    const message = messageParams ? t(messageKey, messageParams) : t(messageKey);
    const diagnostic = new vscode.Diagnostic(range, message, severity);
    diagnostic.source = DIAGNOSTIC_SOURCE;
    diagnostic.code = code;
    return diagnostic;
}

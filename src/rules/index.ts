import * as vscode from "vscode";
import { checkTargetSelector } from "./targetSelector";
import { checkExecuteRedundant } from "./executeRedundant";
import { checkExecuteRun } from "./executeRun";
import { checkExecuteAsS } from "./executeAsS";
import { checkExecuteAtChain } from "./executeAtChain";

export function analyzeCommand(lineIndex: number, line: string): vscode.Diagnostic[] {
    const diagnostics: vscode.Diagnostic[] = [];

    diagnostics.push(...checkTargetSelector(lineIndex, line));
    diagnostics.push(...checkExecuteRedundant(lineIndex, line));

    const executeRunDiag = checkExecuteRun(lineIndex, line);
    if (executeRunDiag) {
        diagnostics.push(executeRunDiag);
    }

    const executeAsDiag = checkExecuteAsS(lineIndex, line);
    if (executeAsDiag) {
        diagnostics.push(executeAsDiag);
    }

    const executeAtChainDiag = checkExecuteAtChain(lineIndex, line);
    if (executeAtChainDiag) {
        diagnostics.push(executeAtChainDiag);
    }

    return diagnostics;
}

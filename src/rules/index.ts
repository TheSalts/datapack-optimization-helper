import * as vscode from "vscode";
import { checkTargetSelector } from "./targetSelector";
import { checkExecuteRedundant } from "./executeRedundant";
import { checkExecuteRun } from "./executeRun";
import { checkExecuteAsS } from "./executeAsS";
import { checkExecuteAtChain } from "./executeAtChain";
import { checkExecuteReturn } from "./executeReturn";
import { checkExecuteAsIfEntity } from "./executeAsIfEntity";
import { checkSelectorNbt } from "./selectorNbt";
import { checkReturnRunDuplicate } from "./returnRunDuplicate";

export function analyzeCommand(lineIndex: number, line: string): vscode.Diagnostic[] {
    const diagnostics: vscode.Diagnostic[] = [];

    diagnostics.push(...checkTargetSelector(lineIndex, line));
    diagnostics.push(...checkExecuteRedundant(lineIndex, line));

    diagnostics.push(...checkExecuteRun(lineIndex, line));

    const executeAsDiag = checkExecuteAsS(lineIndex, line);
    if (executeAsDiag) {
        diagnostics.push(executeAsDiag);
    }

    const executeAtChainDiag = checkExecuteAtChain(lineIndex, line);
    if (executeAtChainDiag) {
        diagnostics.push(executeAtChainDiag);
    }

    const executeReturnDiag = checkExecuteReturn(lineIndex, line);
    if (executeReturnDiag) {
        diagnostics.push(executeReturnDiag);
    }

    const executeAsIfEntityDiag = checkExecuteAsIfEntity(lineIndex, line);
    if (executeAsIfEntityDiag) {
        diagnostics.push(executeAsIfEntityDiag);
    }

    diagnostics.push(...checkSelectorNbt(lineIndex, line));

    const returnRunDuplicateDiag = checkReturnRunDuplicate(lineIndex, line);
    if (returnRunDuplicateDiag) {
        diagnostics.push(returnRunDuplicateDiag);
    }

    return diagnostics;
}

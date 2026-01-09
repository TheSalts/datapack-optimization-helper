import * as vscode from "vscode";
import { checkTargetSelector, checkTargetSelectorTypeOrder } from "./targetSelector";
import { checkExecuteRedundant } from "./executeRedundant";
import { checkExecuteRun } from "./executeRun";
import { checkExecuteAsS } from "./executeAsS";
import { checkExecuteAsIfEntity } from "./executeAsIfEntity";
import { checkScoreboardFakePlayer } from "./scoreboardFakePlayer";
import { checkNbtItems } from "./nbtItems";
import { checkReturnRunDuplicate } from "./returnRunDuplicate";
import { getRuleConfig } from "../utils/config";

export function analyzeCommand(lineIndex: number, line: string): vscode.Diagnostic[] {
    const diagnostics: vscode.Diagnostic[] = [];
    const config = getRuleConfig();

    diagnostics.push(...checkTargetSelector(lineIndex, line, config));

    if (config.targetSelectorTypeOrder) {
        diagnostics.push(...checkTargetSelectorTypeOrder(lineIndex, line));
    }

    diagnostics.push(...checkExecuteRedundant(lineIndex, line, config));

    diagnostics.push(...checkExecuteRun(lineIndex, line, config));

    const executeAsDiag = checkExecuteAsS(lineIndex, line, config);
    if (executeAsDiag) {
        diagnostics.push(executeAsDiag);
    }

    const executeAsIfEntityDiag = checkExecuteAsIfEntity(lineIndex, line, config);
    if (executeAsIfEntityDiag) {
        diagnostics.push(executeAsIfEntityDiag);
    }

    diagnostics.push(...checkScoreboardFakePlayer(lineIndex, line, config));

    diagnostics.push(...checkNbtItems(lineIndex, line, config));

    const returnRunDuplicateDiag = checkReturnRunDuplicate(lineIndex, line, config);
    if (returnRunDuplicateDiag) {
        diagnostics.push(returnRunDuplicateDiag);
    }

    return diagnostics;
}

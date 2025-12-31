import * as vscode from "vscode";
import { checkTargetSelector, checkTargetSelectorTypeOrder } from "./targetSelector";
import { checkExecuteRedundant } from "./executeRedundant";
import { checkExecuteRun } from "./executeRun";
import { checkExecuteAsS } from "./executeAsS";
import { checkExecuteAtChain } from "./executeAtChain";
import { checkExecuteReturn } from "./executeReturn";
import { checkExecuteAsIfEntity } from "./executeAsIfEntity";
import { checkReturnRunDuplicate } from "./returnRunDuplicate";
import { checkScoreboardFakePlayer } from "./scoreboardFakePlayer";
import { checkNbtItems } from "./nbtItems";
import { getRuleConfig } from "../utils/config";

export function analyzeCommand(lineIndex: number, line: string): vscode.Diagnostic[] {
    const diagnostics: vscode.Diagnostic[] = [];
    const config = getRuleConfig();

    if (config.targetSelector) {
        diagnostics.push(...checkTargetSelector(lineIndex, line));
    }

    if (config.targetSelectorTypeOrder) {
        diagnostics.push(...checkTargetSelectorTypeOrder(lineIndex, line));
    }
    if (config.executeRedundant) {
        diagnostics.push(...checkExecuteRedundant(lineIndex, line));
    }

    if (config.executeRun) {
        diagnostics.push(...checkExecuteRun(lineIndex, line));
    }

    if (config.executeAsS) {
        const executeAsDiag = checkExecuteAsS(lineIndex, line);
        if (executeAsDiag) {
            diagnostics.push(executeAsDiag);
        }
    }

    if (config.executeAtChain) {
        const executeAtChainDiag = checkExecuteAtChain(lineIndex, line);
        if (executeAtChainDiag) {
            diagnostics.push(executeAtChainDiag);
        }
    }

    if (config.executeReturn) {
        const executeReturnDiag = checkExecuteReturn(lineIndex, line);
        if (executeReturnDiag) {
            diagnostics.push(executeReturnDiag);
        }
    }

    if (config.executeAsIfEntity) {
        const executeAsIfEntityDiag = checkExecuteAsIfEntity(lineIndex, line);
        if (executeAsIfEntityDiag) {
            diagnostics.push(executeAsIfEntityDiag);
        }
    }

    if (config.returnRunDuplicate) {
        const returnRunDuplicateDiag = checkReturnRunDuplicate(lineIndex, line);
        if (returnRunDuplicateDiag) {
            diagnostics.push(returnRunDuplicateDiag);
        }
    }

    if (config.scoreboardFakePlayer) {
        diagnostics.push(...checkScoreboardFakePlayer(lineIndex, line));
    }

    if (config.nbtItems) {
        diagnostics.push(...checkNbtItems(lineIndex, line));
    }

    return diagnostics;
}

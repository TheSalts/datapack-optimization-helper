import * as vscode from "vscode";

export type RuleName =
    | "targetSelector"
    | "targetSelectorTypeOrder"
    | "executeRedundant"
    | "executeRun"
    | "executeAsS"
    | "executeAtChain"
    | "executeReturn"
    | "executeAsIfEntity"
    | "returnRunDuplicate"
    | "scoreboardFakePlayer"
    | "executeGroup"
    | "unreachableCondition"
    | "nbtItems";

export interface RuleConfig {
    targetSelector: boolean;
    targetSelectorTypeOrder: boolean;
    executeRedundant: boolean;
    executeRun: boolean;
    executeAsS: boolean;
    executeAtChain: boolean;
    executeReturn: boolean;
    executeAsIfEntity: boolean;
    returnRunDuplicate: boolean;
    scoreboardFakePlayer: boolean;
    executeGroup: boolean;
    unreachableCondition: boolean;
    nbtItems: boolean;
}

export function getRuleConfig(): RuleConfig {
    const config = vscode.workspace.getConfiguration("datapackOptimization");
    const disabledRules = config.get<RuleName[]>("rules.disabled", []);
    console.log("Disabled rules:", disabledRules);
    const disabledSet = new Set(disabledRules);

    return {
        targetSelector: !disabledSet.has("targetSelector"),
        targetSelectorTypeOrder: !disabledSet.has("targetSelectorTypeOrder"),
        executeRedundant: !disabledSet.has("executeRedundant"),
        executeRun: !disabledSet.has("executeRun"),
        executeAsS: !disabledSet.has("executeAsS"),
        executeAtChain: !disabledSet.has("executeAtChain"),
        executeReturn: !disabledSet.has("executeReturn"),
        executeAsIfEntity: !disabledSet.has("executeAsIfEntity"),
        returnRunDuplicate: !disabledSet.has("returnRunDuplicate"),
        scoreboardFakePlayer: !disabledSet.has("scoreboardFakePlayer"),
        executeGroup: !disabledSet.has("executeGroup"),
        unreachableCondition: !disabledSet.has("unreachableCondition"),
        nbtItems: !disabledSet.has("nbtItems"),
    };
}


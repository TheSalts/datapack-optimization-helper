import * as vscode from "vscode";

export type RuleName =
    | "target-selector-type-order"
    | "execute-group"
    | "unreachable-condition"
    | "always-pass-condition"
    | "unreachable-code"
    | "target-selector-no-type"
    | "target-selector-no-dimension"
    | "execute-run-redundant"
    | "execute-duplicate"
    | "execute-as-s-redundant"
    | "execute-as-if-entity-s-merge"
    | "execute-as-if-entity-s-convert"
    | "return-run-duplicate"
    | "execute-run-redundant-run-execute"
    | "scoreboard-fake-player-missing-hash"
    | "nbt-items-use-if-items";

export interface RuleConfig {
    // Individual Rules
    targetSelectorNoType: boolean;
    targetSelectorNoDimension: boolean;
    targetSelectorTypeOrder: boolean;
    
    executeDuplicate: boolean;
    
    executeRunRedundant: boolean;
    executeRunRedundantRunExecute: boolean;
    
    executeAsSRedundant: boolean;
    
    executeAsIfEntitySMerge: boolean;
    executeAsIfEntitySConvert: boolean;
    
    scoreboardFakePlayerMissingHash: boolean;
    nbtItemsUseIfItems: boolean;
    
    executeGroup: boolean;
    unreachableCondition: boolean;
    alwaysPassCondition: boolean;
    unreachableCode: boolean;
    
    returnRunDuplicate: boolean;
}

export function getRuleConfig(): RuleConfig {
    const config = vscode.workspace.getConfiguration("datapackOptimization");
    const disabledRules = config.get<RuleName[]>("rules.disabled", []);
    const disabledSet = new Set(disabledRules);

    return {
        targetSelectorNoType: !disabledSet.has("target-selector-no-type"),
        targetSelectorNoDimension: !disabledSet.has("target-selector-no-dimension"),
        targetSelectorTypeOrder: !disabledSet.has("target-selector-type-order"),

        executeDuplicate: !disabledSet.has("execute-duplicate"),

        executeRunRedundant: !disabledSet.has("execute-run-redundant"),
        executeRunRedundantRunExecute: !disabledSet.has("execute-run-redundant-run-execute"),

        executeAsSRedundant: !disabledSet.has("execute-as-s-redundant"),

        executeAsIfEntitySMerge: !disabledSet.has("execute-as-if-entity-s-merge"),
        executeAsIfEntitySConvert: !disabledSet.has("execute-as-if-entity-s-convert"),

        scoreboardFakePlayerMissingHash: !disabledSet.has("scoreboard-fake-player-missing-hash"),
        nbtItemsUseIfItems: !disabledSet.has("nbt-items-use-if-items"),

        executeGroup: !disabledSet.has("execute-group"),
        unreachableCondition: !disabledSet.has("unreachable-condition"),
        alwaysPassCondition: !disabledSet.has("always-pass-condition"),
        unreachableCode: !disabledSet.has("unreachable-code"),
        
        returnRunDuplicate: !disabledSet.has("return-run-duplicate"),
    };
}
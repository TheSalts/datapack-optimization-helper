import * as vscode from "vscode";

export type RuleName =
    | "always-pass-condition"
    | "execute-as-if-entity-s-convert"
    | "execute-as-if-entity-s-merge"
    | "execute-as-s-redundant"
    | "execute-duplicate"
    | "execute-group"
    | "execute-run-redundant"
    | "execute-run-redundant-run-execute"
    | "execute-unnecessary"
    | "nbt-items-use-if-items"
    | "return-run-duplicate"
    | "scoreboard-fake-player-missing-hash"
    | "target-selector-no-dimension"
    | "target-selector-no-type"
    | "target-selector-type-order"
    | "unreachable-code"
    | "unreachable-condition";

export interface RuleConfig {
    alwaysPassCondition: boolean;
    executeAsIfEntitySConvert: boolean;
    executeAsIfEntitySMerge: boolean;
    executeAsSRedundant: boolean;
    executeDuplicate: boolean;
    executeGroup: boolean;
    executeRunRedundant: boolean;
    executeRunRedundantRunExecute: boolean;
    executeUnnecessary: boolean;
    nbtItemsUseIfItems: boolean;
    returnRunDuplicate: boolean;
    scoreboardFakePlayerMissingHash: boolean;
    targetSelectorNoDimension: boolean;
    targetSelectorNoType: boolean;
    targetSelectorTypeOrder: boolean;
    unreachableCode: boolean;
    unreachableCondition: boolean;
}

export function getRuleConfig(): RuleConfig {
    const config = vscode.workspace.getConfiguration("datapackOptimization");
    const disabledRules = config.get<RuleName[]>("rules.disabled", []);
    const disabledSet = new Set(disabledRules);

    return {
        alwaysPassCondition: !disabledSet.has("always-pass-condition"),
        executeAsIfEntitySConvert: !disabledSet.has("execute-as-if-entity-s-convert"),
        executeAsIfEntitySMerge: !disabledSet.has("execute-as-if-entity-s-merge"),
        executeAsSRedundant: !disabledSet.has("execute-as-s-redundant"),
        executeDuplicate: !disabledSet.has("execute-duplicate"),
        executeGroup: !disabledSet.has("execute-group"),
        executeRunRedundant: !disabledSet.has("execute-run-redundant"),
        executeRunRedundantRunExecute: !disabledSet.has("execute-run-redundant-run-execute"),
        executeUnnecessary: !disabledSet.has("execute-unnecessary"),
        nbtItemsUseIfItems: !disabledSet.has("nbt-items-use-if-items"),
        returnRunDuplicate: !disabledSet.has("return-run-duplicate"),
        scoreboardFakePlayerMissingHash: !disabledSet.has("scoreboard-fake-player-missing-hash"),
        targetSelectorNoDimension: !disabledSet.has("target-selector-no-dimension"),
        targetSelectorNoType: !disabledSet.has("target-selector-no-type"),
        targetSelectorTypeOrder: !disabledSet.has("target-selector-type-order"),
        unreachableCode: !disabledSet.has("unreachable-code"),
        unreachableCondition: !disabledSet.has("unreachable-condition"),
    };
}

export function getExecuteGroupOutputPath(): string {
    const config = vscode.workspace.getConfiguration("datapackOptimization");
    return config.get<string>("executeGroup.outputPath", "{dir}");
}

export function getExecuteGroupOutputName(): string {
    const config = vscode.workspace.getConfiguration("datapackOptimization");
    return config.get<string>("executeGroup.outputName", "{name}_line_{line}");
}
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { t } from "./i18n";

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
    | "infinite-recursion"
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
    infiniteRecursion: boolean;
    nbtItemsUseIfItems: boolean;
    returnRunDuplicate: boolean;
    scoreboardFakePlayerMissingHash: boolean;
    targetSelectorNoDimension: boolean;
    targetSelectorNoType: boolean;
    targetSelectorTypeOrder: boolean;
    unreachableCode: boolean;
    unreachableCondition: boolean;
}

export interface DatapackConfig {
    rules?: {
        disabled?: RuleName[];
    };
    executeGroup?: {
        outputPath?: string;
        outputName?: string;
    };
}

let cachedDatapackConfig: DatapackConfig | null = null;
let cachedDatapackConfigPath: string | null = null;

export function getDatapackConfig(): DatapackConfig | null {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return null;
    }

    const rootPath = workspaceFolders[0].uri.fsPath;
    const configPath = path.join(rootPath, "datapack.config.json");

    if (cachedDatapackConfigPath === configPath && cachedDatapackConfig !== null) {
        return cachedDatapackConfig;
    }

    try {
        if (!fs.existsSync(configPath)) {
            cachedDatapackConfig = null;
            cachedDatapackConfigPath = configPath;
            return null;
        }
        const content = fs.readFileSync(configPath, "utf-8");
        cachedDatapackConfig = JSON.parse(content) as DatapackConfig;
        cachedDatapackConfigPath = configPath;
        return cachedDatapackConfig;
    } catch (error) {
        console.error("[config] Failed to load datapack.config.json:", error);
        cachedDatapackConfig = null;
        cachedDatapackConfigPath = configPath;
        return null;
    }
}

export function clearDatapackConfigCache() {
    cachedDatapackConfig = null;
    cachedDatapackConfigPath = null;
}

const DEFAULT_CONFIG: DatapackConfig = {
    rules: {
        disabled: ["scoreboard-fake-player-missing-hash"],
    },
    executeGroup: {
        outputPath: "{dir}",
        outputName: "{name}_line_{line}",
    },
};

export async function checkAndNotifyConfigMissing(context: vscode.ExtensionContext): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return;
    }

    const rootPath = workspaceFolders[0].uri.fsPath;
    const configPath = path.join(rootPath, "datapack.config.json");
    const packMetaPath = path.join(rootPath, "pack.mcmeta");

    if (!fs.existsSync(packMetaPath)) {
        return;
    }

    if (fs.existsSync(configPath)) {
        return;
    }

    const notifiedKey = `configNotified:${rootPath}`;
    if (context.workspaceState.get<boolean>(notifiedKey)) {
        return;
    }

    const createButton = t("configCreate");
    const dontShowAgain = t("configDontShowAgain");
    const result = await vscode.window.showInformationMessage(t("configNotFound"), createButton, dontShowAgain);

    if (result === createButton) {
        const content = JSON.stringify(DEFAULT_CONFIG, null, 4);
        fs.writeFileSync(configPath, content, "utf-8");
        const doc = await vscode.workspace.openTextDocument(configPath);
        await vscode.window.showTextDocument(doc);
        context.workspaceState.update(notifiedKey, true);
    } else if (result === dontShowAgain) {
        context.workspaceState.update(notifiedKey, true);
    }
}

export function watchDatapackConfig(context: vscode.ExtensionContext, onChange?: () => void) {
    const watcher = vscode.workspace.createFileSystemWatcher("**/datapack.config.json");

    watcher.onDidChange(() => {
        clearDatapackConfigCache();
        onChange?.();
    });

    watcher.onDidCreate(() => {
        clearDatapackConfigCache();
        onChange?.();
    });

    watcher.onDidDelete(() => {
        clearDatapackConfigCache();
        onChange?.();
    });

    context.subscriptions.push(watcher);
}

export function getRuleConfig(): RuleConfig {
    const config = vscode.workspace.getConfiguration("datapackOptimization");
    const userDisabledRules = config.get<RuleName[]>("rules.disabled", []);

    const datapackConfig = getDatapackConfig();
    const projectDisabledRules = datapackConfig?.rules?.disabled ?? [];

    const disabledSet = new Set([...userDisabledRules, ...projectDisabledRules]);

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
        infiniteRecursion: !disabledSet.has("infinite-recursion"),
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
    const datapackConfig = getDatapackConfig();
    if (datapackConfig?.executeGroup?.outputPath !== undefined) {
        return datapackConfig.executeGroup.outputPath;
    }
    const config = vscode.workspace.getConfiguration("datapackOptimization");
    return config.get<string>("executeGroup.outputPath", "{dir}");
}

export function getExecuteGroupOutputName(): string {
    const datapackConfig = getDatapackConfig();
    if (datapackConfig?.executeGroup?.outputName !== undefined) {
        return datapackConfig.executeGroup.outputName;
    }
    const config = vscode.workspace.getConfiguration("datapackOptimization");
    return config.get<string>("executeGroup.outputName", "{name}_line_{line}");
}

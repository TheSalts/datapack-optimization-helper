import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { t } from "./i18n";

export const ALL_RULE_IDS = [
    "always-pass-condition",
    "execute-as-if-entity-s-convert",
    "execute-as-if-entity-s-merge",
    "execute-as-s-redundant",
    "execute-duplicate",
    "execute-group",
    "execute-run-redundant",
    "execute-run-redundant-run-execute",
    "execute-unnecessary",
    "infinite-recursion",
    "nbt-items-use-if-items",
    "return-run-duplicate",
    "scoreboard-fake-player-missing-hash",
    "target-selector-no-dimension",
    "target-selector-no-type",
    "target-selector-type-order",
    "scoreboard-divide-by-zero",
    "unreachable-code",
    "unreachable-condition",
] as const;

export type RuleName = (typeof ALL_RULE_IDS)[number];

type KebabToCamel<S extends string> = S extends `${infer L}-${infer R}` ? `${L}${Capitalize<KebabToCamel<R>>}` : S;

export type RuleConfig = {
    [K in RuleName as KebabToCamel<K>]: boolean;
};

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

function kebabToCamel(s: string): string {
    return s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

export function getRuleConfig(): RuleConfig {
    const config = vscode.workspace.getConfiguration("datapackOptimization");
    const userDisabledRules = config.get<RuleName[]>("rules.disabled", []);

    const datapackConfig = getDatapackConfig();
    const projectDisabledRules = datapackConfig?.rules?.disabled ?? [];

    const disabledSet = new Set([...userDisabledRules, ...projectDisabledRules]);

    const result: Record<string, boolean> = {};
    for (const id of ALL_RULE_IDS) {
        result[kebabToCamel(id)] = !disabledSet.has(id);
    }
    return result as RuleConfig;
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

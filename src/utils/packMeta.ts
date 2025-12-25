import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

export interface PackMeta {
    pack: {
        pack_format?: number;
        description?: string | object;
        supported_formats?: number | [number, number] | { min_inclusive: number; max_inclusive: number };
        min_format?: number | [number] | [number, number];
        max_format?: number | [number] | [number, number];
    };
}

let cachedPackMeta: PackMeta | null = null;
let cachedPackMetaPath: string | null = null;

export async function getPackMeta(): Promise<PackMeta | null> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return null;
    }

    const rootPath = workspaceFolders[0].uri.fsPath;
    const packMetaPath = path.join(rootPath, "pack.mcmeta");

    if (cachedPackMetaPath === packMetaPath && cachedPackMeta) {
        return cachedPackMeta;
    }

    try {
        const content = fs.readFileSync(packMetaPath, "utf-8");
        cachedPackMeta = JSON.parse(content) as PackMeta;
        cachedPackMetaPath = packMetaPath;
        return cachedPackMeta;
    } catch (error) {
        console.error("[packMeta] Failed to load pack.mcmeta:", error);
        return null;
    }
}

export function getPackFormat(): number | null {
    return cachedPackMeta?.pack?.pack_format ?? null;
}

export function clearPackMetaCache() {
    cachedPackMeta = null;
    cachedPackMetaPath = null;
}

export function watchPackMeta(context: vscode.ExtensionContext) {
    const watcher = vscode.workspace.createFileSystemWatcher("**/pack.mcmeta");

    watcher.onDidChange(() => {
        clearPackMetaCache();
        getPackMeta();
    });

    watcher.onDidCreate(() => {
        clearPackMetaCache();
        getPackMeta();
    });

    watcher.onDidDelete(() => {
        clearPackMetaCache();
    });

    context.subscriptions.push(watcher);
}

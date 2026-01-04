import * as vscode from "vscode";
import { getPackFormat } from "../utils/packMeta";
import { t } from "../utils/i18n";

type RenameBehavior = "ask" | "codeOnly" | "includeComments" | "skip";

interface PendingRename {
    oldRef: string;
    newRef: string;
    includeComments: boolean;
}

let pendingRenames: PendingRename[] = [];

export function registerRenameHandler(context: vscode.ExtensionContext) {
    context.subscriptions.push(vscode.workspace.onWillRenameFiles(handleWillRename));
    context.subscriptions.push(vscode.workspace.onDidRenameFiles(handleDidRename));
}

function getRenameBehavior(): RenameBehavior {
    const config = vscode.workspace.getConfiguration("datapackOptimization");
    return config.get<RenameBehavior>("rename.behavior", "ask");
}

async function setRenameBehavior(behavior: RenameBehavior): Promise<void> {
    const config = vscode.workspace.getConfiguration("datapackOptimization");
    await config.update("rename.behavior", behavior, vscode.ConfigurationTarget.Global);
}

function handleWillRename(event: vscode.FileWillRenameEvent) {
    const mcfunctionFiles = event.files.filter((f) => f.oldUri.fsPath.endsWith(".mcfunction"));
    if (mcfunctionFiles.length === 0) {
        return;
    }

    event.waitUntil(collectRenames(mcfunctionFiles));
}

async function collectRenames(
    files: readonly { readonly oldUri: vscode.Uri; readonly newUri: vscode.Uri }[]
): Promise<vscode.WorkspaceEdit> {
    pendingRenames = [];
    const behavior = getRenameBehavior();

    for (const file of files) {
        const oldRef = extractFunctionReference(file.oldUri.fsPath);
        const newRef = extractFunctionReference(file.newUri.fsPath);

        if (!oldRef || !newRef) {
            continue;
        }

        const codeCount = await findReferences(oldRef, false);
        const commentCount = await findReferences(oldRef, true);

        if (codeCount === 0 && commentCount === 0) {
            continue;
        }

        let choice: "code" | "all" | "skip" | "cancel";

        if (behavior === "ask") {
            choice = await showRefactorDialog(oldRef, newRef, codeCount, commentCount);
        } else if (behavior === "codeOnly") {
            choice = "code";
        } else if (behavior === "includeComments") {
            choice = "all";
        } else {
            choice = "skip";
        }

        if (choice === "cancel") {
            throw new Error("Rename cancelled by user");
        }

        if (choice === "skip") {
            continue;
        }

        pendingRenames.push({
            oldRef,
            newRef,
            includeComments: choice === "all",
        });
    }

    return new vscode.WorkspaceEdit();
}

async function handleDidRename() {
    if (pendingRenames.length === 0) {
        return;
    }

    const renames = [...pendingRenames];
    pendingRenames = [];

    const files = await vscode.workspace.findFiles("**/*.mcfunction");

    for (const file of files) {
        const content = await vscode.workspace.fs.readFile(file);
        let text = Buffer.from(content).toString("utf-8");
        let modified = false;

        for (const rename of renames) {
            const codePatterns = [
                new RegExp(`(\\$?function\\s+)${escapeRegex(rename.oldRef)}\\b`, "g"),
                new RegExp(`(\\$?schedule\\s+function\\s+)${escapeRegex(rename.oldRef)}\\b`, "g"),
            ];

            for (const pattern of codePatterns) {
                if (pattern.test(text)) {
                    text = text.replace(pattern, `$1${rename.newRef}`);
                    modified = true;
                }
            }

            if (rename.includeComments) {
                const lines = text.split(/\r?\n/);
                const newLines = lines.map((line) => {
                    if (line.trim().startsWith("#")) {
                        const replaced = line.replace(new RegExp(escapeRegex(rename.oldRef), "g"), rename.newRef);
                        if (replaced !== line) {
                            modified = true;
                            return replaced;
                        }
                    }
                    return line;
                });
                text = newLines.join("\n");
            }
        }

        if (modified) {
            await vscode.workspace.fs.writeFile(file, Buffer.from(text, "utf-8"));
        }
    }
}

interface RefactorChoice {
    action: "code" | "all" | "skip";
    remember: boolean;
}

async function showRefactorDialog(
    oldRef: string,
    newRef: string,
    codeCount: number,
    commentCount: number
): Promise<"code" | "all" | "skip" | "cancel"> {
    const items: (vscode.QuickPickItem & { choice: RefactorChoice })[] = [];

    items.push({
        label: `$(code) ${t("rename.codeOnly")}`,
        description: t("rename.codeOnlyDesc", { count: codeCount }),
        choice: { action: "code", remember: false },
    });

    items.push({
        label: `$(comment) ${t("rename.includeComments")}`,
        description: t("rename.includeCommentsDesc", { count: codeCount + commentCount }),
        choice: { action: "all", remember: false },
    });

    items.push({
        label: `$(close) ${t("rename.skip")}`,
        description: t("rename.skipDesc"),
        choice: { action: "skip", remember: false },
    });

    items.push({ label: "", kind: vscode.QuickPickItemKind.Separator, choice: { action: "skip", remember: false } });

    items.push({
        label: `$(code) ${t("rename.codeOnlyRemember")}`,
        description: t("rename.rememberDesc"),
        choice: { action: "code", remember: true },
    });

    items.push({
        label: `$(comment) ${t("rename.includeCommentsRemember")}`,
        description: t("rename.rememberDesc"),
        choice: { action: "all", remember: true },
    });

    items.push({
        label: `$(close) ${t("rename.skipRemember")}`,
        description: t("rename.rememberDesc"),
        choice: { action: "skip", remember: true },
    });

    const selected = await vscode.window.showQuickPick(items, {
        title: t("rename.title", { old: oldRef, new: newRef }),
        placeHolder: t("rename.placeholder"),
    });

    if (!selected) {
        return "cancel";
    }

    if (selected.choice.remember) {
        const behaviorMap: Record<"code" | "all" | "skip", RenameBehavior> = {
            code: "codeOnly",
            all: "includeComments",
            skip: "skip",
        };
        await setRenameBehavior(behaviorMap[selected.choice.action]);
    }

    return selected.choice.action;
}

function extractFunctionReference(filePath: string): string | null {
    const normalized = filePath.replace(/\\/g, "/");

    let functionPath = "function";
    const packFormat = getPackFormat();
    if (packFormat !== null && packFormat < 32) {
        functionPath = "functions";
    }
    const match = normalized.match(new RegExp(`data/([^/]+)/${functionPath}/(.+)\\.mcfunction$`));
    if (!match) {
        return null;
    }

    const namespace = match[1];
    const funcPath = match[2];
    return `${namespace}:${funcPath}`;
}

async function findReferences(ref: string, commentsOnly: boolean): Promise<number> {
    let count = 0;
    const files = await vscode.workspace.findFiles("**/*.mcfunction");

    for (const file of files) {
        const content = await vscode.workspace.fs.readFile(file);
        const text = Buffer.from(content).toString("utf-8");
        const lines = text.split(/\r?\n/);

        for (const line of lines) {
            const trimmed = line.trim();
            const isComment = trimmed.startsWith("#");

            if (commentsOnly !== isComment) {
                continue;
            }

            if (commentsOnly) {
                const pattern = new RegExp(escapeRegex(ref), "g");
                const matches = line.match(pattern);
                if (matches) {
                    count += matches.length;
                }
            } else {
                const patterns = [
                    new RegExp(`\\$?function\\s+${escapeRegex(ref)}\\b`, "g"),
                    new RegExp(`\\$?schedule\\s+function\\s+${escapeRegex(ref)}\\b`, "g"),
                ];

                for (const pattern of patterns) {
                    const matches = line.match(pattern);
                    if (matches) {
                        count += matches.length;
                    }
                }
            }
        }
    }

    return count;
}

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

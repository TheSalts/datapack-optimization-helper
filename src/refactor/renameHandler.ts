import * as vscode from "vscode";
import * as path from "path";

export function registerRenameHandler(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.workspace.onWillRenameFiles(handleRename)
    );
}

async function handleRename(event: vscode.FileWillRenameEvent) {
    const edit = new vscode.WorkspaceEdit();

    for (const file of event.files) {
        if (!file.oldUri.fsPath.endsWith(".mcfunction")) {
            continue;
        }

        const oldRef = extractFunctionReference(file.oldUri.fsPath);
        const newRef = extractFunctionReference(file.newUri.fsPath);

        if (!oldRef || !newRef) {
            continue;
        }

        const updates = await findAndReplaceReferences(oldRef, newRef);
        for (const update of updates) {
            edit.replace(update.uri, update.range, update.newText);
        }
    }

    if (edit.size > 0) {
        event.waitUntil(Promise.resolve(edit));
    }
}

function extractFunctionReference(filePath: string): string | null {
    const normalized = filePath.replace(/\\/g, "/");

    // data/<namespace>/function(s)/<path>.mcfunction 패턴 찾기
    const match = normalized.match(/data\/([^/]+)\/functions?\/(.+)\.mcfunction$/);
    if (!match) {
        return null;
    }

    const namespace = match[1];
    const funcPath = match[2];
    return `${namespace}:${funcPath}`;
}

interface ReferenceUpdate {
    uri: vscode.Uri;
    range: vscode.Range;
    newText: string;
}

async function findAndReplaceReferences(
    oldRef: string,
    newRef: string
): Promise<ReferenceUpdate[]> {
    const updates: ReferenceUpdate[] = [];

    const files = await vscode.workspace.findFiles("**/*.mcfunction");

    for (const file of files) {
        const document = await vscode.workspace.openTextDocument(file);
        const text = document.getText();
        const lines = text.split("\n");

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // function 명령어 또는 $로 시작하는 매크로 function 찾기
            // 예: function namespace:path, $function namespace:path
            const patterns = [
                new RegExp(`(\\$?function\\s+)${escapeRegex(oldRef)}\\b`, "g"),
                new RegExp(`(\\$?schedule\\s+function\\s+)${escapeRegex(oldRef)}\\b`, "g"),
            ];

            for (const pattern of patterns) {
                let match;
                while ((match = pattern.exec(line)) !== null) {
                    const start = match.index + match[1].length;
                    const end = start + oldRef.length;

                    updates.push({
                        uri: file,
                        range: new vscode.Range(i, start, i, end),
                        newText: newRef,
                    });
                }
            }
        }
    }

    return updates;
}

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}


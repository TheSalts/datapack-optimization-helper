import * as vscode from "vscode";
import { getAllPackFormats } from "../utils/versionData";

const PACK_META_FORMAT_KEYS = new Set([
    "pack_format",
    "min_inclusive",
    "max_inclusive",
    "supported_formats",
    "min_format",
    "max_format",
]);

function createCompletionItem(
    label: string,
    insertText: string,
    sortText: string,
    filterText: string,
    range?: vscode.Range,
): vscode.CompletionItem {
    const item = new vscode.CompletionItem(label, vscode.CompletionItemKind.Value);
    item.insertText = insertText;
    item.sortText = sortText;
    item.filterText = filterText;
    if (range) {
        item.range = range;
    }
    return item;
}

function getNearestKeyInfo(
    textBeforeCursor: string,
): { key: string; inArray: boolean; afterComma: boolean; major?: number } | null {
    // Find the key and the content after the colon
    const keyPattern = /"(\w+)"\s*:\s*([^"}]*)$/;
    const match = keyPattern.exec(textBeforeCursor);
    if (!match) {
        return null;
    }

    const key = match[1];
    const content = match[2];

    const arrayStart = content.lastIndexOf("[");
    const arrayEnd = content.lastIndexOf("]");

    // Check if we are inside an unclosed array
    if (arrayStart !== -1 && arrayStart > arrayEnd) {
        const insideArray = content.substring(arrayStart + 1);
        const parts = insideArray.split(",");
        if (parts.length === 1) {
            return { key, inArray: true, afterComma: false };
        } else {
            const major = parseInt(parts[0].trim());
            return { key, inArray: true, afterComma: true, major: isNaN(major) ? undefined : major };
        }
    }

    return { key, inArray: false, afterComma: false };
}

function getValueRange(document: vscode.TextDocument, position: vscode.Position): vscode.Range | undefined {
    const line = document.lineAt(position.line).text;
    const before = line.substring(0, position.character);
    const after = line.substring(position.character);
    // Match only alphanumeric characters and dots (exclude [ , ] etc.)
    const beforeMatch = before.match(/([a-zA-Z0-9.]+)$/);
    const afterMatch = after.match(/^([a-zA-Z0-9.]+)/);
    if (!beforeMatch && !afterMatch) {
        return undefined;
    }
    const start = beforeMatch ? position.character - beforeMatch[1].length : position.character;
    const end = afterMatch ? position.character + afterMatch[1].length : position.character;
    return new vscode.Range(position.line, start, position.line, end);
}

class PackMetaCompletionProvider implements vscode.CompletionItemProvider {
    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
    ): vscode.CompletionItem[] | undefined {
        const textBeforeCursor = document.getText(new vscode.Range(new vscode.Position(0, 0), position));

        const info = getNearestKeyInfo(textBeforeCursor);
        if (!info || !PACK_META_FORMAT_KEYS.has(info.key)) {
            return undefined;
        }

        const config = vscode.workspace.getConfiguration("datapackOptimization");
        const includeSnapshots = config.get<boolean>("packMetaVersionHints.showSnapshots") ?? false;

        const entries = getAllPackFormats(includeSnapshots);
        if (entries.length === 0) {
            return undefined;
        }

        const maxFormat = entries[0].format;
        const digits = String(maxFormat).length;
        const replaceRange = getValueRange(document, position);

        if (info.inArray && info.afterComma) {
            // Suggesting minor versions for a specific major version
            const major = info.major;
            const minorEntries = entries.filter((e) => e.format === major);
            return minorEntries.map(({ minor, version }, i) =>
                createCompletionItem(
                    `${version} (minor: ${minor})`,
                    String(minor),
                    String(i).padStart(4, "0"),
                    `${version} ${minor}`,
                    replaceRange,
                ),
            );
        }

        // Suggesting major versions (either in array or single integer)
        return entries.map(({ format, minor, version }, i) => {
            const padded = String(maxFormat - format).padStart(digits + 1, "0");
            const sortText = padded + String(i).padStart(4, "0");
            return createCompletionItem(
                `${version} (${format})`,
                String(format),
                sortText,
                `${version} ${format} ${minor}`,
                replaceRange,
            );
        });
    }
}

export function registerPackMetaCompletion(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            { pattern: "**/pack.mcmeta", scheme: "file" },
            new PackMetaCompletionProvider(),
            "0",
            "1",
            "2",
            "3",
            "4",
            "5",
            "6",
            "7",
            "8",
            "9",
            ".",
            "[",
            ",",
        ),
    );
}

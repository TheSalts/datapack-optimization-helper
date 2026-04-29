import * as vscode from "vscode";
import { getVersionLabel, getVersionLabelWithMinor } from "../utils/versionData";

// Matches: "pack_format": 48  or  "min_inclusive": 18  or  "max_inclusive": 48
// Also matches [major, minor] arrays for min_format and max_format
const FORMAT_LINE_RE =
    /^\s*"(pack_format|min_inclusive|max_inclusive|supported_formats|min_format|max_format)"\s*:\s*(\d+|\[\s*(\d+)\s*,\s*(\d+)\s*\])\s*,?\s*$/;

export class PackMetaInlayHintsProvider implements vscode.InlayHintsProvider {
    provideInlayHints(document: vscode.TextDocument, range: vscode.Range): vscode.InlayHint[] {
        const config = vscode.workspace.getConfiguration("datapackOptimization");
        const isEnabled = config.get<boolean>("packMetaInlayHints.enabled") ?? true;
        if (!isEnabled) {
            return [];
        }

        const includeSnapshots = config.get<boolean>("packMetaVersionHints.showSnapshots") ?? false;
        const hints: vscode.InlayHint[] = [];

        for (let i = range.start.line; i <= range.end.line && i < document.lineCount; i++) {
            const line = document.lineAt(i);
            const match = FORMAT_LINE_RE.exec(line.text);
            if (!match) {
                continue;
            }

            let label: string | null = null;
            if (match[3] && match[4]) {
                // Array [major, minor]
                const major = parseInt(match[3], 10);
                const minor = parseInt(match[4], 10);
                label = getVersionLabelWithMinor(major, minor, false, true);
            } else {
                // Single integer
                const format = parseInt(match[2], 10);
                label = getVersionLabel(format, false, true);
            }

            if (!label) {
                continue;
            }

            const hint = new vscode.InlayHint(
                new vscode.Position(i, line.text.trimEnd().length),
                ` ${label}`,
                vscode.InlayHintKind.Type,
            );
            hints.push(hint);
        }

        return hints;
    }
}

export function registerPackMetaInlayHints(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.languages.registerInlayHintsProvider(
            { pattern: "**/pack.mcmeta", scheme: "file" },
            new PackMetaInlayHintsProvider(),
        ),
    );
}

import * as vscode from "vscode";
import { DIAGNOSTIC_SOURCE } from "../constants";
import { t } from "../utils/i18n";

interface AtToken {
    fullMatch: string;
    selector: string;
    startIndex: number;
}

export function checkExecuteAtChain(lineIndex: number, line: string): vscode.Diagnostic | null {
    const trimmed = line.trim();
    if (!trimmed.startsWith("execute ")) {
        return null;
    }

    const atTokens = findAtTokens(line);
    if (atTokens.length < 2) {
        return null;
    }

    for (let i = 0; i < atTokens.length - 1; i++) {
        const currentToken = atTokens[i];
        const nextToken = atTokens[i + 1];

        const betweenText = line.substring(
            currentToken.startIndex + currentToken.fullMatch.length,
            nextToken.startIndex
        );
        if (hasAsBetween(betweenText)) {
            continue;
        }

        if (!hasSortNearestOrLimit(nextToken.selector)) {
            const range = new vscode.Range(
                lineIndex,
                currentToken.startIndex,
                lineIndex,
                currentToken.startIndex + currentToken.fullMatch.length
            );
            const diagnostic = new vscode.Diagnostic(range, t("executeAtChainRedundant"), vscode.DiagnosticSeverity.Warning);
            diagnostic.source = DIAGNOSTIC_SOURCE;
            diagnostic.code = "execute-at-chain-redundant";
            return diagnostic;
        }
    }

    return null;
}

function findAtTokens(line: string): AtToken[] {
    const tokens: AtToken[] = [];
    const regex = /\bat\s+(@[aepnrs](?:\[[^\]]*\])?)/g;
    let match;

    while ((match = regex.exec(line)) !== null) {
        tokens.push({
            fullMatch: match[0],
            selector: match[1],
            startIndex: match.index,
        });
    }

    return tokens;
}

function hasSortNearestOrLimit(selector: string): boolean {
    if (selector === "@p" || selector === "@n") {
        return true;
    }
    if (selector.startsWith("@p[") || selector.startsWith("@n[")) {
        return true;
    }
    if (/limit\s*=/.test(selector) && /sort\s*=\s*nearest/.test(selector)) {
        return true;
    }
    return false;
}

function hasAsBetween(text: string): boolean {
    return /(?<!\w)as\s+@/.test(text);
}


import * as vscode from "vscode";
import { DIAGNOSTIC_SOURCE } from "../constants";
import { t } from "../utils/i18n";
import { parseSelectors, parseArguments, SelectorArgument } from "./targetSelector";
import { RuleConfig, getRuleConfig } from "../utils/config";

const ITEM_NBT_KEYS = ["SelectedItem", "equipment", "Inventory", "EnderItems"];

function parseAllSelectors(line: string): Array<{ arguments: SelectorArgument[]; startIndex: number; endIndex: number }> {
    const selectors: Array<{ arguments: SelectorArgument[]; startIndex: number; endIndex: number }> = [];
    const regex = /@([aepnrs])(\[[^\]]*\])?/g;

    let match;
    while ((match = regex.exec(line)) !== null) {
        const argsRaw = match[2] || "";
        const args = parseArguments(argsRaw);

        selectors.push({
            arguments: args,
            startIndex: match.index,
            endIndex: match.index + match[0].length,
        });
    }

    return selectors;
}

function extractNbtKeys(nbtValue: string): string[] {
    const keys: string[] = [];
    
    if (!nbtValue.startsWith("{") || !nbtValue.endsWith("}")) {
        return keys;
    }

    const inner = nbtValue.slice(1, -1);
    let current = "";
    let depth = 0;
    let inString = false;
    let stringChar = "";

    for (let i = 0; i < inner.length; i++) {
        const char = inner[i];
        
        if ((char === '"' || char === "'") && (i === 0 || inner[i - 1] !== "\\")) {
            if (!inString) {
                inString = true;
                stringChar = char;
            } else if (char === stringChar) {
                inString = false;
                stringChar = "";
            }
            current += char;
        } else if (!inString) {
            if (char === "{" || char === "[") {
                depth++;
                current += char;
            } else if (char === "}" || char === "]") {
                depth--;
                current += char;
            } else if (char === ":" && depth === 0) {
                let key = current.trim();
                if (key.startsWith('"') && key.endsWith('"')) {
                    key = key.slice(1, -1);
                } else if (key.startsWith("'") && key.endsWith("'")) {
                    key = key.slice(1, -1);
                }
                if (key && !keys.includes(key)) {
                    keys.push(key);
                }
                current = "";
            } else if (char === "," && depth === 0) {
                current = "";
            } else {
                current += char;
            }
        } else {
            current += char;
        }
    }

    if (current.trim() && depth === 0) {
        let key = current.trim();
        if (key.startsWith('"') && key.endsWith('"')) {
            key = key.slice(1, -1);
        } else if (key.startsWith("'") && key.endsWith("'")) {
            key = key.slice(1, -1);
        }
        if (key && !keys.includes(key)) {
            keys.push(key);
        }
    }

    return keys;
}

export function checkNbtItems(lineIndex: number, line: string, config?: RuleConfig): vscode.Diagnostic[] {
    const diagnostics: vscode.Diagnostic[] = [];
    const effectiveConfig = config || getRuleConfig();
    if (!effectiveConfig.nbtItemsUseIfItems) {
        return diagnostics;
    }

    const selectors = parseAllSelectors(line);

    for (const selector of selectors) {
        for (const arg of selector.arguments) {
            if (arg.key === "nbt" && arg.value) {
                const nbtValue = arg.negated ? arg.value.slice(1) : arg.value;
                const keys = extractNbtKeys(nbtValue);
                
                const hasItemKey = ITEM_NBT_KEYS.some((key) => keys.includes(key));
                
                if (hasItemKey) {
                    const nbtArgStart = line.indexOf(arg.raw, selector.startIndex);
                    const nbtArgEnd = nbtArgStart + arg.raw.length;
                    const range = new vscode.Range(lineIndex, nbtArgStart, lineIndex, nbtArgEnd);
                    
                    const message = t("nbtItemsUseIfItems");
                    const diagnostic = new vscode.Diagnostic(
                        range,
                        message,
                        vscode.DiagnosticSeverity.Warning
                    );
                    diagnostic.source = DIAGNOSTIC_SOURCE;
                    diagnostic.code = "nbt-items-use-if-items";
                    
                    diagnostics.push(diagnostic);
                }
            }
        }
    }

    return diagnostics;
}


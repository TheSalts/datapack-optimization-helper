import * as vscode from "vscode";
import { DIAGNOSTIC_SOURCE } from "../constants";
import { createRemoveUnreachableFix } from "./unreachableFix";
import { createTargetSelectorNoDimensionFix, createTargetSelectorTypeOrderFix } from "./targetSelectorFix";
import { createExecuteGroupFix } from "./executeGroupFix";
import { createExecuteDuplicateFix, createExecuteUnnecessaryFix } from "./executeRedundantFix";
import {
    createExecuteRunRedundantFix,
    createExecuteRunRedundantNestedFix,
    createExecuteRunRedundantRunExecuteFix,
} from "./executeRunFix";
import { createExecuteAsSRedundantFix } from "./executeAsSFix";
import { createExecuteAsIfEntitySMergeFix, createExecuteAsIfEntitySConvertFix } from "./executeAsIfEntityFix";
import { createUnreachableConditionFix, createAlwaysPassConditionFix } from "./unreachableConditionFix";
import { createScoreboardFakePlayerFix } from "./scoreboardFakePlayerFix";
import { createReturnRunDuplicateFix } from "./returnRunDuplicateFix";
import { t, getLanguage } from "../utils/i18n";

export class McfunctionCodeActionProvider implements vscode.CodeActionProvider {
    provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range,
        context: vscode.CodeActionContext
    ): vscode.CodeAction[] {
        const actions: vscode.CodeAction[] = [];

        for (const diagnostic of context.diagnostics) {
            if (diagnostic.source !== DIAGNOSTIC_SOURCE) {
                continue;
            }

            const actionOrActions = this.createFixForDiagnostic(document, diagnostic);
            if (actionOrActions) {
                if (Array.isArray(actionOrActions)) {
                    actions.push(...actionOrActions);
                } else {
                    actions.push(actionOrActions);
                }
            }

            const suppressActions = this.createSuppressWarningFixes(document, diagnostic);
            actions.push(...suppressActions);
        }

        const fixAllAction = this.createFixAllAction(document);
        if (fixAllAction) {
            actions.push(fixAllAction);
        }

        return actions;
    }

    private createFixAllAction(document: vscode.TextDocument): vscode.CodeAction | undefined {
        const allDiagnostics = vscode.languages.getDiagnostics(document.uri);
        const ourDiagnostics = allDiagnostics.filter((d) => d.source === DIAGNOSTIC_SOURCE);

        if (ourDiagnostics.length === 0) {
            return undefined;
        }

        const skipRules = [
            "execute-group",
            "unreachable-condition",
            "always-pass-condition",
            "scoreboard-fake-player-missing-hash",
            "unreachable-code",
            "execute-duplicate",
            "execute-unnecessary",
            "execute-as-if-entity-s-merge",
            "execute-as-if-entity-s-convert",
            "return-run-duplicate",
        ];

        const fixableLines = new Set<number>();
        for (const diagnostic of ourDiagnostics) {
            const ruleCode = diagnostic.code as string;
            if (!skipRules.includes(ruleCode)) {
                fixableLines.add(diagnostic.range.start.line);
            }
        }

        if (fixableLines.size === 0) {
            return undefined;
        }

        const lineTexts = new Map<number, string>();
        for (const lineNum of fixableLines) {
            const originalText = document.lineAt(lineNum).text;
            const fixedText = this.applyAllFixes(originalText);
            if (fixedText !== originalText) {
                lineTexts.set(lineNum, fixedText);
            }
        }

        if (lineTexts.size === 0) {
            return undefined;
        }

        const fixAllAction = new vscode.CodeAction(t("fixAllAutoFixableFix"), vscode.CodeActionKind.QuickFix);
        fixAllAction.edit = new vscode.WorkspaceEdit();

        const sortedLines = Array.from(lineTexts.entries()).sort((a, b) => b[0] - a[0]);
        for (const [lineNum, newText] of sortedLines) {
            const line = document.lineAt(lineNum);
            fixAllAction.edit.replace(document.uri, line.range, newText);
        }

        return fixAllAction;
    }

    private applyAllFixes(text: string): string {
        let result = text;
        let changed = true;

        while (changed) {
            changed = false;
            const prev = result;

            // execute-as-s-redundant
            result = result.replace(/(?<!(positioned|rotated)\s)\bas\s+@s\s+/g, "");

            // execute-run-redundant-run-execute (before execute-run-redundant)
            result = result.replace(/(?<!return\s)run\s+execute\s+(?!run\b)/g, "");

            // execute-run-redundant-nested
            result = result.replace(/run\s+execute\s+run\s+/g, "run ");

            // execute-run-redundant (at start of line)
            result = result.replace(/^(\s*)execute\s+run\s+/, "$1");

            // target-selector-type-order
            result = result.replace(/@([aeprns])\[([^\]]*)\]/g, (match, selector: string, args: string) => {
                const typeMatch = args.match(/\btype\s*=\s*[^,\]]+/);
                if (typeMatch) {
                    const typeArg = typeMatch[0];
                    const otherArgs = args.replace(typeArg, "").replace(/^,|,$/g, "").replace(/,,/g, ",");
                    const newArgs = otherArgs ? `${otherArgs},${typeArg}` : typeArg;
                    return `@${selector}[${newArgs}]`;
                }
                return match;
            });

            // target-selector-no-dimension
            result = result.replace(/@([aeprns])\[([^\]]*)\]/g, (match, selector: string, args: string) => {
                const dimensionKeys = ["x", "y", "z", "dx", "dy", "dz", "distance"];
                const hasDimension = dimensionKeys.some((key) => new RegExp(`\\b${key}\\s*=`).test(args));
                if (!hasDimension) {
                    const newArgs = args ? `${args},distance=0..` : "distance=0..";
                    return `@${selector}[${newArgs}]`;
                }
                return match;
            });

            if (result !== prev) {
                changed = true;
            }
        }

        return result;
    }

    private applyFixToText(text: string, diagnostic: vscode.Diagnostic): string | null {
        switch (diagnostic.code) {
            case "execute-run-redundant":
                return text.replace(/^(\s*)execute\s+run\s+/, "$1");
            case "execute-run-redundant-nested":
                return text.replace(/run\s+execute\s+run\s+/g, "run ");
            case "execute-run-redundant-run-execute":
                return text.replace(/(?<!return\s)run\s+execute\s+/g, "");
            case "execute-as-s-redundant": {
                let result = text.replace(/(?<!(positioned|rotated)\s)\bas\s+@s\s+/g, "");
                if (/^(\s*)execute\s+run\s+/.test(result)) {
                    result = result.replace(/^(\s*)execute\s+run\s+/, "$1");
                }
                return result;
            }
            case "target-selector-no-dimension": {
                const match = text.match(/@[aeprns]\[([^\]]*)\]/);
                if (match) {
                    const args = match[1];
                    const newArgs = args ? `${args},distance=0..` : "distance=0..";
                    return text.replace(match[0], match[0].replace(`[${args}]`, `[${newArgs}]`));
                }
                return null;
            }
            case "target-selector-type-order": {
                const regex = /@[aeprns]\[([^\]]*)\]/g;
                return text.replace(regex, (match, args: string) => {
                    const typeMatch = args.match(/\btype\s*=\s*[^,\]]+/);
                    if (typeMatch) {
                        const typeArg = typeMatch[0];
                        const otherArgs = args.replace(typeArg, "").replace(/^,|,$/g, "").replace(/,,/g, ",");
                        const newArgs = otherArgs ? `${otherArgs},${typeArg}` : typeArg;
                        return match.replace(`[${args}]`, `[${newArgs}]`);
                    }
                    return match;
                });
            }
            case "scoreboard-fake-player-missing-hash": {
                const match = text.match(/scoreboard\s+players\s+\S+\s+\S+\s+(\S+)/);
                if (match && match[1] && !match[1].startsWith("#") && !match[1].startsWith("@")) {
                    return text.replace(match[1], `#${match[1]}`);
                }
                return null;
            }
            default:
                return null;
        }
    }

    private createSuppressWarningFixes(
        document: vscode.TextDocument,
        diagnostic: vscode.Diagnostic
    ): vscode.CodeAction[] {
        const actions: vscode.CodeAction[] = [];
        const ruleId = typeof diagnostic.code === "string" ? diagnostic.code : "";
        if (!ruleId) {
            return actions;
        }

        const lineAction = new vscode.CodeAction(t("warnOffLineFix", { ruleId }), vscode.CodeActionKind.QuickFix);
        lineAction.edit = new vscode.WorkspaceEdit();
        const lineNum = diagnostic.range.start.line;
        const insertPos = new vscode.Position(lineNum, 0);
        lineAction.edit.insert(document.uri, insertPos, `# warn-off ${ruleId}\n`);
        lineAction.diagnostics = [diagnostic];
        actions.push(lineAction);

        const fileAction = new vscode.CodeAction(t("warnOffFileFix", { ruleId }), vscode.CodeActionKind.QuickFix);
        fileAction.edit = new vscode.WorkspaceEdit();
        const fileInsertPos = new vscode.Position(0, 0);
        fileAction.edit.insert(document.uri, fileInsertPos, `# warn-off-file ${ruleId}\n`);
        fileAction.diagnostics = [diagnostic];
        actions.push(fileAction);

        const lang = getLanguage();
        const wikiPage = lang === "ko" ? "%EA%B7%9C%EC%B9%99" : "Rules";
        const docUrl = `https://github.com/TheSalts/datapack-optimization-helper/wiki/${wikiPage}#${ruleId}`;

        const docAction = new vscode.CodeAction(t("showDocumentationFix", { ruleId }), vscode.CodeActionKind.QuickFix);
        docAction.command = {
            title: t("showDocumentationFix", { ruleId }),
            command: "vscode.open",
            arguments: [vscode.Uri.parse(docUrl)],
        };
        docAction.diagnostics = [diagnostic];
        actions.push(docAction);

        return actions;
    }

    private createFixForDiagnostic(
        document: vscode.TextDocument,
        diagnostic: vscode.Diagnostic
    ): vscode.CodeAction | vscode.CodeAction[] | undefined {
        switch (diagnostic.code) {
            case "unreachable-code":
                return createRemoveUnreachableFix(document, diagnostic);
            case "target-selector-no-dimension":
                return createTargetSelectorNoDimensionFix(document, diagnostic);
            case "target-selector-type-order":
                return createTargetSelectorTypeOrderFix(document, diagnostic);
            case "execute-group":
                return createExecuteGroupFix(document, diagnostic);
            case "execute-run-redundant":
                return createExecuteRunRedundantFix(document, diagnostic);
            case "execute-run-redundant-nested":
                return createExecuteRunRedundantNestedFix(document, diagnostic);
            case "execute-run-redundant-run-execute":
                return createExecuteRunRedundantRunExecuteFix(document, diagnostic);
            case "execute-duplicate":
                return createExecuteDuplicateFix(document, diagnostic);
            case "execute-unnecessary":
                return createExecuteUnnecessaryFix(document, diagnostic);
            case "execute-as-s-redundant":
                return createExecuteAsSRedundantFix(document, diagnostic);
            case "execute-as-if-entity-s-merge":
                return createExecuteAsIfEntitySMergeFix(document, diagnostic);
            case "execute-as-if-entity-s-convert":
                return createExecuteAsIfEntitySConvertFix(document, diagnostic);
            case "unreachable-condition":
                return createUnreachableConditionFix(document, diagnostic);
            case "always-pass-condition":
                return createAlwaysPassConditionFix(document, diagnostic);
            case "scoreboard-fake-player-missing-hash":
                return createScoreboardFakePlayerFix(document, diagnostic);
            case "return-run-duplicate":
                return createReturnRunDuplicateFix(document, diagnostic);
            default:
                return undefined;
        }
    }
}

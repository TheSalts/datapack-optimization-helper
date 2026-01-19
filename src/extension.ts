import * as vscode from "vscode";
import { McfunctionCodeActionProvider } from "./codeActions/provider";
import { analyzeCommand } from "./rules";
import { isTerminatingCommand, createUnreachableDiagnostics } from "./unreachable";
import { registerRenameHandler } from "./refactor/renameHandler";
import { getPackMeta, watchPackMeta } from "./utils/packMeta";
import { checkExecuteGroup } from "./rules/executeGroup";
import { checkUnreachableCondition } from "./rules/unreachableCondition";
import { checkAlwaysPassCondition } from "./rules/alwaysPassCondition";
import { checkInfiniteRecursion } from "./rules/infiniteRecursion";
import { indexWorkspace, watchMcfunctionFiles } from "./analyzer/functionIndex";
import {
    getRuleConfig,
    watchDatapackConfig,
    clearDatapackConfigCache,
    checkAndNotifyConfigMissing,
} from "./utils/config";
import { registerReferencesCodeLens } from "./providers/referencesCodeLens";
import { t } from "./utils/i18n";
import { parseWarnOffFile, getDisabledRulesForLine, isRuleDisabled, ALL_RULE_IDS } from "./utils/warnOff";
import { registerConditionDefinition } from "./providers/conditionDefinition";

let diagnosticCollection: vscode.DiagnosticCollection;

export async function activate(context: vscode.ExtensionContext) {
    console.log("Datapack Optimization extension activated");
    diagnosticCollection = vscode.languages.createDiagnosticCollection("datapack-optimization");
    context.subscriptions.push(diagnosticCollection);

    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider(
            { pattern: "**/*.mcfunction", scheme: "file" },
            new McfunctionCodeActionProvider(),
            { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] },
        ),
    );

    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            { pattern: "**/*.mcfunction", scheme: "file" },
            new WarnOffCompletionProvider(),
            " ",
        ),
    );

    const debounceTimers = new Map<string, NodeJS.Timeout>();
    context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(analyzeDocument));
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument((e) => {
            const uri = e.document.uri.toString();
            const existing = debounceTimers.get(uri);
            if (existing) {
                clearTimeout(existing);
            }
            debounceTimers.set(
                uri,
                setTimeout(() => {
                    debounceTimers.delete(uri);
                    analyzeDocument(e.document);
                }, 300),
            );
        }),
    );
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (editor) {
                analyzeDocument(editor.document);
            }
        }),
    );
    context.subscriptions.push(vscode.workspace.onDidCloseTextDocument((doc) => diagnosticCollection.delete(doc.uri)));
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration("datapackOptimization")) {
                console.log("Configuration changed, reanalyzing documents");
                const mcfunctionDocs = vscode.workspace.textDocuments.filter((doc) => isMcfunction(doc));
                console.log(`Found ${mcfunctionDocs.length} mcfunction documents`);
                mcfunctionDocs.forEach((doc) => {
                    analyzeDocument(doc);
                });
            }
        }),
    );

    registerRenameHandler(context);
    watchPackMeta(context);
    watchDatapackConfig(context, () => {
        const mcfunctionDocs = vscode.workspace.textDocuments.filter((doc) => isMcfunction(doc));
        mcfunctionDocs.forEach((doc) => analyzeDocument(doc));
    });
    getPackMeta();
    watchMcfunctionFiles(context);

    const codeLensProvider = registerReferencesCodeLens(context);
    registerConditionDefinition(context);

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: t("initializing"),
        },
        async () => {
            await indexWorkspace();
            codeLensProvider.refresh();
            vscode.workspace.textDocuments.forEach(analyzeDocument);
        },
    );

    checkAndNotifyConfigMissing(context);
}

class WarnOffCompletionProvider implements vscode.CompletionItemProvider {
    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
    ): vscode.CompletionItem[] | undefined {
        const lineText = document.lineAt(position.line).text;
        const textBeforeCursor = lineText.substring(0, position.character);

        if (!/^#\s*warn-off(-file)?\s+/i.test(textBeforeCursor)) {
            return undefined;
        }

        const items: vscode.CompletionItem[] = [];

        for (const ruleId of ALL_RULE_IDS) {
            const item = new vscode.CompletionItem(ruleId, vscode.CompletionItemKind.EnumMember);
            items.push(item);
        }

        return items;
    }
}

function isMcfunction(document: vscode.TextDocument): boolean {
    return document.fileName.endsWith(".mcfunction") || document.languageId === "mcfunction";
}

function analyzeDocument(document: vscode.TextDocument) {
    if (!isMcfunction(document)) {
        return;
    }

    const diagnostics: vscode.Diagnostic[] = [];
    const text = document.getText();
    const lines = text.split(/\r?\n/);

    const fileDisabledRules = parseWarnOffFile(lines);
    let unreachableFrom: number | null = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();

        if (trimmedLine.startsWith("#") || trimmedLine === "") {
            continue;
        }

        if (unreachableFrom !== null) {
            continue;
        }

        if (isTerminatingCommand(trimmedLine)) {
            unreachableFrom = i + 1;
        }

        const lineDiagnostics = analyzeCommand(i, line);
        const lineDisabledRules = getDisabledRulesForLine(lines, i, fileDisabledRules);
        for (const diag of lineDiagnostics) {
            const ruleId = typeof diag.code === "string" ? diag.code : "";
            if (!isRuleDisabled(ruleId, lineDisabledRules)) {
                diagnostics.push(diag);
            }
        }
    }

    const config = getRuleConfig();
    if (config.executeGroup && !isRuleDisabled("execute-group", fileDisabledRules)) {
        const groupDiags = checkExecuteGroup(lines);
        for (const diag of groupDiags) {
            const lineDisabled = getDisabledRulesForLine(lines, diag.range.start.line, fileDisabledRules);
            if (!isRuleDisabled("execute-group", lineDisabled)) {
                diagnostics.push(diag);
            }
        }
    }
    if (config.unreachableCondition && !isRuleDisabled("unreachable-condition", fileDisabledRules)) {
        const condDiags = checkUnreachableCondition(lines, document.uri.fsPath);
        for (const diag of condDiags) {
            const lineDisabled = getDisabledRulesForLine(lines, diag.range.start.line, fileDisabledRules);
            if (!isRuleDisabled("unreachable-condition", lineDisabled)) {
                diagnostics.push(diag);
            }
        }
    }

    if (config.alwaysPassCondition && !isRuleDisabled("always-pass-condition", fileDisabledRules)) {
        const alwaysPassResult = checkAlwaysPassCondition(lines, document.uri.fsPath);
        for (const diag of alwaysPassResult.diagnostics) {
            const lineDisabled = getDisabledRulesForLine(lines, diag.range.start.line, fileDisabledRules);
            if (!isRuleDisabled("always-pass-condition", lineDisabled)) {
                diagnostics.push(diag);
            }
        }

        if (alwaysPassResult.alwaysReturns.length > 0) {
            const firstReturn = alwaysPassResult.alwaysReturns[0];
            const alwaysPassUnreachableFrom = firstReturn.line + 1;

            if (unreachableFrom === null || alwaysPassUnreachableFrom < unreachableFrom) {
                unreachableFrom = alwaysPassUnreachableFrom;
            }
        }
    }

    if (config.infiniteRecursion && !isRuleDisabled("infinite-recursion", fileDisabledRules)) {
        const recursionDiags = checkInfiniteRecursion(document, config);
        for (const diag of recursionDiags) {
            const lineDisabled = getDisabledRulesForLine(lines, diag.range.start.line, fileDisabledRules);
            if (!isRuleDisabled("infinite-recursion", lineDisabled)) {
                diagnostics.push(diag);
            }
        }
    }

    if (config.unreachableCode && !isRuleDisabled("unreachable-code", fileDisabledRules) && unreachableFrom !== null) {
        const unreachableDiagnostics = createUnreachableDiagnostics(lines, unreachableFrom);
        for (const diag of unreachableDiagnostics) {
            const lineDisabled = getDisabledRulesForLine(lines, diag.range.start.line, fileDisabledRules);
            if (!isRuleDisabled("unreachable-code", lineDisabled)) {
                diagnostics.push(diag);
            }
        }
    }

    diagnosticCollection.set(document.uri, diagnostics);
}

export function deactivate() {
    if (diagnosticCollection) {
        diagnosticCollection.dispose();
    }
}

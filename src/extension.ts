import * as vscode from "vscode";
import { McfunctionCodeActionProvider } from "./codeActions/provider";
import { analyzeCommand } from "./rules";
import { isTerminatingCommand, createUnreachableDiagnostics } from "./unreachable";
import { registerRenameHandler } from "./refactor/renameHandler";
import { getPackMeta, watchPackMeta } from "./utils/packMeta";
import { checkExecuteGroup } from "./rules/executeGroup";
import { getDiagnosticData } from "./utils/diagnosticData";
import { checkUnreachableCondition } from "./rules/unreachableCondition";
import { checkAlwaysPassCondition } from "./rules/alwaysPassCondition";
import { checkInfiniteRecursion } from "./rules/infiniteRecursion";
import { checkMacroSafety } from "./rules/macroSafety";
import { checkScoreboardDivideByZero } from "./rules/scoreboardDivideByZero";
import { checkScoreboardOverflow } from "./rules/scoreboardOverflow";
import { indexWorkspace, watchMcfunctionFiles } from "./analyzer/functionIndex";
import { getRuleConfig, watchDatapackConfig, checkAndNotifyConfigMissing } from "./utils/config";
import { registerReferencesCodeLens } from "./providers/referencesCodeLens";
import { t } from "./utils/i18n";
import { parseWarnOffFile, getDisabledRulesForLine, isRuleDisabled, ALL_RULE_IDS } from "./utils/warnOff";
import { registerConditionDefinition } from "./providers/conditionDefinition";
import { registerScoreboardInlayHints } from "./providers/scoreboardInlayHints";
import { registerScoreboardHover } from "./providers/scoreboardHover";
import { addTestScoreCommand } from "./commands/addTestScore";
import { showDependencyGraph } from "./commands/dependencyGraph";
import { fetchVersionData } from "./utils/versionData";
import { registerPackMetaCompletion } from "./providers/packMetaCompletion";
import { registerPackMetaInlayHints } from "./providers/packMetaInlayHints";
import { registerConfigCompletion } from "./providers/configCompletion";

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
    context.subscriptions.push(
        vscode.workspace.onDidCloseTextDocument((doc) => {
            diagnosticCollection.delete(doc.uri);
            const uri = doc.uri.toString();
            const existing = debounceTimers.get(uri);
            if (existing) {
                clearTimeout(existing);
                debounceTimers.delete(uri);
            }
        }),
    );
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

    context.subscriptions.push(
        vscode.commands.registerCommand("datapackOptimization.addTestScore", addTestScoreCommand),
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("datapackOptimization.showDependencyGraph", showDependencyGraph),
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
    registerScoreboardInlayHints(context);
    registerScoreboardHover(context);
    registerPackMetaCompletion(context);
    registerPackMetaInlayHints(context);
    registerConfigCompletion(context);

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: t("initializing"),
        },
        async () => {
            await Promise.all([indexWorkspace(), fetchVersionData()]);
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

function pushFilteredDiagnostics(
    diagnostics: vscode.Diagnostic[],
    newDiags: vscode.Diagnostic[],
    lineDisabledRules: Set<string>,
): void {
    for (const diag of newDiags) {
        const ruleId = typeof diag.code === "string" ? diag.code : "";
        if (!isRuleDisabled(ruleId, lineDisabledRules)) {
            diagnostics.push(diag);
        }
    }
}

function pushFilteredFileDiagnostics(
    diagnostics: vscode.Diagnostic[],
    newDiags: vscode.Diagnostic[],
    ruleId: string,
    lines: string[],
    fileDisabledRules: Set<string>,
    getCheckLine?: (diag: vscode.Diagnostic) => number,
): void {
    for (const diag of newDiags) {
        const checkLine = getCheckLine ? getCheckLine(diag) : diag.range.start.line;
        const lineDisabled = getDisabledRulesForLine(lines, checkLine, fileDisabledRules);
        if (!isRuleDisabled(ruleId, lineDisabled)) {
            diagnostics.push(diag);
        }
    }
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

        const lineDisabledRules = getDisabledRulesForLine(lines, i, fileDisabledRules);
        const lineDiagnostics = analyzeCommand(i, line);
        pushFilteredDiagnostics(diagnostics, lineDiagnostics, lineDisabledRules);
    }

    const config = getRuleConfig();
    if (config.executeGroup && !isRuleDisabled("execute-group", fileDisabledRules)) {
        pushFilteredFileDiagnostics(
            diagnostics,
            checkExecuteGroup(lines),
            "execute-group",
            lines,
            fileDisabledRules,
            (diag) => getDiagnosticData<{ lineIndices?: number[] }>(diag)?.lineIndices?.[0] ?? diag.range.start.line,
        );
    }
    if (config.unreachableCondition && !isRuleDisabled("unreachable-condition", fileDisabledRules)) {
        pushFilteredFileDiagnostics(
            diagnostics,
            checkUnreachableCondition(lines, document.uri.fsPath),
            "unreachable-condition",
            lines,
            fileDisabledRules,
        );
    }

    if (config.scoreboardDivideByZero && !isRuleDisabled("scoreboard-divide-by-zero", fileDisabledRules)) {
        pushFilteredFileDiagnostics(
            diagnostics,
            checkScoreboardDivideByZero(lines, document.uri.fsPath),
            "scoreboard-divide-by-zero",
            lines,
            fileDisabledRules,
        );
    }

    if (config.scoreboardOverflow && !isRuleDisabled("scoreboard-overflow", fileDisabledRules)) {
        pushFilteredFileDiagnostics(
            diagnostics,
            checkScoreboardOverflow(lines, document.uri.fsPath),
            "scoreboard-overflow",
            lines,
            fileDisabledRules,
        );
    }

    if (config.alwaysPassCondition && !isRuleDisabled("always-pass-condition", fileDisabledRules)) {
        const alwaysPassResult = checkAlwaysPassCondition(lines, document.uri.fsPath);
        pushFilteredFileDiagnostics(
            diagnostics,
            alwaysPassResult.diagnostics,
            "always-pass-condition",
            lines,
            fileDisabledRules,
        );

        if (alwaysPassResult.alwaysReturns.length > 0) {
            const firstReturn = alwaysPassResult.alwaysReturns[0];
            const alwaysPassUnreachableFrom = firstReturn.line + 1;

            if (unreachableFrom === null || alwaysPassUnreachableFrom < unreachableFrom) {
                unreachableFrom = alwaysPassUnreachableFrom;
            }
        }
    }

    if (config.infiniteRecursion && !isRuleDisabled("infinite-recursion", fileDisabledRules)) {
        pushFilteredFileDiagnostics(
            diagnostics,
            checkInfiniteRecursion(document, config),
            "infinite-recursion",
            lines,
            fileDisabledRules,
        );
    }

    if (config.macroFunctionWithoutWith && !isRuleDisabled("macro-function-without-with", fileDisabledRules)) {
        pushFilteredFileDiagnostics(
            diagnostics,
            checkMacroSafety(document, config),
            "macro-function-without-with",
            lines,
            fileDisabledRules,
        );
    }

    if (config.unreachableCode && !isRuleDisabled("unreachable-code", fileDisabledRules) && unreachableFrom !== null) {
        pushFilteredFileDiagnostics(
            diagnostics,
            createUnreachableDiagnostics(lines, unreachableFrom),
            "unreachable-code",
            lines,
            fileDisabledRules,
        );
    }

    diagnosticCollection.set(document.uri, diagnostics);
}

export function deactivate() {
    if (diagnosticCollection) {
        diagnosticCollection.dispose();
    }
}

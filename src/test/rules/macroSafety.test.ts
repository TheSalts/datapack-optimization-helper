import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import { FunctionIndex } from "../../analyzer/functionIndex";
import { checkMacroSafety, isInsideString } from "../../rules/macroSafety";
import { ALL_RULE_IDS, RuleConfig } from "../../utils/config";

function createEnabledConfig(): RuleConfig {
    const config: Record<string, boolean> = {};
    for (const id of ALL_RULE_IDS) {
        const camel = id.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        config[camel] = true;
    }
    return config as RuleConfig;
}

function createMockDocument(filePath: string, content: string): vscode.TextDocument {
    const lines = content.split(/\r?\n/);
    return {
        uri: vscode.Uri.file(filePath),
        lineCount: lines.length,
        lineAt: (line: number) => ({
            text: lines[line],
        }),
    } as unknown as vscode.TextDocument;
}

suite("isInsideString", () => {
    test("returns false outside strings", () => {
        const line = "function test:macro";
        assert.strictEqual(isInsideString(line, 0), false);
    });

    test("returns true inside double-quoted string", () => {
        const line = 'tellraw @a {"text":"function test:macro"}';
        assert.strictEqual(isInsideString(line, line.indexOf("function")), true);
    });

    test("returns true inside single-quoted string", () => {
        const line = "data modify storage test:s a set value 'function test:macro'";
        assert.strictEqual(isInsideString(line, line.indexOf("function")), true);
    });

    test("handles escaped quotes inside string", () => {
        const line = 'tellraw @a {"text":"say \\"function test:macro\\""}';
        assert.strictEqual(isInsideString(line, line.indexOf("function")), true);
    });

    test("handles escaped backslash before closing quote", () => {
        const line = 'say "foo\\\\" function test:macro';
        assert.strictEqual(isInsideString(line, line.indexOf("function")), false);
    });

    test("handles mismatched quote types inside string", () => {
        const line1 = 'tellraw @a {"text":"don\'t function test:macro"}';
        assert.strictEqual(isInsideString(line1, line1.indexOf("function")), true);

        const line2 = "summon text_display ~ ~ ~ {text:'{\"text\":\"function test:macro\"}'}";
        assert.strictEqual(isInsideString(line2, line2.indexOf("function")), true);
    });
});

suite("checkMacroSafety", () => {
    let tempDir: string;
    let originalWorkspaceFolders: readonly vscode.WorkspaceFolder[] | undefined;

    setup(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "macro-safety-test-"));
        originalWorkspaceFolders = vscode.workspace.workspaceFolders;
        (vscode.workspace as { workspaceFolders?: vscode.WorkspaceFolder[] }).workspaceFolders = [
            { uri: vscode.Uri.file(tempDir), name: "test", index: 0 },
        ];
    });

    teardown(() => {
        (vscode.workspace as { workspaceFolders?: readonly vscode.WorkspaceFolder[] }).workspaceFolders =
            originalWorkspaceFolders;
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    async function setupWorkspace(callerContent: string): Promise<{
        callerDoc: vscode.TextDocument;
        index: FunctionIndex;
    }> {
        const funcDir = path.join(tempDir, "data", "test", "function");
        fs.mkdirSync(funcDir, { recursive: true });

        const macroPath = path.join(funcDir, "macro_fn.mcfunction");
        fs.writeFileSync(macroPath, "$say $(msg)\n", "utf-8");

        const callerPath = path.join(funcDir, "caller.mcfunction");
        fs.writeFileSync(callerPath, callerContent, "utf-8");

        const index = new FunctionIndex();
        await index.indexWorkspace();

        return {
            callerDoc: createMockDocument(callerPath, callerContent),
            index,
        };
    }

    test("reports diagnostic for macro call without with", async () => {
        const { callerDoc, index } = await setupWorkspace("function test:macro_fn");
        const diagnostics = checkMacroSafety(callerDoc, createEnabledConfig(), index);
        assert.strictEqual(diagnostics.length, 1);
        assert.strictEqual(diagnostics[0].code, "macro-function-without-with");
    });

    test("ignores macro call inside double-quoted string", async () => {
        const content = [
            'tellraw @a {"text":"function test:macro_fn"}',
            'tellraw @a {"clickEvent":{"action":"run_command","value":"/function test:macro_fn"}}',
            'say "function test:macro_fn"',
        ].join("\n");
        const { callerDoc, index } = await setupWorkspace(content);
        const diagnostics = checkMacroSafety(callerDoc, createEnabledConfig(), index);
        assert.strictEqual(diagnostics.length, 0);
    });

    test("ignores macro call inside single-quoted string", async () => {
        const content = [
            "data modify storage test:s cmd set value 'function test:macro_fn'",
            "summon text_display ~ ~ ~ {text:'{\"text\":\"function test:macro_fn\"}'}",
        ].join("\n");
        const { callerDoc, index } = await setupWorkspace(content);
        const diagnostics = checkMacroSafety(callerDoc, createEnabledConfig(), index);
        assert.strictEqual(diagnostics.length, 0);
    });

    test("flags real call after string on same line", async () => {
        const content = 'execute if data storage test:s {cmd:"function test:macro_fn"} run function test:macro_fn';
        const { callerDoc, index } = await setupWorkspace(content);
        const diagnostics = checkMacroSafety(callerDoc, createEnabledConfig(), index);
        assert.strictEqual(diagnostics.length, 1);
        const range = diagnostics[0].range as unknown as { startCharacter: number };
        assert.strictEqual(range.startCharacter, content.lastIndexOf("function"));
    });

    test("allows real call with arguments after string on same line", async () => {
        const content =
            'execute if data storage test:s {cmd:"function test:macro_fn"} run function test:macro_fn with storage test:s';
        const { callerDoc, index } = await setupWorkspace(content);
        const diagnostics = checkMacroSafety(callerDoc, createEnabledConfig(), index);
        assert.strictEqual(diagnostics.length, 0);
    });
});

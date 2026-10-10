import * as assert from "assert";
import { checkMacroSafety } from "../../rules/macroSafety";
import { functionIndexInstance } from "../../analyzer/functionIndex";
import { RuleConfig } from "../../utils/config";

suite("checkMacroSafety", () => {
    const callerFunction = "test:caller";
    const macroFunction = "test:macro";
    const filePath = "/workspace/data/test/function/caller.mcfunction";
    let originalGetFunctionInfoByFile: typeof functionIndexInstance.getFunctionInfoByFile;
    let originalGetFunctionInfo: typeof functionIndexInstance.getFunctionInfo;

    setup(() => {
        originalGetFunctionInfoByFile = functionIndexInstance.getFunctionInfoByFile.bind(functionIndexInstance);
        originalGetFunctionInfo = functionIndexInstance.getFunctionInfo.bind(functionIndexInstance);

        (functionIndexInstance as any).getFunctionInfoByFile = () => ({
            namespace: "test",
            path: "caller",
            fullPath: callerFunction,
            filePath,
            calls: [{ functionName: macroFunction, line: 0, isConditional: false, hasUnconditionalReturnBefore: false }],
            scoreChanges: [],
            hasMacro: false,
            macroArgs: [],
        });

        (functionIndexInstance as any).getFunctionInfo = (functionName: string) => {
            if (functionName === macroFunction) {
                return {
                    namespace: "test",
                    path: "macro",
                    fullPath: macroFunction,
                    filePath: "/workspace/data/test/function/macro.mcfunction",
                    calls: [],
                    scoreChanges: [],
                    hasMacro: true,
                    macroArgs: ["arg"],
                };
            }

            return undefined;
        };
    });

    teardown(() => {
        (functionIndexInstance as any).getFunctionInfoByFile = originalGetFunctionInfoByFile;
        (functionIndexInstance as any).getFunctionInfo = originalGetFunctionInfo;
    });

    function createDocument(line: string) {
        return {
            uri: { fsPath: filePath },
            lineAt: () => ({ text: line }),
        } as any;
    }

    test("reports direct function command with onlyFullCommands enabled", () => {
        const diagnostics = checkMacroSafety(
            createDocument(`function ${macroFunction}`),
            { macroFunctionWithoutWith: true } as RuleConfig,
            true,
        );
        assert.strictEqual(diagnostics.length, 1);
    });

    test("ignores embedded function string with onlyFullCommands enabled", () => {
        const diagnostics = checkMacroSafety(
            createDocument(`data modify storage foo:bar exe set value {cmd:{args:{},run:"function ${macroFunction}"}}`),
            { macroFunctionWithoutWith: true } as RuleConfig,
            true,
        );
        assert.strictEqual(diagnostics.length, 0);
    });

    test("keeps legacy behavior when onlyFullCommands is disabled", () => {
        const diagnostics = checkMacroSafety(
            createDocument(`data modify storage foo:bar exe set value {cmd:{args:{},run:"function ${macroFunction}"}}`),
            { macroFunctionWithoutWith: true } as RuleConfig,
            false,
        );
        assert.strictEqual(diagnostics.length, 1);
    });
});

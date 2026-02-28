import * as assert from "assert";
import {
    fixExecuteRunRedundant,
    fixExecuteRunRedundantNested,
    fixExecuteRunRedundantRunExecute,
} from "../../codeActions/executeRunFix";

suite("fixExecuteRunRedundant", () => {
    test("removes leading execute run", () => {
        assert.strictEqual(fixExecuteRunRedundant("execute run scoreboard players set #a v 1"), "scoreboard players set #a v 1");
    });

    test("preserves indentation", () => {
        assert.strictEqual(fixExecuteRunRedundant("  execute run say hi"), "  say hi");
    });

    test("returns null when no match", () => {
        assert.strictEqual(fixExecuteRunRedundant("execute as @a run say hi"), null);
    });

    test("returns null for non-execute line", () => {
        assert.strictEqual(fixExecuteRunRedundant("say hello"), null);
    });

    test("handles extra whitespace", () => {
        assert.strictEqual(fixExecuteRunRedundant("execute  run  say hi"), "say hi");
    });
});

suite("fixExecuteRunRedundantNested", () => {
    test("removes nested run execute run", () => {
        const result = fixExecuteRunRedundantNested("execute as @a run execute run say hi");
        assert.strictEqual(result, "execute as @a run say hi");
    });

    test("returns null when no match", () => {
        assert.strictEqual(fixExecuteRunRedundantNested("execute as @a run say hi"), null);
    });

    test("handles extra whitespace", () => {
        const result = fixExecuteRunRedundantNested("execute as @a run  execute  run  say hi");
        assert.strictEqual(result, "execute as @a run say hi");
    });
});

suite("fixExecuteRunRedundantRunExecute", () => {
    test("removes run execute (non-run following)", () => {
        const result = fixExecuteRunRedundantRunExecute("execute as @a run execute as @s say hi");
        assert.strictEqual(result, "execute as @a as @s say hi");
    });

    test("does NOT remove when 'return' precedes", () => {
        assert.strictEqual(fixExecuteRunRedundantRunExecute("return run execute say hi"), null);
    });

    test("does NOT remove when 'run' follows execute", () => {
        assert.strictEqual(fixExecuteRunRedundantRunExecute("execute as @a run execute run say hi"), null);
    });

    test("returns null when no match", () => {
        assert.strictEqual(fixExecuteRunRedundantRunExecute("execute as @a run say hi"), null);
    });
});

import * as assert from "assert";
import { fixExecuteAsS } from "../../codeActions/executeAsSFix";

suite("fixExecuteAsS", () => {
    test("removes as @s", () => {
        assert.strictEqual(fixExecuteAsS("execute as @s run say hi"), "say hi");
    });

    test("removes as @s with other subcommands", () => {
        assert.strictEqual(fixExecuteAsS("execute as @s at @s run say hi"), "execute at @s run say hi");
    });

    test("does NOT remove after positioned", () => {
        assert.strictEqual(fixExecuteAsS("execute positioned as @s run say hi"), null);
    });

    test("does NOT remove after rotated", () => {
        assert.strictEqual(fixExecuteAsS("execute rotated as @s run say hi"), null);
    });

    test("returns null for non-matching line", () => {
        assert.strictEqual(fixExecuteAsS("execute as @a run say hi"), null);
    });

    test("removes multiple as @s", () => {
        const result = fixExecuteAsS("execute as @s at @s as @s run say hi");
        assert.ok(result !== null);
        assert.ok(!result.includes("as @s"));
    });

    test("cleans up execute run after removal", () => {
        assert.strictEqual(fixExecuteAsS("execute as @s run say hi"), "say hi");
    });
});

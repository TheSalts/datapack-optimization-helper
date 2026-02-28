import * as assert from "assert";
import { fixTargetSelectorTypeOrder, fixTargetSelectorNoDimension } from "../../codeActions/targetSelectorFix";

suite("fixTargetSelectorTypeOrder", () => {
    test("moves type to end", () => {
        const result = fixTargetSelectorTypeOrder("kill @e[type=zombie,tag=foo]");
        assert.strictEqual(result, "kill @e[tag=foo,type=zombie]");
    });

    test("returns null if type is already last", () => {
        assert.strictEqual(fixTargetSelectorTypeOrder("kill @e[tag=foo,type=zombie]"), null);
    });

    test("returns null for no type arg", () => {
        assert.strictEqual(fixTargetSelectorTypeOrder("kill @e[tag=foo]"), null);
    });

    test("does NOT move negated type", () => {
        assert.strictEqual(fixTargetSelectorTypeOrder("kill @e[type=!zombie,tag=foo]"), null);
    });

    test("does NOT move tag type (#)", () => {
        assert.strictEqual(fixTargetSelectorTypeOrder("kill @e[type=#my_tag,tag=foo]"), null);
    });

    test("handles multiple selectors", () => {
        const result = fixTargetSelectorTypeOrder("execute as @e[type=zombie,tag=a] at @e[type=pig,tag=b] run say hi");
        assert.ok(result);
        assert.ok(result.includes("@e[tag=a,type=zombie]"));
        assert.ok(result.includes("@e[tag=b,type=pig]"));
    });
});

suite("fixTargetSelectorNoDimension", () => {
    test("adds distance=0.. when no dimension key", () => {
        const result = fixTargetSelectorNoDimension("kill @e[type=zombie]");
        assert.strictEqual(result, "kill @e[type=zombie,distance=0..]");
    });

    test("returns null if distance already exists", () => {
        assert.strictEqual(fixTargetSelectorNoDimension("kill @e[distance=..5]"), null);
    });

    test("returns null if x exists", () => {
        assert.strictEqual(fixTargetSelectorNoDimension("kill @e[x=0]"), null);
    });

    test("returns null if dx exists", () => {
        assert.strictEqual(fixTargetSelectorNoDimension("kill @e[dx=5]"), null);
    });

    test("handles bare selector", () => {
        const result = fixTargetSelectorNoDimension("kill @e[]");
        assert.strictEqual(result, "kill @e[distance=0..]");
    });
});

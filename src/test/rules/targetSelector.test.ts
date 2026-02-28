import * as assert from "assert";
import { parseSelectors, parseArguments } from "../../rules/targetSelector";

suite("parseSelectors", () => {
    test("parses bare @e", () => {
        const selectors = parseSelectors("kill @e");
        assert.strictEqual(selectors.length, 1);
        assert.strictEqual(selectors[0].type, "e");
        assert.strictEqual(selectors[0].arguments.length, 0);
    });

    test("parses @e with args", () => {
        const selectors = parseSelectors("kill @e[type=zombie,tag=foo]");
        assert.strictEqual(selectors.length, 1);
        assert.strictEqual(selectors[0].type, "e");
        assert.strictEqual(selectors[0].arguments.length, 2);
        assert.strictEqual(selectors[0].arguments[0].key, "type");
        assert.strictEqual(selectors[0].arguments[0].value, "zombie");
        assert.strictEqual(selectors[0].arguments[1].key, "tag");
    });

    test("parses multiple selectors", () => {
        const selectors = parseSelectors("execute as @e[type=zombie] at @n run say hi");
        assert.strictEqual(selectors.length, 2);
    });

    test("detects negated values", () => {
        const selectors = parseSelectors("kill @e[type=!player]");
        assert.strictEqual(selectors[0].arguments[0].negated, true);
        assert.strictEqual(selectors[0].arguments[0].value, "player");
    });

    test("tracks startIndex and endIndex", () => {
        const selectors = parseSelectors("kill @e[type=zombie]");
        assert.strictEqual(selectors[0].startIndex, 5);
        assert.strictEqual(selectors[0].endIndex, 20);
    });

    test("no selectors on plain line", () => {
        const selectors = parseSelectors("say hello world");
        assert.strictEqual(selectors.length, 0);
    });
});

suite("parseArguments", () => {
    test("empty args", () => {
        assert.deepStrictEqual(parseArguments(""), []);
        assert.deepStrictEqual(parseArguments("[]"), []);
    });

    test("single argument", () => {
        const args = parseArguments("[type=zombie]");
        assert.strictEqual(args.length, 1);
        assert.strictEqual(args[0].key, "type");
        assert.strictEqual(args[0].value, "zombie");
        assert.strictEqual(args[0].negated, false);
    });

    test("negated argument", () => {
        const args = parseArguments("[type=!player]");
        assert.strictEqual(args[0].negated, true);
        assert.strictEqual(args[0].value, "player");
    });

    test("multiple arguments", () => {
        const args = parseArguments("[type=zombie,tag=foo,distance=..5]");
        assert.strictEqual(args.length, 3);
    });

    test("handles nested braces (scores)", () => {
        const args = parseArguments("[scores={a=1..5},tag=foo]");
        assert.strictEqual(args.length, 2);
        assert.strictEqual(args[0].key, "scores");
    });

    test("returns null for key-only (no = sign)", () => {
        const args = parseArguments("[noequals]");
        assert.strictEqual(args.length, 0);
    });
});

import * as assert from "assert";
import { parseArgs, findSelectors, extractSelector } from "../../parser/selectorParser";

suite("parseArgs", () => {
    test("empty string returns empty array", () => {
        assert.deepStrictEqual(parseArgs(""), []);
    });

    test("single key=value", () => {
        const result = parseArgs("type=player");
        assert.strictEqual(result.length, 1);
        assert.strictEqual(result[0].key, "type");
        assert.strictEqual(result[0].raw, "type=player");
    });

    test("multiple args", () => {
        const result = parseArgs("type=player,tag=foo,distance=..5");
        assert.strictEqual(result.length, 3);
        assert.strictEqual(result[0].key, "type");
        assert.strictEqual(result[1].key, "tag");
        assert.strictEqual(result[2].key, "distance");
    });

    test("nested braces are preserved", () => {
        const result = parseArgs("nbt={Items:[{id:\"stone\"}]},type=player");
        assert.strictEqual(result.length, 2);
        assert.strictEqual(result[0].key, "nbt");
        assert.ok(result[0].raw.includes("{Items:[{id:\"stone\"}]}"));
    });

    test("nested brackets in scores", () => {
        const result = parseArgs("scores={foo=1..5,bar=10},tag=test");
        assert.strictEqual(result.length, 2);
        assert.strictEqual(result[0].key, "scores");
        assert.strictEqual(result[1].key, "tag");
    });

    test("whitespace trimming", () => {
        const result = parseArgs(" type = player , tag = foo ");
        assert.strictEqual(result.length, 2);
        assert.strictEqual(result[0].key, "type");
    });
});

suite("findSelectors", () => {
    test("finds @e selector", () => {
        const results = findSelectors("execute as @e[type=player] run say hi");
        assert.strictEqual(results.length, 1);
        assert.strictEqual(results[0].raw, "@e[type=player]");
    });

    test("finds @n selector", () => {
        const results = findSelectors("tp @n[type=villager] ~ ~1 ~");
        assert.strictEqual(results.length, 1);
        assert.strictEqual(results[0].raw, "@n[type=villager]");
    });

    test("default selectorTypes only matches @e and @n", () => {
        const results = findSelectors("execute as @a at @s run tp @e ~ ~ ~");
        assert.strictEqual(results.length, 1);
        assert.strictEqual(results[0].raw, "@e");
    });

    test("custom selectorTypes matches all specified", () => {
        const results = findSelectors("execute as @a at @s run tp @e ~ ~ ~", "aepnrs");
        assert.strictEqual(results.length, 3);
    });

    test("selector with nested NBT", () => {
        const results = findSelectors("kill @e[nbt={Items:[{id:\"stone\"}]}]");
        assert.strictEqual(results.length, 1);
        assert.strictEqual(results[0].raw, "@e[nbt={Items:[{id:\"stone\"}]}]");
    });

    test("bare selector without brackets", () => {
        const results = findSelectors("kill @e");
        assert.strictEqual(results.length, 1);
        assert.strictEqual(results[0].raw, "@e");
    });

    test("no selectors returns empty", () => {
        const results = findSelectors("say hello world");
        assert.strictEqual(results.length, 0);
    });

    test("tracks startIndex and endIndex", () => {
        const results = findSelectors("kill @e[type=zombie]");
        assert.strictEqual(results[0].startIndex, 5);
        assert.strictEqual(results[0].endIndex, 20);
    });

    test("skips selector inside quotes", () => {
        const results = findSelectors('tellraw @a {"selector":"@e[type=pig]"}', "aepnrs");
        // @a should be found, but "@e inside quotes should be skipped
        const found = results.map((r) => r.raw);
        assert.ok(found.includes("@a"));
    });
});

suite("extractSelector", () => {
    test("extracts selector at position", () => {
        const result = extractSelector("kill @e[type=zombie]", 5);
        assert.ok(result);
        assert.strictEqual(result.raw, "@e[type=zombie]");
        assert.strictEqual(result.startIndex, 5);
        assert.strictEqual(result.endIndex, 20);
    });

    test("extracts bare selector", () => {
        const result = extractSelector("kill @e", 5);
        assert.ok(result);
        assert.strictEqual(result.raw, "@e");
    });

    test("returns null for invalid start", () => {
        assert.strictEqual(extractSelector("kill @e", -1), null);
        assert.strictEqual(extractSelector("kill @e", 100), null);
        assert.strictEqual(extractSelector("kill @e", 0), null); // 'k' is not '@'
    });

    test("handles nested brackets", () => {
        const result = extractSelector("@e[scores={a=1}]", 0);
        assert.ok(result);
        assert.strictEqual(result.raw, "@e[scores={a=1}]");
    });
});

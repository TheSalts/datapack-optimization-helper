import * as assert from "assert";
import { tokenize } from "../../parser/tokenizer";

suite("tokenizer", () => {
    test("simple command tokens", () => {
        const tokens = tokenize("execute as @a run say hello");
        assert.deepStrictEqual(
            tokens.map((t) => t.text),
            ["execute", "as", "@a", "run", "say", "hello"],
        );
    });

    test("tracks start/end positions", () => {
        const tokens = tokenize("say hello");
        assert.strictEqual(tokens[0].start, 0);
        assert.strictEqual(tokens[0].end, 3);
        assert.strictEqual(tokens[1].start, 4);
        assert.strictEqual(tokens[1].end, 9);
    });

    test("preserves brackets as single token", () => {
        const tokens = tokenize("execute as @e[type=player] run say hi");
        assert.deepStrictEqual(
            tokens.map((t) => t.text),
            ["execute", "as", "@e[type=player]", "run", "say", "hi"],
        );
    });

    test("preserves braces as single token", () => {
        const tokens = tokenize('data merge entity @s {Health:20}');
        const texts = tokens.map((t) => t.text);
        assert.ok(texts.includes("{Health:20}"));
    });

    test("nested brackets/braces", () => {
        const tokens = tokenize("execute as @e[nbt={Items:[{id:\"stone\"}]}] run kill @s");
        assert.deepStrictEqual(
            tokens.map((t) => t.text),
            ["execute", "as", "@e[nbt={Items:[{id:\"stone\"}]}]", "run", "kill", "@s"],
        );
    });

    test("quoted strings kept together", () => {
        const tokens = tokenize('tellraw @a {"text":"hello world"}');
        const texts = tokens.map((t) => t.text);
        assert.ok(texts.includes('{"text":"hello world"}'));
    });

    test("empty string returns empty array", () => {
        const tokens = tokenize("");
        assert.deepStrictEqual(tokens, []);
    });

    test("leading spaces are handled", () => {
        const tokens = tokenize("  say hello");
        assert.strictEqual(tokens[0].text, "say");
        assert.strictEqual(tokens[0].start, 2);
    });

    test("multiple spaces between tokens", () => {
        const tokens = tokenize("say   hello");
        assert.deepStrictEqual(
            tokens.map((t) => t.text),
            ["say", "hello"],
        );
    });

    test("escaped quotes in strings", () => {
        const tokens = tokenize('tellraw @a {"text":"say \\"hi\\""}');
        // The escaped quotes should keep the braces as one token
        assert.strictEqual(tokens.length, 3);
    });
});

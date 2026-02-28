import * as assert from "assert";
import {
    FUNCTION_REF_RE,
    FUNCTION_CALL_RE,
    IF_FUNCTION_CALL_RE,
    SCORE_SET_RE,
    SCORE_ADD_RE,
    SCORE_RESET_RE,
    SCORE_OPERATION_RE,
    SCORE_STORE_RE,
    SCORE_CONDITION_RE,
} from "../../parser/patterns";

suite("FUNCTION_REF_RE", () => {
    test("matches namespace:path", () => {
        assert.ok(FUNCTION_REF_RE.test("my_pack:foo/bar"));
    });
    test("matches with dots and dashes", () => {
        assert.ok(FUNCTION_REF_RE.test("my-pack.v2:some.func"));
    });
    test("does not match bare word", () => {
        assert.ok(!FUNCTION_REF_RE.test("nocolon"));
    });
});

suite("FUNCTION_CALL_RE", () => {
    test("matches simple function call", () => {
        const m = "function my:func".match(FUNCTION_CALL_RE);
        assert.ok(m);
        assert.strictEqual(m![1], "my:func");
    });
    test("matches execute run function", () => {
        const m = "execute as @a run function my:func".match(FUNCTION_CALL_RE);
        assert.ok(m);
        assert.strictEqual(m![1], "my:func");
    });
    test("matches macro function call", () => {
        const m = "$execute as @a run function my:func".match(FUNCTION_CALL_RE);
        assert.ok(m);
        assert.strictEqual(m![1], "my:func");
    });
    test("does not match non-function line", () => {
        assert.ok(!"say hello".match(FUNCTION_CALL_RE));
    });
});

suite("IF_FUNCTION_CALL_RE", () => {
    test("matches if function", () => {
        const m = "execute if function my:check run say hi".match(IF_FUNCTION_CALL_RE);
        assert.ok(m);
        assert.strictEqual(m![1], "if");
        assert.strictEqual(m![2], "my:check");
    });
    test("matches unless function", () => {
        const m = "execute unless function my:check run say hi".match(IF_FUNCTION_CALL_RE);
        assert.ok(m);
        assert.strictEqual(m![1], "unless");
    });
});

suite("SCORE_SET_RE", () => {
    test("matches scoreboard players set", () => {
        const m = "scoreboard players set #temp var 10".match(SCORE_SET_RE);
        assert.ok(m);
        assert.strictEqual(m![1], "#temp");
        assert.strictEqual(m![2], "var");
        assert.strictEqual(m![3], "10");
    });
    test("matches negative value", () => {
        const m = "scoreboard players set #temp var -5".match(SCORE_SET_RE);
        assert.ok(m);
        assert.strictEqual(m![3], "-5");
    });
    test("matches with execute prefix", () => {
        const m = "execute as @a run scoreboard players set @s var 1".match(SCORE_SET_RE);
        assert.ok(m);
    });
});

suite("SCORE_ADD_RE", () => {
    test("matches add", () => {
        const m = "scoreboard players add #temp var 5".match(SCORE_ADD_RE);
        assert.ok(m);
        assert.strictEqual(m![1], "add");
        assert.strictEqual(m![2], "#temp");
        assert.strictEqual(m![3], "var");
        assert.strictEqual(m![4], "5");
    });
    test("matches remove", () => {
        const m = "scoreboard players remove #temp var 3".match(SCORE_ADD_RE);
        assert.ok(m);
        assert.strictEqual(m![1], "remove");
    });
});

suite("SCORE_RESET_RE", () => {
    test("matches reset with objective", () => {
        const m = "scoreboard players reset #temp var".match(SCORE_RESET_RE);
        assert.ok(m);
        assert.strictEqual(m![1], "#temp");
        assert.strictEqual(m![2], "var");
    });
    test("matches reset without objective", () => {
        const m = "scoreboard players reset #temp".match(SCORE_RESET_RE);
        assert.ok(m);
        assert.strictEqual(m![1], "#temp");
        assert.strictEqual(m![2], undefined);
    });
});

suite("SCORE_OPERATION_RE", () => {
    test("matches operation", () => {
        const m = "scoreboard players operation #a var += #b var".match(SCORE_OPERATION_RE);
        assert.ok(m);
        assert.strictEqual(m![1], "#a");
        assert.strictEqual(m![2], "var");
        assert.strictEqual(m![3], "+=");
        assert.strictEqual(m![4], "#b");
        assert.strictEqual(m![5], "var");
    });
});

suite("SCORE_STORE_RE", () => {
    test("matches store result", () => {
        const m = "execute store result score #temp var run time query daytime".match(SCORE_STORE_RE);
        assert.ok(m);
        assert.strictEqual(m![1], "result");
        assert.strictEqual(m![2], "#temp");
        assert.strictEqual(m![3], "var");
    });
    test("matches store success", () => {
        const m = "execute store success score #temp var run say hi".match(SCORE_STORE_RE);
        assert.ok(m);
        assert.strictEqual(m![1], "success");
    });
});

suite("SCORE_CONDITION_RE", () => {
    test("matches if score matches", () => {
        const m = "execute if score #temp var matches 1..5 run say hi".match(SCORE_CONDITION_RE);
        assert.ok(m);
        assert.strictEqual(m![1], "if");
        assert.strictEqual(m![2], "#temp");
        assert.strictEqual(m![3], "var");
        assert.strictEqual(m![4], "1..5");
    });
    test("matches unless score matches", () => {
        const m = "execute unless score #temp var matches 0 run say hi".match(SCORE_CONDITION_RE);
        assert.ok(m);
        assert.strictEqual(m![1], "unless");
    });
});

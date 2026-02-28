import * as assert from "assert";
import {
    parseRange,
    matchesRange,
    isConditionUnreachable,
    isConditionAlwaysTrue,
    isExecuteConditional,
    applyScoreChange,
    processScoreboardLine,
    loadInheritedScoreStates,
    ScoreState,
} from "../../analyzer/scoreTracker";

suite("parseRange", () => {
    test("single value", () => {
        const r = parseRange("5");
        assert.strictEqual(r.min, 5);
        assert.strictEqual(r.max, 5);
    });

    test("range with both bounds", () => {
        const r = parseRange("1..10");
        assert.strictEqual(r.min, 1);
        assert.strictEqual(r.max, 10);
    });

    test("range with only min", () => {
        const r = parseRange("5..");
        assert.strictEqual(r.min, 5);
        assert.strictEqual(r.max, null);
    });

    test("range with only max", () => {
        const r = parseRange("..10");
        assert.strictEqual(r.min, null);
        assert.strictEqual(r.max, 10);
    });

    test("negative values", () => {
        const r = parseRange("-5..5");
        assert.strictEqual(r.min, -5);
        assert.strictEqual(r.max, 5);
    });

    test("NaN returns null bounds", () => {
        const r = parseRange("abc");
        assert.strictEqual(r.min, null);
        assert.strictEqual(r.max, null);
    });
});

suite("matchesRange", () => {
    test("value in range", () => {
        assert.strictEqual(matchesRange(5, { min: 1, max: 10 }), true);
    });

    test("value below range", () => {
        assert.strictEqual(matchesRange(0, { min: 1, max: 10 }), false);
    });

    test("value above range", () => {
        assert.strictEqual(matchesRange(11, { min: 1, max: 10 }), false);
    });

    test("value at boundary", () => {
        assert.strictEqual(matchesRange(1, { min: 1, max: 10 }), true);
        assert.strictEqual(matchesRange(10, { min: 1, max: 10 }), true);
    });

    test("open min", () => {
        assert.strictEqual(matchesRange(-100, { min: null, max: 10 }), true);
    });

    test("open max", () => {
        assert.strictEqual(matchesRange(9999, { min: 5, max: null }), true);
    });

    test("both null", () => {
        assert.strictEqual(matchesRange(42, { min: null, max: null }), true);
    });
});

suite("isConditionUnreachable", () => {
    test("unknown state is never unreachable", () => {
        const state: ScoreState = { target: "#a", objective: "v", type: "unknown", value: null, line: 0 };
        assert.strictEqual(isConditionUnreachable(state, "if", "1..5"), false);
    });

    test("reset state with if is unreachable", () => {
        const state: ScoreState = { target: "#a", objective: "v", type: "reset", value: null, line: 0 };
        assert.strictEqual(isConditionUnreachable(state, "if", "1..5"), true);
    });

    test("reset state with unless is not unreachable", () => {
        const state: ScoreState = { target: "#a", objective: "v", type: "reset", value: null, line: 0 };
        assert.strictEqual(isConditionUnreachable(state, "unless", "1..5"), false);
    });

    test("known value outside if range is unreachable", () => {
        const state: ScoreState = { target: "#a", objective: "v", type: "known", value: 20, line: 0 };
        assert.strictEqual(isConditionUnreachable(state, "if", "1..10"), true);
    });

    test("known value inside if range is NOT unreachable", () => {
        const state: ScoreState = { target: "#a", objective: "v", type: "known", value: 5, line: 0 };
        assert.strictEqual(isConditionUnreachable(state, "if", "1..10"), false);
    });

    test("known value inside unless range IS unreachable", () => {
        const state: ScoreState = { target: "#a", objective: "v", type: "known", value: 5, line: 0 };
        assert.strictEqual(isConditionUnreachable(state, "unless", "1..10"), true);
    });
});

suite("isConditionAlwaysTrue", () => {
    test("unknown is never always true", () => {
        const state: ScoreState = { target: "#a", objective: "v", type: "unknown", value: null, line: 0 };
        assert.strictEqual(isConditionAlwaysTrue(state, "if", "1..5"), false);
    });

    test("known value in if range is always true", () => {
        const state: ScoreState = { target: "#a", objective: "v", type: "known", value: 3, line: 0 };
        assert.strictEqual(isConditionAlwaysTrue(state, "if", "1..5"), true);
    });

    test("known value outside unless range is always true", () => {
        const state: ScoreState = { target: "#a", objective: "v", type: "known", value: 20, line: 0 };
        assert.strictEqual(isConditionAlwaysTrue(state, "unless", "1..10"), true);
    });

    test("known value in unless range is NOT always true", () => {
        const state: ScoreState = { target: "#a", objective: "v", type: "known", value: 5, line: 0 };
        assert.strictEqual(isConditionAlwaysTrue(state, "unless", "1..10"), false);
    });
});

suite("isExecuteConditional", () => {
    test("non-execute line is not conditional", () => {
        assert.strictEqual(isExecuteConditional("say hello", new Map()), false);
    });

    test("execute with if is conditional", () => {
        assert.strictEqual(isExecuteConditional("execute if entity @s run say hi", new Map()), true);
    });

    test("execute store only (no conditional subcommand) is not conditional", () => {
        assert.strictEqual(
            isExecuteConditional("execute store result score #a v run time query daytime", new Map()),
            false,
        );
    });

    test("execute with as is conditional", () => {
        assert.strictEqual(isExecuteConditional("execute as @a run say hi", new Map()), true);
    });

    test("always-true score condition makes it non-conditional", () => {
        const states = new Map<string, ScoreState>();
        states.set("#a:v", { target: "#a", objective: "v", type: "known", value: 5, line: 0 });
        assert.strictEqual(
            isExecuteConditional("execute if score #a v matches 1..10 run say hi", states),
            false,
        );
    });
});

suite("applyScoreChange", () => {
    test("set operation creates known state", () => {
        const states = new Map<string, ScoreState>();
        applyScoreChange(states, { target: "#a", objective: "v", operation: "set", value: 10, isConditional: false }, 0);
        const state = states.get("#a:v");
        assert.ok(state);
        assert.strictEqual(state.type, "known");
        assert.strictEqual(state.value, 10);
    });

    test("conditional makes state unknown", () => {
        const states = new Map<string, ScoreState>();
        applyScoreChange(states, { target: "#a", objective: "v", operation: "set", value: 10, isConditional: true }, 0);
        const state = states.get("#a:v");
        assert.ok(state);
        assert.strictEqual(state.type, "unknown");
    });

    test("add to known value", () => {
        const states = new Map<string, ScoreState>();
        states.set("#a:v", { target: "#a", objective: "v", type: "known", value: 10, line: 0 });
        applyScoreChange(states, { target: "#a", objective: "v", operation: "add", value: 5, isConditional: false }, 1);
        assert.strictEqual(states.get("#a:v")!.value, 15);
    });

    test("remove from known value", () => {
        const states = new Map<string, ScoreState>();
        states.set("#a:v", { target: "#a", objective: "v", type: "known", value: 10, line: 0 });
        applyScoreChange(states, { target: "#a", objective: "v", operation: "remove", value: 3, isConditional: false }, 1);
        assert.strictEqual(states.get("#a:v")!.value, 7);
    });

    test("reset creates reset state", () => {
        const states = new Map<string, ScoreState>();
        states.set("#a:v", { target: "#a", objective: "v", type: "known", value: 10, line: 0 });
        applyScoreChange(states, { target: "#a", objective: "v", operation: "reset", value: null, isConditional: false }, 1);
        assert.strictEqual(states.get("#a:v")!.type, "reset");
        assert.strictEqual(states.get("#a:v")!.value, null);
    });
});

suite("processScoreboardLine", () => {
    test("processes set command", () => {
        const states = new Map<string, ScoreState>();
        const result = processScoreboardLine("scoreboard players set #temp var 42", states, 0);
        assert.strictEqual(result, true);
        assert.strictEqual(states.get("#temp:var")!.value, 42);
    });

    test("processes add command", () => {
        const states = new Map<string, ScoreState>();
        states.set("#temp:var", { target: "#temp", objective: "var", type: "known", value: 10, line: 0 });
        processScoreboardLine("scoreboard players add #temp var 5", states, 1);
        assert.strictEqual(states.get("#temp:var")!.value, 15);
    });

    test("processes reset command", () => {
        const states = new Map<string, ScoreState>();
        states.set("#temp:var", { target: "#temp", objective: "var", type: "known", value: 10, line: 0 });
        processScoreboardLine("scoreboard players reset #temp var", states, 1);
        assert.strictEqual(states.get("#temp:var")!.type, "reset");
    });

    test("processes operation command", () => {
        const states = new Map<string, ScoreState>();
        states.set("#a:v", { target: "#a", objective: "v", type: "known", value: 10, line: 0 });
        states.set("#b:v", { target: "#b", objective: "v", type: "known", value: 3, line: 0 });
        processScoreboardLine("scoreboard players operation #a v += #b v", states, 1);
        assert.strictEqual(states.get("#a:v")!.value, 13);
    });

    test("non-scoreboard line returns false", () => {
        const states = new Map<string, ScoreState>();
        assert.strictEqual(processScoreboardLine("say hello", states, 0), false);
    });

    test("skips @-targeted commands", () => {
        const states = new Map<string, ScoreState>();
        processScoreboardLine("scoreboard players set @s var 42", states, 0);
        assert.strictEqual(states.size, 0);
    });
});

suite("loadInheritedScoreStates", () => {
    test("loads known values", () => {
        const inherited = new Map([["#a:v", { target: "#a", objective: "v", value: 10 }]]);
        const states = new Map<string, ScoreState>();
        loadInheritedScoreStates(inherited, states);
        assert.strictEqual(states.get("#a:v")!.type, "known");
        assert.strictEqual(states.get("#a:v")!.value, 10);
    });

    test("loads null values as unknown", () => {
        const inherited = new Map([["#a:v", { target: "#a", objective: "v", value: null }]]);
        const states = new Map<string, ScoreState>();
        loadInheritedScoreStates(inherited, states);
        assert.strictEqual(states.get("#a:v")!.type, "unknown");
    });
});

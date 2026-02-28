import * as assert from "assert";
import { processTestScoreLine, collectScoreReferences } from "../../parser/testScore";
import { ScoreState } from "../../analyzer/scoreTracker";

suite("processTestScoreLine", () => {
    test("parses test-score comment", () => {
        const states = new Map<string, ScoreState>();
        const result = processTestScoreLine("# test-score #temp var 42", states, 0);
        assert.strictEqual(result, true);
        const state = states.get("#temp:var");
        assert.ok(state);
        assert.strictEqual(state.type, "known");
        assert.strictEqual(state.value, 42);
        assert.strictEqual(state.target, "#temp");
        assert.strictEqual(state.objective, "var");
    });

    test("parses negative value", () => {
        const states = new Map<string, ScoreState>();
        processTestScoreLine("# test-score #x obj -10", states, 5);
        const state = states.get("#x:obj");
        assert.ok(state);
        assert.strictEqual(state.value, -10);
        assert.strictEqual(state.line, 5);
    });

    test("returns false for non-matching line", () => {
        const states = new Map<string, ScoreState>();
        assert.strictEqual(processTestScoreLine("# this is a comment", states, 0), false);
        assert.strictEqual(processTestScoreLine("scoreboard players set #a var 1", states, 0), false);
        assert.strictEqual(states.size, 0);
    });

    test("case insensitive", () => {
        const states = new Map<string, ScoreState>();
        assert.strictEqual(processTestScoreLine("# TEST-SCORE #a var 1", states, 0), true);
    });
});

suite("collectScoreReferences", () => {
    test("collects from set command", () => {
        const refs = collectScoreReferences(["scoreboard players set #temp var 10"]);
        assert.strictEqual(refs.length, 1);
        assert.strictEqual(refs[0].target, "#temp");
        assert.strictEqual(refs[0].objective, "var");
    });

    test("collects from add command", () => {
        const refs = collectScoreReferences(["scoreboard players add #temp var 5"]);
        assert.strictEqual(refs.length, 1);
        assert.strictEqual(refs[0].target, "#temp");
    });

    test("collects from operation (both sides)", () => {
        const refs = collectScoreReferences(["scoreboard players operation #a var += #b obj"]);
        assert.strictEqual(refs.length, 2);
        assert.ok(refs.some((r) => r.target === "#a" && r.objective === "var"));
        assert.ok(refs.some((r) => r.target === "#b" && r.objective === "obj"));
    });

    test("collects from store", () => {
        const refs = collectScoreReferences(["execute store result score #temp var run time query daytime"]);
        assert.strictEqual(refs.length, 1);
        assert.strictEqual(refs[0].target, "#temp");
    });

    test("collects from condition", () => {
        const refs = collectScoreReferences(["execute if score #temp var matches 1..5 run say hi"]);
        assert.strictEqual(refs.length, 1);
    });

    test("deduplicates references", () => {
        const refs = collectScoreReferences([
            "scoreboard players set #temp var 10",
            "scoreboard players add #temp var 5",
        ]);
        assert.strictEqual(refs.length, 1);
    });

    test("skips empty lines and comments", () => {
        const refs = collectScoreReferences(["", "# comment", "scoreboard players set #a var 1"]);
        assert.strictEqual(refs.length, 1);
    });

    test("collects from reset with objective", () => {
        const refs = collectScoreReferences(["scoreboard players reset #temp var"]);
        assert.strictEqual(refs.length, 1);
    });

    test("does not collect from reset without objective", () => {
        const refs = collectScoreReferences(["scoreboard players reset #temp"]);
        assert.strictEqual(refs.length, 0);
    });
});

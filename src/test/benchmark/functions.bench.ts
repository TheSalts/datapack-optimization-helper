import { performance } from "perf_hooks";
import { tokenize } from "../../parser/tokenizer";
import { parseArgs, findSelectors } from "../../parser/selectorParser";
import { parseRange, matchesRange, isConditionAlwaysTrue, isConditionUnreachable, ScoreState } from "../../analyzer/scoreTracker";
import { fixExecuteRunRedundant, fixExecuteRunRedundantNested, fixExecuteRunRedundantRunExecute } from "../../codeActions/executeRunFix";
import { fixExecuteAsS } from "../../codeActions/executeAsSFix";
import { fixTargetSelectorTypeOrder } from "../../codeActions/targetSelectorFix";

interface BenchResult {
    name: string;
    iterations: number;
    avgMs: number;
    minMs: number;
    maxMs: number;
    opsPerSec: number;
}

function bench(name: string, fn: () => void, iterations = 10000): BenchResult {
    // Warmup
    for (let i = 0; i < 100; i++) { fn(); }

    const times: number[] = [];
    for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        fn();
        times.push(performance.now() - start);
    }

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);

    return {
        name,
        iterations,
        avgMs: avg,
        minMs: min,
        maxMs: max,
        opsPerSec: 1000 / avg,
    };
}

function printResults(results: BenchResult[]) {
    const nameWidth = Math.max(40, ...results.map((r) => r.name.length));
    const header = `${"Function".padEnd(nameWidth)} | ${"Iters".padStart(7)} | ${"Avg (ms)".padStart(12)} | ${"Min (ms)".padStart(12)} | ${"Max (ms)".padStart(12)} | ${"ops/sec".padStart(12)}`;
    const separator = "-".repeat(header.length);

    console.log("\n" + separator);
    console.log(header);
    console.log(separator);

    for (const r of results) {
        console.log(
            `${r.name.padEnd(nameWidth)} | ${String(r.iterations).padStart(7)} | ${r.avgMs.toFixed(6).padStart(12)} | ${r.minMs.toFixed(6).padStart(12)} | ${r.maxMs.toFixed(6).padStart(12)} | ${r.opsPerSec.toFixed(0).padStart(12)}`,
        );
    }
    console.log(separator + "\n");
}

// Test inputs
const simpleLine = "execute as @a run say hello";
const complexLine = "execute as @e[type=zombie,nbt={Health:20},tag=wave1] at @s positioned ~ ~1 ~ run tp @s ~ ~ ~";
const selectorArgs = "type=zombie,nbt={Health:20},tag=wave1,scores={kills=1..5}";
const redundantLine = "execute run scoreboard players set #a v 1";
const nestedRedundant = "execute as @a run execute run say hi";
const runExecuteLine = "execute as @a run execute as @s say hi";
const asSLine = "execute as @s at @s run say hi";
const typeOrderLine = "kill @e[type=zombie,tag=foo,distance=..5]";

suite("Function Benchmarks", () => {
    test("benchmark all functions", function () {
        this.timeout(30000);

        const results: BenchResult[] = [];

        // Parser functions
        results.push(bench("tokenize (simple)", () => tokenize(simpleLine)));
        results.push(bench("tokenize (complex)", () => tokenize(complexLine)));
        results.push(bench("parseArgs (4 args w/ nested)", () => parseArgs(selectorArgs)));
        results.push(bench("findSelectors (default @e/@n)", () => findSelectors(complexLine)));
        results.push(bench("findSelectors (all types)", () => findSelectors(complexLine, "aepnrs")));

        // Score tracker functions
        results.push(bench("parseRange (bounded)", () => parseRange("1..10")));
        results.push(bench("parseRange (single)", () => parseRange("5")));
        results.push(bench("parseRange (open)", () => parseRange("5..")));
        results.push(bench("matchesRange (in range)", () => matchesRange(5, { min: 1, max: 10 })));
        results.push(bench("matchesRange (out of range)", () => matchesRange(20, { min: 1, max: 10 })));

        const knownState: ScoreState = { target: "#a", objective: "v", type: "known", value: 5, line: 0 };
        results.push(bench("isConditionAlwaysTrue", () => isConditionAlwaysTrue(knownState, "if", "1..10")));
        results.push(bench("isConditionUnreachable", () => isConditionUnreachable(knownState, "if", "10..20")));

        // Fix functions
        results.push(bench("fixExecuteRunRedundant (match)", () => fixExecuteRunRedundant(redundantLine)));
        results.push(bench("fixExecuteRunRedundant (no match)", () => fixExecuteRunRedundant(simpleLine)));
        results.push(bench("fixExecuteRunRedundantNested", () => fixExecuteRunRedundantNested(nestedRedundant)));
        results.push(bench("fixExecuteRunRedundantRunExecute", () => fixExecuteRunRedundantRunExecute(runExecuteLine)));
        results.push(bench("fixExecuteAsS", () => fixExecuteAsS(asSLine)));
        results.push(bench("fixTargetSelectorTypeOrder", () => fixTargetSelectorTypeOrder(typeOrderLine)));

        printResults(results);
    });
});

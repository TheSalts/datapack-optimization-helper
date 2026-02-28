/** Short fixture — 10 lines of simple commands */
export const SHORT_FIXTURE = [
    "scoreboard players set #temp var 10",
    "scoreboard players add #temp var 5",
    "execute as @e[type=zombie] run kill @s",
    "say hello world",
    "function my:other_func",
    "scoreboard players operation #a var += #b var",
    "execute if score #temp var matches 1..15 run say yes",
    "# comment line",
    "scoreboard players reset #temp var",
    "tp @e[type=pig] ~ ~1 ~",
];

/** Medium fixture — 100 lines with diverse patterns */
export const MEDIUM_FIXTURE: string[] = [];
{
    // Scoreboard operations
    for (let i = 0; i < 20; i++) {
        MEDIUM_FIXTURE.push(`scoreboard players set #var${i} obj ${i * 10}`);
    }
    // Execute chains
    for (let i = 0; i < 15; i++) {
        MEDIUM_FIXTURE.push(`execute as @e[type=zombie,tag=wave${i}] at @s run tp @s ~ ~1 ~`);
    }
    // Redundant execute run
    for (let i = 0; i < 10; i++) {
        MEDIUM_FIXTURE.push(`execute run scoreboard players add #counter obj 1`);
    }
    // Conditions
    for (let i = 0; i < 10; i++) {
        MEDIUM_FIXTURE.push(`execute if score #var${i} obj matches ${i}..${i + 10} run say match ${i}`);
    }
    // Function calls
    for (let i = 0; i < 10; i++) {
        MEDIUM_FIXTURE.push(`function my_pack:tick/sub_${i}`);
    }
    // Operations
    for (let i = 0; i < 10; i++) {
        MEDIUM_FIXTURE.push(`scoreboard players operation #var${i} obj += #var${i + 1} obj`);
    }
    // Comments and blanks
    for (let i = 0; i < 10; i++) {
        MEDIUM_FIXTURE.push(`# Section ${i}`);
    }
    // Mixed: as @s, nested selectors
    for (let i = 0; i < 10; i++) {
        MEDIUM_FIXTURE.push(`execute as @s at @s run tp @e[type=villager,distance=..5] ~ ~1 ~`);
    }
    // Store
    for (let i = 0; i < 5; i++) {
        MEDIUM_FIXTURE.push(`execute store result score #time${i} obj run time query daytime`);
    }
}

/** Large fixture — 500 lines stress test */
export const LARGE_FIXTURE: string[] = [];
{
    for (let round = 0; round < 5; round++) {
        for (const line of MEDIUM_FIXTURE) {
            LARGE_FIXTURE.push(line);
        }
    }
}

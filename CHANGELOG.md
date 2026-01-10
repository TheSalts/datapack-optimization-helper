# Change Log

## 1.0.26

### Features

-   Added `infinite-recursion` rule to detect infinite recursion calls

## 1.0.25

Fixed tracking score with conditional `return`

## 1.0.24

### Features

-   When using navigation for unreachable/always-pass conditions, if source cannot be found, prompts to report issue

### Fixes

-   Fixed false positive when score is set by only some callers
-   Fixed macro function calls (`$execute ... run function`) not being tracked

## 1.0.23

### Features

-   Added navigation for unreachable/always-pass conditions
    -   Ctrl+Click on `if` or `unless` keyword to jump to the score assignment location
-   Fixed multiline execute commands (with `\`) not being parsed correctly for score tracking

## 1.0.22

Fixed `execute-as-if-entity-s-merge` should not be suggested when `if entity @s` precedes `as`

## 1.0.21

Fixed `targetSelectorNoType` and `targetSelectorNoDimension` should not be detected with `@s`

## 1.0.20

Fixed `scoreboard fake player` doesn't detect `@n` as a target selector

## 1.0.19

Added `npm run pub`

## 1.0.18

Fixed `target-selector-no-dimension` doesn't work with all quick fix

## 1.0.17

### Features

-   Added project-level configuration with `datapack.config.json`
    -   Place in the same folder as `pack.mcmeta`
    -   Configure disabled rules and execute group settings per project
    -   Project settings override user settings
    -   Autocomplete support for rule IDs in config file
-   Added notification to create `datapack.config.json` when opening a datapack workspace

## 1.0.16

Fixed [multiple execute summon false positive](https://github.com/TheSalts/datapack-optimization-helper/issues/9)

## 1.0.15

### Features

-   Added "Show Documentation" quick fix with wiki links
-   Added detection for conflicting score conditions in the same line (e.g., `if score @s foo matches 1 if score @s foo matches 2`)

### Fixes

-   Fixed "Fix All" quick fix not applying all fixes at once
-   Fixed `scores` and `advancements` selector arguments not merging correctly in `execute-as-if-entity-s-convert`

### Documentation

-   Added wiki documentation for all rules ([English](https://github.com/TheSalts/datapack-optimization-helper/wiki/Rules), [한국어](https://github.com/TheSalts/datapack-optimization-helper/wiki/%EA%B7%9C%EC%B9%99))

## 1.0.14

Refactored quick fixes

Fixed [string is interpreted as selector](https://github.com/TheSalts/datapack-optimization-helper/issues/8)

## 1.0.13

Added `# warn-off` comment to suppress warnings for specific lines or files

-   `# warn-off` - Suppress all warnings for the next line
-   `# warn-off rule-id` - Suppress specific rule for the next line
-   `# warn-off-file` - Suppress all warnings for the entire file
-   `# warn-off-file rule-id` - Suppress specific rule for the entire file
-   Quick Fix: "Suppress warning for this line"
-   Autocomplete support for rule IDs

## 1.0.12

Fixed [Function grouping is broken with `execute summon`](https://github.com/TheSalts/datapack-optimization-helper/issues/7)

## 1.0.11

Fixed [Wrong merge `as` with `unless entity`](https://github.com/TheSalts/datapack-optimization-helper/issues/6)

Fixed warning message now correctly displays `if` or `unless`

Fixed quick fix merge now places `type` at the end of selector

## 1.0.10

Fixed dx,dy,dz limit dimension but unexpected

## 1.0.9

Added Function References feature

Fixed [Scoreboard tracking is broken when using function with `execute if/unless`](https://github.com/TheSalts/datapack-optimization-helper/issues/5)

## 1.0.8

Fixed README images

## 1.0.7

Added configuration options for function grouping quick fix

Fixed [`positioned` subproperties are considered duplicates for `execute-duplicate`](https://github.com/TheSalts/datapack-optimization-helper/issues/4)

## 1.0.6

Fixed [Wrong warning (function group)](https://github.com/TheSalts/datapack-optimization-helper/issues/3)

## 1.0.5

Fixed [Incorrect warning with execute in](https://github.com/TheSalts/datapack-optimization-helper/issues/2)

## 1.0.4

### Features

Added config item's label and now supports i18n

### Bugs

-   Fixed [issue 1](https://github.com/TheSalts/datapack-optimization-helper/issues/1)
-   Fixed a false positive lint warning when using `execute` before `return`.
-   Fixed the Quick Fix behavior for duplicate `return` commands.
-   Improved function grouping to correctly handle whitespace and comments.
-   Resolved incorrect warnings regarding duplicate `at` subcommands.
-   Fixed an issue where duplicated subcommands were incorrectly reported.
-   Separated `unknown` and `reset` states in scoreboard tracking logic.

## 1.0.3

Fixed quick fix of 'if entity'

## 1.0.2

Edited icon

## 1.0.1

Edited README

## 1.0.0

first release

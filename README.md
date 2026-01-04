# Datapack Optimization Helper

Vscode Extension for minecraft datapack optimization.

## Features

![Example](https://raw.githubusercontent.com/TheSalts/datapack-optimization-helper/refs/heads/master/image/codes.png)

-   Add lint warnings for optimizations

-   Add some quick fixes

![image](https://raw.githubusercontent.com/TheSalts/datapack-optimization-helper/refs/heads/master/image/func_ref.png)

-   Show function references with CodeLens

-   Automatically update function references when renaming `.mcfunction` files
    -   Updates `function` and `schedule function` commands
    -   Optionally updates references in comments

## Configuration

### Disable Rules

![image](https://raw.githubusercontent.com/TheSalts/datapack-optimization-helper/refs/heads/master/image/disable_rule.png)

default: `scoreboard-fake-player-missing-hash`

### Output path for function grouping

![image](https://raw.githubusercontent.com/TheSalts/datapack-optimization-helper/refs/heads/master/image/output_path.png)

default: `{dir}`

### Output name for function grouping

![image](https://raw.githubusercontent.com/TheSalts/datapack-optimization-helper/refs/heads/master/image/output_name.png)

default: `{name}_line_{line}`

### Rename Behavior

Controls how function references are updated when renaming `.mcfunction` files.

-   `ask`: Show a dialog to choose (default)
-   `codeOnly`: Only update code references
-   `includeComments`: Update code and comment references
-   `skip`: Don't update references

## Contributing

If you want to add an optimization rule, or report a bug, please make an [issue](https://github.com/TheSalts/datapack-optimization-helper/issues)

And any contributions are welcome!

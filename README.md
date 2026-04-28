# Datapack Optimization Helper

[![Visual Studio Marketplace](https://vsmarketplacebadges.dev/installs-short/TheSalt.datapack-optimization.svg)](https://marketplace.visualstudio.com/items?itemName=TheSalt.datapack-optimization)
[![Open VSX](https://img.shields.io/open-vsx/dt/TheSalt/datapack-optimization?logo=eclipse&label=Open%20VSX)](https://open-vsx.org/extension/TheSalt/datapack-optimization)

Vscode Extension for minecraft datapack optimization.

[English](https://github.com/TheSalts/datapack-optimization-helper/blob/master/README.md) | [한국어](https://github.com/TheSalts/datapack-optimization-helper/blob/master/README.ko.md)

## Features

![Example](https://raw.githubusercontent.com/TheSalts/datapack-optimization-helper/refs/heads/master/image/codes.png)

- Add lint warnings for optimizations

- Detect infinite recursion calls

- Add some quick fixes

- Ctrl+Click on `if`/`unless` in unreachable/always-pass conditions to jump to the score assignment

- Suppress warnings with comments:
    - `# warn-off` - Suppress all warnings for the next line
    - `# warn-off rule-id` - Suppress specific rule
    - `# warn-off-file` - Suppress warnings for entire file

![image](https://raw.githubusercontent.com/TheSalts/datapack-optimization-helper/refs/heads/master/image/func_ref.png)

- Show function references with CodeLens

![image](https://raw.githubusercontent.com/TheSalts/datapack-optimization-helper/refs/heads/master/image/rename.png)

- Automatically update function references when renaming `.mcfunction` files
    - Updates `function` and `schedule function` commands
    - Optionally updates references in comments

![image](https://raw.githubusercontent.com/TheSalts/datapack-optimization-helper/refs/heads/master/image/scoreboard.png)

- Tracking scoreboard values
    - Visible when holding `Ctrl + Alt`
    - To always show them, set `editor.inlayHints.enabled` to `on`

- Test scoreboard values with `# test-score`
    - Insert `# test-score <target> <objective> <value>` anywhere in the file to pin a score to a specific value for testing
    - The overridden value is reflected in inlay hints, hover, and diagnostics from that line onwards
    - Right-click (or use the command palette) → **Datapack Optimization: Add Test Score** to insert interactively — shows all scores in the file with their current values at the cursor position

    ```mcfunction
    # test-score #counter obj 10

    scoreboard players add #counter obj 3
    # inlay hint: #counter:obj = 13
    ```

## Configuration

### Project Configuration

Create `datapack.config.json` in the same folder as `pack.mcmeta`:

```json
{
    "rules": {
        "disabled": ["scoreboard-fake-player-missing-hash"]
    },
    "executeGroup": {
        "outputPath": "{dir}",
        "outputName": "{name}_line_{line}"
    }
}
```

Project settings override user settings.

### Disable Rules

![image](https://raw.githubusercontent.com/TheSalts/datapack-optimization-helper/refs/heads/master/image/disable_rule.png)

default: `scoreboard-fake-player-missing-hash`

### Output path for function grouping

![image](https://raw.githubusercontent.com/TheSalts/datapack-optimization-helper/refs/heads/master/image/output_path.png)

default: `{dir}`

### Output name for function grouping

![image](https://raw.githubusercontent.com/TheSalts/datapack-optimization-helper/refs/heads/master/image/output_name.png)

default: `{name}_line_{line}`

![image](https://raw.githubusercontent.com/TheSalts/datapack-optimization-helper/refs/heads/master/image/config_scoreboard.png)

### Scoreboard Inlay Hints Enabled

Enable tracking scoreboard values.

default: `true`

### Scoreboard Inlay Hints Padding

Number of padding spaces for Scoreboard Inlay Hints.
Set to `0` to auto alignment.

default: `1`

### Rename Behavior

![image](https://raw.githubusercontent.com/TheSalts/datapack-optimization-helper/refs/heads/master/image/rename_config.png)

Controls how function references are updated when renaming `.mcfunction` files.

- `ask`: Show a dialog to choose (default)
- `codeOnly`: Only update code references
- `includeComments`: Update code and comment references
- `skip`: Don't update references

## Contributing

If you want to add an optimization rule, or report a bug, please make an [issue](https://github.com/TheSalts/datapack-optimization-helper/issues)

And any contributions are welcome!

# Datapack Optimization Helper

[![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/i/TheSalt.datapack-optimization?logo=visualstudiocode&label=VS%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=TheSalt.datapack-optimization)
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

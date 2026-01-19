# Datapack Optimization Helper

[![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/i/TheSalt.datapack-optimization?logo=visualstudiocode&label=VS%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=TheSalt.datapack-optimization)
[![Open VSX](https://img.shields.io/open-vsx/dt/TheSalt/datapack-optimization?logo=eclipse&label=Open%20VSX)](https://open-vsx.org/extension/TheSalt/datapack-optimization)

마인크래프트 데이터팩 최적화를 위한 VSCode 확장 프로그램입니다.

[English](https://github.com/TheSalts/datapack-optimization-helper/blob/master/README.md) | [한국어](https://github.com/TheSalts/datapack-optimization-helper/blob/master/README.ko.md)

## 기능

![Example](https://raw.githubusercontent.com/TheSalts/datapack-optimization-helper/refs/heads/master/image/codes.png)

- 최적화를 위한 린트 경고 표시

- 무한 재귀 호출 감지

- 빠른 수정 제공

- 항상 통과/실패 조건에서 `if`/`unless`를 Ctrl+클릭하면 스코어 할당 위치로 이동

- 주석으로 경고 비활성화:
    - `# warn-off` - 다음 줄의 모든 경고 비활성화
    - `# warn-off rule-id` - 특정 규칙 비활성화
    - `# warn-off-file` - 파일 전체 경고 비활성화

![image](https://raw.githubusercontent.com/TheSalts/datapack-optimization-helper/refs/heads/master/image/func_ref.png)

- CodeLens로 함수 참조 표시

![image](https://raw.githubusercontent.com/TheSalts/datapack-optimization-helper/refs/heads/master/image/rename.png)

- `.mcfunction` 파일 이름 변경 시 함수 참조 자동 업데이트
    - `function` 및 `schedule function` 명령어 업데이트
    - 주석 내 참조도 선택적으로 업데이트

## 설정

### 프로젝트 설정

`pack.mcmeta`와 같은 폴더에 `datapack.config.json`을 생성하세요:

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

프로젝트 설정은 사용자 설정보다 우선 적용됩니다.

### 규칙 블랙리스트

![image](https://raw.githubusercontent.com/TheSalts/datapack-optimization-helper/refs/heads/master/image/disable_rule.png)

기본값: `scoreboard-fake-player-missing-hash`

### 함수 그룹화 출력 경로

![image](https://raw.githubusercontent.com/TheSalts/datapack-optimization-helper/refs/heads/master/image/output_path.png)

기본값: `{dir}`

### 함수 그룹화 출력 이름

![image](https://raw.githubusercontent.com/TheSalts/datapack-optimization-helper/refs/heads/master/image/output_name.png)

기본값: `{name}_line_{line}`

### 이름 변경 동작

![image](https://raw.githubusercontent.com/TheSalts/datapack-optimization-helper/refs/heads/master/image/rename_config.png)

`.mcfunction` 파일 이름 변경 시 함수 참조 업데이트 방식을 설정합니다.

- `ask`: 선택 다이얼로그 표시 (기본값)
- `codeOnly`: 코드 참조만 업데이트
- `includeComments`: 코드와 주석 참조 모두 업데이트
- `skip`: 참조 업데이트 안 함

## 기여

최적화 규칙 추가나 버그 제보는 [이슈](https://github.com/TheSalts/datapack-optimization-helper/issues)를 만들어주세요.

모든 기여를 환영합니다!

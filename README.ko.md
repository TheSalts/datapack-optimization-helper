# Datapack Optimization Helper

[![Visual Studio Marketplace](https://vsmarketplacebadges.dev/installs-short/TheSalt.datapack-optimization.svg)](https://marketplace.visualstudio.com/items?itemName=TheSalt.datapack-optimization)
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

- **함수 의존성 그래프** 표시
    - 커맨드 팔레트에서 `Datapack Optimization: 함수 의존성 그래프 표시`를 실행하세요
    - D3.js 기반의 대화형 그래프로 함수 간 호출 관계를 시각화합니다
    - 확대/축소, 드래그, 네임스페이스별 색상 구분을 지원합니다

![image](https://raw.githubusercontent.com/TheSalts/datapack-optimization-helper/refs/heads/master/image/rename.png)

- `.mcfunction` 파일 이름 변경 시 함수 참조 자동 업데이트
    - `function` 및 `schedule function` 명령어 업데이트
    - 주석 내 참조도 선택적으로 업데이트

![image](https://raw.githubusercontent.com/TheSalts/datapack-optimization-helper/refs/heads/master/image/scoreboard.png)

- 스코어보드 값 추적
    - `Ctrl + Alt`를 누르고 있으면 표시
    - 항상 표시되게 하려면 `설정` → `editor.inlayHints.enabled`를 `on`으로 변경하세요

- `# test-score`로 스코어 테스트 값 설정
    - `# test-score <target> <objective> <value>` 주석을 파일 어디에나 삽입하면, 해당 줄 이후의 inlay hint·hover·진단 결과에 그 값이 반영됩니다
    - 우클릭 또는 커맨드 팔레트에서 **Datapack Optimization: 테스트 스코어 추가**를 실행하면 커서 위치의 스코어 상태를 목록으로 보면서 삽입할 수 있습니다

    ```mcfunction
    # test-score #counter obj 10

    scoreboard players add #counter obj 3
    # inlay hint: #counter:obj = 13
    ```

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

![image](https://raw.githubusercontent.com/TheSalts/datapack-optimization-helper/refs/heads/master/image/config_scoreboard.png)

### 스코어보드 Inlay Hint 활성화

스코어보드 값 추적 기능을 켜거나 끕니다.

기본값: `true`

### 스코어보드 Inlay Hint 여백

스코어보드 Inlay Hint의 여백 개수를 설정합니다.
`0`으로 설정하면 자동 정렬이 활성화됩니다.

기본값: `1`

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

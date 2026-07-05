# PetPresence 故障排查指南

这份指南用于定位 PetPresence creator pipeline 的常见问题。优先按顺序排查，不要一开始就修改代码或重做素材。

默认诊断顺序：

```text
环境是否可用
  -> pet_demo 是否能跑
  -> 新 pet workspace 是否完整
  -> provider/import 是否产出合法 MP4 contract
  -> action 是否正确注册
  -> alpha WebM 转换是否成功
  -> desktop 是否能读取 action_assets.json
  -> 视觉质量是否需要重做素材
```

如果涉及私人宠物素材，不要把原视频、`.env`、API key、provider URL、frames、events、reports 或 `outputs/` 贴到公开 issue。优先贴命令和脱敏后的报错。

## 1. 先跑最小环境诊断

从仓库根目录运行：

```powershell
npm run pet:doctor
```

如果 PowerShell 报 `npm.ps1 cannot be loaded` 或执行策略相关错误，先不要修改项目文件。可以改用下面任一方式运行同一条命令：

```powershell
npm.cmd run pet:doctor
cmd.exe /c npm run pet:doctor
```

后续命令同理，例如把 `npm run verify:quick` 改成 `npm.cmd run verify:quick`。

如果已经创建了宠物：

```powershell
npm run pet:doctor -- --pet-id <pet_id>
```

看结果：

- `ERROR`：必须先修复。
- `WARN`：可以继续，但要理解风险。
- `apps/desktop/node_modules missing`：运行 `npm --prefix apps/desktop install`。
- `ffmpeg not found`：运行 `npm install`，或设置 `FFMPEG_PATH`。
- `no actions registered yet`：新宠物刚创建时正常；注册动作后再检查。
- `creator_brief`、`action_plan` 或 `prompts` 是 `WARN`：先运行 `pet:create-brief` 或 `pet:scaffold-actions`，再继续 provider/import。
- Agent 或自动化需要解析结果：运行 `npm run pet:doctor -- --pet-id <pet_id> --json`，查看 `summary` 和 `checks`。

## 2. pet_demo 跑不起来

先确认公开 fixture 完整：

```powershell
npm run pet:validate -- --pet-id pet_demo
npm --prefix apps/desktop run smoke
```

如果这两条通过，再启动桌宠：

```powershell
npm run desktop -- --pet-id pet_demo
```

常见原因：

| 症状 | 优先检查 |
| --- | --- |
| `pet_demo` 校验失败 | `data/pets/pet_demo/action_assets.json` 是否存在，`assets/pets/pet_demo/` 是否完整 |
| desktop smoke 失败 | 是否安装了 `apps/desktop` 依赖 |
| 启动后没有窗口 | Windows 安全策略、Electron 启动日志、是否在远程/无显示环境 |
| 窗口出现但没动作 | `action_assets.json` 的 `path` 是否指向真实文件 |

如果 `pet_demo` 都跑不通，先不要制作新宠物。

## 3. 新宠物工作区不完整

重新创建或检查：

```powershell
npm run pet:init -- --pet-id <pet_id> --name <name> --species <species>
npm run pet:doctor -- --pet-id <pet_id>
```

应该出现：

```text
data/pets/<pet_id>/profile.json
data/pets/<pet_id>/agent.md
data/pets/<pet_id>/action_assets.json
assets/pets/<pet_id>/
```

如果 `pet_id` 报错，通常是因为包含了中文、空格或特殊字符。`pet_id` 只能用 ASCII 字母、数字、下划线和短横线，例如：

```text
pet_huahua
pet_mochi_01
```

宠物显示名可以是中文，`pet_id` 不建议用中文。

## 4. action plan 或 prompt 不符合预期

重新生成脚手架：

```powershell
npm run pet:scaffold-actions -- --pet-id <pet_id> --actions idle,sleep,eat,play
```

检查：

```text
data/pets/<pet_id>/action_plan.md
data/pets/<pet_id>/prompts/<action>.txt
```

如果动作太多、prompt 太泛或不符合宠物个性，先编辑这些文本文件，再调用 provider 或导入视频。不要直接跳到 `pet:add-action`。

## 5. provider 或外部视频模型问题

### 只想测试边界

```powershell
npm run provider:example -- --pet-id <pet_id> --action idle --prompt-file "data/pets/<pet_id>/prompts/idle.txt"
```

它不调用真实 API，也不会上传用户素材。

### 已经有外部模型生成的 MP4

```powershell
npm run provider:import -- --pet-id <pet_id> --action idle --input "D:\path\idle_from_model.mp4" --prompt-file "data/pets/<pet_id>/prompts/idle.txt"
```

然后校验 provider contract：

```powershell
npm run provider:validate-result -- --input outputs/generated/<pet_id>/provider-result.json --pet-id <pet_id> --action idle
```

常见原因：

| 症状 | 处理 |
| --- | --- |
| `--input must point to an .mp4 file` | 先导出或转成 MP4 |
| `source_video does not exist` | 检查 provider JSON 里的路径是否相对仓库根目录 |
| `next_command must include npm run pet:add-action` | adapter 没有遵守 contract |
| provider 需要上传 reference image | 必须先获得用户确认；真实 adapter 应要求 `--confirm-upload` |
| provider 生成质量差 | 调整 prompt、参考图或模型参数；PetPresence 只能处理已有视频，不能保证模型还原度 |

真实 provider adapter 参考：

```text
docs/provider-adapters.md
docs/provider_adapter_cookbook.md
scripts/providers/provider-template.ts
```

## 6. `pet:add-action` 失败

透明 WebM：

```powershell
npm run pet:add-action -- --pet-id <pet_id> --action idle --input "D:\path\idle.webm" --skip-alpha --loop true
```

普通 MP4 并立即透明化：

```powershell
npm run pet:add-action -- --pet-id <pet_id> --action idle --input "D:\path\idle.mp4" --convert-alpha --loop true
```

常见原因：

| 报错或症状 | 处理 |
| --- | --- |
| `--convert-alpha currently requires an .mp4 input` | `--convert-alpha` 只能处理 MP4 |
| `--convert-alpha and --skip-alpha cannot be used together` | 二选一：已有透明 WebM 用 `--skip-alpha`，普通 MP4 用 `--convert-alpha` |
| 注册后仍是 MP4 | 没有加 `--convert-alpha`；这只是源素材注册，透明桌宠通常还需要转 WebM |
| `Alpha conversion finished but output was not found` | 查看 PowerShell 转换脚本输出，检查 ffmpeg/Python/background-removal 依赖 |

## 7. alpha WebM 转换质量差

先跑合成 smoke，确认工具链不是坏的：

```powershell
npm run smoke:creator-alpha
```

如果 smoke 通过，但你的素材效果差，通常是源视频问题：

| 视觉问题 | 可能原因 | 处理 |
| --- | --- | --- |
| 边缘闪烁 | 背景复杂、压缩严重、主体快速移动 | 换干净背景，缩短视频，降低动作幅度 |
| 白色宠物缺边 | 宠物和背景对比太低 | 换深色或纯色背景，调整 color mask 参数 |
| 缺腿、缺耳朵 | 模型分割失败或主体被遮挡 | 换更清楚的源视频 |
| 背景残留大片 | 背景太复杂或光照变化大 | 重新拍摄或换生成 prompt |
| 循环跳帧 | 首尾姿态差别太大 | 重新剪辑成自然循环，或把 `loop` 改为 `false` |

可以尝试的参数：

```powershell
npm run pet:add-action -- --pet-id <pet_id> --action idle --input "D:\path\idle.mp4" --convert-alpha --alpha-height 512 --alpha-fps 12 --alpha-crf 32 --alpha-color-mask-threshold 12
```

不要把质量差误判成 manifest 问题。`pet:validate` 只能证明文件存在和配置可读，不能证明素材好看。

## 8. `pet:validate` 报错

运行：

```powershell
npm run pet:validate -- --pet-id <pet_id>
```

如果是 Agent 或自动化在排查，使用 JSON 输出：

```powershell
npm run pet:validate -- --pet-id <pet_id> --json
```

JSON 包含 `schema_version`、`pet_id`、`summary`、`errors` 和 `warnings`。`summary.ok` 为 `false` 时，先处理 `errors`；`warnings` 可以记录下来让用户确认。

常见项：

| 输出 | 含义 |
| --- | --- |
| `profile.json` 缺失 | `pet:init` 没成功或目录被删 |
| `action_assets.json` 缺失 | `pet:init` 没成功 |
| `default_action` 不存在 | 默认动作没有注册，通常需要先注册 `idle` |
| action path 不存在 | `action_assets.json` 指向了不存在的文件 |
| type 和后缀不一致 | manifest 里的 `type` 与文件扩展名不匹配 |

先修 `ERROR`，再看 `WARN`。不要在 `pet:validate` 失败时启动桌宠预览。

## 9. 桌宠启动但动作不对

先跑桌面配置 smoke：

```powershell
npm --prefix apps/desktop run smoke -- --pet-id <pet_id>
```

然后启动：

```powershell
npm run desktop -- --pet-id <pet_id>
```

排查：

| 症状 | 检查 |
| --- | --- |
| 没有新动作菜单 | `action_assets.json` 是否注册该 action；重跑 `pet:validate` |
| 动作不透明 | 当前注册的可能是 MP4 源素材，不是 alpha WebM |
| 动作很大或很小 | 调整桌宠缩放，或重新导出素材尺寸 |
| 播放一次后不回 idle | 检查 action 的 `loop` 和 duration 设置 |
| 气泡文案不对 | 修改 `action_assets.json` 中该 action 的 message |

桌宠右键菜单会从 `action_assets.json` 动态读取动作。新增动作后通常重新启动桌宠最稳。

## 10. verify/release gate 失败

快速 gate：

```powershell
npm run verify:quick
```

完整发布 gate：

```powershell
npm run release:verify
```

注意：

- 不要并行运行 `verify:quick` 和 `release:verify`。它们都会创建临时 smoke pet，可能让公开资产审计短暂看到另一条命令的临时文件。
- `verify:quick` 不跑真实 alpha conversion；它适合 CI。
- `release:verify` 会跑 `smoke:creator-alpha`，第一次可能安装 Python 抠背景依赖，耗时更长。
- `release:audit-assets -- --fail-on-unresolved` 失败时，先看是否有未审查的 `assets/`、`data/`、`outputs/` 文件。

## 11. 公开发布前 staging 异常

生成 staging 计划：

```powershell
npm run release:stage-plan
npm run release:stage-plan -- --write-md
```

检查：

```text
docs/first_public_stage_plan.md
```

如果 `do-not-stage` 或 `manual-review` 不为 0，先人工检查。正常情况下，`keep-deleted` 很多是可以接受的，因为 private/legacy 文件正在从公开发布面移除。

不要把这些内容作为新增文件加回公开发布：

```text
private legacy pet workspace
shelter/adoption demo media
presentation artifact paths
outputs
frames
events
reports
.env
真实 API key
私人宠物照片或视频
付费模型输出
```

## 12. 开 issue 前准备

公开 issue 里优先贴：

- 操作系统。
- Node/npm 版本。
- 运行过的命令。
- `pet:doctor` 输出。
- `pet:validate` 输出。
- provider 问题的 `provider:validate-result` 输出。
- 已脱敏的 provider JSON contract。

不要贴：

- 真实 API key。
- `.env` 内容。
- 私人宠物原视频。
- provider 原始下载 URL。
- extracted frames、events、reports。
- 付费模型生成视频，除非你确认可以公开。

对应 GitHub issue 模板：

```text
.github/ISSUE_TEMPLATE/bug_report.yml
.github/ISSUE_TEMPLATE/creator_pipeline_help.yml
.github/ISSUE_TEMPLATE/provider_adapter.yml
.github/ISSUE_TEMPLATE/media_privacy_review.yml
```

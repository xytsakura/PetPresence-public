# Agent Recipe：制作你的私人桌面宠物

这份文档给 Codex、Cursor、Claude 等 Agent 使用。目标是帮助用户基于 PetPresence 创建自己的桌面宠物，而不是部署实时监控系统。

如果用户不是开发者，先让用户阅读或直接使用：

```text
docs/user_guide_create_private_pet.md
```

其中包含给 Agent 的启动提示词、素材准备表、隐私/API 决策和最终验收清单。

如果执行过程中遇到安装、provider、透明化、校验或桌宠预览问题，先查：

```text
docs/troubleshooting.md
```

## 1. 任务目标

把用户提供的宠物资料、图片、短视频或视频生成模型产物，整理成一个可运行的 PetPresence 桌宠配置。

最终产物至少包括：

- `data/pets/<pet_id>/profile.json`
- `data/pets/<pet_id>/agent.md`
- `data/pets/<pet_id>/action_assets.json`
- `assets/pets/<pet_id>/<action>/<action>.webm`
- 一份通过 `pet:validate` 的配置
- 一个可启动预览的 Electron 桌宠

## 2. 不要做什么

- 不要默认要求用户接入摄像头。
- 不要默认要求用户部署云服务。
- 不要把宠物行为写成医疗、心理或健康诊断。
- 不要把用户私人宠物素材上传到未知服务。
- 不要把真实 API key 写入仓库。
- 不要默认提交 `outputs/`、`events/`、`frames/`、`reports/` 或用户新建宠物素材目录。
- 不要把 private legacy pet workspace 或旧 shelter 素材加回公开发布面，除非用户明确确认发布权。

## 3. 开始前收集信息

一次只问必要问题。如果用户已经给出答案，不要重复问。

必需信息：

1. 宠物名字。
2. 宠物类型，例如猫、狗、兔子、鸟或其他。
3. 想要的动作列表。第一版推荐 `idle`、`sleep`、`eat`、`play`。
4. 每个动作是否已有源视频。
5. 如果没有源视频，是否需要先生成给视频模型的 prompt。
6. 是否只需要本地运行预览，还是需要后续打包成安装包。

动作名可以自定义，但必须只包含 ASCII 字母、数字、下划线和短横线。桌宠右键菜单会从 `action_assets.json` 动态读取已注册动作。

## 4. 默认动作设计

| action | 用途 | 素材建议 |
| --- | --- | --- |
| `idle` | 默认待机 | 正面、轻微呼吸或轻微晃动，适合循环 |
| `sleep` | 睡觉 | 趴下、蜷缩或闭眼休息，适合循环 |
| `eat` | 吃东西 | 低头、靠近食物或咀嚼，适合短动作 |
| `play` | 玩耍 | 小跳、挥爪、转身或玩玩具，适合短动作 |
| `alert` | 需要注意 | 抬头、看向镜头、轻微焦躁；不要写成诊断 |
| `out_of_view` | 暂时不在 | 跑开、探头或画面外提示 |

## 5. 推荐执行流程

### Step 1：确认仓库可运行

```powershell
npm install
npm --prefix apps/desktop install
npm run pet:doctor
npm run smoke:agent-pipeline
npm run verify:quick
```

`pet:doctor` 会检查 Node/npm、桌面依赖、PowerShell、ffmpeg、公开配置模板等基础环境。`smoke:agent-pipeline` 会模拟 Agent 从建宠物、生成 creator brief、生成动作计划、provider contract、注册动作到桌面配置 smoke 的轻量端到端流程。`verify:quick` 会运行 TypeScript 检查、协议测试、creator smoke、`pet_demo` 校验、桌面配置 smoke 和严格公开资产审计。如果失败，先修基础环境，不要继续制作素材。

带 `--pet-id` 的 `pet:doctor` 还会检查该宠物的 `creator_brief.md`、`action_plan.md` 和 `prompts/*.txt`。这些缺失通常是 `WARN`，但 Agent 在调用 provider 或导入生成视频前应该先补齐。

Agent 需要稳定解析诊断结果时，优先使用 JSON 输出：

```powershell
npm run pet:doctor -- --pet-id <pet_id> --json
```

JSON 包含 `schema_version`、`pet_id`、`summary` 和 `checks`。如果 `summary.error` 大于 0，先修复错误；如果 creator planning 文件是 `WARN`，先补齐 brief 或 scaffold，再继续 provider/import。

如果本次任务需要处理普通 MP4 并转换成透明 WebM，建议先运行一次公开合成素材 smoke：

```powershell
npm run smoke:creator-alpha
```

它会生成一个临时合成 MP4，走真实 `pet:add-action --convert-alpha` 路径，然后自动清理临时宠物目录。第一次运行可能会安装 Python 抠背景依赖，耗时会比普通 creator smoke 更长。

发布前或改动透明化链路后，运行完整本地 gate：

```powershell
npm run release:verify
```

### Step 2：创建宠物工作区

```powershell
npm run pet:init -- --pet-id <pet_id> --name <pet_name> --species <species>
```

`pet_id` 必须稳定、简短、只包含 ASCII 字符，例如：

```text
pet_huahua
pet_mochi
pet_bunny_01
```

创建后先让 Agent 做一次工作区体检：

```powershell
npm run pet:doctor -- --pet-id <pet_id>
```

### Step 3：写入 Creator Brief

在生成 prompt、调用 provider 或导入素材前，先把用户已经确认的信息写成 brief：

```powershell
npm run pet:create-brief -- --pet-id <pet_id> --actions idle,sleep,eat,play --media "<已有素材路径，逗号分隔；没有就写 TBD>" --video-api "<not configured / provider name>" --upload-consent "ask every time before uploading pet media" --force
```

这个命令会写入：

```text
data/pets/<pet_id>/creator_brief.md
```

`creator_brief.md` 记录宠物身份、动作需求、已有素材、视频 API 状态、上传授权、隐私边界和验收标准。它不会调用视频 API、上传素材或注册动作。Agent 应该先让用户确认这份 brief，再继续生成 action plan、prompt 或调用外部 provider。

### Step 4：准备源视频

先为动作生成计划和 prompt 文件：

```powershell
npm run pet:scaffold-actions -- --pet-id <pet_id> --actions idle,sleep,eat,play
```

如果用户给了自定义动作，用逗号分隔：

```powershell
npm run pet:scaffold-actions -- --pet-id <pet_id> --actions idle,sleep,wave_paw,custom_spin
```

这个命令会写入：

```text
data/pets/<pet_id>/action_plan.md
data/pets/<pet_id>/prompts/<action>.txt
```

它不会调用视频 API，也不会注册素材。Agent 应该先让用户确认 `action_plan.md` 是否符合宠物个性，再进入视频生成或素材收集。

优先使用 3 到 6 秒短视频。画面要求：

- 宠物主体完整。
- 背景尽量简单。
- 镜头不要快速移动。
- 动作清晰。
- 如果需要透明背景，白色或低对比宠物最好使用纯色或简单背景。

如果用户只有图片，没有视频，先生成给视频模型的 prompt，不要假装已经有素材。

如果只是验证 provider adapter 边界，可以运行本地合成示例：

```powershell
npm run provider:example -- --pet-id <pet_id> --action idle --prompt-file "data/pets/<pet_id>/prompts/idle.txt"
```

它不会调用真实视频模型，也不会上传用户素材，只会在 `outputs/generated/<pet_id>/idle.mp4` 生成一个测试 MP4，并打印后续 `pet:add-action` 命令。真实视频生成 API adapter 应该遵守 `docs/provider-adapters.md` 的同一 JSON 输出契约。

如果需要接入某个真实视频生成 API，先阅读：

```text
docs/provider_adapter_cookbook.md
```

不要把真实 API adapter 加入默认 CI；也不要在没有用户确认的情况下上传 reference image 或 reference video。

如果用户已经用任意外部视频模型生成了 MP4，先把它标准化成 provider contract：

```powershell
npm run provider:import -- --pet-id <pet_id> --action idle --input "D:\path\model_output_idle.mp4" --prompt-file "data/pets/<pet_id>/prompts/idle.txt"
```

如果真实 adapter 输出了 JSON 文件，先校验：

```powershell
npm run provider:validate-result -- --input "outputs\generated\<pet_id>\provider-result.json" --pet-id <pet_id> --action idle
```

通过后再执行 JSON 里的 `next_command`，或者手动运行 `pet:add-action`。

### Step 5：注册动作素材

如果输入已经是透明 WebM：

```powershell
npm run pet:add-action -- --pet-id <pet_id> --action idle --input "D:\path\idle.webm" --skip-alpha --loop true --message "I am here."
```

如果输入是普通 MP4，优先使用自动透明化：

```powershell
npm run pet:add-action -- --pet-id <pet_id> --action idle --input "D:\path\idle.mp4" --message "I am here." --loop true --convert-alpha
```

`--convert-alpha` 会调用：

```powershell
.\scripts\assets\remove_background_to_alpha_webm.ps1 -PetId <pet_id> -Action <action> -InputPath "<source.mp4>"
```

成功后，`action_assets.json` 会指向：

```text
assets/pets/<pet_id>/<action>/<action>.webm
```

如果暂时不想运行耗时的透明化流程，可以先不加 `--convert-alpha`，只复制并注册 MP4。之后再手动运行透明化脚本并重新注册生成的 WebM。

### Step 6：验证

```powershell
npm run pet:validate -- --pet-id <pet_id>
```

必须修复所有 `ERROR`。`WARN` 可以记录下来给用户确认。

如果 Agent 需要稳定解析校验结果，使用 JSON 输出：

```powershell
npm run pet:validate -- --pet-id <pet_id> --json
```

JSON 包含 `schema_version`、`pet_id`、`summary`、`errors` 和 `warnings`。只有 `summary.ok` 为 `true` 时，才继续启动桌宠预览；否则先根据 `errors` 修复 manifest 或素材路径。

### Step 7：启动预览

```powershell
npm run desktop -- --pet-id <pet_id>
```

使用桌宠菜单切换动作，检查透明边缘、缩放、循环和气泡文案。

### Step 8：根据视觉反馈迭代

让用户检查：

- 桌宠大小是否合适。
- 透明边缘是否发虚或闪烁。
- 动作是否能表达该状态。
- 气泡文案是否像这只宠物。
- 哪些动作应该循环，哪些动作应该播放后回到 idle。

根据反馈调整素材、缩放参数和 `action_assets.json`。

### Step 9：说明私有文件边界

交付前提醒用户：

- `assets/pets/<pet_id>/` 可能包含私人宠物视频。
- `data/pets/<pet_id>/events/`、`frames/`、`reports/` 是本地生成记录。
- `outputs/` 是本地渲染或视频生成输出。
- 这些文件默认不要提交到公开仓库，除非用户确认有发布权并希望作为 demo fixture。

详细规则见：

```text
docs/media_and_data_policy.md
```

## 6. 视频生成 Prompt 模板

### idle

```text
Create a short 4-second video of this pet as a desktop companion idle animation.
The pet faces the camera, stays mostly in place, with subtle breathing and tiny head movement.
Use a clean plain background, stable camera, full body visible, soft light.
No text, no watermark, no extra objects.
```

### sleep

```text
Create a short 4-second video of this pet sleeping peacefully.
The pet lies down or curls up, with very subtle breathing.
Use a clean plain background, stable camera, full body visible.
No text, no watermark, no extra objects.
```

### eat

```text
Create a short 4-second video of this pet eating or lowering its head toward food.
The movement should be clear but gentle, suitable for a desktop pet action.
Use a clean plain background, stable camera, full body visible.
No text, no watermark, no extra objects.
```

### play

```text
Create a short 4-second video of this pet playing happily.
The pet makes a small playful movement such as turning, bouncing, pawing, or reacting to a toy.
Use a clean plain background, stable camera, full body visible.
No text, no watermark, no extra objects.
```

## 7. 常见失败与恢复

更完整的症状排查见 `docs/troubleshooting.md`。下面是 Agent 执行时最常见的快速恢复表。

| 问题 | 处理方式 |
| --- | --- |
| 不知道本机缺什么依赖 | 运行 `npm run pet:doctor`；如果已经创建宠物，再运行 `npm run pet:doctor -- --pet-id <pet_id>` |
| 不确定 brief、动作计划或 prompt 是否齐 | 运行 `npm run pet:doctor -- --pet-id <pet_id>`，查看 `creator_brief`、`action_plan` 和 `prompts` 检查项 |
| Agent 需要稳定解析诊断结果 | 运行 `npm run pet:doctor -- --pet-id <pet_id> --json`，读取 `summary.error`、`summary.warn` 和 `checks` |
| Agent 需要稳定解析 manifest 校验结果 | 运行 `npm run pet:validate -- --pet-id <pet_id> --json`，确认 `summary.ok` 为 `true`，否则读取 `errors` 和 `warnings` |
| 想确认整条 Agent 流水线没坏 | 运行 `npm run smoke:agent-pipeline`；它会覆盖 creator brief、action plan、provider contract、动作注册和桌面 smoke，不上传素材、不调用付费 API |
| 想先固定用户需求、素材和上传授权 | 运行 `npm run pet:create-brief -- --pet-id <pet_id> --actions idle,sleep,eat,play`，再让用户确认 `data/pets/<pet_id>/creator_brief.md` |
| 不知道该生成哪些动作或 prompt | 运行 `npm run pet:scaffold-actions -- --pet-id <pet_id> --actions idle,sleep,eat,play`，再查看 `data/pets/<pet_id>/action_plan.md` |
| 用户已经有外部模型生成的 MP4 | 运行 `npm run provider:import -- --pet-id <pet_id> --action <action> --input "<file.mp4>"`，先标准化输出路径和 JSON contract |
| `pet:validate` 报素材不存在 | 检查 `action_assets.json` 的 `path` 是否指向真实文件 |
| `smoke:creator-alpha` 失败 | 先确认 Python、PowerShell 和 ffmpeg 可用；再查看 `scripts/assets/remove_background_to_alpha_webm.ps1` 的报错 |
| MP4 透明化很慢 | 告诉用户第一次会安装依赖和下载模型；可先用 `--skip-alpha` 注册已有 WebM |
| 白色宠物边缘发虚 | 调整 `-ColorMaskThreshold`、`-SolidAlphaThreshold`、`-TemporalMedian` |
| 动作循环不自然 | 把该 action 的 `loop` 改为 `false`，播放后回到 idle |
| 桌宠没有显示新动作 | 重新运行 `pet:validate`，确认 action 已写入 `action_assets.json` |
| 用户想接入摄像头 | 说明这是 experimental observer 方向，不是默认 creator pipeline |

## 8. 验收标准

任务完成前，Agent 必须确认：

- 新宠物目录存在。
- `pet:doctor -- --pet-id <pet_id>` 没有 `ERROR`。
- `creator_brief.md` 已生成，并且用户确认过素材来源、视频 API 状态和上传授权。
- `action_plan.md` 和 `prompts/<action>.txt` 已生成并经用户确认。
- provider 输出已经通过 `provider:validate-result`，或由 `provider:import` 生成。
- 所有注册动作的素材文件存在。
- `pet:validate` 通过。
- 至少 `idle` 能播放。
- 至少一个非 idle 或自定义 action 能通过菜单或命令触发。
- 用户知道哪些能力是本地桌宠，哪些能力仍是实验功能。
- 用户知道哪些生成文件不应该默认提交。

## 9. 最终交付说明

最终回复用户时包含：

- 创建了哪个 `pet_id`。
- 支持哪些动作。
- 如何启动预览。
- 如何继续添加动作。
- 哪些素材质量问题仍需人工判断。

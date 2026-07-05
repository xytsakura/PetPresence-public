# PetPresence

<p align="center">
  <img src="docs/images/bichon-xiaobai.jpg" alt="小白，公开的小白狗桌宠 demo" width="360" />
</p>

<p align="center">
  <a href="README.md">English</a> | <strong>简体中文</strong>
</p>

PetPresence 是一个开源的桌面宠物制作流程。它不是一个要求你部署摄像头、云端识别和长期监控服务的复杂系统；当前开源版本的核心目标更朴素：让你在 Agent 的帮助下，用自己的宠物照片、短视频或视频生成模型输出，做出一个本地运行、可手动切换动作的私人桌面宠物。

项目最早来自一个黑客松 demo，当时的故事是“真实宠物状态驱动桌面陪伴 Agent”。现在的开源方向已经收束为更容易部署、更低成本、更适合个人使用的版本：上传或准备宠物素材，让 Agent 帮你生成制作计划、动作 prompt、素材清单和桌宠配置，最后在本地 Electron 桌宠里跑起来。

实时摄像头、多模态识别、event stream、日报和问答模块仍保留为 experimental reference，但它们不是默认开源体验，也不需要你为了使用这个项目去承担高额 API 或部署成本。

第一版公开仓库包含两个发布面：

1. **Creator Pipeline**：一套可复用的 Agent-assisted 制作流程。你可以用自己的宠物素材、本地视频，或任意视频生成模型输出，制作一个私人桌面宠物。
2. **Xiaobai / Bichon Demo**：一只已经清理好的小白狗桌宠 demo，`pet_bichon_demo`，包含六个 WebM 动作，并且不包含私有事件历史、原始 MP4、抽帧或报告。

## 快速开始

安装依赖：

```powershell
npm install
npm --prefix apps/desktop install
```

检查本地环境：

```powershell
npm run pet:doctor
```

运行公开的小白狗 demo：

```powershell
npm run smoke:bichon
npm run demo:bichon
```

运行最小 synthetic fixture：

```powershell
npm run pet:validate -- --pet-id pet_demo
npm run desktop -- --pet-id pet_demo
```

更完整的快速开始见：

```text
docs/quickstart.md
```

它会运行 `pet_demo`、检查 Agent pipeline smoke，并创建一个临时本地宠物；整个过程不会调用付费 API，也不会上传你的宠物素材。

## 你可以做什么

用 PetPresence，你可以创建一个本地桌面宠物：

- 播放你自己的宠物 `idle`、`sleep`、`eat`、`play`、`alert` 或自定义动作动画；
- 使用透明背景 WebM，形成轻量、低打扰的桌面陪伴体验；
- 通过每个宠物自己的 `action_assets.json` 管理动作；
- 通过右键菜单、demo events 或未来自定义规则切换动作；
- 让 Codex、Claude Code、GLM、DeepSeek 等 Agent harness 按项目 recipe 帮你完成制作流程。

当前优先验证的平台是 Windows 11。

## 仓库结构

```text
apps/desktop/                  Electron 桌面宠物运行时
assets/pets/<pet_id>/          每只宠物的动作视频资源
data/pets/<pet_id>/            每只宠物的 profile 和动作 manifest
docs/agent-recipes/            给 Agent 使用的工作流
scripts/creator/pet-cli.ts     init/add-action/validate/print-plan CLI
scripts/assets/                视频转透明 WebM 工具
services/event-server/         experimental 本地事件服务
services/observer/             experimental 多模态 observer
packages/protocol/             共享 PetActionEvent schema
packages/report/               experimental 本地日报生成
```

## 公开示例宠物

仓库里有两只公开示例宠物：

- `pet_demo`：很小的 synthetic fixture，用于 creator pipeline 和 CI 测试。
- `pet_bichon_demo`：清理后的小白狗桌宠 demo，包含六个可运行 WebM 动作。

### Synthetic Pipeline Fixture

校验 `pet_demo`：

```powershell
npm run pet:validate -- --pet-id pet_demo
```

启动桌宠：

```powershell
npm run desktop -- --pet-id pet_demo
```

### Xiaobai / Bichon Demo

不打开桌面窗口，只校验 cleaned public demo：

```powershell
npm run smoke:bichon
```

开发模式启动：

```powershell
npm run demo:bichon
```

`pet_bichon_demo` 包含：

- `idle`
- `eat`
- `sleep`
- `alert`
- `play`
- `out_of_view`

它有意排除了旧私有工作区中的 event JSONL、抽帧、生成报告、原始 MP4、alpha preview、contact sheet、checker image 和本地 `outputs/`。

## 制作你自己的桌宠

### 1. 创建宠物工作区

使用稳定的 ASCII `pet_id`。

```powershell
npm run pet:init -- --pet-id pet_huahua --name Huahua --species cat --description "A calm orange cat"
```

这会创建：

```text
data/pets/pet_huahua/profile.json
data/pets/pet_huahua/agent.md
data/pets/pet_huahua/action_assets.json
assets/pets/pet_huahua/
```

随时可以检查工作区和本地工具链：

```powershell
npm run pet:doctor -- --pet-id pet_huahua
```

### 2. 写 Creator Brief

在生成 prompt 或调用任何 provider 之前，先把用户选择写入本地 brief：

```powershell
npm run pet:create-brief -- --pet-id pet_huahua --actions idle,sleep,eat,play --media "D:\pets\huahua_idle.mp4,D:\pets\huahua_sleep.mp4" --video-api "not configured" --upload-consent "ask every time before uploading pet media" --force
```

这会写入：

```text
data/pets/pet_huahua/creator_brief.md
```

brief 会记录宠物身份、动作需求、已有素材、视频 API 状态、上传许可、隐私边界和验收标准。它不会调用视频 API、不会上传素材、也不会注册资源。

### 3. 规划第一批动作

```powershell
npm run pet:print-plan -- --pet-id pet_huahua
```

推荐第一批动作：

- `idle`：正面、轻微呼吸、稳定循环。
- `sleep`：趴下或蜷起来，稳定循环。
- `eat`：低头或吃东西，短动作。
- `play`：小跳、转身、挥爪或玩具互动。

为 Agent 或视频 provider 生成动作计划和 prompt：

```powershell
npm run pet:scaffold-actions -- --pet-id pet_huahua --actions idle,sleep,eat,play
```

这会写入：

```text
data/pets/pet_huahua/action_plan.md
data/pets/pet_huahua/prompts/<action>.txt
```

### 4. 注册透明 WebM

如果你的动作视频已经是透明 WebM：

```powershell
npm run pet:add-action -- --pet-id pet_huahua --action idle --input "D:\pets\huahua_idle.webm" --skip-alpha --loop true --message "I am here~"
```

### 5. 注册普通 MP4

如果动作视频是普通 MP4，并希望 PetPresence 立刻转成透明 WebM：

```powershell
npm run pet:add-action -- --pet-id pet_huahua --action eat --input "D:\pets\huahua_eat.mp4" --message "I am eating~" --convert-alpha
```

如果只想先复制并注册源 MP4：

```powershell
npm run pet:add-action -- --pet-id pet_huahua --action eat --input "D:\pets\huahua_eat.mp4" --message "I am eating~"
```

### 6. 校验

```powershell
npm run pet:validate -- --pet-id pet_huahua
```

预览前必须修复所有 `ERROR`。`WARN` 可以存在，但需要人工看一眼。

Agent 或脚本可以使用 JSON 输出：

```powershell
npm run pet:validate -- --pet-id pet_huahua --json
```

只有当 `summary.ok` 为 `true` 时再继续。

### 7. 预览

```powershell
npm run desktop -- --pet-id pet_huahua
```

用桌宠菜单切换动作，检查大小、透明度、动作循环和消息风格是否自然。

## Agent 工作流

PetPresence 本来就是为了让 Agent 操作而设计的。

如果你不是开发者，把这两个文件先交给 Agent：

```text
docs/user_guide_create_private_pet.md
docs/agent-recipes/create-your-pet.md
```

Agent 应该：

1. 运行 `pet:doctor` 检查本地环境；
2. 询问宠物名称、物种、动作列表和可用源视频；
3. 运行 `pet:init`；
4. 运行 `pet:create-brief` 记录用户选择、素材情况、API 状态、上传许可和验收标准；
5. 运行 `pet:scaffold-actions` 创建 `action_plan.md` 和 prompt 文件；
6. 准备、请求或生成短动作视频；
7. 运行 `pet:add-action`；
8. 必要时把 MP4 转为透明 WebM；
9. 运行 `pet:validate`；
10. 运行 `pet:doctor -- --pet-id <pet_id>`；
11. 启动桌面预览；
12. 根据你的视觉反馈迭代。

不上传素材、不调用付费 API 的 smoke test：

```powershell
npm run smoke:agent-pipeline
```

验证 quickstart 路径：

```powershell
npm run smoke:quickstart
```

## 视频生成模型

视频生成 API 是可选的。

PetPresence 不绑定某个 provider。你可以使用：

- 自己拍摄的 clips；
- 从已有宠物视频里剪出来的片段；
- 任意外部 image-to-video 或 video generation 模型；
- 未来自定义 provider adapter。

仓库核心负责的是：源视频存在以后，如何做前景提取、透明 WebM 输出、动作 manifest 注册、校验和桌面播放。

Provider adapter 文档：

```text
docs/provider-adapters.md
docs/provider_adapter_cookbook.md
```

本地 synthetic adapter：

```powershell
npm run provider:example -- --pet-id pet_huahua --action idle --prompt "Create a calm idle animation"
```

导入已有 MP4：

```powershell
npm run provider:import -- --pet-id pet_huahua --action idle --input "D:\pets\huahua_idle_from_model.mp4" --prompt-file "data/pets/pet_huahua/prompts/idle.txt"
```

校验 provider adapter JSON 结果：

```powershell
npm run provider:validate-result -- --input outputs/generated/pet_huahua/provider-result.json --pet-id pet_huahua --action idle
```

## Experimental Modules

原黑客松系统还包含：

- 本地 HTTP/WebSocket event server；
- mock 和 AI observer；
- 视频抽帧；
- `PetActionEvent` protocol；
- JSONL event history；
- 日报和 today-QA 实验；
- shelter demo 页面。

这些模块可作为参考，但不是默认 creator pipeline 的必要部分。

## 验证

CI 使用的快速检查：

```powershell
npm run verify:quick
```

发布前完整本地检查：

```powershell
npm run release:verify
```

第一次公开发布或打 tag 前的总门禁：

```powershell
npm run release:preflight
```

公开卫生检查会阻止意外发布 `.env`、API key、`outputs/`、private/legacy media、frames、events、reports 或 preview artifacts。

提交 release 改动前检查 Git index：

```powershell
npm run release:check-staged
```

## 隐私与安全

- PetPresence 默认 local-first。
- 不要提交私人宠物视频、API key 或付费模型输出，除非你明确拥有公开发布权利。
- 如果使用外部视频生成或多模态模型，请先看 provider 的数据政策。
- `outputs/`、抽帧、event JSONL 和生成报告默认都是私有本地数据。
- PetPresence 只描述可观察行为和用户提供的性格设定，不应声称诊断宠物情绪、心理或健康。

## 当前限制

- 桌面运行时主要在 Windows 上验证。
- MP4 到透明 WebM 的效果强依赖源视频质量。
- 白色或低对比度宠物在浅色背景上可能需要调参。
- 桌面菜单会读取 `action_assets.json` 里的动作，但动作体验仍取决于你提供的视频素材和循环设置。
- 安装包打包仍是后续任务。

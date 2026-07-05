# PetPresence 开源 Creator Pipeline 设计

## 1. 开源定位

PetPresence 的开源主线不是实时宠物监控，也不是重云服务产品，而是一套个人桌面宠物生成工作流：

```text
用户提供宠物照片、短视频和性格设定
  -> Agent 规划动作列表和素材需求
  -> 用户或 Agent 调用视频生成模型生成短动作视频
  -> 本地脚本把短视频处理成透明背景 WebM
  -> Creator CLI 写入宠物档案和 action_assets.json
  -> Electron 桌宠读取配置并播放动作
  -> 用户通过右键菜单、快捷命令或规则触发不同形态
```

项目的核心价值是让个人开发者和非技术用户在 Agent 帮助下做出自己的私人桌宠，而不是要求每个人部署摄像头、视频流、多模态识别和长期云服务。

## 2. 默认用户故事

### 非技术用户

用户准备几张宠物照片、若干短视频，或者拥有视频生成模型 API，然后把需求交给 Agent：

> 我想把我的猫“花花”做成桌面宠物。它需要 `idle`、`sleep`、`eat`、`play` 四个动作。请用 PetPresence 帮我生成项目配置、处理动作视频、验证素材并启动桌宠预览。

Agent 根据仓库文档执行命令、检查文件、修正配置，直到桌宠可以运行。

### 个人开发者

开发者 clone 仓库后，可以手动运行 creator 命令：

```powershell
npm run pet:init -- --pet-id pet_huahua --name Huahua --species cat
npm run pet:add-action -- --pet-id pet_huahua --action sleep --input D:\videos\huahua_sleep.mp4
npm run pet:validate -- --pet-id pet_huahua
npm run desktop -- --pet-id pet_huahua
```

第一阶段以 Windows 本地运行为主，跨平台和安装包作为后续目标。

## 3. 产品边界

第一阶段必须支持：

- 创建新的 `data/pets/<pet_id>/` 工作区。
- 写入 `profile.json`、`agent.md`、`action_assets.json`。
- 为指定 action 注册视频素材。
- 复用透明化脚本，把 MP4 转成 VP9 alpha WebM。
- 校验每个 action 的配置和文件是否存在。
- Electron 桌宠按 `pet_id` 读取对应配置。
- 用户通过右键菜单手动切换动作。
- README 和 Agent 指南能让别人复刻流程。

第一阶段不默认支持：

- 实时摄像头视频流。
- 长期云服务。
- 账号系统。
- 多用户同步。
- 硬件按钮。
- 医疗、心理或健康诊断。
- 自动保证视频生成模型一定生成高质量宠物动作。

这些能力可以保留为 experimental modules 或长期方向，但不能成为开源项目的安装门槛。

## 4. 仓库结构目标

```text
apps/
  desktop/                    # Electron 桌宠运行时
assets/
  pets/
    pet_demo/                 # 合成公开示例宠物
    pet_bichon_demo/          # 清洗后的小白/比熊公开 demo
    <pet_id>/                 # 用户本地生成的私人宠物素材
data/
  pets/
    pet_demo/                 # 合成公开示例宠物配置
    pet_bichon_demo/          # 清洗后的小白/比熊公开 demo 配置
    <pet_id>/                 # 用户本地生成的私人宠物配置
docs/
  agent-recipes/
    create-your-pet.md        # 面向 Agent 的一条龙操作手册
  open_source_creator_pipeline.md
scripts/
  creator/
    pet-cli.ts                # init/add-action/validate/print-plan
  assets/
    remove_background_to_alpha_webm.ps1
```

raw private legacy pet workspace、旧 shelter 资源和黑客松 presentation 是本地 legacy material，默认不进入公开发布面。公开小白狗体验使用清洗后的 `pet_bichon_demo`，只包含运行所需 WebM 和公开配置。

当前公开 `pet_demo` fixture 是完整 creator pipeline 样板，而不只是运行时素材。它应包含 9 个文件：

```text
assets/pets/pet_demo/idle/idle.webm
assets/pets/pet_demo/wave_paw/wave_paw.webm
data/pets/pet_demo/profile.json
data/pets/pet_demo/agent.md
data/pets/pet_demo/creator_brief.md
data/pets/pet_demo/action_plan.md
data/pets/pet_demo/prompts/idle.txt
data/pets/pet_demo/prompts/wave_paw.txt
data/pets/pet_demo/action_assets.json
```

其中 `creator_brief.md` 表示用户/Agent 开始制作前确认过的需求、素材来源、上传授权和验收标准；`action_plan.md` 与 `prompts/*.txt` 表示接下来交给 provider 或视频模型的动作计划。

当前公开 `pet_bichon_demo` fixture 是可直接运行的小白/比熊桌宠 demo。它包含 6 个 WebM 动作和完整 creator planning 文件，但不包含原始 MP4、历史 events、frames、reports 或 preview artifacts。

## 5. Creator CLI

### `pet:init`

创建宠物基础目录和配置。

输入：

- `--pet-id`：只允许字母、数字、下划线和短横线。
- `--name`：宠物展示名。
- `--species`：例如 `dog`、`cat`、`rabbit`、`bird`、`other`。
- `--description`：可选。

输出：

- `data/pets/<pet_id>/profile.json`
- `data/pets/<pet_id>/agent.md`
- `data/pets/<pet_id>/action_assets.json`
- `assets/pets/<pet_id>/`

### `pet:add-action`

为宠物注册动作素材。

输入：

- `--pet-id`
- `--action`：默认支持 `idle`、`sleep`、`eat`、`play`、`alert`、`out_of_view`，也支持自定义 action。
- `--input`：源 MP4 或已经处理好的 WebM。
- `--message`：动作气泡文案。
- `--loop`：是否循环。
- `--skip-alpha`：如果素材已经是透明 WebM，则跳过抠背景。
- `--convert-alpha`：立即调用透明化脚本生成 alpha WebM。

输出：

- `assets/pets/<pet_id>/<action>/<action>.mp4` 或 `.webm`
- 更新 `data/pets/<pet_id>/action_assets.json`

### `pet:validate`

检查宠物配置是否可运行。

检查项：

- `profile.json` 可解析。
- `action_assets.json` 可解析。
- `default_action` 存在。
- 每个 action 的 `path` 指向存在的文件。
- WebM/MP4 文件后缀和 `type` 一致。
- 必要气泡文案存在。

### `pet:print-plan`

根据宠物设定输出给 Agent 或用户看的动作制作清单。

## 6. Agent 协作流程

Agent 应按顺序完成：

1. 读取 `docs/agent-recipes/create-your-pet.md`。
2. 询问宠物名称、物种、动作列表、素材来源和视频生成 API 是否可用。
3. 执行 `pet:init`。
4. 执行 `pet:create-brief`，让用户确认 `creator_brief.md`。
5. 执行 `pet:scaffold-actions`，生成 `action_plan.md` 和 `prompts/*.txt`。
6. 为每个 action 收集或生成源视频。
7. 执行 `provider:import` 或具体 provider adapter，验证 provider contract。
8. 执行 `pet:add-action`。
9. 必要时执行 `--convert-alpha` 或手动透明化脚本。
10. 执行 `pet:validate`。
11. 启动桌宠预览。
12. 根据用户视觉反馈调整动作、缩放和气泡文案。
13. 说明哪些文件是私人本地素材，不应默认提交到公开仓库。

## 7. 视频生成模型的角色

视频生成 API 是可选增强，不是项目硬依赖。

第一阶段只要求用户能提供短 MP4。视频可以来自：

- 用户自己拍摄。
- 剪辑现有宠物视频。
- 任意视频生成模型。
- 未来的 PetPresence provider adapter。

当用户有视频生成 API 时，Agent 可以根据 `pet:print-plan` 生成提示词，然后让用户或工具调用模型生成素材。仓库只负责后续清理、透明化、注册和运行。

## 8. 开源前清理清单

- README 以 creator pipeline 为主线。
- `pet_demo` 和 `pet_bichon_demo` 是唯一公开 pet fixtures。
- raw private legacy pet workspace、shelter 和 presentation legacy material 不在公开发布面。
- `LICENSE`、`.env.example`、`CONTRIBUTING.md`、`PRIVACY.md` 存在。
- `services/observer`、event-server、report、shelter 页面均标记为 experimental。
- `npm run verify:quick` 通过，作为新贡献者和 CI 的快速检查。
- `npm run release:verify` 通过，作为发布前的完整本地 gate。
- `npm run release:audit-assets -- --fail-on-unresolved` 通过。
- 不提交真实 API key、私人素材或未确认版权的生成产物。

## 9. MVP 验收标准

第一版开源 creator pipeline 通过的标准：

1. 新用户 clone 仓库后能运行合成示例 `pet_demo` 桌宠。
2. 新用户能运行清洗后的小白/比熊示例 `pet_bichon_demo` 桌宠。
3. 新用户能用 CLI 创建新宠物。
4. 新用户能把至少一个 WebM 或 MP4 注册为动作素材。
5. `pet:validate` 能发现缺失文件和错误配置。
6. Electron 桌宠能读取新 `pet_id` 并播放新动作。
7. `docs/agent-recipes/create-your-pet.md` 足够让 Agent 按步骤完成一次私人桌宠制作。

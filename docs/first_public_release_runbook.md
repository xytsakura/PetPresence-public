# PetPresence 第一次公开发布 Runbook

更新时间：2026-07-04

这份 runbook 用于把当前私有/半公开的 PetPresence 仓库整理成第一次正式公开开源版本。它假设产品方向已经收敛为：

```text
用户宠物照片/视频或生成 clips
  -> Agent 规划动作和提示词
  -> provider/example/import 产出或归一化 MP4
  -> Creator CLI 注册动作并校验 manifest
  -> 可选 MP4 转透明 WebM
  -> Electron 桌面宠物读取 action_assets.json
  -> 用户通过菜单、命令或简单规则切换动作
```

实时摄像头观察、多模态识别、event-server、报告、QA 和 shelter 页面只作为 experimental 或 legacy 资料保留，不作为第一次公开发布的默认体验。

## 1. 发布目标

第一次公开发布只承诺这些内容：

- 一个干净的开源 creator pipeline。
- 一个 synthetic public fixture：`pet_demo`。
- 一个 cleaned ready-to-run Xiaobai/Bichon public demo：`pet_bichon_demo`。
- 一套 Agent 可执行的私人桌宠制作流程。
- 本地 synthetic provider、local MP4 import 和 provider contract validation。
- 开发模式 Electron 桌面预览。
- Windows-first 的验证链路。

第一次公开发布不承诺这些内容：

- 安装包。
- 图形化 creator wizard。
- 绑定某个商业视频生成 API。
- 云端账号、支付、托管生成服务。
- 实时摄像头监控作为默认产品。
- 医疗、心理、健康、安全诊断能力。

## 2. 公开前必跑命令

从仓库根目录运行：

```powershell
npm run release:check-hygiene
npm run smoke:public-hygiene
npm run release:readiness
npm run release:audit-assets -- --fail-on-unresolved
npm run verify:quick
npm run release:verify
npm run release:smoke-clean-export
npm run release:check-staged
npm run smoke:staged-release
git diff --check
```

期望结果：

- 所有 npm 命令通过。
- `release:check-hygiene` 不发现即将被 Git 带出的 `.env`、API key、`outputs/`、legacy/private media、frames、events 或 reports。
- `smoke:public-hygiene` 证明 hygiene gate 能拦截危险文件，并能在清理后放行。
- `release:audit-assets -- --fail-on-unresolved` 报告 0 unresolved、0 blocking。
- `release:check-staged` 不发现已经进入 Git index 的 `.env`、API key、`outputs/`、private/legacy media、frames、events、reports、key file 或 preview artifact。
- `smoke:staged-release` 证明 staged-content guard 会拦截危险 staged 文件，并在清理 index 后放行。
- `git diff --check` 最多出现 Windows LF-to-CRLF 提示，不应出现实际 whitespace error。
- `release:smoke-clean-export` 能在无 `.git`、无 `node_modules`、无 private media 的临时导出目录中通过 `verify:quick`。

如果只是在普通开发过程中快速自检，可以先跑：

```powershell
npm run verify:quick
```

但真正公开仓库或打 tag 前，必须跑完整命令组，或直接跑：

```powershell
npm run release:preflight
```

`release:preflight` 会刷新 stage plan，运行完整 release verification、clean export smoke、严格公开资产审计、staged 内容检查和 `git diff --check`。它不替代人工权利、隐私、仓库可见性或 release notes 判断。

## 3. 人工检查

自动化脚本不能替你判断这些事项：

- 确认 `pet_demo` 的合成视频、profile、action plan 和 prompts 都有公开发布权。
- 确认 `pet_demo` 的 9 个公开 fixture 文件都来自 synthetic/reproducible 流程：
  - `assets/pets/pet_demo/idle/idle.webm`
  - `assets/pets/pet_demo/wave_paw/wave_paw.webm`
  - `data/pets/pet_demo/profile.json`
  - `data/pets/pet_demo/agent.md`
  - `data/pets/pet_demo/creator_brief.md`
  - `data/pets/pet_demo/action_plan.md`
  - `data/pets/pet_demo/prompts/idle.txt`
  - `data/pets/pet_demo/prompts/wave_paw.txt`
  - `data/pets/pet_demo/action_assets.json`
- 确认 `pet_bichon_demo` 的公开 demo 文件只包含运行必需内容：
  - `assets/pets/pet_bichon_demo/idle/idle.webm`
  - `assets/pets/pet_bichon_demo/eat/eat.webm`
  - `assets/pets/pet_bichon_demo/sleep/sleep.webm`
  - `assets/pets/pet_bichon_demo/alert/alert.webm`
  - `assets/pets/pet_bichon_demo/play/play.webm`
  - `assets/pets/pet_bichon_demo/out_of_view/out_of_view.webm`
  - `data/pets/pet_bichon_demo/profile.json`
  - `data/pets/pet_bichon_demo/agent.md`
  - `data/pets/pet_bichon_demo/creator_brief.md`
  - `data/pets/pet_bichon_demo/action_plan.md`
  - `data/pets/pet_bichon_demo/prompts/*.txt`
  - `data/pets/pet_bichon_demo/action_assets.json`
- 确认 `pet_bichon_demo` 没有携带原始 MP4、events、frames、reports、alpha preview、contact sheet、checker image 或 `outputs/`。
- 确认没有 staged 或 untracked 的真实 `.env`、API key、用户宠物素材、付费模型输出、frames、events、reports、`outputs/`。
- 确认 GitHub 远端 Actions 已经通过。
- 决定默认分支保留 `master`，还是迁移到 `main`。
- 决定第一版 tag，例如 `v0.1.0`。
- 用 `docs/release_notes_template.md` 写 GitHub release notes。
- 检查 `README.md`、`CHANGELOG.md`、`PRIVACY.md`、`CONTRIBUTING.md` 是否仍然匹配当前发布范围。

## 4. 不要加回 Git 的内容

除非之后重新做权利确认和 release audit 决策，否则不要 stage 或重新加入：

- private legacy workspaces;
- shelter/adoption demo media;
- presentation artifacts;
- local outputs;
- source MP4 clips;
- extracted frames;
- event logs;
- generated reports;
- `.env` or `.env.*` files;
- real API keys;
- private pet photos or videos;
- paid-model outputs without explicit publication rights.

`.env.example` 是唯一应该公开的环境变量样例文件。

## 5. 建议提交顺序

当前工作树包含大量有意清理和新增文件。第一次公开前建议按主题拆提交，方便审查和回滚：

1. `public fixture and private asset cleanup`
2. `creator CLI and desktop runtime alignment`
3. `action scaffold, Agent pipeline smoke, and quickstart smoke`
4. `provider adapter example, local import, and contract validation`
5. `release verification and asset audit tooling`
6. `documentation, privacy, roadmap, changelog, and release notes`

每个提交前都先看：

```powershell
npm run release:stage-plan
npm run release:stage-plan -- --write-md
git status --short
git diff --cached --stat
```

不要用会覆盖工作树的命令清理历史改动。当前大量删除是为了移出 private/legacy 素材，不应被误恢复。

## 6. 推荐 Git 操作

先人工挑选本次提交要包含的文件：

```powershell
git add README.md CHANGELOG.md CONTRIBUTING.md PRIVACY.md LICENSE .env.example .github
git add docs package.json package-lock.json tsconfig.json
git add apps/desktop package-lock.json package.json packages scripts
git add assets/pets/pet_demo data/pets/pet_demo
git add assets/pets/pet_bichon_demo data/pets/pet_bichon_demo
```

然后确认 staged 内容：

```powershell
npm run release:stage-plan
npm run release:check-staged
git diff --cached --stat
git diff --cached --name-status
```

如果 `release:check-staged` 失败，或 staged 列表里出现 private legacy workspaces、shelter/adoption media、presentation artifacts、outputs、frames、events、reports、原始 MP4、preview artifact 或真实 `.env`，先停止，重新检查。

提交前再跑：

```powershell
npm run release:preflight
```

或者手动跑等价命令组：

```powershell
npm run release:verify
npm run release:check-hygiene
npm run smoke:public-hygiene
npm run smoke:staged-release
npm run release:audit-assets -- --fail-on-unresolved
npm run release:check-staged
git diff --check
```

提交示例：

```powershell
git commit -m "Prepare PetPresence open-source creator pipeline"
```

只有在本地和远端 CI 都通过后，再切换仓库可见性或打 tag。

## 7. GitHub 发布步骤

1. Push 到远端私有仓库。
2. 等待 GitHub Actions 通过。
3. 在 GitHub 上检查文件树，确认公开入口清晰：
   - `README.md`
   - `docs/README.md`
   - `docs/agent-recipes/create-your-pet.md`
   - `docs/open_source_creator_pipeline.md`
   - `data/pets/pet_bichon_demo/action_assets.json`
4. 确认仓库 Settings 里的 visibility 切换符合预期。
5. 切换 public 后，再创建 tag 和 release：

```powershell
git tag v0.1.0
git push origin v0.1.0
```

6. 用 `docs/release_notes_template.md` 填写 GitHub release notes。
7. 发布后重新从 GitHub clone 一份干净仓库，运行：

```powershell
npm ci
npm --prefix apps/desktop ci
npm run verify:quick
```

## 8. 发布后第一批 Issue

第一次公开后建议把后续工作拆成 issue，而不是塞进首版：

- Packaged installers for Windows。
- GUI creator wizard。
- Real video-generation provider adapter template。
- Better alpha extraction presets。
- Cross-platform desktop smoke。
- Example gallery using only publishable synthetic fixtures。
- Clearer Agent prompt templates for different pet species。

这样首版更干净，也更容易让外部贡献者理解项目边界。

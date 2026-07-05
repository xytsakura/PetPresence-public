# PetPresence 开源路线图

这份路线图把 PetPresence 从黑客松 demo 收束成一个干净的开源项目。当前主线不是实时宠物监控，而是私人桌面宠物 creator pipeline。

默认目标是：

```text
用户准备宠物照片、短视频或视频生成模型产物
  -> Agent 规划动作和素材
  -> Creator CLI 创建宠物档案并注册动作素材
  -> 本地脚本把普通 MP4 处理成透明 WebM
  -> Electron 桌宠按 action_assets.json 播放动作
  -> 用户通过菜单、快捷命令或规则切换宠物形态
```

实时摄像头、视频流、多模态识别、事件服务器、日报、问答和 shelter 页面保留为 experimental 或 legacy 模块，不作为新用户上手的必需条件。

## 1. 当前资源判断

当前仓库已经足够支撑第一版开源 MVP：

- 有 Electron 桌宠运行时。
- 有合成公开示例宠物 `pet_demo`。
- 有 `action_assets.json` 动作 manifest。
- 有 Creator CLI：`pet:init`、`pet:add-action`、`pet:validate`、`pet:print-plan`。
- 有普通 MP4 到透明 WebM 的处理脚本。
- 有可复现的 `smoke:creator-alpha`，验证 MP4 到 alpha WebM 的真实链路。
- 有 Agent recipe。
- 有 README、LICENSE、PRIVACY、CONTRIBUTING 和 release checklist 雏形。
- 公开发布面保留 synthetic `pet_demo` fixture 和 cleaned ready-to-run `pet_bichon_demo` fixture；raw private legacy pet workspace、shelter 资源和旧 presentation 已作为本地 legacy material 排除。

当前还不适合承诺“完全不懂技术的人不用 Agent 也能稳定完成”：

- 还没有图形化制作向导。
- 还没有绑定具体厂商的视频生成 API adapter；已有中立 provider template 和 cookbook。
- 还没有安装包打包和发布流程。
- 还没有素材质量自动评分。
- 旧 experimental 模块还需要继续隔离和文档清理。

## 2. 三条产品路径

### 路径 A：干净开源工具链

目标用户：

- 个人开发者。
- 会使用 Codex、Cursor、Claude 等 coding Agent 的非技术用户。
- 想自己掌控素材和本地运行的人。

交付形态：

- 开源仓库。
- Creator CLI。
- Agent recipe。
- 合成示例宠物。
- 本地桌宠预览。
- 清晰的素材处理文档。

工程复杂度：低到中。

主要成本：

- 文档打磨。
- Windows 本地兼容性。
- 透明化脚本稳定性。
- 公开 fixture 和隐私边界治理。

盈利方式：

- 先建立开源影响力，不急于直接收费。
- 后续承接定制桌宠、教程、赞助、模板包或动作包。

这是最适合作为第一阶段的路线，因为它符合当前资源状态，也不会把项目拖进昂贵的实时视频流部署。

### 路径 B：Agent-assisted 私人桌宠工坊

目标用户：

- 想要自己的宠物桌宠，但不想理解工程细节的人。
- 愿意为成品、动作设计或个性化效果付费的人。

交付形态：

- 开源核心工具链保持免费。
- 增加更强的 Agent playbook。
- 增加素材质量检查。
- 增加视频生成 prompt 模板。
- 使用 provider adapter template 和 cookbook 接入具体厂商，但不把商业 API 变成开源核心依赖。
- 增加一键预览和打包说明。

工程复杂度：中。

主要成本：

- 设计制作向导。
- 处理失败恢复：缺文件、视频太长、抠图失败、动作不循环、透明边缘闪烁。
- 适配多个视频生成模型的 API 差异。
- 维护新手友好的错误提示。

盈利方式：

- 付费制作服务：用户提交宠物素材，我们代做成桌宠。
- 高级模板包：动作设计、气泡文案、桌宠皮肤。
- 视频生成额度或模型调用服务。
- Agent 工作流课程或模板。

这是最适合从开源项目自然长出来的商业化方向。

### 路径 C：实时陪伴与云服务

目标用户：

- 愿意部署摄像头的重度用户。
- 希望远程陪伴真实宠物状态的家庭。
- 可能的宠物机构、救助站或硬件合作方。

交付形态：

- 摄像头视频流。
- 多模态识别。
- 本地或云端事件服务。
- 桌宠状态实时映射。
- 日报、问答、家庭共享、云端历史。

工程复杂度：高。

主要成本：

- 视频流稳定性。
- 模型调用费用。
- 隐私与合规。
- 用户账号和云端存储。
- 长期运行、告警和设备兼容。

盈利方式：

- 订阅制。
- 硬件合作。
- 家庭宠物陪伴服务。
- 宠物机构或救助站 SaaS。

这条路线适合作为长期故事和实验方向，不适合作为开源仓库的默认上手路径。

## 3. 推荐阶段

### Phase 0：公开前整理

目标：仓库打开后，用户一眼能看懂当前主线。

验收标准：

- README 只把 creator pipeline 放在默认路径。
- `docs/README.md` 给出清晰文档导航。
- 旧黑客松文档默认不进入公开 release tree，如需发布需单独做隐私和素材权利审计。
- experimental 模块有明确标签。
- synthetic `pet_demo` 能运行。
- 不提交真实 API key、私人素材或不确定版权的生成产物。
- `npm run release:audit-assets -- --fail-on-unresolved` 通过。

### Phase 1：开源 MVP

目标：个人开发者或 Agent 能完成一次私人桌宠制作。

验收标准：

- 新用户能创建一个新 `pet_id`。
- 能注册至少一个透明 WebM。
- 能注册普通 MP4，并看到透明化提示或使用 `--convert-alpha`。
- `npm run smoke:creator-alpha` 能验证 MP4 到透明 WebM 链路。
- `pet:validate` 能发现缺失文件。
- 桌宠菜单能动态读取该宠物的动作列表。
- Agent recipe 能指导 Agent 完成一次端到端流程。

### Phase 2：Agent 一条龙

目标：用户只需要提供宠物资料和素材，Agent 可以稳定执行制作流程。

验收标准：

- 有更完整的任务清单和失败恢复策略。
- 有素材命名和目录约定。
- 有视频生成 prompt 模板。
- 有 provider adapter 接口、模板和 cookbook。
- 有素材质量检查 checklist。
- 有打包安装说明。

### Phase 3：商业化实验

目标：在不破坏开源核心的前提下探索付费。

候选方向：

- 定制桌宠制作服务。
- 高级动作模板包。
- 视频生成 provider 集成。
- 桌宠打包器。
- 轻量云端素材生成服务。

## 4. 近期优先级

1. 保持公开入口干净：README、docs index、Agent recipe、release checklist。
2. 继续隔离 legacy/hackathon 文档和素材。
3. 增强 `pet:validate` 与 smoke，覆盖更多 manifest、素材路径和运行时入口问题。
4. 保持 provider adapter scaffold 和 cookbook 可用，但先不绑定具体商业模型。
5. 从 clean clone 视角复跑 README，确认新用户不会碰到 legacy 路径。

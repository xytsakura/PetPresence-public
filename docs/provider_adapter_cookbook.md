# 视频生成 Provider Adapter Cookbook

这份 cookbook 给想接入真实视频生成 API 的开发者和 Agent 使用。PetPresence 不绑定某个厂商；你可以用任意能生成短 MP4 的服务，只要最后输出同一个 provider JSON contract。

当前开源核心提供三种层级：

| 层级 | 命令/文件 | 用途 |
| --- | --- | --- |
| 本地合成示例 | `npm run provider:example` | 不调用 API，用于 smoke test |
| 本地 MP4 导入 | `npm run provider:import` | 用户已经有外部模型生成的 MP4 |
| 真实 API 模板 | `scripts/providers/provider-template.ts` | 复制后改成某个厂商 adapter |

## 1. 什么时候需要真实 adapter

先不要急着写真实 adapter。优先判断用户处在哪条路径：

- 用户已经有 MP4：用 `provider:import`。
- 用户只想验证流程：用 `provider:example`。
- 用户有视频生成 API key，并且愿意把宠物素材上传给该服务：再写真实 adapter。

真实 adapter 的价值是把这些动作自动化：

```text
读取 prompt 和参考图
  -> 调用视频生成 API
  -> 等待任务完成
  -> 下载 MP4 到 outputs/generated/<pet_id>/<action>.mp4
  -> 输出 provider-result.json
  -> 交给 pet:add-action 透明化和注册
```

## 2. 不变的输出契约

真实 adapter 成功时必须输出：

```json
{
  "ok": true,
  "provider": "your-provider-name",
  "pet_id": "pet_huahua",
  "action": "idle",
  "source_video": "outputs/generated/pet_huahua/idle.mp4",
  "prompt": "Create a short idle animation...",
  "reference_images": ["D:/pets/huahua_front.jpg"],
  "next_command": "npm run pet:add-action -- --pet-id pet_huahua --action idle --input \"outputs/generated/pet_huahua/idle.mp4\" --convert-alpha --loop true --message \"I am here~\""
}
```

然后运行：

```powershell
npm run provider:validate-result -- --input outputs/generated/pet_huahua/provider-result.json --pet-id pet_huahua --action idle
```

验证通过后，再运行 `next_command`。

## 3. 环境变量

真实 adapter 应读取本地环境变量：

```text
PETPRESENCE_VIDEO_PROVIDER=your-provider-name
PETPRESENCE_VIDEO_API_KEY=
PETPRESENCE_VIDEO_API_BASE=
```

规则：

- API key 不写进代码。
- API key 不写进 `.env.example`。
- API key 不写进 README、issue、截图、日志或报告。
- 如果 adapter 需要更多变量，例如 model id、region、webhook secret，可以用 `PETPRESENCE_VIDEO_` 前缀。

## 4. 用户授权边界

只要要上传用户宠物照片、视频或私人路径，就必须先确认：

```text
这个 adapter 会把以下素材上传到 <provider>：
- <reference image path>
- <reference video path>

请确认你已经阅读该 provider 的数据政策，并允许本次上传。
```

建议 adapter 支持显式参数：

```powershell
--confirm-upload
```

如果有 `--reference-image` 或 `--reference-video`，但没有 `--confirm-upload`，adapter 应该失败并提示用户确认。

## 5. 推荐实现步骤

复制模板：

```powershell
Copy-Item scripts\providers\provider-template.ts scripts\providers\your-provider.ts
```

然后改这些部分：

1. `provider` 名称。
2. API request body 的字段映射。
3. 任务提交接口。
4. 任务轮询接口。
5. 视频下载接口。
6. 错误信息归一化。
7. 成功后调用 `buildProviderResult(...)` 输出 contract。

推荐命令形态：

```powershell
npm run provider:your-provider -- --pet-id pet_huahua --action idle --prompt-file "data/pets/pet_huahua/prompts/idle.txt" --reference-image "D:\pets\huahua_front.jpg" --confirm-upload
```

新增 npm script 时，使用清楚的 provider 名字：

```json
{
  "scripts": {
    "provider:your-provider": "tsx scripts/providers/your-provider.ts"
  }
}
```

如果这个 adapter 依赖真实 API，不要把它加入默认 CI gate。默认 CI 应继续使用 `provider:example` 和 `provider:import`。

## 6. 伪代码

真实 adapter 的主流程通常长这样：

```text
read flags
validate pet_id and action
read prompt or prompt-file
resolve reference images/videos
require API key and API base
require --confirm-upload when uploading private media
submit generation job
poll until succeeded/failed/timeout
download final MP4 to outputs/generated/<pet_id>/<action>.mp4
write provider-result.json
print provider-result.json
```

失败时要清楚说明：

- 是缺 API key；
- 是用户未授权上传；
- 是 provider 拒绝输入；
- 是任务超时；
- 是 provider 没有返回视频；
- 是下载结果不是 MP4。

## 7. 质量检查

真实 adapter 只证明“拿到了一个 MP4”，不证明它就是好素材。注册前仍要人工或 Agent 检查：

- 宠物身份是否还像原宠物。
- 动作是否明确。
- 背景是否适合抠图。
- 有没有文字、水印、字幕。
- 有没有奇怪的额外物体。
- `idle` 和 `sleep` 是否能自然循环。

生成质量不达标时，优先调整 prompt、参考图或模型参数，而不是改 PetPresence manifest。

## 8. 交付给 Agent 的 adapter 任务提示

把下面这段给 Agent：

```text
请为 PetPresence 写一个真实视频生成 provider adapter。

要求：
- 先阅读 docs/provider-adapters.md 和 docs/provider_adapter_cookbook.md。
- 从 scripts/providers/provider-template.ts 复制新文件，不要改坏 provider:example 和 provider:import。
- API key 只从 PETPRESENCE_VIDEO_API_KEY 读取。
- API base 只从 PETPRESENCE_VIDEO_API_BASE 读取。
- 如果上传任何 reference image/video，必须要求 --confirm-upload。
- 成功输出必须通过 npm run provider:validate-result。
- 下载视频必须保存为 outputs/generated/<pet_id>/<action>.mp4。
- 不要直接修改 action_assets.json；交给 pet:add-action。
- 不要把真实 API key、私有素材、provider 原始响应或下载 URL 提交到仓库。
- 给我一个本地手动测试命令，但不要把真实 API smoke 加入默认 CI。
```

## 9. 首版开源建议

第一次公开发布不应该包含真实商业 provider 的默认实现。更稳妥的做法是：

- 开源 contract、模板、cookbook 和 local import。
- 让用户或二次开发者自己选择 provider。
- 后续按 issue 或插件形式增加具体厂商 adapter。

这样可以避免把 API 成本、隐私政策和厂商稳定性变成 PetPresence 的安装门槛。

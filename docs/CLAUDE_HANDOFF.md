# Claude 交接说明

更新时间：2026-09-27

## 本轮已完成

### 首页模式选择

文件：`src/views/ModeSelection.vue`

- 单机模式默认选中，首页打开后“初入仙途”按钮可直接使用。
- 单机与云端卡片使用自绘 PNG 图标：
  - `src/assets/mode-icons/single.png`
  - `src/assets/mode-icons/cloud.png`
- 离线时隐藏右上角“离线”状态徽章；后端可用时显示“已连接”。
- 首页标题拆成“仙”和“途”两个元素，便于单独调整颜色。
- “仙”已改为青绿色/蓝色渐变，并调整了对应的发光动画。
- 增加了首页明暗主题切换按钮及相应视觉样式。

### 六项属性卡片

文件：`src/components/character-creation/Step6_AttributeAllocation.vue`

- 六项属性改用自绘 PNG 图标，图标资源位于 `src/assets/attribute-icons/`。
- 放大了卡片内图标和图标底圈，提升辨识度。
- 调整卡片间距、文字层级和描述文字，使六张卡片在现有外框内完整显示。
- 保持角色创建页外层框尺寸不变，避免出现额外滚动条。

### 游戏页“根本”指标

文件：`src/components/dashboard/RightSidebar.vue`、`src/styles/game-theme.css`

- 气血、灵气、神识、寿元和声望都已替换为自绘透明 PNG 图标。
- 图标资源位于 `src/assets/status-icons/`：`blood.png`、`spirit.png`、`sense.png`、`lifespan.png`、`reputation.png`。
- 指标图标显示为 28px，保留原有数值、进度条和颜色逻辑。

## 资源与构建配置

- `src/env.d.ts` 已声明 `*.png` 模块。
- `webpack.config.js` 已配置 PNG 资源输出到 `assets/[name][ext]`。
- 图标是透明背景 PNG；如果后续替换资源，需保持透明通道，避免出现白色方块。

## 已验证

- 在项目根目录执行 `npm run type-check` 已通过。
- 开发服务器热更新可正常编译；首页后端离线时云端卡片仍保持禁用状态。

## 后续修改注意

- 不要轻易修改角色创建页外层 `.creation-scroll` 或整体框架尺寸；优先调整六个属性卡片内部布局。
- 修改首页标题颜色时，优先改 `ModeSelection.vue` 中的 `--ms-title-gradient`，不要直接改背景图。
- 离线状态的隐藏逻辑依赖 `v-if="backendReady"`，不要恢复成始终渲染的状态徽章。
- 当前工作区包含其他历史功能改动，交接时不要执行全量回滚或重置未相关文件。

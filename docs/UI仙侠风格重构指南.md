# UI 仙侠风格重构指南（局外界面）

> 用途：给后续接手 UI 重构的人 / AI 作为提示词与规范。改任何局外界面前先读完本文件。
> 范围：首页、设置、创角、续前世因缘（角色管理）、API 管理、提示词管理、全局提示弹窗与菜单。**局内（/game 下的面板）暂不处理。**

## 1. 设计方向

- 关键词：**修仙、古籍、水墨、玉璧、朱印、鎏金**。不要做成通用的"科技蓝玻璃拟态"。
- 双主题，必须同时可用：
  - 暗色「夜山松烟」：玄青底 + 鎏金细线 + 靛紫灵光。
  - 亮色「宣纸淡墨」：米黄纸底 + 墨色文字 + 朱砂印。
- 主题状态唯一来源：`src/composables/useTheme.ts`（`preference` / `resolvedTheme` / `setTheme` / `toggleTheme`）。**不要**再在组件里直接 `setAttribute('data-theme')`。

## 2. 颜色令牌（全局，`src/styles/xian-tokens.css`，在 `main.ts` 引入）

一律用令牌，不写死颜色；亮色自动切换，**不要再写 `[data-theme='light']` 的颜色覆盖**（品阶色等内容色除外）。

| 令牌 | 用途 |
| --- | --- |
| `--cc-shell-bg` / `--cc-shell-border` / `--cc-shell-shadow` | 大面板、弹窗外壳（半透明） |
| `--cc-solid-bg` | 不透明底（抽屉、下拉等需遮住下层时） |
| `--cc-surface` / `--cc-surface-2` / `--cc-surface-hover` | 卡片 / 次级块 / 悬停 |
| `--cc-inset` | 输入框、分段控件底 |
| `--cc-border` / `--cc-border-strong` / `--cc-divider` | 边框 / 强边框 / 分隔线 |
| `--cc-text` / `--cc-text-2` / `--cc-text-3` | 主文 / 次文 / 弱文 |
| `--cc-accent`(+`-rgb`) | 靛青强调（选中文字、焦点环） |
| `--cc-gold`(+`-rgb`) | 鎏金：装饰线、图标、数值 |
| `--cc-seal` / `--cc-seal-text` | 朱印：勾选印、徽记、未保存红点 |
| `--cc-danger`(+`-rgb`) / `--cc-success` / `--cc-warning`(+`-rgb`) | 状态色 |
| `--cc-primary-bg` / `--cc-primary-border` / `--cc-primary-shadow` | 主按钮 |
| `--cc-selected-bg` / `--cc-glow` | 选中项背景与光晕 |
| `--cc-calligraphy` | 书法字体栈（Ma Shan Zheng → 行楷 → 楷体） |
| `--cc-watermark` / `--cc-caret` | 空态水印字色 / select 下拉箭头 |

内容色（天资品阶、灵根品级、五行）在亮色下用 `color-mix(in srgb, <色> 55%, #221d16)` 压暗以保证可读。

## 3. 通用组件类（`src/styles/creation-theme.css`，在 `main.ts` 全局引入）

| 类 | 说明 |
| --- | --- |
| `cc-split` | 左列表 + 右详情 两栏布局（≤640px 自动上下排列） |
| `cc-panel` | 通用面板卡片 |
| `cc-actions` + `cc-action` | 面板顶部操作按钮组（带金色图标） |
| `cc-list` / `cc-item` / `cc-item-main` / `cc-item-name` / `cc-item-meta` / `cc-item-check` / `cc-item-tools` | 列表项；`.selected` 有金色左竖条 + 朱印勾，`.disabled` 置灰 |
| `cc-icon-btn`（`.danger`） | 编辑 / 删除小图标按钮 |
| `cc-divider` | 带菱形的金色分隔线 |
| `cc-detail` + `cc-detail-inner` / `-head` / `-title`（书法大字）/ `-sub` / `-rule` / `-body` | 详情面板 |
| `cc-stat-row` + `cc-stat`（内含 `<strong>`） | 数值徽签 |
| `cc-placeholder`（带"道"字水印）/ `cc-state`（`.error`） | 空态 / 加载 / 错误 |
| `cc-btn`（`.primary` `.small`） | 按钮 |
| `cc-input`（input / textarea / select 通用） | 输入 |
| `cc-segmented`（子元素 `button.active` 或 `label>input[type=radio]`） | 分段选择 |
| `cc-section-title` | 金色小节标题 + 渐隐横线 |
| `cc-tool-btn`（`.done` `.danger`） | 顶部工具小按钮 |
| `cc-modal-overlay` / `cc-modal`（`.wide`；叠在其他弹窗上时加 `.solid` 垫不透明底）/ `-head` / `-title` / `-close` / `-body` / `-foot`、`cc-field`、`cc-hint`、`cc-errors` | 弹窗 |
| `cc-spin` | 旋转动画（配 lucide `Loader2`） |

## 4. 视觉语汇（照做即可）

- **标题**用书法字体 `var(--cc-calligraphy)`，字距 0.08–0.2em；正文仍用宋体衬线。
- **面板外框**：圆角 6px，`::before` 内缩 9px 的细金框，四角 `frame-corner` 回纹（见 `CharacterCreation.vue` / `ModeSelection.vue`）。
- **图标**只用 `lucide-vue-next`，**不要用 emoji**。代表性图标可换成书法单字放在"玉璧"圆盘里（径向渐变底 + 金色细环 + 外圈虚线环，悬停虚线环旋转）。
- **选中态**：金色左竖条 + 朱印勾 / 金边 + 柔光；不要大面积高饱和色块。
- **主按钮**：`cc-btn primary`（靛紫渐变 + 金边），可加流光 `::after`；次按钮 `cc-btn`。
- **空态**：`cc-placeholder` 大号"道"字水印。
- 交互元素需有 `:focus-visible` 焦点环；可点击的 div 加 `role="button" tabindex="0"` + `@keydown.enter`。
- 动画尊重 `prefers-reduced-motion`。
- 移动端：≤768 平板、≤480 手机；按钮在手机上撑满，不能横向滚动。
- 右上角全局菜单 FAB（48px）会盖住面板右上角，面板头部在 481–1400px 需留 `padding-right: 56px`。

## 5. UI 与逻辑一致（设置类界面必须遵守）

- **依赖开关的选项，只在开关开启时出现**，并以"子项"形式缩进在开关正下方（`setting-item nested` / `setting-item-nested`，带金色 L 形引线）。例：
  - 分步生成 → 第 2 步使用的 API、第 2 步流式传输
  - 向量检索 → Embedding API、检索数量
  - 文本润色 → 开启后才出现 API 选择
  - 成人内容模式 → 性别偏好；行动选项 → 自定义行动选项提示词；调试模式 → 控制台调试、性能监控
- 未生效的配置不在别处"冒出来"：例如 API 卡片上的"已分配功能"只列当前生效的功能（`isFunctionActive`）。
- 描述要说**做什么 / 有什么代价**，不写内部字段名（如 tavern_commands）；描述可随开关状态切换文案。
- 名称去掉技术后缀（"指令生成（分步第2步）"→ 放进"分步生成"下作为"第 2 步使用的 API"）。
- 缩写要写全（提示词权重的"W"→"权重"）；只有图标没文字的按钮要么加文字、要么有 `title`。
- 弹窗里嵌面板时，面板提供 `closable` 属性 + `close` 事件，外层不要再套一层标题栏（避免双标题）。
- 看起来可点的区域必须真的可点（如整块拖放区都能打开文件选择）；搜索框输入后要真的触发查询。
- 提交按钮在必填项未满足时直接禁用，而不是点了再报错；切换类型等会让已选内容失效的操作，要同步清空。

## 6. 改造流程（每个组件）

1. 模板：换成 `cc-*` 通用类；emoji → lucide 图标；给可点击元素补可访问性。
2. 样式：删掉旧 `<style scoped>` 中所有写死颜色和 `[data-theme]` 覆盖，只保留该组件特有的布局 / 内容色，全部改用 `--cc-*`。
3. 注意全局样式泄漏：`style.css` 里有 `.selection-content`、`.main-title`、`.btn` 等全局规则，`panel-theme.css` 有 `.panel-header`、`.action-btn` 等——同名类需在 scoped 里显式覆盖或改名。
4. 新增中文文案要在 `src/i18n/index.ts` 的映射表补英文。
5. 验证：`npx vue-tsc --noEmit -p .`、`npx eslint <文件>`，并在浏览器分别看暗 / 亮主题和手机宽度。
6. 页面仍用 `--color-*` 时，根元素加 `class="xian-scope"` 即映射到仙侠配色（见 creation-theme.css）。
7. `<select>` 下拉已在 `xian-tokens.css` 统一处理：支持的浏览器（Chrome/Edge 135+）用 `appearance: base-select` 渲染主题化下拉面板，其余浏览器回退为原生列表 + 主题选项色。新页面若根元素不在其作用容器列表里，给根元素加 `xian-scope` 即可；不要再单独写下拉样式，也不要为此改成自定义组件（会丢失原生键盘/无障碍行为）。
8. Bash 的 heredoc 写含中文的大段内容容易失败 → 先用 Write 写到 scratchpad，再拼接。

## 7. 进度

- [x] 首页 `views/ModeSelection.vue`
- [x] 设置 `dashboard/SettingsPanel.vue`（首页弹窗与局内共用）
- [x] 创角外壳 `views/CharacterCreation.vue` + 7 个步骤组件
- [x] 创角弹窗：`CustomCreationModal` `AIPromptModal` `RedemptionCodeModal` `PresetSaveModal` `PresetLoadModal`（导入/导出子弹窗靠 `--color-*` 映射跟随）
- [x] 顶部工具按钮 `CloudDataSync` `StorePreSeting` `LoadingPreSeting` `DataClearButtons`
- [x] 全局提示 `common/ToastContainer.vue`
- [x] 确认弹窗 `common/RetryConfirmDialog.vue`
- [x] 全局菜单 `common/ActionMenu.vue`（App.vue 中的菜单项，分组用 `action-menu-divider`）
- [x] API 管理 `dashboard/APIManagementPanel.vue`（首页弹窗用 `closable` 属性去掉外层重复标题）
- [x] 续前世因缘 `character-creation/CharacterManagement.vue`（4253 → ~2400 行；`LegacySaveMigrationModal` 未改）
- [x] 提示词管理 `dashboard/PromptManagementPanel.vue`（`closable`）
- [x] 教程 / 赞助弹窗（`App.vue` 内）
- [x] 创意工坊 `WorkshopView`（全量改为 `cc-*`：书法标题+玉璧徽记、分段标签、栅格工具栏、卡片金竖条、底栏分页；搜索改为输入即查）、账号中心 `AccountCenter`
- [x] 登录 `LoginView`（补上原本不显示的错误提示；Turnstile 主题取自 `useTheme`）
- [x] 旧存档转化 `LegacySaveMigrationModal`、预设导入 / 导出子弹窗 `PresetImportModal` `PresetExportModal`（`cc-modal solid`）

局外界面已全部完成；后续新增局外界面照本文规范即可。

---

## 8. 局内（/game）

> **页面布局以 `docs/UI页面重构设计文档.md` 为准。** 第一轮（本节下方）只换了皮、骨架未变，用户不认可；本节只保留令牌与通用类的说明，8.4 的外壳约定和 8.5 的进度作废，以新文档为准。

### 8.1 分层

- `src/styles/game-theme.css`（`main.ts` 全局引入）：局内专用令牌 `--gm-*` + 通用类 `gm-*`，建立在 `--cc-*` 之上。
- `GameView` 根元素带 `gm-view`：把旧的 `--color-*` 映射到仙侠配色（不透明），并统一滚动条、焦点环、减弱动效。未改造的面板因此也能先跟上配色。

### 8.2 局内令牌

| 令牌 | 用途 |
| --- | --- |
| `--gm-page-bg` / `--gm-rail-bg` / `--gm-bar-bg` | 页面底 / 左右栏底 / 顶栏底 |
| `--gm-paper` / `--gm-card-bg` | 面板卷面底 / 卡片底 |
| `--gm-hp` `--gm-mp` `--gm-sense` `--gm-life` `--gm-cultivation` | 气血(朱) / 灵气(靛) / 神识(金) / 寿元(青) / 修为(紫) |
| `--gm-text-env` `--gm-text-dialogue` `--gm-text-psy` `--gm-text-quote` | 叙事：环境【】 / 对话 / 心理 / 引用 |
| `--gm-reading-size` / `--gm-reading-leading` | 正文字号 / 行高 |

### 8.3 通用类

| 类 | 说明 |
| --- | --- |
| `gm-label` | 金色小标题 + 渐隐横线（分组名） |
| `gm-calli` | 书法字体 |
| `gm-sec` / `-head`（`.toggle` `.collapsed`）/ `-title` / `-body` | 小节卡 |
| `gm-meter`（`style="--meter: var(--gm-hp)"`）/ `-row` / `-name` / `-val`（`<i>/上限</i>`）/ `-track` / `-fill` | 数值条 |
| `gm-chip`（`.gold` `.buff` `.debuff`；`<button>` 自带悬停） | 签条 |
| `gm-seal` | 朱印方章（单字） |
| `gm-disc`（`.lg` 带外圈虚线） | 玉璧圆盘（图标 / 单字） |
| `gm-panel` + `gm-toolbar`（`.grow`）+ `gm-panel-body` | 功能面板内部骨架 |
| `gm-grid`（`--gm-grid-min`）+ `gm-card`（`.clickable` `.selected`） | 卡片栅格 |
| `gm-kv`（`<dl><dt><dd>`） | 键值行 |

弹窗、按钮、输入、分段、空态继续用 `cc-*`（见第 3 节）。

### 8.4 外壳约定

- `GameView`：`TopBar` + 左栏 `rail-left`（228px）+ 中栏 `stage` + 右栏 `rail-right`（276px）；≤768px 两栏变抽屉。
- 功能面板统一由 `GameView` 的 `panel-overlay` 承载：头部是「返回 + 玉璧图标 + 书法标题 + 工具按钮（`panelBus`）」，**面板自身不要再画标题栏**，直接从工具条 / 内容开始。
- 面板根元素用 `gm-panel`，高度撑满 `panel-shell`；内容滚动放在 `gm-panel-body`。
- `LeftSidebar` 是数据驱动的 `navSections`，新增入口改数组即可；当前路由自动高亮。
- `FormattedText` 的类名已加 `jc-` 前缀：`design-system.css` / `style.css` 有全局 `.stat-*`、`.card-*`，**局内组件起名避开这些通用词**（或加前缀）。

### 8.5 局内进度

- [x] 外壳 `GameView` / `TopBar`（新增主题切换）/ `LeftSidebar` / `RightSidebar`
- [x] 主叙事 `MainGamePanel` + `FormattedText`（判定签、规则弹窗）
- [ ] 人物详情 `CharacterDetailsPanel`
- [ ] 背包 `InventoryPanel`
- [ ] 功法 `SkillsPanel`
- [ ] 大道 `ThousandDaoPanel`
- [ ] 炼制 `CraftingPanel`
- [ ] 世界事件 `EventPanel`
- [ ] 记忆 `MemoryCenterPanel`
- [ ] 存档 `SavePanel`
- [ ] 地图 `GameMapPanel` / `RegionMapPanel` / `UnmappedLocationsPanel`
- [ ] 宗门 `SectSystemPanel` / `SectPanel` / `Sect*Content`
- [ ] 游戏变量 `GameVariablePanel` + `components/GameVariable*`
- [ ] 弹窗 `DetailModal` / `StatusDetailCard` / `StateChangeViewer` / `BodyStatsPanel` 等

# 多 AI 并行重构任务提示词

使用方式：每个 AI 使用独立分支或独立工作树，并把对应提示词完整发给它。三个任务可以并行，但禁止跨任务修改对方负责的核心文件。

公共参考文档：`重构协作计划.md`

## 认领状态

| 任务 | 状态 | 认领 |
| --- | --- | --- |
| AI 1：主界面、路由和旧功能清理 | 已完成（已整合） | Cursor，2026-09-27 |
| AI 2：游戏变量、提示词、三千大道和宗门 | 已完成（已整合） | Codex，2026-09-27 |
| AI 3：存档、云同步、RAG 和旧联机服务清理 | 已完成（已整合） | Claude，2026-09-27 |

AI 1 的 `GameView.vue`、`LeftSidebar.vue`、`RightSidebar.vue`、`TopBar.vue`、`theme-overrides.css` 已有未提交改动。已完成部分是在这些改动上继续的，没有回退。

### 整合结果

- **旧联机清理**：已删除旅行、穿越地图、联机日志、presence、宗门战争面板和模拟器；路由与 API 导出已清理。
- **地图整合**：`WorldMapRoute.vue` 和 `GameMapPanel.vue` 只保留本地世界地图。
- **提示词整合**：已移除旧联机/穿越提示词和服务器日志指令说明。
- **云端修行**：继续保留账号、云存档和同步冲突处理；云端存档不再触发旧联机只读限制。
- **记忆中心 UI**：RAG 页面可直接使用新接口 `vectorMemoryService.getLastRecall()` / `narrativeRagService.getLastRecall()`（最近召回结果）以及 `getStats().usable`（当前模型可用条目数）。条目不再携带原始 `vector` 字段。
- **服务端（XianTu-Server）**：上传已携带 `base_version`、`client_updated_at`，服务端目前忽略。建议 `PUT /characters/{id}/save` 在 `base_version < 当前版本` 时返回 409，客户端即可把冲突检测从“版本跳跃推断”改为服务端判定。

---

## AI 1：主界面、路由和旧功能清理

**状态：已完成（Cursor，2026-09-27）。**

已完成：

- 侧栏移除穿越、人物关系。游戏变量在联机存档下仍然显示。
- `/game/travel`、`/game/relationships` 重定向到主界面，`/game/sect/war` 重定向到宗门概览。
- 宗门标签去掉「大战」。主界面去掉「穿越中」。
- 模式选择和创角里的云存档入口改为「云端修行」。
- 事件类型里不再提供「宗门大战」。
- 功能页同时只开一层；移动端面板盖住侧栏；面板在内部滚动。
- 全局 48px 圆按钮只作用于 `.bottom-actions`。`src/styles/` 里的 `!important` 已去掉，面板按钮改走 `panel-theme.css`。
- `npx tsc --noEmit` 通过。

构建备注：`npm run type-check` 通过；`npm run build` 在当前机器 webpack 阶段因 Node 原生内存不足中断。

```text
你负责本项目的“主界面、路由、导航和旧功能入口清理”。

请先阅读：
1. 重构协作计划.md
2. src/views/GameView.vue
3. src/router/index.ts
4. src/components/dashboard/LeftSidebar.vue
5. src/components/dashboard/RightSidebar.vue
6. src/styles/ 下所有全局样式文件

目标：
1. 重做游戏主布局，使界面层级清晰、滚动正常、移动端可用。
2. 保留并展示这些入口：游戏主界面、角色信息、背包、修炼、三千大道、宗门、事件、地图、记忆、游戏变量、提示词、保存、API、设置。
3. 从主流程移除关系网络图、在线旅行、穿越、旧联机共修和宗门战争入口。
4. 保留云存档入口，但不能再把云存档显示成旧的“联机旅行”。
5. 统一面板容器、标题栏、按钮、弹窗、遮罩和移动端导航。
6. 减少全局样式覆盖，尽量删除 !important，不要继续新增样式补丁。

允许修改的文件：
- src/views/GameView.vue
- src/router/index.ts
- src/components/dashboard/LeftSidebar.vue
- src/components/dashboard/RightSidebar.vue
- src/components/dashboard/TopBar.vue
- src/styles/
- 与菜单、路由、布局直接相关的组件
- 对应的 i18n 文案

禁止修改的范围：
- 不重写 gameStateStore.ts、characterStore.ts、apiManagementStore.ts。
- 不修改 vectorMemoryService.ts、narrativeRagService.ts 的实现。
- 不修改三千大道、游戏变量、提示词、宗门的业务逻辑。
- 不实现 PVP。
- 不覆盖其他 AI 的未提交改动。

实现要求：
- 删除功能入口时，同时清理对应路由、菜单、图标、文案和无效 import。
- 不要直接删除大型业务文件，除非确认已经没有引用，并在总结中列出删除文件。
- 不要为了改变视觉效果修改业务字段名。
- 保持现有路由名称的兼容性，除非该路由属于明确删除的旧联机功能。
- 只做布局和入口相关修改，避免顺手重构无关代码。

验收标准：
- 主界面不存在多层互相覆盖的面板和遮罩。
- 桌面端和移动端都能正常打开、关闭和滚动面板。
- 旧联机旅行、关系网络图和宗门战争不再出现在主流程。
- 游戏变量、提示词、三千大道、宗门入口仍然可访问。
- npm run type-check 不新增错误。
- npm run build 可以完成，或明确记录现有构建错误。

完成后请输出：
1. 修改文件列表。
2. 删除或隐藏的入口列表。
3. 布局和样式的主要变化。
4. 验证命令和结果。
5. 仍需其他 AI 处理的问题。
```

---

## AI 2：游戏变量、提示词、三千大道和宗门

**状态：进行中（Codex，2026-09-27）**

Cursor 不修改本任务的面板和业务文件。

```text
你负责本项目的“高自定义玩法系统”。重点是游戏变量、独立提示词、三千大道和基础宗门。

请先阅读：
1. 重构协作计划.md
2. src/components/dashboard/GameVariablePanel.vue
3. src/components/dashboard/PromptManagementPanel.vue
4. src/components/dashboard/ThousandDaoPanel.vue
5. src/components/dashboard/SectSystemPanel.vue
6. src/components/dashboard/SectPanel.vue
7. src/components/dashboard/components/ 下所有 Sect 和 GameVariable 组件
8. src/types/game.d.ts

目标：
1. 保留游戏变量面板，并把它改造成有搜索、路径定位、类型提示、修改预览、校验、撤销和变更记录的高级编辑器。
2. 保留独立提示词管理，并增加分类、优先级、启用状态、变量预览、最终渲染预览、导入导出和恢复默认。
3. 重做三千大道页面，使其能清楚展示大道层级、感悟进度、下一阶段条件、效果、相生相克、冲突、融合和系统关联。
4. 删除宗门战争，但保留基础宗门：概览、成员、藏书、任务、贡献与职位、管理。
5. 把宗门 UI 精简成单页面标签结构，减少嵌套路由。

允许修改的文件：
- src/components/dashboard/GameVariablePanel.vue
- src/components/dashboard/components/GameVariable*.vue
- src/components/dashboard/PromptManagementPanel.vue
- src/components/dashboard/ThousandDaoPanel.vue
- src/components/dashboard/SectSystemPanel.vue
- src/components/dashboard/SectPanel.vue
- src/components/dashboard/components/Sect*.vue，但不要保留 SectWarContent.vue 的业务入口
- src/data/thousandDaoData.ts
- src/data/creationData.ts（只有确实需要时）
- src/types/game.d.ts 中与上述系统直接相关的类型
- 对应的提示词、翻译和局部样式

禁止修改的范围：
- 不改 GameView.vue、router/index.ts、LeftSidebar.vue、RightSidebar.vue 的整体布局。
- 不重写 characterStore.ts、gameStateStore.ts、apiManagementStore.ts。
- 不修改 RAG 存储实现和云同步实现。
- 不实现 PVP。
- 不大范围修改全局 CSS。
- 不覆盖其他 AI 的未提交改动。

业务要求：
- 游戏变量修改必须有字段校验，不能让非法数据直接进入存档。
- 原始 JSON 编辑必须提供错误提示，不能静默写入坏数据。
- 提示词必须保持核心状态更新规则，用户自定义只能覆盖允许自定义层。
- 三千大道的数值和规则不能只写在模板中，应尽量放入可维护的数据结构。
- 三千大道必须说明当前效果和下一阶段条件，不能只显示名称和等级。
- 宗门战争相关组件如果不再使用，应清理引用、类型和提示词，但不要误删基础成员、任务、藏书功能。

验收标准：
- 可以搜索一个变量并定位到具体字段。
- 修改变量前能看到旧值和新值，非法值会被拒绝。
- 提示词页面能看到一条提示词的最终渲染结果。
- 三千大道页面能展示进度、条件、效果和冲突关系。
- 宗门基础页面可以查看成员、藏书和任务。
- 宗门战争不再出现在页面和业务入口。
- npm run type-check 不新增错误。

完成后请输出：
1. 修改文件列表。
2. 游戏变量新增能力。
3. 提示词新增能力。
4. 三千大道和宗门的结构变化。
5. 数据兼容或迁移风险。
6. 验证命令和结果。
```

---

## AI 3：存档、云同步、RAG 和旧联机服务清理

```text
你负责本项目的“数据层和服务层”。重点是存档一致性、云同步、本地 RAG，以及旧联机代码的服务层清理。

请先阅读：
1. 重构协作计划.md
2. src/stores/characterStore.ts
3. src/stores/gameStateStore.ts
4. src/stores/apiManagementStore.ts
5. src/services/vectorMemoryService.ts
6. src/services/narrativeRagService.ts
7. src/services/cloudDataSync.ts（如果实际路径不同，先搜索确认）
8. 织界项目中的 docs/06-RAG记忆增强方案.md
9. 织界项目中的 docs/13-RAG本地向量库分片存储与闪退治理.md

目标：
1. 统一角色、存档槽位、当前存档和 RAG 索引的 ID 规则。
2. 检查自动保存、手动保存、角色切换、导入导出和回退流程，避免重复写入和串档。
3. 保留云账号、云存档、配置同步和冲突处理，但移除旧联机旅行所依赖的数据流。
4. 合并长期记忆 RAG 和叙事 RAG 的重复逻辑，形成一个清晰的本地索引服务。
5. 本地 RAG 采用增量同步、分片存储、模型和维度校验，避免每次新增都整库重写。
6. 为未来 PVP 保留独立服务边界，但本次不实现 PVP。
7. 清理旧联机旅行、穿越、在线心跳和联机日志相关服务引用。

允许修改的文件：
- src/stores/characterStore.ts
- src/stores/gameStateStore.ts
- src/stores/apiManagementStore.ts
- src/services/vectorMemoryService.ts
- src/services/narrativeRagService.ts
- src/services/embeddingService.ts
- src/services/cloudDataSync.ts 或实际云同步服务文件
- src/utils/indexedDBManager.ts
- src/utils/onlineTravel*、onlineLogQueue* 等旧联机服务文件
- 与数据迁移、存档格式直接相关的类型和工具

禁止修改的范围：
- 不重做 GameView.vue、LeftSidebar.vue、RightSidebar.vue。
- 不修改三千大道、宗门、游戏变量、提示词的页面结构。
- 不修改全局视觉样式。
- 不实现房间、匹配、WebSocket PVP。
- 不覆盖其他 AI 的未提交改动。

RAG 规则：
- 默认只索引 AI / GM 叙事和确认后的事实。
- 默认不把玩家原始行动文本作为检索候选。
- 每个存档使用独立索引。
- 记录 embedding 模型和维度。
- 模型或维度不一致时禁止混用。
- 只注入 Top-K 结果。
- 索引新增、删除、回退都应尽量只修改受影响的分片。
- RAG 失败时不能阻塞正常游戏流程，应回退到无 RAG 或普通记忆模式。

云同步规则：
- API Key 不得进入云同步数据。
- 云存档必须带版本号和更新时间。
- 本地与云端冲突必须可识别，不能静默覆盖。
- 删除旧联机功能时不能误删普通云存档。

旧联机清理规则：
- 删除旧联机旅行、穿越、在线心跳、在线日志和联机存档专用服务引用。
- 不要删除普通账号、云存档、云配置同步。
- 不要删除未来 PVP 所需的通用 HTTP、认证和 WebSocket 基础设施，除非它们完全绑定旧旅行功能。
- 删除前先搜索全仓库引用，确保没有悬空 import。

验收标准：
- 角色切换不会读取到上一个存档的 RAG 数据。
- 保存和导入导出不会重复写入或覆盖错误槽位。
- RAG 可以初始化、增量同步、搜索、重建和清空。
- Embedding 模型更换后旧向量不会混入检索。
- RAG 失败时主游戏仍能继续。
- 云存档和配置同步仍可用。
- 旧联机服务没有残留调用。
- npm run type-check 不新增错误。

完成后请输出：
1. 修改文件列表。
2. 存档 ID 和 RAG ID 的统一规则。
3. 云同步变化。
4. RAG 合并和存储变化。
5. 删除的旧联机服务引用。
6. 数据迁移风险。
7. 验证命令和结果。
```

---

## 三个 AI 都必须遵守的最后规则

```text
开始修改前先检查 git status，不要覆盖已有未提交改动。

只修改任务允许的文件；发现需要跨边界修改时，先记录接口需求，不要直接改对方模块。

不要把 dist、截图、临时日志、调试输出加入提交。

不要为了修复一个问题顺手重命名大量字段或格式化整个项目。

完成后必须检查 git diff --stat、git diff 和 git status。

如果 type-check、lint 或 build 失败，要区分“本次引入的问题”和“原有问题”，不能笼统报告成功。
```

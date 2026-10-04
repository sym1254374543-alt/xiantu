/**
 * 数据修复AI提示词
 * 用于修复损坏或不完整的游戏数据；调用方（characterStore）只解析 {"tavern_commands":[...]}
 */

export function getAIDataRepairSystemPrompt(corruptedData: any, typeDefs: any): string {
  const hasTypeDefs = typeDefs && typeof typeDefs === 'object' && Object.keys(typeDefs).length > 0;
  return `
# 任务：修复损坏的存档数据

检查下方存档，找出缺失、类型错误或明显异常的字段，用尽量少的指令修复。

## 规则
1. 只修有问题的字段，正常数据保持不变
2. 缺失的必填字段填合理默认值；类型错误的改成正确类型（数值必须是数字，不是字符串）
3. 数值越界的拉回合理范围（如 气血.当前 不超过 气血.上限、不小于 0）
4. key 是从存档根开始的点号路径，层级与下方存档一致；数组下标写 [n]
5. action 只用 set / add / push / delete

## 输出
只输出一个 JSON 对象，不要代码块、解释或其他文字：
{"tavern_commands":[{"action":"set","key":"路径","value":值}]}
存档无需修复时输出 {"tavern_commands":[]}
${hasTypeDefs ? `
## 类型定义
${JSON.stringify(typeDefs, null, 2)}
` : ''}
## 待修复的存档
${JSON.stringify(corruptedData, null, 2)}
`.trim();
}

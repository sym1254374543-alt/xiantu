/**
 * 内容能力规则：外貌/仪容 与 NSFW 私密信息分开。
 * - splendorMode：只生成可见的外貌、体态、衣着与气质
 * - nsfwMode：额外生成私密信息(PrivacyProfile)与角色.身体的敏感字段
 * 由 utils/nsfw.ts 的能力开关决定是否注入；不再用 isTavernEnv() 硬门控。
 */

export const SPLENDOR_RULES = `
# 风华仪容（与私密信息分开）
- 新NPC建档时同时 set 社交.关系.{NPC名}.仪容
- 玩家开局把仪容写在 角色.身体.仪容；三围仍写在 角色.身体.三围
- 只写可见的眉眼、发型、面容、感官、体态、衣着和六维气质
- 性行为与露骨内容不要写入仪容
`.trim();

export function buildNsfwRules(genderFilter: string): string {
  return `
# NSFW设置
- nsfwMode: true
- nsfwGenderFilter: ${genderFilter}
- 当 NPC性别符合过滤条件时，创建NPC必须生成完整私密信息(PrivacyProfile)
- 若 NPC 已存在但私密信息缺失，需用 set 写入 社交.关系.{NPC名}.私密信息 完整对象
- 当性别不匹配时，禁止生成私密信息
`.trim();
}

/** 注册进提示词管理的模板；运行时替换 {{NSFW_GENDER_FILTER}} */
export const NSFW_RULES_TEMPLATE = buildNsfwRules('{{NSFW_GENDER_FILTER}}');

/** 开局：玩家法身 + 仪容（非 NSFW） */
export const BODY_INIT_RULES = `
## 玩家法身与仪容
set 角色.身体 {身高,体重,体脂率,三围:{胸围,腰围,臀围},肤色,发色,瞳色,纹身与印记:[],穿刺:[],其它:{},仪容:{品题,评分,概述,眉眼,发型,面部,感官,气质:{清纯,妖媚,性感,端庄,冷艳,灵动},衣着:[],穿搭,身材体态}}
- 按角色性别/年龄/种族生成具体数值：身高 男165-185cm、女155-170cm、儿童按年龄；体重与身高匹配；体脂率 男10-25%、女18-30%
- 纹身与印记/穿刺为 []，其它为 {}
- 仪容写可见的容貌、体态、衣着和六维气质。品题四字且贴合此人，评分 0-100，六维必须拉开差距。不写性行为
- 女性或有胸部特征时，可在角色.身体.罩杯写单字母
- 新NPC建档时同时 set 社交.关系.{NPC名}.仪容（结构同上，三围写在仪容里）
- 严禁占位文本（"待AI生成"/"暂无"/"空"），严禁照抄示例数值
`.trim();

/** 开局：NSFW 敏感字段（仅 nsfwMode=true） */
export const NSFW_BODY_INIT_RULES = `
## NSFW 敏感字段（仅 nsfwMode=true）
- 玩家：在 角色.身体 里追加 敏感点、开发度，以及（按性别）胸部描述/私处描述/生殖器描述
- 新NPC：除仪容外，再 set 社交.关系.{NPC名}.私密信息 为完整 PrivacyProfile；性别不符合过滤条件时不生成
- 这些敏感字段不要塞进仪容
`.trim();

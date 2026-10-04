<template>
  <div v-if="open" class="cc-modal-overlay legacy-overlay" @click.self="emit('close')">
    <div class="cc-modal wide solid legacy-modal" role="dialog" aria-modal="true" aria-labelledby="legacy-title">
      <div class="cc-modal-head">
        <h3 id="legacy-title" class="cc-modal-title">旧存档转化</h3>
        <button type="button" class="cc-modal-close" title="关闭" aria-label="关闭" @click="emit('close')">
          <X :size="18" />
        </button>
      </div>

      <div class="cc-modal-body">
        <p class="cc-hint">{{ hintText }}</p>

        <div
          class="drop-zone"
          :class="{ picked: !!fileName }"
          role="button"
          tabindex="0"
          @click="pickFile"
          @keydown.enter.prevent="pickFile"
          @keydown.space.prevent="pickFile"
        >
          <FileJson :size="22" class="drop-icon" />
          <div class="drop-text">
            <span class="drop-name">{{ fileName || '选择 JSON 文件' }}</span>
            <span class="drop-sub">{{ fileName ? '点击重新选择' : '支持存档包、角色包、单个存档或存档数据' }}</span>
          </div>
          <Upload :size="16" class="drop-action" />
        </div>

        <template v-if="analysis">
          <div class="summary-grid">
            <div class="cc-stat"><span>识别类型</span><strong>{{ analysis.typeLabel }}</strong></div>
            <div class="cc-stat"><span>存档数量</span><strong>{{ analysis.totalSaves }}</strong></div>
            <div class="cc-stat"><span>需要转换</span><strong>{{ analysis.needsMigration }}</strong></div>
            <div class="cc-stat" :class="{ warn: analysis.invalidSaves > 0 }"><span>校验警告</span><strong>{{ analysis.invalidSaves }}</strong></div>
          </div>

          <div v-if="analysis.hasFatalErrors" class="cc-errors" role="alert">
            <p v-for="(e, idx) in analysis.errors" :key="idx">{{ e }}</p>
          </div>

          <details v-else-if="analysis.errors.length" class="fold warn" open>
            <summary>
              <ChevronRight :size="14" class="chevron" />
              <span>兼容性提示（{{ analysis.errors.length }} 条，不影响导入）</span>
            </summary>
            <ul class="fold-list">
              <li v-for="(e, idx) in analysis.errors" :key="idx">{{ e }}</li>
            </ul>
          </details>

          <details v-if="analysis.legacyKeys.length" class="fold">
            <summary>
              <ChevronRight :size="14" class="chevron" />
              <span>检测到的旧字段（{{ analysis.legacyKeys.length }}）</span>
            </summary>
            <div class="chips">
              <span v-for="k in analysis.legacyKeys" :key="k" class="chip">{{ k }}</span>
            </div>
          </details>

          <details v-if="convertedPreview" class="fold">
            <summary>
              <ChevronRight :size="14" class="chevron" />
              <span>转换后的导出结构</span>
            </summary>
            <pre class="json-preview">{{ JSON.stringify(convertedPreview, null, 2) }}</pre>
          </details>
        </template>
      </div>

      <div class="cc-modal-foot">
        <button type="button" class="cc-btn" @click="emit('close')">关闭</button>
        <button
          v-if="analysis && !analysis.hasFatalErrors"
          type="button"
          class="cc-btn"
          :class="{ primary: !canImport && !canCreateCharacter }"
          :disabled="!convertedBundle"
          @click="downloadConverted"
        >
          <Download :size="15" />
          下载转换结果
        </button>
        <button
          v-if="canImport"
          type="button"
          class="cc-btn primary"
          :disabled="!convertedSaves || analysis?.hasFatalErrors"
          :title="targetCharName ? `导入到「${targetCharName}」` : undefined"
          @click="importToSelectedCharacter"
        >
          <ArrowDownToLine :size="15" />
          导入到当前角色
        </button>
        <button
          v-if="canCreateCharacter"
          type="button"
          class="cc-btn primary"
          :disabled="analysis?.hasFatalErrors"
          @click="createNewCharacter"
        >
          <UserPlus :size="15" />
          创建新角色
        </button>
      </div>

      <input ref="fileInput" type="file" accept=".json,application/json" hidden @change="onFileChange" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowDownToLine, ChevronRight, Download, FileJson, Upload, UserPlus, X } from 'lucide-vue-next'
import { toast } from '@/utils/toast'
import { createDadBundle, unwrapDadBundle } from '@/utils/dadBundle'
import { detectLegacySaveData, isSaveDataV3, migrateSaveDataToLatest } from '@/utils/saveMigration'
import { validateSaveDataV3 } from '@/utils/saveValidationV3'
import { useCharacterStore } from '@/stores/characterStore'

interface Props {
  open: boolean
  targetCharId?: string | null
  targetCharName?: string
  standalone?: boolean  // 独立模式：不需要选择角色，可以创建新角色
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'imported', count: number): void
  (e: 'character-created', charId: string): void  // 新角色创建成功
}>()

const characterStore = useCharacterStore()

const fileInput = ref<HTMLInputElement | null>(null)
const fileName = ref<string>('')

type SaveLike = { 存档名?: string; 存档数据?: unknown } & Record<string, any>

type SourceInfo =
  | { label: string; exportType: 'saves'; exportPayloadBase: Record<string, any>; saves: SaveLike[] }
  | { label: string; exportType: 'character'; exportPayloadBase: Record<string, any>; saves: SaveLike[] }

type Analysis = {
  typeLabel: string
  totalSaves: number
  needsMigration: number
  invalidSaves: number
  legacyKeys: string[]
  errors: string[]  // 🔥 现在只用于显示，不阻止操作
  hasFatalErrors: boolean  // 🔥 新增：是否有致命错误（阻止操作）
}

const analysis = ref<Analysis | null>(null)
const convertedBundle = ref<unknown>(null)
const convertedSaves = ref<SaveLike[] | null>(null)
const sourceInfo = ref<SourceInfo | null>(null)  // 保存源信息用于判断是否为角色包

const convertedPreview = computed(() => {
  if (!convertedBundle.value) return null
  const unwrapped = unwrapDadBundle(convertedBundle.value)
  return unwrapped.isBundle ? { schema: 'dad.bundle', type: unwrapped.type } : convertedBundle.value
})

const hintText = computed(() =>
  '选择旧存档或旧导出文件，先检测并转换为当前格式，再做校验；转换结果不会自动写入本地。' +
  (props.standalone ? '若是角色包文件，可直接据此创建新角色。' : '可下载转换后的文件，或导入到当前选中的单机角色。')
)

const canImport = computed(() => {
  if (!props.targetCharId) return false
  const profile = (characterStore.rootState.角色列表 as any)?.[props.targetCharId]
  if (!profile || profile.模式 !== '单机') return false
  return Array.isArray(convertedSaves.value) && convertedSaves.value.length > 0
})

// 是否可以创建新角色（独立模式 + 角色包类型 + 有存档数据）
const canCreateCharacter = computed(() => {
  if (!props.standalone) return false
  if (!sourceInfo.value) return false
  if (sourceInfo.value.exportType !== 'character') return false
  if (!Array.isArray(convertedSaves.value) || convertedSaves.value.length === 0) return false
  if (analysis.value?.hasFatalErrors) return false  // 🔥 使用 hasFatalErrors 代替 errors.length
  return true
})

const pickFile = () => {
  fileInput.value?.click()
}

const normalizeSavesFromUnknown = (raw: any): SourceInfo => {
  const unwrapped = unwrapDadBundle(raw)

  // 1) dad.bundle / legacy typed exports
  if (unwrapped.type === 'saves' && Array.isArray(unwrapped.payload?.saves)) {
    return {
      label: '存档包',
      exportType: 'saves',
      exportPayloadBase: { ...(unwrapped.payload || {}) },
      saves: unwrapped.payload.saves,
    }
  }
  if (unwrapped.type === 'character' && Array.isArray(unwrapped.payload?.存档列表)) {
    return {
      label: '角色包',
      exportType: 'character',
      exportPayloadBase: { ...(unwrapped.payload || {}) },
      saves: unwrapped.payload.存档列表,
    }
  }

  // 2) raw single SaveSlot
  if (raw && typeof raw === 'object' && raw.存档数据) {
    return { label: '单个存档', exportType: 'saves', exportPayloadBase: {}, saves: [raw] }
  }

  // 3) raw save data (old/new)
  if (raw && typeof raw === 'object') {
    const detection = detectLegacySaveData(raw)
    if (detection.needsMigration || isSaveDataV3(raw)) {
      return {
        label: '存档数据',
        exportType: 'saves',
        exportPayloadBase: {},
        saves: [
          {
            存档名: '转换存档',
            存档数据: raw,
          },
        ],
      }
    }
  }

  throw new Error('无法识别文件类型：请使用本游戏导出的存档/角色文件，或直接选择存档数据 JSON')
}

const convertSaves = (source: SourceInfo) => {
  const errors: string[] = []
  const warnings: string[] = []  // 🔥 新增：区分错误和警告
  const legacyKeys = new Set<string>()
  let needsMigration = 0
  let invalidSaves = 0

  const nowIso = new Date().toISOString()

  const normalizedSaves = source.saves.map((slot, idx) => {
    const rawSaveData = slot?.存档数据 ?? slot
    const detection = detectLegacySaveData(rawSaveData)
    if (detection.needsMigration) needsMigration++
    detection.legacyKeysFound.forEach((k) => legacyKeys.add(k))

    // 🔥 兼容旧格式：尝试迁移，如果失败则使用原始数据
    let v3 = rawSaveData
    try {
      v3 = isSaveDataV3(rawSaveData) ? rawSaveData : migrateSaveDataToLatest(rawSaveData as any).migrated
      const validation = validateSaveDataV3(v3 as any)
      if (!validation.isValid) {
        invalidSaves++
        // 🔥 改为警告而不是错误，不阻止导入
        warnings.push(
          `第 ${idx + 1} 个存档「${slot?.存档名 ?? '未命名'}」校验警告：${validation.errors[0] || '未知原因'}`
        )
      }
    } catch (migrateError) {
      // 🔥 迁移失败时使用原始数据，只记录警告
      warnings.push(
        `第 ${idx + 1} 个存档「${slot?.存档名 ?? '未命名'}」迁移失败，将使用原始格式`
      )
      console.warn('[旧存档转化] 迁移失败:', migrateError)
    }

    const nextName = String(slot?.存档名 ?? `导入存档_${idx + 1}`)

    return {
      ...slot,
      存档名: nextName,
      保存时间: slot?.保存时间 ?? nowIso,
      最后保存时间: slot?.最后保存时间 ?? slot?.保存时间 ?? nowIso,
      存档数据: v3,
    }
  })

  analysis.value = {
    typeLabel: source.label,
    totalSaves: source.saves.length,
    needsMigration,
    invalidSaves,
    legacyKeys: Array.from(legacyKeys).sort((a, b) => a.localeCompare(b, 'zh')),
    errors: [...errors, ...warnings],  // 🔥 合并错误和警告用于显示
    hasFatalErrors: errors.length > 0,  // 🔥 只有真正的错误才阻止操作
  }

  convertedSaves.value = normalizedSaves
  if (source.exportType === 'character') {
    convertedBundle.value = createDadBundle(
      'character',
      { ...(source.exportPayloadBase || {}), 存档列表: normalizedSaves },
      { exportedAt: nowIso },
    )
  } else {
    convertedBundle.value = createDadBundle(
      'saves',
      { ...(source.exportPayloadBase || {}), saves: normalizedSaves },
      { exportedAt: nowIso },
    )
  }
}

const onFileChange = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return

  try {
    fileName.value = file.name
    analysis.value = null
    convertedBundle.value = null
    convertedSaves.value = null
    sourceInfo.value = null

    const text = await file.text()
    const raw = JSON.parse(text)
    const source = normalizeSavesFromUnknown(raw)
    sourceInfo.value = source  // 保存源信息
    convertSaves(source)

    const result = analysis.value as Analysis | null
    if (result?.hasFatalErrors) {
      toast.error('检测到致命错误，无法导入')
    } else if (result && result.errors.length) {
      // 🔥 有警告但没有致命错误，仍然可以导入
      toast.warning('检测到一些兼容性问题（可继续导入）')
    } else if (result && (result.needsMigration ?? 0) > 0) {
      toast.success('旧存档已转换为当前格式（未写入本地，需手动下载/导入）')
    } else {
      toast.info('文件已是当前格式（可直接下载或导入）')
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : '未知错误'
    analysis.value = { typeLabel: '未知', totalSaves: 0, needsMigration: 0, invalidSaves: 0, legacyKeys: [], errors: [msg], hasFatalErrors: true }
    sourceInfo.value = null
    toast.error(`读取/解析失败：${msg}`)
  } finally {
    if (fileInput.value) fileInput.value.value = ''
  }
}

const downloadConverted = () => {
  if (!convertedBundle.value) return
  const blob = new Blob([JSON.stringify(convertedBundle.value, null, 2)], { type: 'application/json' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  const dateStr = new Date().toISOString().split('T')[0]
  link.download = `仙途-旧存档转化-${dateStr}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(link.href)
  toast.success('已下载转换后的文件')
}

const importToSelectedCharacter = async () => {
  if (!props.targetCharId) return
  if (!convertedSaves.value?.length) return

  const charName = props.targetCharName || props.targetCharId
  try {
    for (const save of convertedSaves.value) {
      await characterStore.importSave(props.targetCharId, save as any)
    }
    toast.success(`已导入 ${convertedSaves.value.length} 个存档到角色「${charName}」`)
    emit('imported', convertedSaves.value.length)
  } catch (err) {
    toast.error(`导入失败：${err instanceof Error ? err.message : '未知错误'}`)
  }
}

// 从旧版本角色包创建新角色
const createNewCharacter = async () => {
  if (!sourceInfo.value || sourceInfo.value.exportType !== 'character') {
    toast.error('当前文件不是角色包，无法创建新角色')
    return
  }
  if (!convertedSaves.value?.length) {
    toast.error('没有可用的存档数据')
    return
  }

  try {
    const payload = sourceInfo.value.exportPayloadBase
    const characterData = payload?.角色信息 || payload
    const normalizedProfile = JSON.parse(JSON.stringify(characterData || {}))

    // 兼容旧字段：角色基础信息 → 角色
    if (!normalizedProfile.角色 && normalizedProfile.角色基础信息) {
      normalizedProfile.角色 = normalizedProfile.角色基础信息
      delete normalizedProfile.角色基础信息
    }

    if (!normalizedProfile?.角色) {
      toast.error('角色数据不完整，无法创建')
      return
    }

    // 清空原有存档列表，由导入的存档列表接管
    normalizedProfile.存档列表 = {}
    normalizedProfile._导入存档列表 = convertedSaves.value

    // 使用 characterStore.importCharacter 创建新角色
    const newCharId = await characterStore.importCharacter(normalizedProfile)

    if (newCharId) {
      emit('character-created', newCharId)
    } else {
      toast.error('角色创建失败')
    }
  } catch (err) {
    toast.error(`创建角色失败：${err instanceof Error ? err.message : '未知错误'}`)
  }
}
</script>

<style scoped>
/* 旧存档转化 —— 外壳用 creation-theme.css 的 cc-modal */
.legacy-overlay {
  z-index: 10050;
}

.drop-zone {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.95rem 1.1rem;
  border: 1px dashed var(--cc-border-strong);
  border-radius: 8px;
  background: var(--cc-inset);
  cursor: pointer;
  transition: border-color 0.2s ease, background 0.2s ease;
}

.drop-zone:hover {
  border-color: rgba(var(--cc-gold-rgb), 0.7);
  background: var(--cc-surface-hover);
}

.drop-zone:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(var(--cc-accent-rgb), 0.3);
}

.drop-zone.picked {
  border-style: solid;
  border-left: 3px solid var(--cc-gold);
}

.drop-icon {
  flex-shrink: 0;
  color: var(--cc-gold);
}

.drop-text {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  gap: 0.15rem;
}

.drop-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.92rem;
  letter-spacing: 0.06em;
  color: var(--cc-text);
}

.drop-sub {
  font-size: 0.76rem;
  color: var(--cc-text-3);
}

.drop-action {
  flex-shrink: 0;
  color: var(--cc-text-2);
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.6rem;
}

.summary-grid .cc-stat {
  flex-direction: column;
  align-items: flex-start;
  gap: 0.15rem;
  min-width: 0;
}

.summary-grid .cc-stat span {
  font-size: 0.74rem;
  color: var(--cc-text-3);
}

.summary-grid .cc-stat strong {
  overflow: hidden;
  max-width: 100%;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.summary-grid .cc-stat.warn {
  border-color: rgba(var(--cc-warning-rgb), 0.45);
  background: rgba(var(--cc-warning-rgb), 0.08);
}

.summary-grid .cc-stat.warn strong {
  color: var(--cc-warning);
}

.fold {
  border: 1px solid var(--cc-border);
  border-radius: 6px;
  background: var(--cc-surface);
}

.fold > summary {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.55rem 0.8rem;
  font-size: 0.84rem;
  letter-spacing: 0.08em;
  color: var(--cc-text-2);
  cursor: pointer;
  list-style: none;
}

.fold > summary::-webkit-details-marker {
  display: none;
}

.fold > summary:hover {
  color: var(--cc-text);
}

.fold > summary:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(var(--cc-accent-rgb), 0.3);
}

.chevron {
  flex-shrink: 0;
  color: var(--cc-gold);
  transition: transform 0.2s ease;
}

.fold[open] .chevron {
  transform: rotate(90deg);
}

.fold.warn {
  border-color: rgba(var(--cc-warning-rgb), 0.4);
}

.fold.warn > summary {
  color: var(--cc-warning);
}

.fold-list {
  margin: 0;
  padding: 0.1rem 0.9rem 0.7rem 2rem;
  font-size: 0.8rem;
  line-height: 1.7;
  color: var(--cc-text-2);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  padding: 0.1rem 0.8rem 0.75rem;
}

.chip {
  padding: 0.1rem 0.5rem;
  border: 1px solid var(--cc-border);
  border-radius: 999px;
  font-size: 0.75rem;
  color: var(--cc-text-2);
}

.json-preview {
  max-height: 220px;
  margin: 0 0.8rem 0.8rem;
  padding: 0.7rem 0.8rem;
  overflow: auto;
  border: 1px solid var(--cc-border);
  border-radius: 6px;
  background: var(--cc-inset);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 0.78rem;
  color: var(--cc-text-2);
}

.cc-modal-foot {
  flex-wrap: wrap;
}

.legacy-modal :is(.cc-btn, .cc-modal-close):focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(var(--cc-accent-rgb), 0.3);
}

@media (max-width: 640px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>

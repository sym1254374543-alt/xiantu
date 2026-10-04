<template>
  <div class="mem-page">
    <PageTabs v-model="tab" :tabs="tabs" label="记忆分类">
      <template v-if="isListTab">
        <label class="per-page">
          每页
          <select v-model.number="pageSize" class="gm-field" aria-label="每页条数">
            <option v-for="n in [10, 20, 50]" :key="n" :value="n">{{ n }}</option>
          </select>
        </label>
      </template>
    </PageTabs>

    <!-- 短 / 中 / 长期 -->
    <div v-if="isListTab" class="list-wrap">
      <div class="list-col">
        <div v-if="tab === 'medium'" class="mid-bar">
          <p>
            中期记忆 <b>{{ lists.medium.value.length }}</b> 条
            <template v-if="cfg.settings.value.autoSummaryEnabled"> · 达到 <b>{{ cfg.settings.value.midTermTrigger }}</b> 条时自动总结为长期记忆</template>
            <template v-else> · 自动总结已关闭</template>
            · 总结后保留最近 {{ cfg.settings.value.midTermKeep }} 条
          </p>
          <button
            type="button"
            class="cc-btn small"
            :disabled="!canSummarize || summarizing"
            :title="canSummarize ? '把较早的中期记忆交给 AI 总结成长期记忆' : `至少需要 ${minForSummary} 条中期记忆（保留数 + 5）`"
            @click="summarize"
          >
            <Loader2 v-if="summarizing" :size="14" class="cc-spin" /><Sparkles v-else :size="14" />
            <span>手动总结</span>
          </button>
          <button v-if="debugOn" type="button" class="cc-btn small ghost" @click="addTestMedium"><FlaskConical :size="14" /><span>添加测试中期记忆</span></button>
        </div>
        <p v-if="tab === 'medium' && !canSummarize && lists.medium.value.length" class="mid-note">手动总结需要至少 {{ minForSummary }} 条中期记忆（保留数 {{ cfg.settings.value.midTermKeep }} + 5）。</p>

        <EmptyState v-if="!currentList.length" glyph="忆" :title="emptyText" compact />

        <ol v-else class="timeline">
          <li v-for="m in pagedList" :key="m.index + m.raw.slice(0, 20)" class="mem">
            <span class="mem-time">{{ m.time || '—' }}</span>
            <span class="mem-dot" aria-hidden="true"></span>
            <article class="mem-card">
              <template v-if="tab === 'long' && structured(m.raw)">
                <h4 v-if="structured(m.raw)!.title" class="mem-title">{{ structured(m.raw)!.title }}</h4>
                <dl class="mem-sections">
                  <template v-for="sec in structured(m.raw)!.sections" :key="sec.title">
                    <dt>{{ sec.title }}</dt>
                    <dd><p v-for="(line, li) in sec.items" :key="li">{{ line }}</p></dd>
                  </template>
                </dl>
              </template>
              <p v-else class="mem-body" :class="{ clamp: m.body.length > 240 && !open.has(m.index) }">{{ m.body }}</p>
              <footer class="mem-foot">
                <button v-if="m.body.length > 240 && !(tab === 'long' && structured(m.raw))" type="button" class="link" @click="toggle(m.index)">
                  {{ open.has(m.index) ? '收起' : '展开全文' }}
                </button>
                <span class="spacer"></span>
                <button type="button" class="cc-icon-btn danger" title="删除这条记忆" aria-label="删除这条记忆" @click="removeMemory(m)"><Trash2 :size="14" /></button>
              </footer>
            </article>
          </li>
        </ol>

        <div v-if="pages > 1" class="gm-pager">
          <button type="button" class="cc-icon-btn" aria-label="第一页" :disabled="page <= 1" @click="page = 1"><ChevronsLeft :size="14" /></button>
          <button type="button" class="cc-icon-btn" aria-label="上一页" :disabled="page <= 1" @click="page--"><ChevronLeft :size="14" /></button>
          <span>{{ page }} / {{ pages }}</span>
          <button type="button" class="cc-icon-btn" aria-label="下一页" :disabled="page >= pages" @click="page++"><ChevronRight :size="14" /></button>
          <button type="button" class="cc-icon-btn" aria-label="最后一页" :disabled="page >= pages" @click="page = pages"><ChevronsRight :size="14" /></button>
          <label class="jump">跳至 <input v-model.number="jump" class="gm-field" type="number" min="1" :max="pages" aria-label="跳页" @keydown.enter="goJump" /> 页</label>
        </div>
      </div>
    </div>

    <!-- 检索 -->
    <div v-else-if="tab === 'rag'" class="rag">
      <section class="rag-block">
        <header class="gm-sec-head">
          <span class="gm-sec-seal">溯</span>
          <h3>叙事检索</h3>
          <span class="aside">从历史正文里找回与当前行动相关的片段，随下回合一起发给 AI</span>
        </header>

        <div class="gm-form-row">
          <div class="gm-form-info">
            <span class="gm-form-name">启用叙事检索</span>
            <span class="gm-form-desc">
              <template v-if="rag.embedding.value.available">Embedding 可用 · {{ rag.embedding.value.model }}</template>
              <template v-else><TriangleAlert :size="13" class="warn" />{{ rag.embedding.value.reason }}</template>
            </span>
          </div>
          <label class="gm-switch">
            <input type="checkbox" :checked="rag.config.value.enabled" :disabled="!rag.embedding.value.available && !rag.config.value.enabled" @change="toggleRag" />
            <span></span>
          </label>
        </div>
        <div v-if="!rag.embedding.value.available" class="gm-form-row nested">
          <div class="gm-form-info"><span class="gm-form-desc">先在「API 管理 → 功能分配」打开叙事检索，并指定独立的 Embedding 模型。长期记忆与叙事检索共用这一配置。</span></div>
          <button type="button" class="cc-btn small" @click="router.push('/game/api-management')"><Plug :size="14" /><span>去 API 管理</span></button>
        </div>

        <div class="rag-stats">
          <div class="stat">
            <span>可检索</span>
            <b>{{ rag.stats.value?.usable ?? 0 }}<i> / {{ rag.stats.value?.total ?? 0 }}</i></b>
          </div>
          <div class="stat">
            <span>正文段落</span>
            <b>{{ rag.vectorizable.value }}</b>
          </div>
          <div class="stat">
            <span>待同步</span>
            <b :class="{ hot: rag.pending.value > 0 }">{{ rag.pending.value }}</b>
          </div>
          <div class="rag-ops">
            <button type="button" class="cc-btn small primary" :disabled="rag.busy.value || !rag.embedding.value.available" @click="syncRag">
              <Loader2 v-if="rag.busy.value" :size="14" class="cc-spin" /><RefreshCw v-else :size="14" />
              <span>{{ rag.busy.value && rag.progress.value.total ? `同步 ${rag.progress.value.done}/${rag.progress.value.total}` : '同步' }}</span>
            </button>
            <button type="button" class="cc-btn small" :disabled="rag.busy.value || !rag.embedding.value.available" @click="rebuildRag"><Hammer :size="14" /><span>重建</span></button>
            <button type="button" class="cc-btn small danger" :disabled="rag.busy.value || !rag.stats.value?.total" @click="clearRag"><Trash2 :size="14" /><span>清空</span></button>
          </div>
        </div>
        <p v-if="rag.modelChanged.value" class="rag-warn"><TriangleAlert :size="14" />模型已更换，旧向量不参与检索，建议重建。</p>
        <p v-if="rag.error.value" class="rag-warn">{{ rag.error.value }}</p>

        <div class="rag-cfg">
          <label class="cfg">
            <span>召回条数</span>
            <input v-model.number="ragDraft.topK" class="gm-field" type="number" min="1" max="20" @change="saveRagCfg" />
          </label>
          <label class="cfg">
            <span>相似度阈值</span>
            <input v-model.number="ragDraft.minSimilarity" class="gm-field" type="number" min="0.05" max="1" step="0.05" @change="saveRagCfg" />
          </label>
          <label class="cfg">
            <span>最大注入字数</span>
            <input v-model.number="ragDraft.maxContextChars" class="gm-field" type="number" min="200" max="10000" step="100" @change="saveRagCfg" />
          </label>
          <label class="cfg check">
            <span class="gm-switch"><input v-model="ragDraft.autoIndex" type="checkbox" @change="saveRagCfg" /><span></span></span>
            发送前自动补齐索引
          </label>
        </div>
      </section>

      <section class="rag-block">
        <header class="gm-sec-head">
          <span class="gm-sec-seal">召</span>
          <h3>最近召回</h3>
          <span v-if="rag.lastRecall.value" class="aside">{{ new Date(rag.lastRecall.value.at).toLocaleString('zh-CN') }}</span>
        </header>
        <template v-if="rag.lastRecall.value">
          <p class="recall-q"><b>查询</b>{{ rag.lastRecall.value.query }}</p>
          <ol v-if="rag.lastRecall.value.hits.length" class="recall">
            <li v-for="h in rag.lastRecall.value.hits" :key="h.id">
              <span class="score">{{ h.score.toFixed(3) }}</span>
              <p>{{ h.preview }}</p>
            </li>
          </ol>
          <p v-else class="gm-muted">这次没有召回到足够相似的片段。</p>
        </template>
        <p v-else class="gm-muted">本次会话还没有发生过检索。开启后，下一回合发送时会记录在这里。</p>
      </section>
    </div>

    <!-- 设置 -->
    <div v-else class="settings">
      <div class="settings-col">
        <div class="gm-form-row">
          <div class="gm-form-info">
            <span class="gm-form-name">短期记忆上限</span>
            <span class="gm-form-desc">超出后最旧的一条转入中期记忆</span>
          </div>
          <input v-model.number="cfgDraft.shortTermLimit" class="gm-field num" type="number" min="1" max="50" aria-label="短期记忆上限" />
        </div>
        <div class="gm-form-row">
          <div class="gm-form-info">
            <span class="gm-form-name">启用自动总结</span>
            <span class="gm-form-desc">中期记忆达到阈值时，自动用 AI 总结为长期记忆</span>
          </div>
          <label class="gm-switch"><input v-model="cfgDraft.autoSummaryEnabled" type="checkbox" /><span></span></label>
        </div>
        <template v-if="cfgDraft.autoSummaryEnabled">
          <div class="gm-form-row nested">
            <div class="gm-form-info"><span class="gm-form-name">中期转化阈值</span><span class="gm-form-desc">默认 25</span></div>
            <input v-model.number="cfgDraft.midTermTrigger" class="gm-field num" type="number" min="5" max="200" aria-label="中期转化阈值" />
          </div>
          <div class="gm-form-row nested">
            <div class="gm-form-info"><span class="gm-form-name">中期保留数量</span><span class="gm-form-desc">总结后保留最近几条中期记忆，默认 8</span></div>
            <input v-model.number="cfgDraft.midTermKeep" class="gm-field num" type="number" min="0" max="100" aria-label="中期保留数量" />
          </div>
        </template>
        <div class="gm-form-row">
          <div class="gm-form-info"><span class="gm-form-name">总结时流式输出</span><span class="gm-form-desc">同时影响人物名录里的 NPC 记忆总结</span></div>
          <label class="gm-switch"><input v-model="cfgDraft.useStreaming" type="checkbox" /><span></span></label>
        </div>
        <div class="gm-form-row stacked">
          <div class="gm-form-info"><span class="gm-form-name">自定义中期记忆格式</span><span class="gm-form-desc">留空使用默认格式</span></div>
          <textarea v-model="cfgDraft.midTermFormat" class="gm-field" rows="4"></textarea>
        </div>
        <div class="gm-form-row stacked">
          <div class="gm-form-info"><span class="gm-form-name">自定义长期记忆格式</span><span class="gm-form-desc">留空使用默认格式</span></div>
          <textarea v-model="cfgDraft.longTermFormat" class="gm-field" rows="4"></textarea>
        </div>
        <div class="settings-foot">
          <button type="button" class="cc-btn" @click="resetCfg"><RotateCcw :size="15" /><span>恢复默认</span></button>
          <button type="button" class="cc-btn primary" @click="saveCfg"><Save :size="15" /><span>保存设置</span></button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onActivated, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import {
  BookText, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, FlaskConical, Hammer, Loader2, Plug, RefreshCw, RotateCcw, Save, Sparkles,
  Trash2, TriangleAlert,
} from 'lucide-vue-next';
import { cloneDeep } from 'lodash';
import { useAPIManagementStore } from '@/stores/apiManagementStore';
import { useGameStateStore } from '@/stores/gameStateStore';
import { narrativeRagService } from '@/services/narrativeRagService';
import { useCharacterStore } from '@/stores/characterStore';
import {
  narrativeToNovel, useMemoryConfig, useMemoryLists, useNarrativeRag, type MemoryItem, type MemoryTier,
} from '@/composables/useMemoryCenter';
import { usePageActions } from '@/composables/usePageActions';
import { confirmDialog } from '@/composables/useDialog';
import { parseMemoryContent } from '@/utils/memoryFormatConfig';
import { downloadText, localDateStamp } from '@/utils/gameDisplay';
import { debug } from '@/utils/debug';
import { toast } from '@/utils/toast';
import PageTabs from '@/components/game/PageTabs.vue';
import EmptyState from '@/components/game/EmptyState.vue';

defineOptions({ name: 'MemoryPage' });

const gs = useGameStateStore();
const cs = useCharacterStore();
const router = useRouter();
const lists = useMemoryLists();
const rag = useNarrativeRag();
const cfg = useMemoryConfig();

type Tab = MemoryTier | 'rag' | 'settings';
const tab = ref<Tab>('short');
const tabs = computed(() => [
  { key: 'short', label: '短期', count: lists.short.value.length },
  { key: 'medium', label: '中期', count: lists.medium.value.length },
  { key: 'long', label: '长期', count: lists.long.value.length },
  { key: 'rag', label: '检索' },
  { key: 'settings', label: '设置' },
]);
const isListTab = computed(() => tab.value === 'short' || tab.value === 'medium' || tab.value === 'long');

// ─── 列表 + 分页（最新在前） ───
const currentList = computed<MemoryItem[]>(() => {
  const l = tab.value === 'short' ? lists.short.value : tab.value === 'medium' ? lists.medium.value : tab.value === 'long' ? lists.long.value : [];
  return [...l].reverse();
});
const pageSize = ref(10);
const page = ref(1);
const jump = ref<number | ''>('');
const pages = computed(() => Math.max(1, Math.ceil(currentList.value.length / pageSize.value)));
const pagedList = computed(() => currentList.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value));
watch([tab, pageSize], () => {
  page.value = 1;
});
watch(pages, (n) => {
  if (page.value > n) page.value = n;
});
const goJump = () => {
  const n = Number(jump.value);
  if (n >= 1 && n <= pages.value) page.value = n;
  jump.value = '';
};

const emptyText = computed(() => ({ short: '暂无短期记忆', medium: '暂无中期记忆', long: '暂无长期记忆' })[tab.value as MemoryTier] || '');

const open = ref(new Set<number>());
const toggle = (i: number) => {
  const s = new Set(open.value);
  if (s.has(i)) s.delete(i);
  else s.add(i);
  open.value = s;
};

/** 长期记忆的结构化展示：识别到预设格式时按分节显示 */
const structuredCache = new Map<string, { title?: string; sections: { title: string; items: string[] }[] } | null>();
const structured = (raw: string) => {
  if (structuredCache.has(raw)) return structuredCache.get(raw)!;
  const p = parseMemoryContent(raw);
  let out: { title?: string; sections: { title: string; items: string[] }[] } | null = null;
  if (p.format) {
    const sections = p.format.sections
      .map((s) => ({ title: s.title, items: p.sections[s.key] || [] }))
      .filter((s) => s.items.length);
    if (sections.length) out = { title: p.title, sections };
  }
  structuredCache.set(raw, out);
  return out;
};

const removeMemory = async (m: MemoryItem) => {
  const tier = tab.value as MemoryTier;
  const name = { short: '短期', medium: '中期', long: '长期' }[tier];
  const ok = await confirmDialog({
    title: '删除记忆',
    message: `删除这条${name}记忆？会同时从存档和酒馆变量中删除。`,
    details: [m.body.slice(0, 80) + (m.body.length > 80 ? '…' : '')],
    confirmText: '删除',
    danger: true,
  });
  if (!ok) return;
  try {
    await lists.remove(tier, m);
    toast.success('已删除');
  } catch (e) {
    toast.error(e instanceof Error ? e.message : '删除失败');
  }
};

// ─── 中期总结 ───
const minForSummary = computed(() => cfg.settings.value.midTermKeep + 5);
const canSummarize = computed(() => lists.medium.value.length >= minForSummary.value);
const summarizing = ref(false);
const summarize = async () => {
  summarizing.value = true;
  try {
    await cfg.summarize();
  } finally {
    summarizing.value = false;
  }
};

const debugOn = ref(debug.isEnabled());
const addTestMedium = async () => {
  const mem = cloneDeep(gs.memory || { 短期记忆: [], 中期记忆: [], 长期记忆: [], 隐式中期记忆: [] }) as any;
  mem.中期记忆 = [...(mem.中期记忆 || []), `【测试】测试中期记忆 ${Date.now()}`];
  gs.updateState('memory', mem);
  await cs.saveCurrentGame();
};

// ─── 叙事检索 ───
const ragDraft = ref({ ...rag.config.value });
watch(rag.config, (c) => {
  ragDraft.value = { ...c };
});
const saveRagCfg = () => {
  rag.saveConfig({
    topK: ragDraft.value.topK,
    minSimilarity: ragDraft.value.minSimilarity,
    maxContextChars: ragDraft.value.maxContextChars,
    autoIndex: ragDraft.value.autoIndex,
  });
  toast.success('叙事检索配置已保存');
};
const toggleRag = async (e: Event) => {
  const on = (e.target as HTMLInputElement).checked;
  useAPIManagementStore().setFunctionEnabled('embedding', on);
  rag.saveConfig({ enabled: on });
  embeddingRefresh();
  toast.success(on ? '叙事检索已开启' : '叙事检索已关闭');
  if (on && rag.embedding.value.available) await syncRag();
};
const embeddingRefresh = () => {
  rag.embedding.value = narrativeRagService.getEmbeddingStatus();
};
const syncRag = async () => {
  try {
    const n = await rag.sync();
    toast.success(n > 0 ? `已同步 ${n} 条叙事向量` : '叙事向量已是最新');
  } catch (e) {
    toast.error(e instanceof Error ? `同步失败：${e.message}` : '同步失败');
  }
};
const rebuildRag = async () => {
  const ok = await confirmDialog({ title: '重建叙事检索', message: '清空后用当前 Embedding 模型重新向量化全部正文，会消耗 Embedding 调用。', confirmText: '重建' });
  if (!ok) return;
  try {
    const n = await rag.rebuild();
    toast.success(`已重建 ${n} 条`);
  } catch (e) {
    toast.error(e instanceof Error ? `重建失败：${e.message}` : '重建失败');
  }
};
const clearRag = async () => {
  const ok = await confirmDialog({ title: '清空叙事检索', message: '只清空本存档的检索索引，不影响正文。之后可重新同步。', confirmText: '清空', danger: true });
  if (!ok) return;
  await rag.clear();
  toast.success('已清空');
};

// ─── 设置 ───
const cfgDraft = ref({ ...cfg.settings.value });
const saveCfg = () => {
  cfg.save({ ...cfgDraft.value });
  cfgDraft.value = { ...cfg.settings.value };
  toast.success('记忆设置已保存');
};
const resetCfg = async () => {
  const ok = await confirmDialog({ title: '恢复默认', message: '把记忆设置恢复为默认值？自定义格式会清空。', confirmText: '恢复默认' });
  if (!ok) return;
  cfg.reset();
  cfgDraft.value = { ...cfg.settings.value };
  toast.success('已恢复默认');
};

// ─── 页头 ───
const exportNovel = () => {
  const history = (gs.narrativeHistory || []) as Array<{ type?: string; content?: string }>;
  if (!history.length) return toast.warning('没有叙事历史可导出');
  const name = String((gs.character as any)?.名字 || '修仙者');
  const world = String((gs.worldInfo as any)?.世界名称 || '修仙世界');
  downloadText(`${name}_修仙历程_${localDateStamp()}.txt`, narrativeToNovel(history, name, world), 'text/plain');
  toast.success(`已导出 ${history.length} 段叙事`);
};
usePageActions(() => [{ key: 'novel', title: '导出为小说', icon: BookText, onClick: exportNovel }]);

const onShow = () => {
  cfg.reload();
  cfgDraft.value = { ...cfg.settings.value };
  debugOn.value = debug.isEnabled();
  void rag.refresh();
};
onMounted(onShow);
onActivated(onShow);
watch(tab, (t) => {
  if (t === 'rag') void rag.refresh();
});
</script>

<style scoped>
.mem-page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  height: 100%;
  min-height: 0;
  padding-top: 0.5rem;
}

.per-page {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 13px;
  color: var(--cc-text-2);
}

.list-wrap,
.rag,
.settings {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.list-col,
.settings-col {
  max-width: 900px;
  margin: 0 auto;
  padding-bottom: 1.5rem;
}

.settings-col {
  max-width: 760px;
}

.mid-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 0.4rem;
  padding: 0.7rem 1rem;
  border: 1px solid var(--cc-border);
  border-radius: 8px;
  background: var(--gm-block);
}

.mid-bar p {
  flex: 1;
  margin: 0;
  font-size: 14px;
  color: var(--cc-text-2);
}

.mid-bar b {
  font-weight: 500;
  color: var(--cc-gold);
}

.mid-note {
  margin: 0 0 1rem;
  font-size: 12px;
  color: var(--cc-text-3);
}

/* ---------- 时间线 ---------- */
.timeline {
  position: relative;
  margin: 1rem 0 0;
  padding: 0;
  list-style: none;
}

.timeline::before {
  content: '';
  position: absolute;
  top: 8px;
  bottom: 0;
  left: 141px;
  width: 2px;
  background: var(--gm-line);
}

.mem {
  display: grid;
  grid-template-columns: 124px 36px minmax(0, 1fr);
  padding-bottom: 1rem;
}

.mem-time {
  padding-top: 0.7rem;
  font-size: 12px;
  line-height: 1.5;
  text-align: right;
  color: var(--cc-gold);
  word-break: break-all;
}

.mem-dot {
  position: relative;
  z-index: 1;
  justify-self: center;
  width: 10px;
  height: 10px;
  margin-top: 0.9rem;
  border: 2px solid rgba(var(--cc-gold-rgb), 0.7);
  border-radius: 50%;
  background: var(--cc-solid-bg);
}

.mem-card {
  position: relative;
  padding: 0.7rem 3rem 0.7rem 1rem;
  border: 1px solid var(--cc-border);
  border-radius: 6px;
  background: var(--gm-block);
}

.mem-body {
  margin: 0;
  font-size: var(--narrative-size, 16px);
  line-height: 1.9;
  white-space: pre-wrap;
  word-break: break-word;
}

.mem-body.clamp {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 5;
  -webkit-box-orient: vertical;
}

.mem-title {
  margin: 0 0 0.5rem;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--cc-gold);
}

.mem-sections {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.35rem 1rem;
  margin: 0;
  font-size: 15px;
  line-height: 1.8;
}

.mem-sections dt {
  font-size: 13px;
  letter-spacing: 0.1em;
  color: var(--cc-text-2);
}

.mem-sections dd {
  margin: 0;
}

.mem-sections dd p {
  margin: 0;
}

.mem-foot {
  display: flex;
  align-items: center;
}

.mem-foot .link {
  margin-top: 0.35rem;
}

.mem-foot .cc-icon-btn {
  position: absolute;
  top: 0.6rem;
  right: 0.6rem;
  opacity: 0.6;
}

.mem-card:hover .mem-foot .cc-icon-btn,
.mem-foot .cc-icon-btn:focus-visible {
  opacity: 1;
}

.mem-foot .spacer {
  flex: 1;
}

.link {
  padding: 0;
  border: none;
  background: none;
  color: var(--cc-accent);
  font-size: 13px;
  cursor: pointer;
}

.jump {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin-left: 0.75rem;
}

.jump .gm-field {
  width: 56px;
  height: 30px;
  text-align: center;
}

/* ---------- 检索 ---------- */
.rag {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  align-content: start;
  gap: 2rem;
  padding: 0.5rem 0 1.5rem;
}

.warn {
  margin-right: 0.25rem;
  color: var(--cc-warning);
  vertical-align: -2px;
}

.rag-stats {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 1.5rem;
  padding: 1rem 0.25rem;
  border-bottom: 1px solid var(--gm-line);
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.stat span {
  font-size: 13px;
  letter-spacing: 0.15em;
  color: var(--cc-text-2);
}

.stat b {
  font-size: 24px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  color: var(--cc-gold);
}

.stat b i {
  font-size: 14px;
  font-style: normal;
  color: var(--cc-text-3);
}

.stat b.hot {
  color: var(--cc-warning);
}

.rag-ops {
  display: flex;
  gap: 0.4rem;
  margin-left: auto;
}

.rag-warn {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin: 0.6rem 0 0;
  font-size: 13px;
  color: var(--cc-warning);
}

.rag-cfg {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.8rem 1.25rem;
  padding: 1rem 0.25rem;
}

.cfg {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 13px;
  color: var(--cc-text-2);
}

.cfg.check {
  flex-direction: row;
  align-items: center;
  gap: 0.5rem;
}

.recall-q {
  margin: 0 0 0.8rem;
  font-size: 14px;
  line-height: 1.7;
}

.recall-q b {
  margin-right: 0.6rem;
  font-size: 13px;
  font-weight: 400;
  letter-spacing: 0.2em;
  color: var(--cc-gold);
}

.recall {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.recall li {
  display: flex;
  gap: 0.75rem;
  padding: 0.6rem 0.8rem;
  border-radius: 6px;
  background: var(--gm-block);
}

.score {
  flex-shrink: 0;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  color: var(--gm-mp);
}

.recall p {
  margin: 0;
  font-size: 14px;
  line-height: 1.75;
  color: var(--cc-text);
}

/* ---------- 设置 ---------- */
.gm-field.num {
  width: 80px;
  text-align: center;
}

.gm-form-row textarea {
  width: 100%;
}

.settings-foot {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding-top: 1rem;
}

@media (max-width: 1100px) {
  .rag {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 768px) {
  .timeline::before {
    left: 85px;
  }

  .mem {
    grid-template-columns: 72px 26px minmax(0, 1fr);
  }

  .rag-cfg {
    grid-template-columns: minmax(0, 1fr);
  }

  .rag-ops {
    margin-left: 0;
  }
}
</style>

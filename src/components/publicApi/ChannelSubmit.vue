<template>
  <div class="cs">
    <form v-if="!listOnly" class="cs-form" @submit.prevent="submit">
      <div class="cs-intro">
        <HandHeart :size="18" />
        <p>
          把你自己的 API 渠道捐进公益池。审核通过后，其他道友调用时会分流到你的渠道，每成功一次，你获得该次单价的
          <b>{{ ratioText }}</b> 作为额度返还。密钥只保存在服务器，不会给任何玩家看到。
        </p>
      </div>
      <p v-if="closed" class="cs-closed">暂未开放渠道提交。</p>
      <template v-else>
        <div class="cs-grid">
          <label class="cc-field"><span class="cc-field-label">渠道名称（选填）</span><input v-model="draft.name" class="cc-input" maxlength="40" placeholder="例如：我的 Gemini 渠道" /></label>
          <div class="cc-field">
            <span class="cc-field-label">请求格式</span>
            <div class="cs-seg" role="radiogroup" aria-label="请求格式">
              <button type="button" role="radio" :aria-checked="draft.format === 'openai'" :class="{ on: draft.format === 'openai' }" @click="draft.format = 'openai'">OpenAI 兼容</button>
              <button type="button" role="radio" :aria-checked="draft.format === 'gemini'" :class="{ on: draft.format === 'gemini' }" @click="draft.format = 'gemini'">Gemini</button>
            </div>
          </div>
          <label class="cc-field wide"><span class="cc-field-label">接口地址</span><input v-model="draft.base_url" class="cc-input" required :placeholder="draft.format === 'gemini' ? 'https://generativelanguage.googleapis.com' : 'https://api.example.com/v1'" /></label>
          <label class="cc-field"><span class="cc-field-label">密钥</span><input v-model="draft.api_key" class="cc-input" type="password" required autocomplete="off" placeholder="sk-..." /></label>
          <label class="cc-field"><span class="cc-field-label">模型名</span><input v-model="draft.model" class="cc-input" required placeholder="gemini-3.8-flash" /></label>
          <label class="cc-field wide"><span class="cc-field-label">备注（选填，给审核看）</span><input v-model="draft.note" class="cc-input" maxlength="300" placeholder="例如：额度充足，每天可用 1000 次" /></label>
        </div>
        <div class="cs-actions">
          <span v-if="!p.loggedIn.value" class="cs-hint">登录云端账号后才能提交</span>
          <button type="submit" class="cc-btn primary" :disabled="submitting || !p.loggedIn.value">
            <Loader2 v-if="submitting" :size="15" class="cc-spin" /><Send v-else :size="15" /><span>提交审核</span>
          </button>
        </div>
      </template>
    </form>

    <section class="cs-mine">
      <h4 class="cs-h">我提交的渠道<small v-if="p.myChannels.value.length">共 {{ p.myChannels.value.length }} 条 · 累计返还 {{ formatCredit(totalRewarded, 4) }}</small></h4>
      <p v-if="!p.loggedIn.value" class="cs-empty">登录后查看</p>
      <p v-else-if="!p.myChannels.value.length" class="cs-empty">还没有提交过渠道</p>
      <ul v-else class="cs-list">
        <li v-for="ch in p.myChannels.value" :key="ch.id" class="cs-item">
          <div class="cs-item-main">
            <span class="cs-pill" :class="ch.status">{{ STATUS[ch.status] }}</span>
            <strong>{{ ch.name || ch.model }}</strong>
            <span class="cs-sub">{{ ch.format === 'gemini' ? 'Gemini' : 'OpenAI 兼容' }} · {{ ch.model }} · {{ ch.host }}</span>
          </div>
          <div class="cs-item-meta">
            <span v-if="ch.status === 'approved'">挂在「{{ ch.item_name || '公益模型' }}」 · 已服务 {{ ch.served }} 次 · 返还 {{ formatCredit(ch.rewarded, 4) }}</span>
            <span v-if="ch.review_note" class="cs-review">审核说明：{{ ch.review_note }}</span>
          </div>
          <button type="button" class="cc-btn small" @click="withdraw(ch)"><Undo2 :size="14" /><span>撤回</span></button>
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { HandHeart, Loader2, Send, Undo2 } from 'lucide-vue-next';
import { usePublicApi } from '@/composables/usePublicApi';
import { formatCredit, type ChannelDraft, type ChannelStatus, type MyChannel } from '@/services/builtinApi';
import { confirmDialog } from '@/composables/useDialog';
import { toast } from '@/utils/toast';

withDefaults(defineProps<{ listOnly?: boolean }>(), { listOnly: false });

const STATUS: Record<ChannelStatus, string> = { pending: '审核中', approved: '已入池', rejected: '未通过', disabled: '已停用' };

const p = usePublicApi();
const rules = computed(() => p.wallet.value?.rules ?? null);
const closed = computed(() => rules.value?.submission_enabled === false);
const ratioText = computed(() => {
  const r = rules.value?.contributor_ratio ?? 0.25;
  return r === 0.25 ? '1/4' : `${Math.round(r * 100)}%`;
});
const totalRewarded = computed(() => p.myChannels.value.reduce((sum, ch) => sum + ch.rewarded, 0));

const blank = (): ChannelDraft => ({ name: '', format: 'openai', base_url: '', api_key: '', model: '', note: '' });
const draft = reactive<ChannelDraft>(blank());
const submitting = ref(false);

const submit = async () => {
  submitting.value = true;
  try {
    await p.submitChannel({ ...draft });
    Object.assign(draft, blank());
  } catch (e) {
    toast.error(e instanceof Error ? e.message : '提交失败');
  } finally {
    submitting.value = false;
  }
};

const withdraw = async (ch: MyChannel) => {
  const ok = await confirmDialog({
    title: '撤回渠道',
    message: `撤回「${ch.name || ch.model}」？撤回后会从公益池移除，密钥也会从服务器删除。`,
    confirmText: '撤回',
    danger: true,
  });
  if (ok) await p.withdrawChannel(ch.id);
};

onMounted(() => {
  void p.loadMyChannels();
});
</script>

<style scoped>
.cs {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.cs-form {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  padding: 1rem 1.1rem;
  border: 1px solid var(--cc-border);
  border-radius: 10px;
  background: var(--cc-surface);
}

.cs-intro {
  display: flex;
  gap: 0.6rem;
  color: var(--cc-gold);
}

.cs-intro p {
  margin: 0;
  font-size: 0.85rem;
  line-height: 1.65;
  color: var(--cc-text-2);
}

.cs-intro b {
  color: var(--cc-gold);
}

.cs-closed {
  margin: 0;
  color: var(--cc-text-3);
}

.cs-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem 1rem;
}

.cs-grid .wide {
  grid-column: 1 / -1;
}

.cs-seg {
  display: inline-flex;
  width: fit-content;
  padding: 3px;
  border: 1px solid var(--cc-border);
  border-radius: 6px;
  background: var(--cc-inset);
}

.cs-seg button {
  padding: 0.35rem 0.9rem;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--cc-text-2);
  font: inherit;
  font-size: 0.85rem;
  cursor: pointer;
}

.cs-seg button.on {
  background: var(--cc-surface);
  color: var(--cc-text);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15), inset 0 -2px 0 var(--cc-gold);
}

.cs-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
}

.cs-hint,
.cs-empty {
  font-size: 0.82rem;
  color: var(--cc-text-3);
}

.cs-empty {
  margin: 0;
}

.cs-h {
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
  margin: 0 0 0.6rem;
  font-size: 0.95rem;
  color: var(--cc-text);
}

.cs-h small {
  font-size: 0.78rem;
  font-weight: 400;
  color: var(--cc-text-3);
}

.cs-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.cs-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.3rem 0.75rem;
  padding: 0.7rem 0.9rem;
  border: 1px solid var(--cc-border);
  border-radius: 8px;
  background: var(--cc-surface);
}

.cs-item-main {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.3rem 0.6rem;
  min-width: 0;
}

.cs-item-main strong {
  color: var(--cc-text);
}

.cs-sub {
  overflow: hidden;
  font-size: 0.78rem;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--cc-text-3);
}

.cs-item-meta {
  display: flex;
  flex-direction: column;
  grid-column: 1;
  gap: 0.15rem;
  font-size: 0.78rem;
  color: var(--cc-text-2);
}

.cs-item .cc-btn {
  grid-row: 1 / span 2;
  grid-column: 2;
}

.cs-review {
  color: var(--cc-text-3);
}

.cs-pill {
  padding: 0.05rem 0.45rem;
  border: 1px solid currentColor;
  border-radius: 3px;
  font-size: 0.72rem;
}

.cs-pill.pending { color: var(--cc-warning); }
.cs-pill.approved { color: var(--cc-success); }
.cs-pill.rejected { color: var(--cc-danger); }
.cs-pill.disabled { color: var(--cc-text-3); }

@media (max-width: 560px) {
  .cs-grid {
    grid-template-columns: 1fr;
  }
}
</style>

<template>
  <div class="members">
    <!-- 高层 -->
    <section class="leaders">
      <header class="gm-sec-head">
        <span class="gm-sec-seal">尊</span>
        <h3>宗门高层</h3>
        <span class="aside">{{ leaderSummary }}</span>
        <button type="button" class="cc-btn small" :disabled="busy === 'lead'" @click="run('lead', genLeadership)">
          <Loader2 v-if="busy === 'lead'" :size="14" class="cc-spin" /><Sparkles v-else :size="14" />
          <span>{{ ctx.leadership.value ? '重新生成高层' : 'AI 生成高层' }}</span>
        </button>
      </header>
      <div v-if="leaders.length" class="leader-row">
        <article v-for="l in leaders" :key="l.role" class="leader">
          <span class="gm-disc lg">{{ l.name.charAt(0) }}</span>
          <div class="leader-main">
            <span class="leader-role">{{ l.role }}</span>
            <b>{{ l.name }}</b>
            <small v-if="l.realm">{{ l.realm }}</small>
          </div>
          <button type="button" class="cc-btn small" @click="chat(l.text)"><MessageCircle :size="14" /><span>{{ l.verb }}</span></button>
        </article>
      </div>
      <p v-else class="gm-muted">宗门档案里还没有高层信息，可让 AI 依据宗门规模生成。</p>
    </section>

    <!-- 同门 -->
    <section class="peers">
      <header class="gm-sec-head">
        <span class="gm-sec-seal">同</span>
        <h3>同门</h3>
        <span class="aside">{{ ctx.members.value.length }} 人</span>
        <button type="button" class="cc-btn small" :disabled="busy === 'members'" @click="run('members', genMembers)">
          <Loader2 v-if="busy === 'members'" :size="14" class="cc-spin" /><UserPlus v-else :size="14" />
          <span>AI 生成同门</span>
        </button>
      </header>

      <div class="gm-seg filter" role="radiogroup" aria-label="成员分组">
        <button v-for="c in categories" :key="c.key" type="button" role="radio" :aria-checked="cat === c.key" :class="{ active: cat === c.key }" @click="cat = c.key">
          {{ c.key === 'all' ? '全部' : c.key }}<em>{{ c.count }}</em>
        </button>
      </div>

      <EmptyState v-if="!list.length" glyph="同" :title="ctx.members.value.length ? '这一类还没有同门' : '尚未结识同门'" desc="同门来自人物名录里势力归属为本宗的人物" compact />
      <ul v-else class="gm-list peer-list">
        <li v-for="m in list" :key="m.key" class="gm-row peer">
          <span class="gm-disc" :style="{ '--tone': m.known ? favorInfo(m.favor).tone : 'var(--cc-text-3)' }">{{ m.name.charAt(0) }}</span>
          <span class="gm-row-main">
            <span class="gm-row-title">{{ m.name }} <SealBadge :tone="m.category === '高层' ? 'gold' : 'muted'">{{ m.position }}</SealBadge></span>
            <span class="gm-row-sub">{{ m.realm || '修为不明' }}<template v-if="m.known"> · {{ favorInfo(m.favor).label }} {{ m.favor }}</template><template v-else> · 仅知其名</template></span>
          </span>
          <span class="peer-ops">
            <button type="button" class="cc-btn small ghost" @click="chat(SECT_CHAT_TEXTS.talk(m.name))"><MessageCircle :size="14" /><span>交谈</span></button>
            <button v-if="m.known" type="button" class="cc-btn small ghost" title="在人物名录中查看" @click="router.push({ path: '/game/npcs', query: { npc: m.name } })">
              <Contact :size="14" /><span>档案</span>
            </button>
            <button v-if="m.known" type="button" class="cc-btn small ghost" :disabled="busy === m.key" title="让 AI 依据时间与宗门上限更新其职位与境界" @click="run(m.key, () => evolve(m))">
              <Loader2 v-if="busy === m.key" :size="14" class="cc-spin" /><TrendingUp v-else :size="14" /><span>演化</span>
            </button>
          </span>
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Contact, Loader2, MessageCircle, Sparkles, TrendingUp, UserPlus } from 'lucide-vue-next';
import type { SectContext } from '@/composables/useSectContext';
import { evolveMember, generateLeadership, generateMembers } from '@/services/sectContentService';
import { SECT_CHAT_TEXTS } from '@/utils/prompts/tasks/sectPrompts';
import { favorInfo } from '@/utils/gameDisplay';
import { chatBus, sendChat } from '@/utils/chatBus';
import { toast } from '@/utils/toast';
import EmptyState from '@/components/game/EmptyState.vue';
import SealBadge from '@/components/game/SealBadge.vue';

const props = defineProps<{ ctx: SectContext }>();
const router = useRouter();
const ctx = props.ctx;

const leaders = computed(() => {
  const l = ctx.leadership.value;
  const sect = ctx.sectName.value;
  if (!l) return [];
  const out: { role: string; name: string; realm: string; verb: string; text: string }[] = [];
  if (l.宗主) out.push({ role: '宗主', name: l.宗主, realm: l.宗主修为 || '', verb: '拜见', text: SECT_CHAT_TEXTS.visitMaster(sect, l.宗主) });
  if (l.副宗主) out.push({ role: '副宗主', name: l.副宗主, realm: '', verb: '请教', text: SECT_CHAT_TEXTS.askVice(sect, l.副宗主) });
  if (l.太上长老) out.push({ role: '太上长老', name: l.太上长老, realm: l.太上长老修为 || '', verb: '拜见', text: SECT_CHAT_TEXTS.visitElder(sect, l.太上长老) });
  return out;
});

const leaderSummary = computed(() => {
  const l = ctx.leadership.value;
  if (!l) return '';
  return [l.长老数量 && `长老 ${l.长老数量} 位`, l.最强修为 && `最强 ${l.最强修为}`, l.综合战力 && `战力 ${l.综合战力}`].filter(Boolean).join(' · ');
});

const cat = ref<'all' | '高层' | '真传' | '内门' | '外门'>('all');
const categories = computed(() =>
  (['all', '高层', '真传', '内门', '外门'] as const).map((key) => ({
    key,
    count: key === 'all' ? ctx.members.value.length : ctx.members.value.filter((m) => m.category === key).length,
  })),
);
const list = computed(() => (cat.value === 'all' ? ctx.members.value : ctx.members.value.filter((m) => m.category === cat.value)));

const chat = async (text: string) => {
  await sendChat(text);
  if (!chatBus.hasListeners('send')) {
    await router.push({ name: 'GameMain' });
  }
  toast.success('已发送到对话');
};

const busy = ref('');
const run = async (key: string, fn: () => Promise<unknown>) => {
  if (busy.value) return;
  busy.value = key;
  try {
    await fn();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : '生成失败');
  } finally {
    busy.value = '';
  }
};

const genLeadership = async () => {
  await generateLeadership(ctx);
  toast.success('宗门高层已生成');
};
const genMembers = async () => {
  const { added, skipped } = await generateMembers(ctx);
  toast.success(skipped ? `新增 ${added} 位同门（跳过 ${skipped} 位已有的）` : `新增 ${added} 位同门`);
};
const evolve = async (m: SectContext['members']['value'][number]) => {
  await evolveMember(ctx, m);
  toast.success(`「${m.name}」演化完毕`);
};
</script>

<style scoped>
.members {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  padding-bottom: 1.5rem;
}

.peers,
.peer-list {
  min-width: 0;
  max-width: 100%;
}

.gm-sec-head .cc-btn {
  margin-left: 0.75rem;
}

.leader-row {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 0.75rem;
}

.leader {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.9rem 1rem;
  border: 1px solid rgba(var(--cc-gold-rgb), 0.3);
  border-radius: 8px;
  background: linear-gradient(150deg, rgba(var(--cc-gold-rgb), 0.1), transparent 70%), var(--gm-block);
}

.leader-main {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.leader-role {
  font-size: 12px;
  letter-spacing: 0.3em;
  color: var(--cc-gold);
}

.leader-main b {
  font-family: var(--cc-calligraphy);
  font-size: 22px;
  font-weight: 400;
  letter-spacing: 0.1em;
}

.leader-main small {
  font-size: 13px;
  color: var(--cc-text-2);
}

.filter {
  margin-bottom: 0.8rem;
}

.peer-ops {
  display: flex;
  flex-shrink: 0;
  margin-left: auto;
  gap: 0.2rem;
}

@media (max-width: 768px) {
  .peer {
    flex-wrap: wrap;
  }

  .peer-ops {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>

<template>
  <div class="sect-profile">
    <header class="sp-head">
      <span class="gm-disc lg">{{ (sect.名称 || '宗').charAt(0) }}</span>
      <div class="sp-id">
        <h2 class="gm-detail-name">{{ sect.名称 }}</h2>
        <p class="sp-sub">
          <span>{{ sect.类型 || '宗门' }}</span>
          <span v-if="sect.等级">· {{ sect.等级 }}</span>
          <span v-if="sect.所在大洲">· {{ sect.所在大洲 }}</span>
        </p>
        <div class="sp-badges">
          <SealBadge v-if="current" tone="seal">我的宗门</SealBadge>
          <SealBadge v-if="sect.与玩家关系" :tone="relationTone">{{ relationText }}</SealBadge>
          <SealBadge v-if="sect.可否加入 === false" tone="muted">不收弟子</SealBadge>
        </div>
      </div>
    </header>

    <div class="sp-stats">
      <div v-if="members.length" class="stat"><span>主要成员</span><b>{{ members.length }}</b></div>
      <div v-if="sect.声望值 !== undefined" class="stat"><span>玩家声望</span><b>{{ reputationValue }}</b></div>
    </div>

    <p v-if="sect.描述" class="gm-prose sp-desc">{{ sect.描述 }}</p>

    <section v-if="specialties.length" class="gm-section">
      <h4 class="gm-label">特色</h4>
      <div class="chips"><span v-for="s in specialties" :key="s" class="gm-chip gold">{{ s }}</span></div>
    </section>

    <section v-if="leadership" class="gm-section">
      <h4 class="gm-label">领导层</h4>
      <dl class="gm-kv">
        <dt>{{ leaderTitle }}</dt><dd>{{ leadership.首领 ?? leadership.宗主 }}<small v-if="leaderRealm"> · {{ leaderRealm }}</small></dd>
        <template v-if="deputyName"><dt>{{ deputyTitle }}</dt><dd>{{ deputyName }}</dd></template>
        <template v-if="leadership.太上长老"><dt>太上长老</dt><dd>{{ leadership.太上长老 }}<small v-if="leadership.太上长老修为"> · {{ leadership.太上长老修为 }}</small></dd></template>
        <template v-if="leadership.圣女"><dt>圣女</dt><dd>{{ leadership.圣女 }}</dd></template>
        <template v-if="leadership.圣子"><dt>圣子</dt><dd>{{ leadership.圣子 }}</dd></template>
      </dl>
    </section>

    <section v-if="members.length" class="gm-section">
      <h4 class="gm-label">主要成员</h4>
      <ul class="roster">
        <li v-for="m in members" :key="m.名字">
          <b>{{ m.名字 }}</b>
          <span class="roster-pos">{{ m.职位 }}</span>
          <small v-if="m.境界">{{ m.境界 }}</small>
        </li>
      </ul>
    </section>

    <section v-if="territory.length || sect.势力范围详情?.影响范围" class="gm-section">
      <h4 class="gm-label">势力范围</h4>
      <p v-if="sect.势力范围详情?.影响范围" class="gm-prose">{{ sect.势力范围详情.影响范围 }}<template v-if="sect.势力范围详情?.战略价值"> · 战略价值 {{ sect.势力范围详情.战略价值 }}/10</template></p>
      <div v-if="territory.length" class="chips"><span v-for="t in territory" :key="t" class="gm-chip">{{ t }}</span></div>
    </section>

    <section v-if="resources" class="gm-section">
      <h4 class="gm-label">主要资源</h4>
      <p class="gm-prose">{{ resources }}</p>
    </section>

    <section v-if="!current && (sect.加入条件?.length || sect.加入好处?.length)" class="gm-section">
      <h4 class="gm-label">入门</h4>
      <div class="join">
        <div v-if="sect.加入条件?.length">
          <b>条件</b>
          <ul><li v-for="c in sect.加入条件" :key="c">{{ c }}</li></ul>
        </div>
        <div v-if="sect.加入好处?.length">
          <b>好处</b>
          <ul><li v-for="c in sect.加入好处" :key="c">{{ c }}</li></ul>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { WorldFaction } from '@/types/game';
import SealBadge from '@/components/game/SealBadge.vue';
import { FACTION_RANKS } from '@/utils/prompts/definitions/valueDomains';

const props = defineProps<{ sect: WorldFaction; current?: boolean }>();

const leadership = computed<any>(() => (props.sect as any).领导层 || (props.sect as any).leadership || null);

// 首领称谓按势力类型显示（财团=董事长、家族=家主、局=局长……），
// 旧存档没有 首领称谓 时，退回到按类型推断
const leaderTitle = computed(() => {
  const explicit = leadership.value?.首领称谓;
  if (explicit) return explicit;
  return FACTION_RANKS[String((props.sect as any).类型 || '')]?.首领 || '宗主';
});
const deputyTitle = computed(() => {
  const explicit = leadership.value?.副手称谓;
  if (explicit) return explicit;
  return FACTION_RANKS[String((props.sect as any).类型 || '')]?.副手 || '副宗主';
});
const deputyName = computed(() => leadership.value?.副手 ?? leadership.value?.副宗主);
const leaderRealm = computed(() => leadership.value?.首领修为 ?? leadership.value?.宗主修为);

const relationText = computed(() => {
  const r = props.sect.与玩家关系 as unknown;
  return typeof r === 'object' && r && 'name' in r ? String((r as any).name) : String(r || '中立');
});
const relationTone = computed(() => (/敌|仇/.test(relationText.value) ? 'bad' : /友|盟/.test(relationText.value) ? 'good' : 'muted'));

const reputationValue = computed(() => {
  const r = props.sect.声望值 as unknown;
  return typeof r === 'object' && r && 'value' in r ? Number((r as any).value) : Number(r) || 0;
});

const specialties = computed(() => {
  const s: string[] = [];
  if (Array.isArray(props.sect.特色列表)) s.push(...props.sect.特色列表);
  if (Array.isArray(props.sect.特色)) s.push(...props.sect.特色);
  else if (typeof props.sect.特色 === 'string' && props.sect.特色) s.push(props.sect.特色);
  return [...new Set(s.map(String).filter(Boolean))];
});

/** 具名成员名单（编制）。势力不再统计"多少人"，只列人名+职位+境界 */
const members = computed<Array<{ 名字: string; 职位: string; 境界?: string }>>(() => {
  const raw = (props.sect as any).主要成员 ?? (props.sect as any).members;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((m: any) => ({
      名字: String(m?.名字 ?? m?.name ?? '').trim(),
      职位: String(m?.职位 ?? m?.position ?? '').trim() || '成员',
      境界: String(m?.境界 ?? m?.realm ?? '').trim() || undefined,
    }))
    .filter((m) => !!m.名字);
});

const territory = computed(() => {
  const d = props.sect.势力范围详情?.控制区域;
  if (Array.isArray(d) && d.length) return d.map(String);
  const r = props.sect.势力范围;
  return Array.isArray(r) ? r.filter((x) => typeof x === 'string').map(String) : [];
});

const resources = computed(() => {
  const r = (props.sect as any).主要资源 ?? (props.sect as any).resources;
  return Array.isArray(r) ? r.slice(0, 6).join('、') : typeof r === 'string' ? r : '';
});
</script>

<style scoped>
.sect-profile {
  display: flex;
  flex-direction: column;
}

.sp-head {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.sp-id {
  min-width: 0;
}

.sp-sub {
  margin: 0.2rem 0 0;
  font-size: 14px;
  color: var(--cc-text-2);
}

.sp-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.45rem;
}

.sp-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
  margin-top: 1.1rem;
  padding: 0.8rem 0;
  border-top: 1px solid var(--gm-line);
  border-bottom: 1px solid var(--gm-line);
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.stat span {
  font-size: 13px;
  letter-spacing: 0.15em;
  color: var(--cc-text-2);
}

.stat b {
  font-size: 22px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  color: var(--cc-gold);
}

.stat b.realm {
  font-size: 16px;
}

.sp-desc {
  margin-top: 1rem;
}

.sect-profile .gm-section {
  margin-top: 1.1rem;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.gm-kv small {
  color: var(--cc-text-2);
}

.roster {
  margin: 0;
  padding: 0;
  list-style: none;
}

.roster li {
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
  padding: 0.35rem 0;
  border-bottom: 1px dashed var(--gm-line);
  font-size: 14px;
}

.roster b {
  font-weight: 500;
  letter-spacing: 0.08em;
}

.roster-pos {
  font-size: 12px;
  color: var(--cc-text-2);
}

.roster small {
  margin-left: auto;
  font-size: 12px;
  color: var(--cc-text-3);
}

.join {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
  font-size: 14px;
}

.join b {
  font-size: 13px;
  font-weight: 400;
  letter-spacing: 0.2em;
  color: var(--cc-text-2);
}

.join ul {
  margin: 0.3rem 0 0;
  padding-left: 1.1rem;
  line-height: 1.8;
}
</style>

<template>
  <div class="body-profile">
    <p v-if="!hasAny" class="gm-muted">暂无法身数据，请在酒馆中完善角色设定。</p>
    <template v-else>
      <div v-if="figure.length" class="bp-figure">
        <div v-for="f in figure" :key="f.label" class="bp-stat">
          <span>{{ f.label }}</span>
          <b>{{ f.value }}<i>{{ f.unit }}</i></b>
        </div>
      </div>

      <SplendorProfile v-if="splendor.structured || splendor.summary" :view="splendor" />

      <div v-if="features.length" class="bp-chips">
        <span v-for="tag in features" :key="tag" class="gm-chip">{{ tag }}</span>
      </div>

      <template v-if="nsfw">
        <dl v-if="descriptions.length" class="bp-desc">
          <template v-for="d in descriptions" :key="d.label">
            <dt>{{ d.label }}</dt>
            <dd>{{ d.text }}</dd>
          </template>
        </dl>

        <div v-if="sensitive.length || development.length" class="bp-block">
          <h4 class="gm-label">敏感与开发</h4>
          <div v-if="sensitive.length" class="bp-chips">
            <span v-for="p in sensitive" :key="p" class="gm-chip">{{ p }}</span>
          </div>
          <div v-for="d in development" :key="d.name" class="gm-meter bp-dev" style="--meter: var(--gm-hp)">
            <div class="gm-meter-row"><span>{{ d.name }}</span><b>{{ d.value }}<i>%</i></b></div>
            <div class="gm-meter-track"><span :style="{ width: d.value + '%' }"></span></div>
          </div>
        </div>
      </template>

      <div v-if="marks.length" class="bp-block">
        <h4 class="gm-label">纹身与印记</h4>
        <ul class="bp-marks">
          <li v-for="m in marks" :key="m">{{ m }}</li>
        </ul>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import SplendorProfile from '@/components/game/SplendorProfile.vue';
import { splendorFromBody } from '@/utils/splendor';

const props = defineProps<{ body: Record<string, any> | null; nsfw: boolean }>();

const splendor = computed(() => splendorFromBody(props.body));

const text = (v: unknown) => (typeof v === 'string' && v.trim() && v !== '待AI生成' ? v.trim() : '');
const list = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : []);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

const figure = computed(() => {
  const b = props.body || {};
  const rows: { label: string; value: string | number; unit: string }[] = [];
  if (num(b.身高) !== null) rows.push({ label: '身高', value: b.身高, unit: 'cm' });
  if (num(b.体重) !== null) rows.push({ label: '体重', value: b.体重, unit: 'kg' });
  if (num(b.体脂率) !== null) rows.push({ label: '体脂率', value: b.体脂率, unit: '%' });
  return rows;
});

const features = computed(() => list(props.body?.外观特征));

const descriptions = computed(() => {
  const b = props.body || {};
  return [
    { label: '胸部', text: text(b.胸部描述) },
    { label: '私处', text: text(b.私处描述) },
    { label: '生殖器', text: text(b.生殖器描述) },
  ].filter((d) => d.text);
});

const sensitive = computed(() => list(props.body?.敏感点));

const development = computed(() => {
  const d = props.body?.开发度;
  if (!d || typeof d !== 'object') return [];
  return Object.entries(d as Record<string, unknown>)
    .map(([name, raw]) => ({ name, value: Math.max(0, Math.min(100, Math.round(Number(raw)))) }))
    .filter((e) => Number.isFinite(e.value));
});

const marks = computed(() => list(props.body?.纹身与印记));

const hasAny = computed(
  () =>
    figure.value.length +
      features.value.length +
      descriptions.value.length +
      sensitive.value.length +
      development.value.length +
      marks.value.length >
      0 ||
    splendor.value.structured,
);
</script>

<style scoped>
.body-profile {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.bp-figure {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 0.5rem;
}

.bp-stat {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.6rem 0.8rem;
  border-radius: 6px;
  background: var(--gm-block-2);
}

.bp-stat span {
  font-size: 13px;
  letter-spacing: 0.15em;
  color: var(--cc-text-2);
}

.bp-stat b {
  font-size: 18px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.bp-stat i {
  margin-left: 0.15rem;
  font-size: 12px;
  font-style: normal;
  color: var(--cc-text-3);
}

.bp-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.bp-desc {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.5rem 1rem;
  margin: 0;
  font-size: 15px;
  line-height: 1.8;
}

.bp-desc dt {
  letter-spacing: 0.15em;
  color: var(--cc-text-2);
}

.bp-desc dd {
  margin: 0;
}

.bp-block {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.bp-dev {
  max-width: 360px;
}

.bp-marks {
  margin: 0;
  padding-left: 1.2rem;
  font-size: 15px;
  line-height: 1.8;
}
</style>

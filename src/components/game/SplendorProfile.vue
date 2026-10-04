<template>
  <div class="splendor">
    <div v-if="view.score !== null || view.title || view.summary" class="sp-hero">
      <div v-if="view.score !== null" class="sp-score">
        <ProgressRing :percent="view.score" :size="76" :label="String(view.score)" :tone="view.tone" />
        <span v-if="view.title">{{ view.title }}</span>
      </div>
      <div class="sp-lead">
        <b v-if="view.score === null && view.title">{{ view.title }}</b>
        <p v-if="view.summary" class="gm-prose">{{ view.summary }}</p>
      </div>
    </div>

    <section v-if="view.features.length || view.colors.length" class="sp-sec">
      <h4 class="gm-label">仙姿</h4>
      <div v-if="view.features.length" class="sp-grid">
        <article v-for="f in view.features" :key="f.label" class="sp-card">
          <b>{{ f.label }}</b>
          <p>{{ f.text }}</p>
        </article>
      </div>
      <div v-if="view.colors.length" class="sp-chips">
        <span v-for="c in view.colors" :key="c.label" class="gm-chip">{{ c.label }} {{ c.text }}</span>
      </div>
    </section>

    <div v-if="view.measures.length || view.temperament.length" class="sp-split">
      <section v-if="view.measures.length" class="sp-sec">
        <h4 class="gm-label">法身</h4>
        <div v-for="m in view.measures" :key="m.label" class="gm-meter sp-meter" style="--meter: var(--cc-gold)">
          <div class="gm-meter-row"><span>{{ m.label }}</span><b>{{ m.value }}</b></div>
          <div class="gm-meter-track"><span :style="{ width: bar(m.value) }"></span></div>
        </div>
        <div v-if="view.cup" class="sp-cup" :title="'罩杯 ' + view.cup">{{ view.cup }}</div>
      </section>
      <section v-if="view.temperament.length" class="sp-sec">
        <h4 class="gm-label">气质</h4>
        <RadarChart :items="view.temperament" :size="210" :max="100" />
      </section>
    </div>

    <section v-if="view.clothes.length || view.outfit" class="sp-sec">
      <h4 class="gm-label">霓裳</h4>
      <ul v-if="view.clothes.length" class="sp-clothes">
        <li v-for="c in view.clothes" :key="c"><i></i>{{ c }}</li>
      </ul>
      <p v-if="view.outfit" class="gm-prose">{{ view.outfit }}</p>
    </section>

    <section v-if="view.figure" class="sp-sec">
      <h4 class="gm-label">体态</h4>
      <p class="gm-prose">{{ view.figure }}</p>
    </section>

    <p v-if="!view.structured" class="gm-muted">仪容尚未入册。酒馆里新结识的人物会写下眉眼、体态与衣着；已有的人可在后来的际遇中补上。</p>
  </div>
</template>

<script setup lang="ts">
import ProgressRing from '@/components/game/ProgressRing.vue';
import RadarChart from '@/components/game/RadarChart.vue';
import type { SplendorView } from '@/utils/splendor';

defineProps<{ view: SplendorView }>();

const bar = (value: number) => `${Math.max(6, Math.min(100, value))}%`;
</script>

<style scoped>
.splendor {
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
  container-type: inline-size;
}

.sp-hero {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
}

.sp-score {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  flex-shrink: 0;
}

.sp-score span,
.sp-lead b {
  font-family: var(--cc-calligraphy);
  font-size: 18px;
  font-weight: 400;
  letter-spacing: 0.12em;
  color: var(--cc-gold);
}

.sp-lead {
  min-width: 0;
  flex: 1;
}

.sp-lead p {
  margin: 0;
}

.sp-sec {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.sp-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.sp-card {
  min-width: 0;
  padding: 0.7rem 0.8rem;
  border: 1px solid var(--gm-line);
  border-radius: 6px;
  background: var(--gm-block-2);
}

.sp-card b {
  display: block;
  margin-bottom: 0.25rem;
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.16em;
  color: var(--cc-gold);
}

.sp-card p {
  margin: 0;
  font-size: 14px;
  line-height: 1.7;
  color: var(--cc-text);
}

.sp-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.sp-split {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(180px, 0.9fr);
  gap: 1rem;
  align-items: start;
}

.sp-meter {
  max-width: 280px;
}

.sp-cup {
  width: 42px;
  height: 42px;
  margin-top: 0.2rem;
  display: grid;
  place-items: center;
  border: 1px solid rgba(var(--cc-gold-rgb), 0.55);
  border-radius: 50%;
  background: rgba(var(--cc-gold-rgb), 0.08);
  font-family: var(--cc-calligraphy);
  font-size: 20px;
  color: var(--cc-gold);
}

.sp-clothes {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.sp-clothes li {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.45rem 0.7rem;
  border-radius: 6px;
  background: var(--gm-block-2);
  font-size: 14px;
}

.sp-clothes i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--cc-gold);
  flex-shrink: 0;
}

@container (max-width: 640px) {
  .sp-grid,
  .sp-split {
    grid-template-columns: 1fr;
  }
}
</style>

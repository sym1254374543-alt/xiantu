/**
 * 人物属性页的数据整理：只读，所有值都来自 gameStateStore。
 */
import { computed } from 'vue';
import { useGameStateStore } from '@/stores/gameStateStore';
import { formatRealmWithStage } from '@/utils/realmUtils';
import { calculateFinalAttributes, getAttributeDescription } from '@/utils/attributeCalculation';
import { LOCAL_TALENTS } from '@/data/creationData';
import {
  SIX_SI_KEYS, ageFrom, descOf, formatSpiritRoot, nameOf, normalizeSixSi, playerVitals, reputationInfo, toNumber,
} from '@/utils/gameDisplay';

export function useCharacterSheet() {
  const gs = useGameStateStore();

  const ready = computed(() => gs.isGameLoaded && !!gs.character);
  const character = computed(() => gs.character as Record<string, any> | null);

  const name = computed(() => String(character.value?.名字 || '无名'));
  const age = computed(() => ageFrom(character.value?.出生日期, gs.gameTime, toNumber((gs.attributes as any)?.寿命?.当前)));

  const identityLine = computed(() => {
    const c = character.value;
    if (!c) return '';
    return [c.性别, c.种族 || '人族', `${age.value}岁`].filter(Boolean).join(' · ');
  });

  const origin = computed(() => {
    const o = character.value?.出生;
    return { name: nameOf(o) || '来历不明', desc: descOf(o) };
  });

  const realm = computed(() => {
    const r = (gs.attributes as any)?.境界;
    const need = toNumber(r?.下一级所需);
    const cur = toNumber(r?.当前进度);
    const hasProgress = need > 0;
    const percent = hasProgress ? Math.max(0, Math.min(100, Math.round((cur / need) * 100))) : 0;
    return {
      text: formatRealmWithStage(r),
      hasProgress,
      cur,
      need,
      percent,
      desc: String(r?.突破描述 || ''),
      flag: !hasProgress ? '' : percent >= 100 ? '可突破' : percent >= 90 ? '可冲刺' : '',
    };
  });

  const vitals = computed(() => playerVitals(gs.attributes, age.value));
  const reputation = computed(() => reputationInfo((gs.attributes as any)?.声望));
  const location = computed(() => String((gs.location as any)?.描述 || '行踪未定'));

  const sixSi = computed(() => {
    const innate = normalizeSixSi(character.value?.先天六司);
    let acquired = normalizeSixSi(character.value?.后天六司);
    let final = SIX_SI_KEYS.reduce((acc, k) => ({ ...acc, [k]: innate[k] + acquired[k] }), {} as Record<string, number>);
    try {
      const saveData = gs.toSaveData();
      if (saveData) {
        const r = calculateFinalAttributes(innate as any, saveData);
        acquired = normalizeSixSi(r.后天六司);
        final = normalizeSixSi(r.最终六司);
      }
    } catch {
      /* 数据不全时退回 先天 + 存档后天 */
    }
    return SIX_SI_KEYS.map((k) => ({
      key: k,
      innate: innate[k],
      acquired: acquired[k],
      final: final[k],
      desc: getAttributeDescription(k, Math.max(0, Math.min(10, Math.round(final[k])))),
    }));
  });

  const spiritRoot = computed(() => formatSpiritRoot(character.value?.灵根));

  const talentTier = computed(() => {
    const t = character.value?.天资;
    return { name: nameOf(t), desc: descOf(t) };
  });

  const talents = computed(() => {
    const list = character.value?.天赋;
    if (!Array.isArray(list)) return [];
    return list
      .map((t) => {
        const n = nameOf(t);
        const local = LOCAL_TALENTS.find((x) => x.name === n);
        return { name: n, desc: descOf(t) || String(local?.description || '') };
      })
      .filter((t) => t.name);
  });

  const effects = computed(() =>
    (gs.effects || []).filter((e: any) => e && typeof e === 'object' && e.状态名称),
  );

  const body = computed(() => (gs.body && typeof gs.body === 'object' ? (gs.body as Record<string, any>) : null));

  return {
    ready, name, age, identityLine, origin, realm, vitals, reputation, location,
    sixSi, spiritRoot, talentTier, talents, effects, body,
  };
}

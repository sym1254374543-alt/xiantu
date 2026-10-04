<template>
  <div class="character-management-panel" :class="{ fullscreen: isFullscreen }">
    <VideoBackground v-if="isFullscreen" />

    <!-- 自定义对话框 -->
    <div v-if="modalState.show" class="cc-modal-overlay dialog-layer" @click="handleModalCancel">
      <div class="cc-modal small-dialog" role="dialog" aria-modal="true" @click.stop>
        <div class="cc-modal-head">
          <h3 class="cc-modal-title">{{ modalState.title }}</h3>
        </div>
        <div class="cc-modal-body">
          <p class="cc-hint dialog-message">{{ modalState.message }}</p>
          <input
            v-if="modalState.type === 'prompt'"
            ref="promptInput"
            v-model="modalState.inputValue"
            :placeholder="modalState.placeholder"
            class="cc-input"
            @keydown.enter="handleModalConfirm"
          />
        </div>
        <div class="cc-modal-foot">
          <button v-if="modalState.type !== 'alert'" type="button" class="cc-btn" @click="handleModalCancel">
            {{ $t('取消') }}
          </button>
          <button type="button" class="cc-btn primary" @click="handleModalConfirm">
            {{ $t('确认') }}
          </button>
        </div>
      </div>
    </div>

    <!-- 主体区域 -->
    <main class="main-content" :class="{ 'fullscreen-content': isFullscreen }">
      <span class="frame-corner tl" aria-hidden="true"></span>
      <span class="frame-corner tr" aria-hidden="true"></span>
      <span class="frame-corner bl" aria-hidden="true"></span>
      <span class="frame-corner br" aria-hidden="true"></span>

      <input
        ref="fileInput"
        type="file"
        accept=".json"
        style="display: none"
        @change="handleImportFile"
      />
      <LegacySaveMigrationModal
        :open="showLegacyMigrationModal"
        :targetCharId="legacyMigrationStandalone ? null : selectedCharId"
        :targetCharName="legacyMigrationStandalone ? undefined : selectedCharacter?.角色?.名字"
        :standalone="legacyMigrationStandalone"
        @close="closeLegacyMigration"
        @imported="handleLegacyImported"
        @character-created="handleLegacyCharacterCreated"
      />

      <!-- 页头 -->
      <header v-if="isFullscreen" class="page-header">
        <button type="button" class="cc-btn small back-btn" @click="handleClose">
          <ArrowLeft :size="16" />
          <span>{{ $t('返回道途') }}</span>
        </button>
        <div class="page-title">
          <h1>{{ $t('续前世因缘') }}</h1>
          <p>{{ $t('择一法身，入道重修') }}</p>
        </div>
        <div class="header-spacer" aria-hidden="true"></div>
      </header>

      <!-- 移动端：角色列表抽屉开关 -->
      <div class="mobile-header">
        <button
          type="button"
          class="cc-btn small mobile-menu-btn"
          :class="{ active: isCharacterPanelOpen }"
          :aria-expanded="isCharacterPanelOpen"
          @click="toggleCharacterPanel"
        >
          <Users :size="15" />
          <span>{{ $t('角色列表') }}</span>
        </button>
        <div v-if="selectedCharacter?.角色?.名字" class="mobile-selected">
          {{ selectedCharacter.角色.名字 }} · {{ selectedCharacter.模式 }}
        </div>
      </div>

      <div
        v-if="isCharacterPanelOpen && isMobile"
        class="panel-overlay"
        @click="isCharacterPanelOpen = false"
      ></div>

      <!-- 无角色 -->
      <div v-if="Object.keys(characterStore.rootState.角色列表).length === 0" class="empty-state">
        <div class="empty-emblem" aria-hidden="true"><span>缘</span></div>
        <h2>{{ $t('道途未启') }}</h2>
        <p>{{ $t('尚未创建任何法身，请返回道途开启修仙之旅') }}</p>
        <div class="empty-actions">
          <button type="button" class="cc-btn primary" @click="goBack">
            <Sparkles :size="16" />
            <span>{{ $t('踏入仙途') }}</span>
          </button>
          <button type="button" class="cc-btn" @click="importCharacter">
            <Upload :size="16" />
            <span>{{ $t('导入角色') }}</span>
          </button>
        </div>
      </div>

      <!-- 角色管理 -->
      <div v-else class="management-layout">
        <!-- 左：角色列表 -->
        <section class="cc-panel characters-panel" :class="{ 'is-open': isCharacterPanelOpen }">
          <div class="panel-head">
            <div class="panel-head-title">
              <h2>{{ $t('角色列表') }}</h2>
              <span class="count-chip">{{ allCharacterCount }}</span>
            </div>
            <div class="panel-head-actions">
              <button type="button" class="cc-btn small" :title="$t('导入角色')" @click="importCharacter">
                <Upload :size="14" />
                <span>{{ $t('导入') }}</span>
              </button>
              <button type="button" class="cc-btn small" :title="$t('导入旧版本角色')" @click="openLegacyMigrationStandalone">
                <Wrench :size="14" />
                <span>{{ $t('旧版本') }}</span>
              </button>
            </div>
          </div>

          <div class="characters-list">
            <div
              v-for="[charId, profile] in validCharacterList"
              :key="charId"
              class="character-card"
              role="button"
              tabindex="0"
              :class="{
                active: selectedCharId === String(charId),
                'online-mode': profile.模式 === '联机',
              }"
              @click="selectCharacter(String(charId))"
              @keydown.enter.prevent="selectCharacter(String(charId))"
            >
              <div class="char-avatar" aria-hidden="true">
                <span>{{ profile.角色.名字[0] }}</span>
              </div>
              <div class="char-info">
                <div class="name-row">
                  <h3 class="char-name">{{ profile.角色.名字 }}</h3>
                  <span class="mode-chip" :class="profile.模式 === '联机' ? 'online' : 'single'">
                    {{ profile.模式 === '联机' ? $t('联机') : $t('单机') }}
                  </span>
                </div>
                <div class="char-meta">
                  <span>{{ profile.角色.世界.name }}</span>
                  <span class="dot" aria-hidden="true">·</span>
                  <span>{{ getFieldName(profile.角色.天资.name) }}</span>
                </div>
              </div>
              <div class="save-count" :title="$t('存档')">
                <strong>{{ getSaveCount(profile) }}</strong>
                <span>{{ $t('存档') }}</span>
              </div>
              <div class="card-tools">
                <button type="button" class="cc-icon-btn" :title="$t('详情')" @click.stop="showCharacterDetails(String(charId))">
                  <ScrollText :size="13" />
                </button>
                <button type="button" class="cc-icon-btn" :title="$t('导出')" @click.stop="exportCharacter(String(charId))">
                  <Download :size="13" />
                </button>
                <button type="button" class="cc-icon-btn danger" :title="$t('删除')" @click.stop="handleDeleteCharacter(String(charId))">
                  <Trash2 :size="13" />
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- 右：存档 -->
        <section class="cc-panel saves-panel">
          <div class="panel-head">
            <div class="panel-head-title">
              <h2>{{ $t('存档管理') }}</h2>
              <span v-if="selectedCharacter?.角色?.名字" class="selected-char">
                {{ selectedCharacter.角色.名字 }} · {{ selectedCharacter.模式 }}{{ $t('模式') }}
              </span>
            </div>
            <div v-if="selectedCharacter" class="panel-head-actions">
              <button type="button" class="cc-btn small" :title="$t('向选中角色导入存档')" @click="importSaves">
                <Upload :size="14" />
                <span>{{ $t('导入存档') }}</span>
              </button>
              <button
                type="button"
                class="cc-btn small"
                :disabled="selectedCharacter.模式 !== '单机'"
                title="旧存档转化（单机）"
                @click="openLegacyMigration"
              >
                <Wrench :size="14" />
                <span>旧存档转化</span>
              </button>
            </div>
          </div>

          <div class="saves-body">
            <!-- 未选择角色 -->
            <div v-if="!selectedCharacter" class="cc-placeholder">
              {{ $t('请选择左侧角色查看存档详情') }}
            </div>

            <!-- 加载中 -->
            <div v-else-if="isLoadingSaves" class="cc-state">
              <Loader2 :size="22" class="cc-spin" />
              <span class="state-text">{{ $t('正在加载存档...') }}</span>
            </div>

            <!-- 单机存档 -->
            <div v-else-if="selectedCharacter.模式 === '单机'" class="saves-container">
              <div class="saves-intro">
                <h3 class="cc-section-title">{{ $t('手动存档') }}</h3>
                <span class="saves-tip">{{ $t('存档通过游戏内保存功能创建') }}</span>
              </div>

              <div class="saves-grid">
                <div
                  v-for="(slot, slotKey) in getAllSaves(selectedCharacter)"
                  :key="slotKey"
                  class="save-card"
                  :class="{
                    'has-data': slot.存档数据,
                    'auto-save': slotKey === '上次对话' || slotKey === '时间点存档',
                  }"
                  :role="slot.存档数据 ? 'button' : undefined"
                  :tabindex="slot.存档数据 ? 0 : undefined"
                  @click="slot.存档数据 && handleSelect(selectedCharId!, String(slotKey), true)"
                  @keydown.enter.prevent="slot.存档数据 && handleSelect(selectedCharId!, String(slotKey), true)"
                >
                  <template v-if="slot.存档数据">
                    <div class="save-header">
                      <h4 class="save-name">
                        <History v-if="slotKey === '上次对话'" :size="15" class="save-icon" />
                        <Clock v-else-if="slotKey === '时间点存档'" :size="15" class="save-icon" />
                        <span>{{ slot.存档名 || slotKey }}</span>
                      </h4>
                      <div class="save-tools">
                        <button
                          type="button"
                          class="cc-icon-btn"
                          :title="$t('导出此存档')"
                          @click.stop="exportSingleSave(selectedCharId!, String(slotKey), slot)"
                        >
                          <Download :size="13" />
                        </button>
                        <button
                          type="button"
                          class="cc-icon-btn"
                          :title="$t('重命名')"
                          :disabled="slotKey === '上次对话' || slotKey === '时间点存档'"
                          @click.stop="handleEditSaveName(selectedCharId!, String(slotKey))"
                        >
                          <PenLine :size="13" />
                        </button>
                        <button
                          type="button"
                          class="cc-icon-btn danger"
                          :disabled="!canDeleteSave(selectedCharacter, String(slotKey))"
                          :title="getDeleteTooltip(selectedCharacter, String(slotKey))"
                          @click.stop="handleDeleteSave(selectedCharId!, String(slotKey))"
                        >
                          <Trash2 :size="13" />
                        </button>
                      </div>
                    </div>

                    <div class="save-badges">
                      <span class="realm-badge">{{ getRealmName(normalizeSaveDataV3(slot.存档数据)?.角色?.属性?.境界) }}</span>
                      <span class="age-badge">{{ normalizeSaveDataV3(slot.存档数据)?.角色?.属性?.寿命?.当前 ?? 18 }}岁</span>
                    </div>

                    <div class="stat-grid">
                      <div class="stat vital-hp">
                        <span class="label">气血</span>
                        <span class="value">{{ normalizeSaveDataV3(slot.存档数据)?.角色?.属性?.气血?.当前 ?? 0 }}/{{ normalizeSaveDataV3(slot.存档数据)?.角色?.属性?.气血?.上限 ?? 0 }}</span>
                      </div>
                      <div class="stat vital-qi">
                        <span class="label">灵气</span>
                        <span class="value">{{ normalizeSaveDataV3(slot.存档数据)?.角色?.属性?.灵气?.当前 ?? 0 }}/{{ normalizeSaveDataV3(slot.存档数据)?.角色?.属性?.灵气?.上限 ?? 0 }}</span>
                      </div>
                      <div class="stat vital-sense">
                        <span class="label">神识</span>
                        <span class="value">{{ normalizeSaveDataV3(slot.存档数据)?.角色?.属性?.神识?.当前 ?? 0 }}/{{ normalizeSaveDataV3(slot.存档数据)?.角色?.属性?.神识?.上限 ?? 0 }}</span>
                      </div>
                      <div class="stat">
                        <span class="label">声望</span>
                        <span class="value">{{ normalizeSaveDataV3(slot.存档数据)?.角色?.属性?.声望 ?? 0 }}</span>
                      </div>
                    </div>

                    <div class="save-footer">
                      <span class="location">
                        <MapPin :size="12" />
                        {{ normalizeSaveDataV3(slot.存档数据)?.角色?.位置?.描述 || '初始地' }}
                      </span>
                      <span class="save-time">{{ formatTime(slot.保存时间) }}</span>
                    </div>
                  </template>

                  <div v-else class="save-empty">
                    <FolderOpen :size="22" :stroke-width="1.5" class="empty-slot-icon" />
                    <span class="empty-text">{{ $t('空存档槽') }}</span>
                    <span class="empty-desc">{{ $t('通过游戏内保存创建') }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- 联机存档 -->
            <div v-else-if="selectedCharacter.模式 === '联机'" class="online-saves-container">
              <div v-if="!isLoggedIn" class="center-card">
                <div class="center-emblem" aria-hidden="true"><Lock :size="22" /></div>
                <h3>{{ $t('需要登录') }}</h3>
                <p>{{ $t('请先登录以管理联机角色存档') }}</p>
                <button type="button" class="cc-btn primary" @click="handleLogin">{{ $t('登入道籍') }}</button>
              </div>

              <div v-else-if="isLoadingSaves" class="cc-state">
                <Loader2 :size="22" class="cc-spin" />
                <span class="state-text">{{ $t('正在加载云端存档...') }}</span>
              </div>

              <div v-else-if="selectedCharacter.存档列表?.['云端修行']?.存档数据" class="save-card has-data online-card">
                <div class="save-header">
                  <h4 class="save-name">
                    <Cloud :size="15" class="save-icon" />
                    <span>{{ $t('云端存档') }}</span>
                  </h4>
                  <span
                    class="sync-status"
                    :class="{ synced: !selectedCharacter.存档列表['云端修行'].云端同步信息?.需要同步 }"
                  >
                    {{ selectedCharacter.存档列表['云端修行'].云端同步信息?.需要同步 ? $t('待同步') : $t('已同步') }}
                  </span>
                </div>

                <div class="save-badges">
                  <span class="realm-badge">{{ getRealmName(normalizeSaveDataV3(selectedCharacter.存档列表['云端修行'].存档数据)?.角色?.属性?.境界) }}</span>
                  <span class="age-badge">{{ normalizeSaveDataV3(selectedCharacter.存档列表['云端修行'].存档数据)?.角色?.属性?.寿命?.当前 ?? 18 }}岁</span>
                </div>

                <div class="stat-grid">
                  <div class="stat vital-hp">
                    <span class="label">气血</span>
                    <span class="value">{{ normalizeSaveDataV3(selectedCharacter.存档列表['云端修行'].存档数据)?.角色?.属性?.气血?.当前 ?? 0 }}/{{ normalizeSaveDataV3(selectedCharacter.存档列表['云端修行'].存档数据)?.角色?.属性?.气血?.上限 ?? 0 }}</span>
                  </div>
                  <div class="stat vital-qi">
                    <span class="label">灵气</span>
                    <span class="value">{{ normalizeSaveDataV3(selectedCharacter.存档列表['云端修行'].存档数据)?.角色?.属性?.灵气?.当前 ?? 0 }}/{{ normalizeSaveDataV3(selectedCharacter.存档列表['云端修行'].存档数据)?.角色?.属性?.灵气?.上限 ?? 0 }}</span>
                  </div>
                  <div class="stat vital-sense">
                    <span class="label">神识</span>
                    <span class="value">{{ normalizeSaveDataV3(selectedCharacter.存档列表['云端修行'].存档数据)?.角色?.属性?.神识?.当前 ?? 0 }}/{{ normalizeSaveDataV3(selectedCharacter.存档列表['云端修行'].存档数据)?.角色?.属性?.神识?.上限 ?? 0 }}</span>
                  </div>
                  <div class="stat">
                    <span class="label">声望</span>
                    <span class="value">{{ normalizeSaveDataV3(selectedCharacter.存档列表['云端修行'].存档数据)?.角色?.属性?.声望 ?? 0 }}</span>
                  </div>
                </div>

                <div class="save-footer">
                  <span class="location">
                    <MapPin :size="12" />
                    {{ normalizeSaveDataV3(selectedCharacter.存档列表['云端修行'].存档数据)?.角色?.位置?.描述 || '初始地' }}
                  </span>
                </div>

                <div class="online-actions">
                  <button type="button" class="cc-btn primary" @click="handleSelect(selectedCharId!, '云端修行', true)">
                    <Play :size="15" />
                    <span>{{ $t('进入游戏') }}</span>
                  </button>
                  <button v-if="selectedCharacter.存档列表['云端修行']?.云端同步信息?.需要同步" type="button" class="cc-btn">
                    <RefreshCw :size="15" />
                    <span>{{ $t('同步云端') }}</span>
                  </button>
                </div>
              </div>

              <div v-else class="center-card">
                <div class="center-emblem" aria-hidden="true"><Cloud :size="22" /></div>
                <h3>{{ $t('尚未开始修行') }}</h3>
                <p>{{ $t('开始您的联机修仙之旅，存档将自动同步到云端') }}</p>
                <button type="button" class="cc-btn primary" @click="handleSelect(selectedCharId!, '云端修行', false)">
                  <Play :size="15" />
                  <span>{{ $t('开始游戏') }}</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>

    <!-- 角色详情弹窗 -->
    <div v-if="showDetailsModal" class="cc-modal-overlay dialog-layer" @click="closeDetailsModal">
      <div class="cc-modal wide details-modal" role="dialog" aria-modal="true" @click.stop>
        <div class="cc-modal-head">
          <h3 class="cc-modal-title">{{ detailsCharacter?.角色?.名字 }}</h3>
          <button type="button" class="cc-modal-close" :aria-label="$t('关闭')" @click="closeDetailsModal">
            <X :size="18" />
          </button>
        </div>

        <div v-if="detailsCharacter" class="cc-modal-body">
          <div class="details-grid">
            <section class="detail-section">
              <h4 class="cc-section-title">{{ $t('基础信息') }}</h4>
              <dl class="detail-items">
                <div class="detail-item">
                  <dt>{{ $t('道号') }}</dt>
                  <dd>{{ detailsCharacter.角色.名字 }}</dd>
                </div>
                <div class="detail-item">
                  <dt>{{ $t('世界') }}</dt>
                  <dd>{{ getFieldName(detailsCharacter.角色.世界) }}</dd>
                </div>
                <div class="detail-item">
                  <dt>{{ $t('天资') }}</dt>
                  <dd>{{ getFieldName(detailsCharacter.角色.天资) }}</dd>
                </div>
                <div class="detail-item">
                  <dt>{{ $t('出身') }}</dt>
                  <dd>{{ getFieldName(detailsCharacter.角色.出生) }}</dd>
                </div>
                <div class="detail-item">
                  <dt>{{ $t('灵根') }}</dt>
                  <dd>{{ getFieldName(detailsCharacter.角色.灵根) }}</dd>
                </div>
                <div class="detail-item">
                  <dt>{{ $t('模式') }}</dt>
                  <dd>{{ detailsCharacter.模式 }}</dd>
                </div>
              </dl>
            </section>

            <section class="detail-section">
              <h4 class="cc-section-title">{{ $t('先天六司') }}</h4>
              <div class="attributes-display">
                <HexagonChart
                  v-if="detailsCharacter.角色.先天六司"
                  :stats="convertToStats(detailsCharacter.角色.先天六司)"
                  :size="160"
                  :maxValue="10"
                />
              </div>
            </section>

            <section class="detail-section wide">
              <h4 class="cc-section-title">{{ $t('天赋神通') }}</h4>
              <div v-if="detailsCharacter.角色.天赋?.length" class="talent-items">
                <span
                  v-for="(talent, index) in detailsCharacter.角色.天赋"
                  :key="index"
                  class="talent-tag"
                  :title="getTalentDescription(talent)"
                >
                  {{ getTalentName(talent) }}
                </span>
              </div>
              <span v-else class="no-talents">{{ $t('暂无天赋') }}</span>
            </section>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, nextTick, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useCharacterStore } from '@/stores/characterStore';
import HexagonChart from '@/components/common/HexagonChart.vue';
import VideoBackground from '@/components/common/VideoBackground.vue';
import {
  ArrowLeft, Upload, History, Clock, Wrench, Sparkles, Users, ScrollText, Download, Trash2,
  PenLine, MapPin, FolderOpen, Loader2, Lock, Cloud, Play, RefreshCw, X,
} from 'lucide-vue-next';
import LegacySaveMigrationModal from './LegacySaveMigrationModal.vue';
import type { CharacterProfile, SaveSlot } from '@/types/game';
import "@/style.css";
import { formatRealmWithStage } from '@/utils/realmUtils';
import { toast } from '@/utils/toast';
import { isTavernEnv } from '@/utils/tavern';
import { ensureSaveDataHasTavernNsfw } from '@/utils/nsfw';
import { isSaveDataV3, migrateSaveDataToLatest } from '@/utils/saveMigration';
import { validateSaveDataV3 } from '@/utils/saveValidationV3';
import { createDadBundle, unwrapDadBundle } from '@/utils/dadBundle';
import type { SaveDataV3 } from '@/types/saveSchemaV3';
import { verifyStoredToken } from '@/services/request';
import { isBackendConfigured } from '@/services/backendConfig';

interface Props {
  fullscreen?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  fullscreen: false
});

const emit = defineEmits<{
  (e: 'back'): void;
  (e: 'login'): void;
  (e: 'close'): void;
  (e: 'character-selected', character: CharacterProfile): void;
}>();

const isFullscreen = computed(() => props.fullscreen);

const router = useRouter();
const characterStore = useCharacterStore();
// 临时：管理面板不再校验登录状态，默认视为已登录
const isLoggedIn = ref(true);
const selectedCharId = ref<string | null>(null);
const showDetailsModal = ref(false);
const detailsCharacter = ref<CharacterProfile | null>(null);
const promptInput = ref<HTMLInputElement | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const isCharacterPanelOpen = ref(false);
const loading = ref(false);
const isLoadingSaves = ref(false); // 新增：用于控制存档加载状态
const importMode = ref<'character' | 'saves'>('character');
const showLegacyMigrationModal = ref(false);
const legacyMigrationStandalone = ref(false);

// 响应式屏幕尺寸检测
const screenWidth = ref(window.innerWidth);

// 监听屏幕尺寸变化
const updateScreenWidth = () => {
  screenWidth.value = window.innerWidth;

  // 根据屏幕尺寸调整面板状态
  if (screenWidth.value > 768) {
    // 桌面端：始终显示面板
    isCharacterPanelOpen.value = true;
  } else if (screenWidth.value <= 480) {
    // 小屏手机：默认关闭面板，避免遮挡主要内容
    isCharacterPanelOpen.value = false;
  }
};

const openLegacyMigration = () => {
  if (!selectedCharacter.value) {
    toast.info('请先选择一个单机角色');
    return;
  }
  if (selectedCharacter.value.模式 !== '单机') {
    toast.error('联机角色不支持旧存档转化/导入');
    return;
  }
  legacyMigrationStandalone.value = false;
  showLegacyMigrationModal.value = true;
};

// 独立模式打开旧版本转化（不需要选择角色）
const openLegacyMigrationStandalone = () => {
  legacyMigrationStandalone.value = true;
  showLegacyMigrationModal.value = true;
};

const closeLegacyMigration = () => {
  showLegacyMigrationModal.value = false;
  legacyMigrationStandalone.value = false;
};

const handleLegacyImported = async () => {
  if (!selectedCharId.value) return;
  await selectCharacter(selectedCharId.value);
};

// 处理从旧版本角色创建新角色
const handleLegacyCharacterCreated = async (charId: string) => {
  closeLegacyMigration();
  toast.success('旧版本角色已成功导入');
  // 选中新创建的角色
  await selectCharacter(charId);
};

onMounted(async () => {
  window.addEventListener('resize', updateScreenWidth);
  updateScreenWidth();

  const characterIds = Object.keys(characterStore.rootState.角色列表);
  for (const charId of characterIds) {
    try {
      await characterStore.loadCharacterSaves(charId);
    } catch (error) {
      console.warn(`[CharacterManagement] 预加载角色 ${charId} 存档失败:`, error);
    }
  }

  const firstCharId = characterIds[0];
  if (firstCharId) {
    selectCharacter(firstCharId);
  }
});

onUnmounted(() => {
  window.removeEventListener('resize', updateScreenWidth);
});

// 自定义对话框状态
const modalState = ref({
  show: false,
  type: 'alert' as 'alert' | 'confirm' | 'prompt',
  title: '',
  message: '',
  inputValue: '',
  placeholder: '',
  onConfirm: (() => {}) as (() => void) | ((value: string) => void),
  onCancel: () => {}
});

// 暂停登录校验：避免进入"续前世因缘"时阻断
// verifyStoredToken().then(result => {
//   isLoggedIn.value = result;
// });

// 计算属性
const allCharacterCount = computed(() => Object.keys(characterStore.rootState.角色列表).length);

// 过滤有效的角色列表（排除角色或名字为空的无效数据）
const validCharacterList = computed(() => {
  const list = characterStore.rootState.角色列表;
  const entries = Object.entries(list);

  // 调试：打印原始数据结构
  if (entries.length > 0) {
    console.log('[CharacterManagement] 第一个角色的数据结构:', JSON.stringify(entries[0][1], null, 2).substring(0, 500));
  }

  return entries.filter(([, profile]) => {
    // 兼容两种数据结构：
    // 1. profile.角色.名字 (旧格式)
    // 2. profile.角色.身份.名字 (V3格式)
    const 名字 = profile?.角色?.名字 || (profile?.角色 as any)?.身份?.名字;
    return !!名字;
  });
});

const selectedCharacter = computed(() => {
  if (!selectedCharId.value) return null;
  return characterStore.rootState.角色列表[selectedCharId.value];
});

// 移动端判断
const isMobile = computed(() => screenWidth.value <= 768);

// 方法
const toggleCharacterPanel = () => {
  isCharacterPanelOpen.value = !isCharacterPanelOpen.value;
};

const selectCharacter = async (charId: string) => {
  if (selectedCharId.value === charId) return;

  selectedCharId.value = charId;
  isLoadingSaves.value = true;

  try {
    await characterStore.loadCharacterSaves(charId);
  } catch (error) {
    console.error('[CharacterManagement] 加载存档数据失败:', error);
  } finally {
    isLoadingSaves.value = false;
  }

  if (isMobile.value) {
    isCharacterPanelOpen.value = false;
  }
};

const getSaveCount = (profile: CharacterProfile) => {
  if (profile.模式 === '单机') {
    // 排除"上次对话"，只统计手动存档
    const saves = Object.entries(profile.存档列表 || {})
      .filter(([key, slot]: [string, SaveSlot]) => key !== '上次对话' && slot.存档数据);
    return saves.length;
  } else {
    return profile.存档列表?.['云端修行']?.存档数据 ? 1 : 0;
  }
};

const showCharacterDetails = (charId: string) => {
  detailsCharacter.value = characterStore.rootState.角色列表[charId];
  showDetailsModal.value = true;
};

const closeDetailsModal = () => {
  showDetailsModal.value = false;
  detailsCharacter.value = null;
};

const handleSelect = async (charId: string, slotKey: string, hasData: boolean) => {
  console.log('选择存档:', charId, slotKey, hasData);
  const character = characterStore.rootState.角色列表[charId];

  // 联机模式：先检测登录状态
  if (character?.模式 === '联机' && isBackendConfigured()) {
    const tokenValid = await verifyStoredToken();
    if (!tokenValid) {
      toast.warning('联机模式需要登录，正在跳转...');
      router.push('/login');
      return;
    }
  }

  if (hasData) {
    // 对于有数据的存档，直接进入
    console.log('加载存档...');
    // 加载存档并跳转到游戏
    const success = await characterStore.loadGame(charId, slotKey);
    console.log('加载结果:', success);
    if (success) {
      console.log('跳转到游戏界面...');
      if (props.fullscreen) {
        emit('character-selected', character);
      } else {
        router.push('/game');
      }
    } else {
      console.error('存档加载失败');
    }
  } else {
    // 对于空存档，显示确认对话框
    const isAutoSave = slotKey === '上次对话';
    const title = isAutoSave ? '创建新存档' : '开启新征程';
    const message = isAutoSave
      ? `是否在【${slotKey}】位置创建新的存档开始游戏？`
      : `是否在存档位 \"${slotKey}\" 开始一段新的修行？`;

    showConfirm(
      title,
      message,
      async () => {
        console.log('确认创建新存档...');
        // 加载存档并跳转到游戏
        const success = await characterStore.loadGame(charId, slotKey);
        console.log('新存档加载结果:', success);
        if (success) {
          console.log('跳转到游戏界面...');
          if (props.fullscreen) {
            emit('character-selected', character);
          } else {
            router.push('/game');
          }
        }
      }
    );
  }
};

const handleDeleteCharacter = (charId: string) => {
  const charName = characterStore.rootState.角色列表[charId]?.角色.名字;
  showConfirm(
    '删除角色',
    `确定要彻底删除角色\"${charName}\"及其所有修行记录吗？此操作不可恢复。`,
    async () => {
      // 🔥 修复：如果删除的是当前选中的角色，先清空选中状态
      if (selectedCharId.value === charId) {
        selectedCharId.value = null;
      }

      // 然后执行删除操作
      await characterStore.deleteCharacter(charId);
    }
  );
};

const handleDeleteSave = (charId: string, slotKey: string) => {
  const character = characterStore.rootState.角色列表[charId];
  const charName = character?.角色.名字;
  const saveName = slotKey === '上次对话' ? '上次对话存档' : slotKey;

  // 检查是否可以删除存档
  if (!canDeleteSave(character, slotKey)) {
    showAlert(
      '无法删除存档',
      '无法删除该存档：角色至少需要保留一个存档。如需删除，请先创建其他存档或删除整个角色。'
    );
    return;
  }

  showConfirm(
    '删除存档',
    `确定要删除角色\"${charName}\"的\"${saveName}\"吗？此操作不可恢复。`,
    () => {
      characterStore.deleteSave(charId, slotKey);
    }
  );
};

// 检查是否可以删除存档的逻辑
const canDeleteSave = (character: CharacterProfile | null, slotKey: string): boolean => {
  if (!character || character.模式 === '联机') {
    return false;
  }

  // 自动存档不可删除
  if (slotKey === '上次对话' || slotKey === '时间点存档') {
    return false;
  }

  const savesList = character.存档列表 || {};
  // 统计有数据的手动存档数量
  const manualSavesWithData = Object.entries(savesList).filter(
    ([key, save]) => key !== '上次对话' && key !== '时间点存档' && save.存档数据
  ).length;

  // 如果要删除的存档是最后一个有数据的手动存档，则不允许删除
  const targetSave = savesList[slotKey];
  if (targetSave?.存档数据 && manualSavesWithData <= 1) {
    return false;
  }

  return true;
};

// 获取删除按钮的提示文本
const getDeleteTooltip = (character: CharacterProfile | null, slotKey: string): string => {
  if (slotKey === '上次对话') {
    return '上次对话存档不可删除（用于回滚）';
  }
  if (slotKey === '时间点存档') {
    return '时间点存档不可删除（定时自动覆盖）';
  }
  if (!canDeleteSave(character, slotKey)) {
    return '无法删除：至少需要保留一个手动存档';
  }
  return '删除存档';
};

const getAllSaves = (character: CharacterProfile | null): Record<string, SaveSlot> => {
  if (!character?.存档列表) return {} as Record<string, SaveSlot>;
  // 返回所有存档，不做过滤
  return character.存档列表;
};

const handleEditSaveName = (charId: string, slotKey: string) => {
  const currentSave = characterStore.rootState.角色列表[charId]?.存档列表?.[slotKey];
  const currentName = currentSave?.存档名 || slotKey;

  showPrompt(
    '重命名存档',
    '请输入新的存档名称：',
    currentName,
    '',
    async (newName) => {
      if (newName && newName.trim() && newName.trim() !== currentName) {
        const cleanName = newName.trim();

        const existingSaves = characterStore.rootState.角色列表[charId]?.存档列表;
        if (existingSaves && cleanName !== slotKey && existingSaves[cleanName]) {
          showAlert('重命名失败', '存档名称已存在，请使用其他名称。');
          return;
        }

        await characterStore.renameSave(charId, slotKey, cleanName);
      }
    }
  );
};

const goBack = () => {
  emit('back'); // Still emit for internal logic, but also close via store
};

const handleClose = () => {
  if (props.fullscreen) {
    emit('close');
  } else {
    goBack();
  }
};

const handleLogin = () => {
  emit('login');
};

const normalizeSaveDataV3 = (saveData: unknown): SaveDataV3 | null => {
  if (!saveData || typeof saveData !== 'object') return null;
  try {
    const raw = saveData as any;
    return (isSaveDataV3(raw) ? raw : migrateSaveDataToLatest(raw).migrated) as SaveDataV3;
  } catch (error) {
    console.warn('[CharacterManagement] 存档格式转换失败（旧版存档兼容性问题）:', error);
    // 返回 null，让 UI 显示默认值而不是崩溃
    return null;
  }
};

// 境界显示：统一为“境界+阶段”（初期/中期/后期/圆满），凡人不加阶段
const getRealmName = (realm: unknown): string => {
  return formatRealmWithStage(realm as { 境界: string; 境界等级?: number; 阶段?: string } | null);
};

// 格式化时间
const formatTime = (timeStr: string | null): string => {
  if (!timeStr) return '未保存';
  const date = new Date(timeStr);
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// 转换先天六司
const convertToStats = (innateAttrs: Record<string, number>) => {
  return {
    root_bone: innateAttrs['根骨'] || 0,
    spirituality: innateAttrs['灵性'] || 0,
    comprehension: innateAttrs['悟性'] || 0,
    fortune: innateAttrs['气运'] || 0,
    charm: innateAttrs['魅力'] || 0,
    temperament: innateAttrs['心性'] || 0
  };
};

// 获取天赋名称（兼容字符串和对象格式）
const getTalentName = (talent: unknown): string => {
  if (typeof talent === 'string') return talent;
  if (talent && typeof talent === 'object') {
    const t = talent as Record<string, unknown>;
    return String(t['名称'] || t['name'] || '未知天赋');
  }
  return '未知天赋';
};

// 获取天赋描述（兼容字符串和对象格式）
const getTalentDescription = (talent: unknown): string => {
  if (typeof talent === 'string') return `天赋《${talent}》`;
  if (talent && typeof talent === 'object') {
    const t = talent as Record<string, unknown>;
    const desc = t['描述'] || t['description'] || '';
    const name = getTalentName(talent);
    return desc ? String(desc) : `天赋《${name}》`;
  }
  return '未知天赋';
};

// 通用字段名称获取（兼容字符串和对象格式 { 名称, 描述 } 或 { name, description }）
const getFieldName = (field: string | { 名称?: string; name?: string; 名字?: string } | null): string => {
  if (!field) return '未知';
  if (typeof field === 'string') return field;
  if (typeof field === 'object' && field !== null) {
    return field.名称 || field.name || field.名字 || '未知';
  }
  return '未知';
};

// --- 自定义对话框逻辑 ---

const showAlert = (title: string, message: string, onConfirm?: () => void) => {
  modalState.value = {
    show: true,
    type: 'alert',
    title,
    message,
    inputValue: '',
    placeholder: '',
    onConfirm: () => {
      if (onConfirm) onConfirm();
      closeModal();
    },
    onCancel: closeModal
  };
};

const showConfirm = (title: string, message: string, onConfirm: () => void, onCancel?: () => void) => {
  modalState.value = {
    show: true,
    type: 'confirm',
    title,
    message,
    inputValue: '',
    placeholder: '',
    onConfirm: () => {
      onConfirm();
      closeModal();
    },
    onCancel: () => {
      if (onCancel) onCancel();
      closeModal();
    }
  };
};

const showPrompt = (title: string, message: string, initialValue = '', placeholder = '', onConfirm: (value: string) => void, onCancel?: () => void) => {
  modalState.value = {
    show: true,
    type: 'prompt',
    title,
    message,
    inputValue: initialValue,
    placeholder,
    onConfirm: (value: string) => {
      onConfirm(value || '');
      closeModal();
    },
    onCancel: () => {
      if (onCancel) onCancel();
      closeModal();
    }
  };
  nextTick(() => {
    promptInput.value?.focus();
  });
};

const handleModalConfirm = () => {
  if (modalState.value.type === 'prompt') {
    (modalState.value.onConfirm as (value: string) => void)(modalState.value.inputValue);
  } else {
    (modalState.value.onConfirm as () => void)();
  }
};

const handleModalCancel = () => {
  modalState.value.onCancel();
  closeModal();
};

const closeModal = () => {
  modalState.value.show = false;
};

// 导出角色 - 统一格式: { type: 'character', character: {...} }
const exportCharacter = async (charId: string) => {
  loading.value = true;
  try {
    const character = characterStore.rootState.角色列表[charId];
    if (!character) {
      toast.error('角色不存在');
      loading.value = false;
      return;
    }

    // 🔥 修复：从 IndexedDB 加载所有存档的完整数据
    const { loadSaveData } = await import('@/utils/indexedDBManager');

    // 🔥 统一结构：单机和联机都使用存档列表，过滤掉"上次对话"
    const saveSlots = Object.values(character.存档列表 || {})
      .filter(save => save.存档名 !== '上次对话') as SaveSlot[];

    const savesWithFullData = await Promise.all(
      saveSlots.map(async (save) => {
        const slotKey = save.id || save.存档名;
        const fullData = await loadSaveData(charId, slotKey);
        if (!fullData) {
          console.warn(`[角色导出] 存档「${save.存档名}」数据为空，跳过`);
          return null;
        }
        const patchedData = isTavernEnv() ? (ensureSaveDataHasTavernNsfw(fullData) as any) : fullData;
        return {
          ...save,
          存档数据: patchedData
        };
      })
    ).then(results => results.filter(Boolean)); // 🔥 过滤掉空的存档

    const normalizedSaves = savesWithFullData.map((s) => {
      if (!s) {
        throw new Error(`存档数据为空，无法导出`);
      }
      const rawSaveData = (s as any).存档数据;
      if (!rawSaveData) {
        throw new Error(`存档「${s.存档名}」缺少存档数据，无法导出`);
      }
      // 🔥 兼容旧格式：尝试迁移，如果失败则使用原始数据
      let exportSaveData = rawSaveData;
      try {
        const v3SaveData = isSaveDataV3(rawSaveData as any) ? rawSaveData : migrateSaveDataToLatest(rawSaveData as any).migrated;
        const validation = validateSaveDataV3(v3SaveData as any);
        if (!validation.isValid) {
          console.warn(`[角色导出] 存档「${s.存档名}」校验警告：${validation.errors[0] || '未知原因'}`);
        }
        exportSaveData = v3SaveData;
      } catch (migrateError) {
        console.warn(`[角色导出] 存档「${s.存档名}」迁移失败，使用原始数据:`, migrateError);
        // 继续使用原始数据
      }
      return { ...s, 存档数据: exportSaveData };
    });

    const exportData = createDadBundle('character', {
      角色ID: charId,
      角色信息: JSON.parse(JSON.stringify(character)),
      存档列表: normalizedSaves,
    });

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });

    console.log('[角色导出] 数据大小:', (dataStr.length / 1024).toFixed(2), 'KB');

    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    const characterName = character.角色?.名字 || '未命名角色';
    link.download = `仙途-角色-${characterName}-${new Date().toISOString().split('T')[0]}.json`;

    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    }, 100);

    toast.success(`已导出角色: ${characterName} (含 ${normalizedSaves.length} 个存档)`);
  } catch (error) {
    console.error('导出角色失败', error);
    toast.error('导出角色失败: ' + (error instanceof Error ? error.message : '未知错误'));
  } finally {
    loading.value = false;
  }
};

// 导出单个存档
const exportSingleSave = async (charId: string, slotKey: string, slot: SaveSlot) => {
  loading.value = true;
  try {
    // 从 IndexedDB 加载完整的存档数据
    const { loadSaveData } = await import('@/utils/indexedDBManager');
    const fullSaveDataRaw = await loadSaveData(charId, slotKey);
    const fullSaveData = isTavernEnv() ? (ensureSaveDataHasTavernNsfw(fullSaveDataRaw) as any) : fullSaveDataRaw;

    if (!fullSaveData) {
      toast.error('无法加载存档数据');
      loading.value = false;
      return;
    }

    // 🔥 兼容旧格式：尝试迁移，如果失败则导出原始数据
    let exportSaveData = fullSaveData;
    let migrationWarning = '';
    try {
      const v3SaveData = isSaveDataV3(fullSaveData as any) ? fullSaveData : migrateSaveDataToLatest(fullSaveData as any).migrated;
      const validation = validateSaveDataV3(v3SaveData as any);
      if (!validation.isValid) {
        migrationWarning = `存档格式校验有警告：${validation.errors[0] || '未知问题'}`;
        console.warn('[导出存档]', migrationWarning);
      }
      exportSaveData = v3SaveData;
    } catch (migrateError) {
      migrationWarning = '旧版存档格式，将导出原始数据';
      console.warn('[导出存档] 迁移失败，导出原始数据:', migrateError);
      // 继续使用原始数据导出
    }

    const exportData = createDadBundle('saves', {
      characterId: charId,
      characterName: selectedCharacter.value?.角色?.名字,
      saves: [{
        ...slot,
        存档名: slotKey,
        存档数据: exportSaveData,
      }],
    });

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });

    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    const saveName = slot.存档名 || slotKey;
    link.download = `仙途-${saveName}-${new Date().toISOString().split('T')[0]}.json`;

    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    }, 100);

    toast.success(`已导出存档: ${saveName}`);
  } catch (error) {
    console.error('导出存档失败', error);
    toast.error('导出存档失败: ' + (error instanceof Error ? error.message : '未知错误'));
  } finally {
    loading.value = false;
  }
};

// 导出存档 - 统一格式: { type: 'saves', saves: [...] } (批量导出，保留但不在UI显示)
const _exportSaves = async () => {
  if (!selectedCharacter.value || !selectedCharId.value) {
    toast.error('请先选择一个角色');
    return;
  }

  loading.value = true;
  try {
    const character = selectedCharacter.value;
    const charId = selectedCharId.value;
    const saveSlots = Object.values(character.存档列表 || {}) as SaveSlot[];

    if (saveSlots.length === 0) {
      toast.info('该角色没有可导出的存档');
      loading.value = false;
      return;
    }

    // 🔥 修复：从 IndexedDB 加载每个存档的完整数据
    const { loadSaveData } = await import('@/utils/indexedDBManager');
    const savesWithFullData = await Promise.all(
      saveSlots.map(async (save) => {
        const fullData = await loadSaveData(charId, save.存档名);
        const patchedData = fullData && isTavernEnv() ? (ensureSaveDataHasTavernNsfw(fullData) as any) : fullData;
        return {
          ...save,
          存档数据: patchedData  // 使用统一的字段名
        };
      })
    );

    // 过滤掉没有数据的存档
    const validSaves = savesWithFullData.filter(save => save.存档数据);

    if (validSaves.length === 0) {
      toast.info('该角色没有可导出的存档数据');
      loading.value = false;
      return;
    }

    const normalizedSaves = validSaves.map((s) => {
      const rawSaveData = (s as any).存档数据;
      if (!rawSaveData) return { ...s, 存档数据: rawSaveData };

      // 兼容旧格式：逐个尝试迁移与校验，失败则保留原始数据（保证“能导出”）
      try {
        const v3SaveData = isSaveDataV3(rawSaveData as any) ? rawSaveData : migrateSaveDataToLatest(rawSaveData as any).migrated;
        const validation = validateSaveDataV3(v3SaveData as any);
        if (!validation.isValid) {
          console.warn(`[存档导出] 存档「${s.存档名}」校验警告：${validation.errors[0] || '未知原因'}`);
        }
        return { ...s, 存档数据: v3SaveData };
      } catch (e) {
        console.warn(`[存档导出] 存档「${s.存档名}」迁移失败，导出原始数据:`, e);
        return { ...s, 存档数据: rawSaveData };
      }
    });

    const exportData = createDadBundle('saves', {
      characterId: charId,
      characterName: character.角色.名字,
      saves: normalizedSaves,
    });

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });

    console.log('[存档导出] 数据大小:', (dataStr.length / 1024).toFixed(2), 'KB');

    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `仙途-${character.角色.名字}-存档备份-${new Date().toISOString().split('T')[0]}.json`;

    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    }, 100);

    toast.success(`已导出 ${normalizedSaves.length} 个存档`);
  } catch (error) {
    console.error('导出失败', error);
    toast.error('导出存档失败: ' + (error instanceof Error ? error.message : '未知错误'));
  } finally {
    loading.value = false;
  }
};

// 导入存档
const importSaves = () => {
  if (!selectedCharacter.value) {
    toast.error('请先选择一个角色以导入存档');
    return;
  }
  importMode.value = 'saves';
  fileInput.value?.click();
};

// 导入角色
const importCharacter = () => {
  importMode.value = 'character';
  fileInput.value?.click();
};

// 处理导入文件
// 统一格式: 存档文件 { type: 'saves', saves: [...] }, 角色文件 { 角色, 模式, ... }
const handleImportFile = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;

  const resetInput = () => {
    if (fileInput.value) {
      fileInput.value.value = '';
    }
  };

  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const unwrapped = unwrapDadBundle(data);

    if (importMode.value === 'saves') {
      const savesToImport = (() => {
        if (unwrapped.type === 'saves' && Array.isArray(unwrapped.payload?.saves)) return unwrapped.payload.saves;
        // 兼容：用户可能选了“角色文件”但点了“导入存档”
        if (unwrapped.type === 'character' && Array.isArray(unwrapped.payload?.存档列表)) return unwrapped.payload.存档列表;
        return null;
      })();

      if (!savesToImport) {
        throw new Error('无效的存档文件格式，请使用本游戏导出的存档文件');
      }
      if (savesToImport.length === 0) {
        throw new Error('文件中没有找到有效的存档数据');
      }

      if (!selectedCharId.value || !selectedCharacter.value) {
        toast.error('请先选择一个角色以导入存档');
        resetInput();
        return;
      }

      const charId = selectedCharId.value;
      const charName = selectedCharacter.value.角色.名字;

      showConfirm(
        '导入存档',
        `确定要将 ${savesToImport.length} 个存档导入到角色 "${charName}" 吗？同名存档将被覆盖。`,
        async () => {
          loading.value = true;
          try {
            for (const save of savesToImport) {
              await characterStore.importSave(charId, save);
            }
            toast.success(`成功为角色 "${charName}" 导入 ${savesToImport.length} 个存档`);
            await selectCharacter(charId);
          } catch (error) {
            console.error('导入存档失败', error);
            toast.error('导入存档失败: ' + (error as Error).message);
          } finally {
            loading.value = false;
            resetInput();
          }
        },
        resetInput
      );
    } else if (importMode.value === 'character') {
      // 统一格式: dad.bundle(type=character) payload: { 角色ID, 角色信息, 存档列表 }
      if (unwrapped.type !== 'character' || !unwrapped.payload?.角色信息) {
        throw new Error('无效的角色文件格式，请使用本游戏导出的角色文件');
      }

      const characterData = unwrapped.payload.角色信息;
      const charName = characterData?.角色?.名字 || '未知角色';

      // 清空原有元数据，由存档列表完全接管
      characterData.存档列表 = {};
      if (Array.isArray(unwrapped.payload?.存档列表)) {
        characterData._导入存档列表 = unwrapped.payload.存档列表;
      }

      showConfirm(
        '导入角色',
        `确定要导入角色 "${charName}" 吗？`,
        async () => {
          loading.value = true;
          try {
            await characterStore.importCharacter(characterData);
            toast.success(`成功导入角色 "${charName}"`);
          } catch (error) {
            console.error('导入角色失败', error);
            toast.error('导入角色失败: ' + (error as Error).message);
          } finally {
            loading.value = false;
            resetInput();
          }
        },
        resetInput
      );
    }
  } catch (error) {
    console.error('处理导入文件失败', error);
    toast.error('处理导入文件失败: ' + (error as Error).message);
    resetInput();
  }
};
</script>

<style scoped>
/* ============================================================
   续前世因缘 —— 令牌见 styles/xian-tokens.css，通用类见 creation-theme.css
   ============================================================ */
.character-management-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  color: var(--cc-text);
}

.character-management-panel.fullscreen {
  position: fixed;
  inset: 0;
  z-index: 50;
  align-items: center;
  justify-content: center;
}

.dialog-layer {
  z-index: 3000;
}

.small-dialog {
  width: min(420px, 100%);
}

.dialog-message {
  white-space: pre-wrap;
}

/* ---------- 外框 ---------- */
.main-content {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  width: 100%;
  box-sizing: border-box;
}

.main-content.fullscreen-content {
  flex: none;
  width: 95%;
  max-width: 1280px;
  height: calc(var(--app-vh) * 0.92);
  padding: 1.5rem 1.75rem 1.5rem;
  background: var(--cc-shell-bg);
  border: 1px solid var(--cc-shell-border);
  border-radius: 6px;
  box-shadow: var(--cc-shell-shadow);
  backdrop-filter: blur(22px) saturate(1.1);
  -webkit-backdrop-filter: blur(22px) saturate(1.1);
  animation: shell-in 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}

@keyframes shell-in {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.main-content.fullscreen-content::before {
  content: '';
  position: absolute;
  inset: 9px;
  border: 1px solid rgba(var(--cc-gold-rgb), 0.16);
  border-radius: 3px;
  pointer-events: none;
}

.frame-corner {
  display: none;
  position: absolute;
  width: 30px;
  height: 30px;
  border: 0 solid var(--cc-gold);
  opacity: 0.85;
  pointer-events: none;
}

.fullscreen-content .frame-corner {
  display: block;
}

.frame-corner.tl { top: 5px; left: 5px; border-top-width: 2px; border-left-width: 2px; }
.frame-corner.tr { top: 5px; right: 5px; border-top-width: 2px; border-right-width: 2px; }
.frame-corner.bl { bottom: 5px; left: 5px; border-bottom-width: 2px; border-left-width: 2px; }
.frame-corner.br { bottom: 5px; right: 5px; border-bottom-width: 2px; border-right-width: 2px; }

/* ---------- 页头 ---------- */
.page-header {
  position: relative;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 1rem;
  padding-bottom: 1rem;
  margin-bottom: 1.1rem;
  border-bottom: 1px solid var(--cc-divider);
  flex-shrink: 0;
}

.page-header::after {
  content: '';
  position: absolute;
  left: 20%;
  right: 20%;
  bottom: -1px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(var(--cc-gold-rgb), 0.6), transparent);
}

.back-btn {
  justify-self: start;
}

.page-title {
  text-align: center;
}

.page-title h1 {
  margin: 0;
  font-family: var(--cc-calligraphy);
  font-size: 2.3rem;
  font-weight: 400;
  line-height: 1.15;
  letter-spacing: 0.2em;
  margin-right: -0.2em;
  color: var(--cc-text);
}

[data-theme='dark'] .page-title h1 {
  text-shadow: 0 0 24px rgba(var(--cc-accent-rgb), 0.35);
}

.page-title p {
  margin: 0.2rem 0 0;
  font-size: 0.82rem;
  letter-spacing: 0.3em;
  color: var(--cc-text-3);
}

/* ---------- 空态 ---------- */
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 2rem 1rem;
  text-align: center;
}

.empty-emblem {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 96px;
  height: 96px;
  margin-bottom: 0.75rem;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, rgba(var(--cc-accent-rgb), 0.28) 0%, rgba(var(--cc-accent-rgb), 0.05) 75%);
  box-shadow: 0 0 0 1px rgba(var(--cc-gold-rgb), 0.55), 0 0 40px -10px rgba(var(--cc-accent-rgb), 0.6);
  font-family: var(--cc-calligraphy);
  font-size: 3rem;
  line-height: 1;
  color: var(--cc-accent);
}

.empty-emblem::before {
  content: '';
  position: absolute;
  inset: -9px;
  border-radius: 50%;
  border: 1px dashed rgba(var(--cc-gold-rgb), 0.45);
  animation: ring-spin 24s linear infinite;
}

@keyframes ring-spin {
  to {
    transform: rotate(360deg);
  }
}

.empty-state h2 {
  margin: 0;
  font-family: var(--cc-calligraphy);
  font-size: 1.9rem;
  font-weight: 400;
  letter-spacing: 0.2em;
  color: var(--cc-text);
}

.empty-state p {
  margin: 0;
  font-size: 0.9rem;
  letter-spacing: 0.1em;
  color: var(--cc-text-2);
}

.empty-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 1rem;
}

.empty-actions .cc-btn {
  min-width: 140px;
}

/* ---------- 布局 ---------- */
.management-layout {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(300px, 380px) 1fr;
  gap: 1.1rem;
}

.characters-panel,
.saves-panel {
  min-height: 0;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem 0.75rem;
  padding: 0.8rem 0.9rem;
  border-bottom: 1px solid var(--cc-divider);
  flex-shrink: 0;
}

.panel-head-title {
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
  min-width: 0;
}

.panel-head-title h2 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 0.22em;
  white-space: nowrap;
  color: var(--cc-text);
}

.count-chip {
  padding: 0 0.45rem;
  border-radius: 999px;
  background: rgba(var(--cc-gold-rgb), 0.15);
  color: var(--cc-gold);
  font-size: 0.75rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.selected-char {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.8rem;
  color: var(--cc-text-3);
}

.panel-head-actions {
  display: flex;
  gap: 0.4rem;
}

/* ---------- 角色卡 ---------- */
.characters-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.character-card {
  position: relative;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 0.85rem;
  border: 1px solid var(--cc-border);
  border-radius: 8px;
  background: var(--cc-surface-2);
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.25s ease;
}

.character-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 20%;
  bottom: 20%;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--cc-gold);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.character-card:hover {
  background: var(--cc-surface-hover);
  border-color: rgba(var(--cc-gold-rgb), 0.35);
}

.character-card.active {
  background: var(--cc-selected-bg);
  border-color: rgba(var(--cc-gold-rgb), 0.6);
  box-shadow: var(--cc-glow);
}

.character-card.active::before {
  opacity: 1;
}

.character-card:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(var(--cc-accent-rgb), 0.3);
}

/* 玉璧头像 */
.char-avatar {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, rgba(var(--cc-accent-rgb), 0.25) 0%, rgba(var(--cc-accent-rgb), 0.05) 75%);
  box-shadow: 0 0 0 1px rgba(var(--cc-gold-rgb), 0.5);
  font-family: var(--cc-calligraphy);
  font-size: 1.45rem;
  line-height: 1;
  color: var(--cc-accent);
}

.char-avatar::before {
  content: '';
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  border: 1px dashed rgba(var(--cc-gold-rgb), 0.35);
  transition: transform 0.6s ease;
}

.character-card:hover .char-avatar::before,
.character-card.active .char-avatar::before {
  transform: rotate(90deg);
}

.character-card.online-mode .char-avatar {
  background: radial-gradient(circle at 35% 30%, rgba(96, 165, 250, 0.3) 0%, rgba(96, 165, 250, 0.06) 75%);
}

.char-info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.name-row {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  min-width: 0;
}

.char-name {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--cc-text);
}

.character-card.active .char-name {
  color: var(--cc-accent);
}

.mode-chip {
  flex-shrink: 0;
  padding: 0 0.35rem;
  border-radius: 3px;
  font-size: 0.66rem;
  letter-spacing: 0.05em;
}

.mode-chip.single {
  background: rgba(var(--cc-gold-rgb), 0.15);
  color: var(--cc-gold);
}

.mode-chip.online {
  background: rgba(var(--cc-accent-rgb), 0.15);
  color: var(--cc-accent);
}

.char-meta {
  display: flex;
  gap: 0.3rem;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  font-size: 0.76rem;
  color: var(--cc-text-3);
}

.char-meta span {
  overflow: hidden;
  text-overflow: ellipsis;
}

.char-meta .dot {
  flex-shrink: 0;
}

.save-count {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 2.6rem;
}

.save-count strong {
  font-size: 1.15rem;
  line-height: 1.1;
  color: var(--cc-gold);
  font-variant-numeric: tabular-nums;
}

.save-count span {
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  color: var(--cc-text-3);
}

.card-tools {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
  gap: 0.3rem;
  margin-top: -0.2rem;
  max-height: 0;
  overflow: hidden;
  opacity: 0;
  transition: max-height 0.2s ease, opacity 0.2s ease, margin 0.2s ease;
}

.character-card:hover .card-tools,
.character-card.active .card-tools,
.character-card:focus-within .card-tools {
  max-height: 40px;
  margin-top: 0;
  opacity: 1;
}

@media (hover: none) {
  .card-tools {
    max-height: 40px;
    margin-top: 0;
    opacity: 1;
  }
}

/* ---------- 存档区 ---------- */
.saves-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
}

.state-text {
  margin-left: 0.6rem;
}

.saves-container {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.saves-intro {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.saves-intro .cc-section-title {
  margin-bottom: 0.2rem;
}

.saves-tip {
  font-size: 0.75rem;
  color: var(--cc-text-3);
}

.saves-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 0.75rem;
  margin-top: 0.4rem;
}

.save-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  min-height: 150px;
  padding: 0.9rem 1rem;
  border: 1px solid var(--cc-border);
  border-radius: 10px;
  background: var(--cc-surface-2);
  transition: border-color 0.2s ease, box-shadow 0.25s ease, transform 0.25s ease;
}

.save-card.has-data {
  cursor: pointer;
}

.save-card.has-data:hover {
  border-color: rgba(var(--cc-gold-rgb), 0.6);
  box-shadow: var(--cc-glow);
  transform: translateY(-2px);
}

.save-card.has-data:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(var(--cc-accent-rgb), 0.3);
}

.save-card.auto-save {
  border-style: dashed;
}

.save-card:not(.has-data) {
  border-style: dashed;
  background: transparent;
}

.save-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.save-name {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--cc-text);
}

.save-name span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.save-icon {
  flex-shrink: 0;
  color: var(--cc-gold);
}

.save-tools {
  display: flex;
  gap: 0.25rem;
  flex-shrink: 0;
}

.save-tools .cc-icon-btn {
  width: 26px;
  height: 26px;
}

.save-tools .cc-icon-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.save-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.realm-badge,
.age-badge {
  padding: 0.08rem 0.5rem;
  border-radius: 3px;
  font-size: 0.74rem;
  letter-spacing: 0.06em;
}

.realm-badge {
  background: rgba(var(--cc-gold-rgb), 0.16);
  border: 1px solid rgba(var(--cc-gold-rgb), 0.45);
  color: var(--cc-gold);
}

.age-badge {
  border: 1px solid var(--cc-border);
  color: var(--cc-text-2);
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.3rem 0.8rem;
}

.stat {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.2rem 0;
  border-bottom: 1px dashed var(--cc-divider);
  font-size: 0.78rem;
}

.stat .label {
  color: var(--cc-text-3);
}

.stat .value {
  color: var(--cc-text);
  font-variant-numeric: tabular-nums;
}

.stat.vital-hp .value { color: var(--vital-health); }
.stat.vital-qi .value { color: var(--vital-lingqi); }
.stat.vital-sense .value { color: var(--cc-gold); }

.save-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: auto;
  font-size: 0.72rem;
  color: var(--cc-text-3);
}

.location {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.save-time {
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

.save-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  text-align: center;
}

.empty-slot-icon {
  color: var(--cc-gold);
  opacity: 0.6;
}

.empty-text {
  font-size: 0.85rem;
  letter-spacing: 0.1em;
  color: var(--cc-text-2);
}

.empty-desc {
  font-size: 0.72rem;
  color: var(--cc-text-3);
}

/* ---------- 联机 ---------- */
.online-saves-container {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.online-card {
  max-width: 520px;
  cursor: default;
}

.online-card:hover {
  transform: none;
}

.sync-status {
  flex-shrink: 0;
  padding: 0.05rem 0.45rem;
  border-radius: 999px;
  font-size: 0.7rem;
  background: rgba(var(--cc-warning-rgb), 0.15);
  color: var(--cc-warning);
}

.sync-status.synced {
  background: rgba(110, 231, 183, 0.14);
  color: var(--cc-success);
}

.online-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.4rem;
}

.center-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  padding: 2rem 1rem;
  text-align: center;
}

.center-card h3 {
  margin: 0;
  font-family: var(--cc-calligraphy);
  font-size: 1.5rem;
  font-weight: 400;
  letter-spacing: 0.15em;
}

.center-card p {
  margin: 0 0 0.5rem;
  font-size: 0.85rem;
  color: var(--cc-text-2);
}

.center-emblem {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, rgba(var(--cc-accent-rgb), 0.25) 0%, rgba(var(--cc-accent-rgb), 0.05) 75%);
  box-shadow: 0 0 0 1px rgba(var(--cc-gold-rgb), 0.5);
  color: var(--cc-accent);
}

/* ---------- 详情弹窗 ---------- */
.details-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem 1.25rem;
}

.detail-section.wide {
  grid-column: 1 / -1;
}

.detail-items {
  display: flex;
  flex-direction: column;
  margin: 0;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.4rem 0;
  border-bottom: 1px dashed var(--cc-divider);
  font-size: 0.85rem;
}

.detail-item dt {
  color: var(--cc-text-3);
  letter-spacing: 0.1em;
}

.detail-item dd {
  margin: 0;
  text-align: right;
  color: var(--cc-text);
}

.attributes-display {
  display: flex;
  justify-content: center;
}

.talent-items {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.talent-tag {
  padding: 0.2rem 0.65rem;
  border: 1px solid rgba(var(--cc-gold-rgb), 0.4);
  border-radius: 999px;
  background: rgba(var(--cc-gold-rgb), 0.07);
  font-size: 0.8rem;
  color: var(--cc-gold);
  cursor: help;
}

.no-talents {
  font-size: 0.82rem;
  color: var(--cc-text-3);
}

/* ---------- 移动端 ---------- */
.mobile-header,
.panel-overlay {
  display: none;
}

@media (max-width: 1400px) and (min-width: 769px) {
  /* 为右上角全局菜单按钮让位 */
  .page-header {
    padding-right: 56px;
  }
}

@media (max-width: 900px) {
  .management-layout {
    grid-template-columns: minmax(260px, 1fr) 1.4fr;
  }
}

@media (max-width: 768px) {
  .main-content.fullscreen-content {
    width: 100%;
    height: var(--app-vh);
    height: var(--app-svh);
    padding: 0.9rem 0.85rem;
    padding-bottom: max(0.85rem, env(safe-area-inset-bottom));
    border-radius: 0;
    border-left: none;
    border-right: none;
  }

  .frame-corner {
    display: none !important;
  }

  .page-header {
    grid-template-columns: auto 1fr auto;
    padding-right: 52px;
  }

  .page-title {
    text-align: left;
  }

  .page-title h1 {
    font-size: 1.5rem;
    letter-spacing: 0.12em;
  }

  .page-title p,
  .header-spacer {
    display: none;
  }

  .mobile-header {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin-bottom: 0.75rem;
    flex-shrink: 0;
  }

  .mobile-menu-btn.active {
    color: var(--cc-accent);
    border-color: rgba(var(--cc-gold-rgb), 0.65);
  }

  .mobile-selected {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.8rem;
    color: var(--cc-text-2);
  }

  .panel-overlay {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 60;
    background: rgba(4, 8, 16, 0.5);
  }

  .management-layout {
    display: flex;
    flex-direction: column;
  }

  .characters-panel {
    position: fixed;
    top: 0;
    bottom: 0;
    left: 0;
    z-index: 70;
    width: min(340px, calc(86vw / var(--ui-scale)));
    border-radius: 0 10px 10px 0;
    background: var(--cc-solid-bg);
    box-shadow: 12px 0 32px -12px rgba(0, 0, 0, 0.6);
    transform: translateX(-102%);
    transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  .characters-panel.is-open {
    transform: none;
  }

  .saves-panel {
    flex: 1;
  }

  .saves-grid {
    grid-template-columns: 1fr;
  }

  .details-grid {
    grid-template-columns: 1fr;
  }

  .empty-actions {
    flex-direction: column;
    width: 100%;
    max-width: 280px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .empty-emblem::before,
  .main-content.fullscreen-content {
    animation: none;
  }
}
</style>

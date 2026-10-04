<template>
  <div class="workshop-container">
    <VideoBackground />

    <div class="workshop-panel">
      <span class="frame-corner tl" aria-hidden="true"></span>
      <span class="frame-corner tr" aria-hidden="true"></span>
      <span class="frame-corner bl" aria-hidden="true"></span>
      <span class="frame-corner br" aria-hidden="true"></span>

      <header class="header">
        <div class="emblem" aria-hidden="true"><span>坊</span></div>
        <div class="title-block">
          <div class="title-row">
            <h2 class="title">创意工坊</h2>
            <div v-if="backendReady" class="auth-pill" :class="authState">
              <CheckCircle v-if="authState === 'authed'" :size="13" />
              <AlertCircle v-else-if="authState === 'unauthed'" :size="13" />
              <Loader2 v-else :size="13" class="cc-spin" />
              <span>{{ authState === 'checking' ? '检测中' : authState === 'authed' ? '已验证' : '未验证' }}</span>
              <button v-if="authState === 'unauthed'" type="button" class="pill-link" @click="goLogin">去验证</button>
              <button type="button" class="pill-icon" title="重新检测登录状态" @click="refreshAuth">
                <RefreshCw :size="12" />
              </button>
            </div>
            <div v-else class="auth-pill unauthed">
              <AlertCircle :size="13" />
              <span>未配置后端</span>
            </div>
          </div>
          <p class="subtitle">道友互通有无：分享设置、提示词、开局配置与存档</p>
          <p class="notice">
            <Info :size="12" />
            <span>工坊内容仅对<strong>单机本地</strong>生效，联机模式由后端控制</span>
          </p>
        </div>
      </header>

      <div v-if="!backendReady" class="body">
        <div class="cc-placeholder locked">
          <div class="locked-inner">
            <ServerOff :size="30" />
            <span>未配置后端服务器，创意工坊不可用</span>
          </div>
        </div>
      </div>

      <template v-else>
        <div class="cc-segmented ws-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            :aria-selected="activeTab === 'browse'"
            :class="{ active: activeTab === 'browse' }"
            @click="switchTab('browse')"
          >
            <Compass :size="15" />
            <span>浏览</span>
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="activeTab === 'mine'"
            :class="{ active: activeTab === 'mine' }"
            :title="authState !== 'authed' ? '需先登录' : undefined"
            @click="switchTab('mine')"
          >
            <User :size="15" />
            <span>我的发布</span>
            <Lock v-if="authState !== 'authed'" :size="12" class="tab-lock" />
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="activeTab === 'upload'"
            :class="{ active: activeTab === 'upload' }"
            @click="switchTab('upload')"
          >
            <Upload :size="15" />
            <span>上传</span>
          </button>
        </div>

        <!-- 浏览 / 我的发布 -->
        <div v-if="activeTab !== 'upload'" class="body">
          <div class="filters">
            <select v-model="filterType" class="cc-input type-select" aria-label="类型筛选">
              <option value="">全部类型</option>
              <option value="settings">设置</option>
              <option value="prompts">提示词</option>
              <option value="saves">单机存档</option>
              <option value="start_config">开局配置</option>
            </select>
            <form class="search-wrap" role="search" @submit.prevent="applySearch">
              <Search :size="15" class="search-icon" aria-hidden="true" />
              <input
                v-model="query"
                type="search"
                class="cc-input search-input"
                :placeholder="isMineTab ? '搜索标题 / 说明' : '搜索标题 / 作者 / 说明'"
                aria-label="搜索"
              />
            </form>
            <select v-model.number="pageSize" class="cc-input size-select" aria-label="每页数量">
              <option v-for="size in pageSizeOptions" :key="size" :value="size">每页 {{ size }} 个</option>
            </select>
            <button
              type="button"
              class="cc-icon-btn refresh-btn"
              :disabled="loadingList"
              title="刷新"
              aria-label="刷新"
              @click="refreshList"
            >
              <RefreshCw :size="15" :class="{ 'cc-spin': loadingList }" />
            </button>
          </div>

          <div v-if="isMineTab" class="manage-bar">
            <span class="manage-title">
              <Folder :size="15" />
              我的发布
            </span>
            <span class="manage-meta">仅显示自己发布的内容 · 共 {{ total }} 条</span>
          </div>

          <div class="list-area">
            <div v-if="loadingList" class="cc-state">
              <Loader2 :size="20" class="cc-spin" />
              <span>加载中…</span>
            </div>
            <div v-else-if="items.length === 0" class="cc-placeholder">
              <span>{{ query || filterType ? '没有符合条件的内容' : isMineTab ? '尚未发布任何内容' : '暂无内容' }}</span>
            </div>
            <div v-else class="item-grid">
              <article
                v-for="item in items"
                :key="item.id"
                class="ws-card"
                role="button"
                tabindex="0"
                @click="openDetailModal(item)"
                @keydown.enter.self="openDetailModal(item)"
              >
                <div class="item-head">
                  <span class="type-badge">
                    <component :is="typeIcon[item.type]" :size="12" />
                    {{ typeLabel[item.type] || item.type }}
                  </span>
                  <span class="downloads" :title="`${item.downloads} 次下载`">
                    <Download :size="12" />
                    {{ item.downloads }}
                  </span>
                </div>
                <h3 class="item-title" :title="item.title">{{ item.title }}</h3>
                <p v-if="item.description" class="item-desc">{{ item.description }}</p>
                <div class="item-meta">
                  <span class="meta-author" :title="item.author_name">
                    <UserCircle :size="12" />
                    {{ item.author_name }}
                  </span>
                  <span v-if="item.game_version" class="meta-version">{{ item.game_version }}</span>
                </div>
                <div v-if="item.tags?.length" class="tags">
                  <span v-for="t in item.tags" :key="t" class="tag">{{ t }}</span>
                </div>
                <div class="item-actions" @click.stop>
                  <button v-if="isMineTab" type="button" class="cc-btn small danger" @click="deleteItem(item)">
                    <Trash2 :size="14" />
                    删除
                  </button>
                  <button type="button" class="cc-btn small primary" @click="openDownload(item.id)">
                    <Download :size="14" />
                    下载
                  </button>
                </div>
              </article>
            </div>
          </div>
        </div>

        <!-- 上传 -->
        <div v-else class="body">
          <div v-if="authState !== 'authed'" class="cc-placeholder locked">
            <div class="locked-inner">
              <Lock :size="28" />
              <span>上传需要先完成账号验证（用于标识作者与权限控制）</span>
              <div class="locked-actions">
                <button type="button" class="cc-btn small" @click="refreshAuth">
                  <RefreshCw :size="14" />
                  重新检测
                </button>
                <button type="button" class="cc-btn small primary" @click="goLogin">
                  <LogIn :size="14" />
                  去验证
                </button>
              </div>
            </div>
          </div>
          <form v-else class="upload-form" @submit.prevent="submitUpload">
            <div class="cc-field">
              <label for="ws-type">类型</label>
              <div class="cc-segmented type-seg" id="ws-type" role="radiogroup">
                <label v-for="opt in uploadTypeOptions" :key="opt.value">
                  <input v-model="uploadType" type="radio" name="ws-upload-type" :value="opt.value" />
                  <component :is="typeIcon[opt.value]" :size="14" />
                  <span>{{ opt.label }}</span>
                </label>
              </div>
            </div>
            <div class="cc-field">
              <label for="ws-title">标题 <em class="req">*</em></label>
              <input id="ws-title" v-model="uploadTitle" class="cc-input" maxlength="80" placeholder="给这个分享起个名字" />
            </div>
            <div class="cc-field">
              <label for="ws-desc">说明</label>
              <textarea id="ws-desc" v-model="uploadDesc" class="cc-input" maxlength="2000" placeholder="可选：写点说明（2000 字以内）" />
            </div>
            <div class="cc-field">
              <label for="ws-tags">标签</label>
              <input id="ws-tags" v-model="uploadTagsText" class="cc-input" placeholder="可选：用逗号分隔，如：新手,爽文,慢热（最多 12 个）" />
            </div>

            <div class="cc-field">
              <span class="cc-field-label">内容 <em class="req">*</em></span>
              <div class="content-actions">
                <button v-if="uploadType === 'settings'" type="button" class="cc-btn small" @click="loadLocalSettings">
                  <Settings :size="14" />
                  读取本地设置
                </button>
                <button v-if="uploadType === 'prompts'" type="button" class="cc-btn small" @click="loadLocalPrompts">
                  <FileText :size="14" />
                  导出本地提示词
                </button>
                <label class="cc-btn small file-btn">
                  <File :size="14" />
                  选择 JSON 文件
                  <input type="file" accept=".json,application/json" hidden @change="handleUploadFile" />
                </label>
              </div>
              <p class="payload-hint" :class="{ ok: !!payloadHint }">
                <CheckCircle v-if="payloadHint" :size="13" />
                <span>{{ payloadHint || uploadContentHint }}</span>
              </p>
            </div>
          </form>
        </div>
      </template>

      <footer class="footer">
        <button type="button" class="cc-btn" @click="goBack">
          <ArrowLeft :size="15" />
          返回
        </button>
        <div v-if="backendReady && activeTab !== 'upload' && totalPages > 1" class="pagination">
          <span class="page-meta">共 {{ total }} 条 · 第 {{ page }} / {{ totalPages }} 页</span>
          <button type="button" class="cc-icon-btn" :disabled="page <= 1" title="上一页" aria-label="上一页" @click="goPrevPage">
            <ChevronLeft :size="16" />
          </button>
          <button type="button" class="cc-icon-btn" :disabled="page >= totalPages" title="下一页" aria-label="下一页" @click="goNextPage">
            <ChevronRight :size="16" />
          </button>
        </div>
        <button
          v-if="backendReady && activeTab === 'upload' && authState === 'authed'"
          type="button"
          class="cc-btn primary"
          :disabled="uploading || !uploadTitle.trim() || !uploadPayload"
          @click="submitUpload"
        >
          <Loader2 v-if="uploading" :size="15" class="cc-spin" />
          <Upload v-else :size="15" />
          {{ uploading ? '上传中…' : '上传到工坊' }}
        </button>
      </footer>
    </div>

    <!-- 详情弹窗 -->
    <div v-if="detailModal.open" class="cc-modal-overlay" @click.self="closeDetailModal">
      <div class="cc-modal" role="dialog" aria-modal="true" aria-labelledby="ws-detail-title">
        <div class="cc-modal-head">
          <h3 id="ws-detail-title" class="cc-modal-title modal-title-ellipsis">{{ detailModal.item?.title }}</h3>
          <button type="button" class="cc-modal-close" title="关闭" aria-label="关闭" @click="closeDetailModal">
            <X :size="18" />
          </button>
        </div>
        <div class="cc-modal-body">
          <dl class="info-list">
            <div class="info-row">
              <dt>类型</dt>
              <dd>
                <span class="type-badge">
                  <component :is="typeIcon[detailModal.item?.type || 'settings']" :size="12" />
                  {{ typeLabel[detailModal.item?.type || ''] }}
                </span>
              </dd>
            </div>
            <div class="info-row">
              <dt>作者</dt>
              <dd>{{ detailModal.item?.author_name }}</dd>
            </div>
            <div class="info-row">
              <dt>下载次数</dt>
              <dd class="gold">{{ detailModal.item?.downloads }}</dd>
            </div>
            <div v-if="detailModal.item?.game_version" class="info-row">
              <dt>游戏版本</dt>
              <dd>{{ detailModal.item?.game_version }}</dd>
            </div>
            <div v-if="detailModal.item?.tags?.length" class="info-row">
              <dt>标签</dt>
              <dd class="tags">
                <span v-for="t in detailModal.item?.tags" :key="t" class="tag">{{ t }}</span>
              </dd>
            </div>
          </dl>
          <template v-if="detailModal.item?.description">
            <h4 class="cc-section-title">说明</h4>
            <p class="detail-desc">{{ detailModal.item?.description }}</p>
          </template>
        </div>
        <div class="cc-modal-foot">
          <button type="button" class="cc-btn" @click="closeDetailModal">关闭</button>
          <button type="button" class="cc-btn primary" @click="openDownloadFromDetail">
            <Download :size="15" />
            下载
          </button>
        </div>
      </div>
    </div>

    <!-- 下载/导入弹窗 -->
    <div v-if="downloadModal.open" class="cc-modal-overlay" @click.self="closeDownloadModal">
      <div class="cc-modal" role="dialog" aria-modal="true" aria-labelledby="ws-download-title">
        <div class="cc-modal-head">
          <h3 id="ws-download-title" class="cc-modal-title">取用</h3>
          <button type="button" class="cc-modal-close" title="关闭" aria-label="关闭" @click="closeDownloadModal">
            <X :size="18" />
          </button>
        </div>
        <div v-if="downloadModal.loading" class="cc-modal-body">
          <div class="cc-state">
            <Loader2 :size="20" class="cc-spin" />
            <span>加载中…</span>
          </div>
        </div>
        <template v-else>
          <div class="cc-modal-body">
            <div class="dl-card">
              <div class="dl-title">{{ downloadModal.item?.title }}</div>
              <div class="dl-sub">
                <span v-if="downloadModal.item">
                  <component :is="typeIcon[downloadModal.item.type]" :size="12" />
                  {{ typeLabel[downloadModal.item.type] || downloadModal.item.type }}
                </span>
                <span v-if="downloadModal.item?.author_name">
                  <UserCircle :size="12" />
                  {{ downloadModal.item.author_name }}
                </span>
                <span v-if="downloadModal.item?.game_version">{{ downloadModal.item.game_version }}</span>
              </div>
            </div>

            <div v-if="downloadModal.item?.type === 'saves'" class="cc-field">
              <label for="ws-target">导入到单机角色</label>
              <select id="ws-target" v-model="targetCharId" class="cc-input">
                <option value="">{{ localCharacters.length ? '请选择角色' : '暂无单机角色' }}</option>
                <option v-for="c in localCharacters" :key="c.角色ID" :value="c.角色ID">
                  {{ c.name }}
                </option>
              </select>
              <p class="cc-hint">存档会追加到所选角色的存档列表中，不会覆盖已有存档。</p>
            </div>
            <p v-else class="cc-hint">{{ applyHint }}</p>
          </div>
          <div class="cc-modal-foot">
            <button type="button" class="cc-btn" @click="downloadAsFile">
              <FileDown :size="15" />
              下载为文件
            </button>
            <button v-if="downloadModal.item?.type === 'settings'" type="button" class="cc-btn primary" @click="applySettingsFromPayload">
              <Import :size="15" />
              导入到本地设置
            </button>
            <button v-if="downloadModal.item?.type === 'prompts'" type="button" class="cc-btn primary" @click="applyPromptsFromPayload">
              <Import :size="15" />
              导入到本地提示词
            </button>
            <button v-if="downloadModal.item?.type === 'start_config'" type="button" class="cc-btn primary" @click="applyStartConfigFromPayload">
              <Import :size="15" />
              应用到开局配置
            </button>
            <button v-if="downloadModal.item?.type === 'saves'" type="button" class="cc-btn primary" :disabled="!targetCharId" @click="applySavesFromPayload">
              <Import :size="15" />
              导入存档
            </button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, type Component } from 'vue';
import { useRouter } from 'vue-router';
import VideoBackground from '@/components/common/VideoBackground.vue';
import { verifyStoredToken } from '@/services/request';
import { toast } from '@/utils/toast';
import { promptStorage } from '@/services/promptStorage';
import { createWorkshopItem, deleteWorkshopItem, downloadWorkshopItem, listMyWorkshopItems, listWorkshopItems, type WorkshopItemOut, type WorkshopItemType } from '@/services/workshop';
import { useCharacterStore } from '@/stores/characterStore';
import { fetchBackendVersion, isBackendConfigured } from '@/services/backendConfig';
import { createDadBundle, unwrapDadBundle } from '@/utils/dadBundle';
import { isSaveDataV3, migrateSaveDataToLatest } from '@/utils/saveMigration';
import { validateSaveDataV3 } from '@/utils/saveValidationV3';
import {
  CheckCircle, AlertCircle, Loader2, RefreshCw, Info, ServerOff, ArrowLeft,
  Compass, User, Upload, Search, Folder, Download, UserCircle, Trash2,
  ChevronLeft, ChevronRight, Lock, Settings, FileText, File, X, FileDown, Import,
  ScrollText, Save, PlayCircle, LogIn
} from 'lucide-vue-next';

const router = useRouter();
const characterStore = useCharacterStore();

const backendReady = ref(isBackendConfigured());
const backendVersion = ref<string | null>(null);
const effectiveVersion = computed(() => {
  if (!backendReady.value) {
    return APP_VERSION;
  }
  return backendVersion.value ?? '';
});
const versionLabel = computed(() => effectiveVersion.value || '未知版本');

const authState = ref<'checking' | 'authed' | 'unauthed'>('checking');
const activeTab = ref<'browse' | 'upload' | 'mine'>('browse');
const page = ref(1);
const pageSize = ref(12);
const total = ref(0);
const pageSizeOptions = [8, 12, 20, 30];
const listMode = computed(() => (activeTab.value === 'mine' ? 'mine' : 'browse'));
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)));
const isMineTab = computed(() => activeTab.value === 'mine');
const isListTab = computed(() => activeTab.value !== 'upload');
const typeLabel: Record<string, string> = {
  settings: '设置',
  prompts: '提示词',
  saves: '单机存档',
  start_config: '开局配置',
};

const uploadTypeOptions: { value: WorkshopItemType; label: string }[] = [
  { value: 'settings', label: '设置' },
  { value: 'prompts', label: '提示词' },
  { value: 'saves', label: '单机存档' },
  { value: 'start_config', label: '开局配置' },
];

// 类型对应的图标
const typeIcon: Record<string, Component> = {
  settings: Settings,
  prompts: ScrollText,
  saves: Save,
  start_config: PlayCircle,
};

// 详情弹窗
const detailModal = ref<{
  open: boolean;
  item: WorkshopItemOut | null;
}>({
  open: false,
  item: null,
});

const openDetailModal = (item: WorkshopItemOut) => {
  detailModal.value.open = true;
  detailModal.value.item = item;
};

const closeDetailModal = () => {
  detailModal.value.open = false;
  detailModal.value.item = null;
};

const openDownloadFromDetail = () => {
  if (detailModal.value.item) {
    openDownload(detailModal.value.item.id);
    closeDetailModal();
  }
};

const refreshAuth = async () => {
  if (!backendReady.value) {
    authState.value = 'unauthed';
    return;
  }
  authState.value = 'checking';
  try {
    const ok = await verifyStoredToken();
    authState.value = ok ? 'authed' : 'unauthed';
  } catch {
    authState.value = 'unauthed';
  }
};

onMounted(async () => {
  if (!backendReady.value) return;
  const fetchedVersion = await fetchBackendVersion();
  if (fetchedVersion) {
    backendVersion.value = fetchedVersion;
  }
  void refreshAuth();
  void refreshList();
});

const goBack = () => {
  router.push('/');
};

const goLogin = () => {
  if (!backendReady.value) {
    toast.info('未配置后端服务器，登录不可用');
    return;
  }
  router.push('/login');
};

const switchTab = (tab: 'browse' | 'upload' | 'mine') => {
  if (tab === 'mine' && authState.value !== 'authed') {
    goLogin();
    return;
  }
  activeTab.value = tab;
};

// --- 浏览 ---
const filterType = ref<WorkshopItemType | ''>('');
const query = ref('');
const items = ref<WorkshopItemOut[]>([]);
const loadingList = ref(false);

const refreshList = async () => {
  if (!backendReady.value) {
    items.value = [];
    total.value = 0;
    return;
  }
  if (listMode.value === 'mine' && authState.value !== 'authed') {
    goLogin();
    return;
  }
  loadingList.value = true;
  try {
    const res = listMode.value === 'mine'
      ? await listMyWorkshopItems({ type: filterType.value, q: query.value, page: page.value, pageSize: pageSize.value })
      : await listWorkshopItems({ type: filterType.value, q: query.value, page: page.value, pageSize: pageSize.value });
    items.value = res.items || [];
    total.value = res.total || 0;
  } catch {
    items.value = [];
    total.value = 0;
  } finally {
    loadingList.value = false;
  }
};

const goPrevPage = () => {
  if (page.value > 1) {
    page.value -= 1;
  }
};

const goNextPage = () => {
  if (page.value < totalPages.value) {
    page.value += 1;
  }
};

watch(activeTab, () => {
  page.value = 1;
  if (isListTab.value) {
    void refreshList();
  }
});

watch(page, () => {
  if (isListTab.value) {
    void refreshList();
  }
});

watch(pageSize, () => {
  page.value = 1;
  if (isListTab.value) {
    void refreshList();
  }
});

watch(filterType, () => {
  page.value = 1;
  if (isListTab.value) {
    void refreshList();
  }
});

// 搜索：回车立即查询，输入停顿后自动查询
let searchTimer: ReturnType<typeof setTimeout> | null = null;
const applySearch = () => {
  if (searchTimer) {
    clearTimeout(searchTimer);
    searchTimer = null;
  }
  if (page.value !== 1) {
    page.value = 1; // page 的 watch 会触发刷新
    return;
  }
  if (isListTab.value) void refreshList();
};

watch(query, () => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(applySearch, 450);
});

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer);
});

// --- 下载/导入 ---
const downloadModal = ref<{
  open: boolean;
  loading: boolean;
  item: WorkshopItemOut | null;
  payload: unknown;
}>({
  open: false,
  loading: false,
  item: null,
  payload: null,
});

const targetCharId = ref('');

const applyHint = computed(() => {
  switch (downloadModal.value.item?.type) {
    case 'settings':
      return '导入会与本地设置合并（同名项被覆盖），刷新页面后生效。';
    case 'prompts':
      return '导入会覆盖同名提示词，刷新页面后生效。';
    case 'start_config':
      return '应用后会替换本地开局配置，重新打开开局页面生效。';
    default:
      return '';
  }
});

const closeDownloadModal = () => {
  downloadModal.value.open = false;
  downloadModal.value.loading = false;
  downloadModal.value.item = null;
  downloadModal.value.payload = null;
  targetCharId.value = '';
};

const openDownload = async (itemId: number) => {
  downloadModal.value.open = true;
  downloadModal.value.loading = true;
  downloadModal.value.item = null;
  downloadModal.value.payload = null;
  try {
    const res = await downloadWorkshopItem(itemId);
    downloadModal.value.item = res.item;
    downloadModal.value.payload = res.payload;
  } catch {
    closeDownloadModal();
  } finally {
    downloadModal.value.loading = false;
  }
};

const deleteItem = async (item: WorkshopItemOut) => {
  if (authState.value !== 'authed') {
    goLogin();
    return;
  }
  const ok = window.confirm(`确定删除「${item.title}」吗？删除后将无法恢复。`);
  if (!ok) return;
  try {
    await deleteWorkshopItem(item.id);
    toast.success('已删除');
    await refreshList();
  } catch {
    // request.ts 已 toast
  }
};

const downloadAsFile = () => {
  if (!downloadModal.value.item) return;
  const payload = downloadModal.value.payload;
  const dataStr = JSON.stringify(payload, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  const dateStr = new Date().toISOString().split('T')[0];
  link.download = `仙途-工坊-${downloadModal.value.item.type}-${dateStr}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
};

const applySettingsFromPayload = () => {
  const payload = downloadModal.value.payload as any;
  const unwrapped = unwrapDadBundle(payload);

  // 提取设置数据（支持多种格式）
  let settingsData: any = null;

  if (unwrapped.type === 'settings') {
    // dad.bundle 格式
    settingsData = unwrapped.payload;
  } else if (payload?.settings) {
    // 旧导出格式 { settings: {...}, exportInfo: {...} }
    settingsData = payload.settings;
  } else if (unwrapped.type === null && typeof unwrapped.payload === 'object') {
    // 直接是设置对象
    settingsData = unwrapped.payload;
  }

  if (!settingsData || typeof settingsData !== 'object') {
    toast.error('设置内容格式不正确');
    return;
  }

  try {
    // 读取当前设置
    const currentSettings = (() => {
      try {
        const raw = localStorage.getItem('dad_game_settings');
        return raw ? JSON.parse(raw) : {};
      } catch {
        return {};
      }
    })();

    // 合并设置（保留当前设置中未被覆盖的字段）
    const mergedSettings = { ...currentSettings, ...settingsData };

    // 保存到 localStorage
    localStorage.setItem('dad_game_settings', JSON.stringify(mergedSettings));

    toast.success('已导入本地设置（刷新页面后生效）');
    closeDownloadModal();
  } catch (error) {
    console.error('导入设置失败:', error);
    toast.error('导入设置失败，请重试');
  }
};

const applyPromptsFromPayload = async () => {
  const payload = downloadModal.value.payload as any;
  const unwrapped = unwrapDadBundle(payload);

  // 提取提示词数据（支持多种格式）
  let promptsData: any = null;

  if (unwrapped.type === 'prompts') {
    // dad.bundle 格式
    promptsData = unwrapped.payload;
  } else if (typeof payload === 'object' && !Array.isArray(payload)) {
    // 直接是提示词对象
    promptsData = payload;
  }

  if (!promptsData || typeof promptsData !== 'object') {
    toast.error('提示词内容格式不正确');
    return;
  }

  try {
    const count = await promptStorage.importPrompts(promptsData);
    toast.success(`已导入 ${count} 条提示词（刷新页面后生效）`);
    closeDownloadModal();
  } catch (error) {
    console.error('导入提示词失败:', error);
    toast.error('导入提示词失败，请重试');
  }
};

const applyStartConfigFromPayload = () => {
  const payload = downloadModal.value.payload as any;
  const unwrapped = unwrapDadBundle(payload);

  // 提取开局配置数据（支持多种格式）
  let startConfigData: any = null;

  if (unwrapped.type === 'start_config') {
    // dad.bundle 格式
    startConfigData = unwrapped.payload;
  } else if (typeof payload === 'object' && !Array.isArray(payload)) {
    // 直接是开局配置对象
    startConfigData = payload;
  }

  if (!startConfigData || typeof startConfigData !== 'object') {
    toast.error('开局配置格式不正确');
    return;
  }

  try {
    localStorage.setItem('dad_start_config', JSON.stringify(startConfigData));
    toast.success('已应用到本地开局配置（重新打开开局页面生效）');
    closeDownloadModal();
  } catch (error) {
    console.error('导入开局配置失败:', error);
    toast.error('导入开局配置失败，请重试');
  }
};

const localCharacters = computed(() => {
  const list = (characterStore.allCharacterProfiles as any[]) || [];
  return list
    .filter((c: any) => c?.模式 === '单机')
    .map((c: any) => ({
      角色ID: c.角色ID,
      name: c?.角色?.名字 || c.角色ID,
    }));
});

const applySavesFromPayload = async () => {
  if (!targetCharId.value) return;
  const payload = downloadModal.value.payload as any;
  const unwrapped = unwrapDadBundle(payload);

  const saves = (() => {
    if (unwrapped.type === 'saves' && Array.isArray(unwrapped.payload?.saves)) return unwrapped.payload.saves;
    if (unwrapped.type === 'character' && Array.isArray(unwrapped.payload?.存档列表)) return unwrapped.payload.存档列表;
    return null;
  })();

  if (!saves) {
    toast.error('存档内容格式不正确');
    return;
  }

  for (const save of saves) {
    await characterStore.importSave(targetCharId.value, save);
  }
  toast.success(`已导入 ${saves.length} 个存档到本地单机角色`);
  closeDownloadModal();
};

// --- 上传 ---
const uploadType = ref<WorkshopItemType>('settings');
const uploadTitle = ref('');
const uploadDesc = ref('');
const uploadTagsText = ref('');
const uploadPayload = ref<unknown>(null);
const payloadHint = ref('');
const uploading = ref(false);

const uploadContentHint = computed(() => {
  switch (uploadType.value) {
    case 'settings':
      return '可直接读取本机设置，或选择导出的设置文件。';
    case 'prompts':
      return '可直接导出本机提示词，或选择导出的提示词文件。';
    case 'saves':
      return '请选择游戏导出的存档包或角色包，上传前会自动转换并校验。';
    default:
      return '请选择导出的开局配置 JSON 文件。';
  }
});

// 切换类型后，已选内容不再对应，清空避免误传
watch(uploadType, () => {
  uploadPayload.value = null;
  payloadHint.value = '';
});

const parseTags = (text: string): string[] => {
  return text
    .split(',')
    .map(t => t.trim())
    .filter(Boolean)
    .slice(0, 12);
};

const handleUploadFile = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    uploadPayload.value = JSON.parse(text);
    payloadHint.value = `已读取：${file.name}`;
    if (!uploadTitle.value) uploadTitle.value = file.name.replace(/\.json$/i, '');
  } catch {
    uploadPayload.value = null;
    payloadHint.value = '';
    toast.error('读取文件失败，请确认是有效的 JSON');
  } finally {
    (e.target as HTMLInputElement).value = '';
  }
};

const loadLocalSettings = () => {
  try {
    const raw = localStorage.getItem('dad_game_settings');
    if (!raw) {
      toast.info('本地还没有设置数据');
      return;
    }
    const settings = JSON.parse(raw);
    uploadPayload.value = {
      settings,
      exportInfo: { timestamp: new Date().toISOString(), version: versionLabel.value, gameVersion: `仙途 v${versionLabel.value}` },
    };
    payloadHint.value = '已从本地读取 dad_game_settings';
    if (!uploadTitle.value) uploadTitle.value = `设置-${versionLabel.value}`;
  } catch {
    toast.error('读取本地设置失败');
  }
};

const loadLocalPrompts = async () => {
  try {
    const data = await promptStorage.exportAll();
    uploadPayload.value = data;
    payloadHint.value = '已从本地导出提示词';
    if (!uploadTitle.value) uploadTitle.value = `提示词-${versionLabel.value}`;
  } catch {
    toast.error('导出本地提示词失败');
  }
};

const submitUpload = async () => {
  if (authState.value !== 'authed') {
    toast.info('上传前需要先完成账号验证');
    return;
  }
  const title = uploadTitle.value.trim();
  if (!title) {
    toast.error('请填写标题');
    return;
  }
  if (!uploadPayload.value) {
    toast.error('请先选择/生成要上传的内容');
    return;
  }

  // 统一：工坊上传 payload 全部使用 dad.bundle（导入时仍兼容旧格式）
  const normalizeUploadPayload = (): { bundleType: 'settings' | 'prompts' | 'saves' | 'character' | 'start_config'; bundle: unknown } => {
    const raw = uploadPayload.value as any;
    const unwrapped = unwrapDadBundle(raw);

    if (uploadType.value === 'settings') {
      const settings = unwrapped.type === 'settings' ? unwrapped.payload : raw?.settings ?? raw;
      if (!settings || typeof settings !== 'object') throw new Error('设置内容格式不正确');
      return { bundleType: 'settings', bundle: createDadBundle('settings', settings, { appVersion: versionLabel.value }) };
    }

    if (uploadType.value === 'prompts') {
      const promptsPayload = unwrapped.type === 'prompts' ? unwrapped.payload : raw;
      if (!promptsPayload || typeof promptsPayload !== 'object') throw new Error('提示词内容格式不正确');
      return { bundleType: 'prompts', bundle: createDadBundle('prompts', promptsPayload, { appVersion: versionLabel.value }) };
    }

    if (uploadType.value === 'start_config') {
      const startConfig = unwrapped.type === 'start_config' ? unwrapped.payload : raw;
      if (!startConfig || typeof startConfig !== 'object') throw new Error('开局配置格式不正确');
      return { bundleType: 'start_config', bundle: createDadBundle('start_config', startConfig, { appVersion: versionLabel.value }) };
    }

    // saves：允许上传“存档包 / 角色包”（工坊类型仍为 saves）
    if (uploadType.value === 'saves') {
      const bundleType = unwrapped.type === 'character' ? 'character' : 'saves';

      const saves = (() => {
        if (unwrapped.type === 'saves' && Array.isArray(unwrapped.payload?.saves)) return unwrapped.payload.saves;
        if (unwrapped.type === 'character' && Array.isArray(unwrapped.payload?.存档列表)) return unwrapped.payload.存档列表;

        // 兼容：旧格式（未包裹 dad.bundle）
        if (raw?.type === 'saves' && Array.isArray(raw.saves)) return raw.saves;
        if (raw?.type === 'character' && Array.isArray(raw.character?.存档列表)) return raw.character.存档列表;

        return null;
      })();

      if (!saves) throw new Error('单机存档必须使用游戏导出的存档或角色文件');

      const normalizedSaves = saves.map((s: any) => {
        const rawSaveData = s?.存档数据;
        if (!rawSaveData) throw new Error(`存档「${s?.存档名 ?? '未知'}」缺少存档数据`);
        const v3SaveData = isSaveDataV3(rawSaveData as any) ? rawSaveData : migrateSaveDataToLatest(rawSaveData as any).migrated;
        const validation = validateSaveDataV3(v3SaveData as any);
        if (!validation.isValid) throw new Error(`存档「${s?.存档名 ?? '未知'}」校验失败：${validation.errors[0] || '未知原因'}`);
        return { ...s, 存档数据: v3SaveData };
      });

      if (bundleType === 'character') {
        const payload = {
          角色ID: raw?.角色ID ?? unwrapped.payload?.角色ID,
          角色信息: JSON.parse(JSON.stringify(raw?.角色信息 ?? unwrapped.payload?.角色信息 ?? {})),
          存档列表: normalizedSaves,
        };
        return { bundleType: 'character', bundle: createDadBundle('character', payload, { appVersion: versionLabel.value }) };
      }

      const payload = {
        characterId: raw?.characterId ?? unwrapped.payload?.characterId,
        characterName: raw?.characterName ?? unwrapped.payload?.characterName,
        saves: normalizedSaves,
      };
      return { bundleType: 'saves', bundle: createDadBundle('saves', payload, { appVersion: versionLabel.value }) };
    }

    throw new Error('不支持的上传类型');
  };

  uploading.value = true;
  try {
    const normalized = normalizeUploadPayload();
    await createWorkshopItem({
      type: uploadType.value,
      title,
      description: uploadDesc.value.trim() || undefined,
      tags: parseTags(uploadTagsText.value),
      payload: normalized.bundle,
      game_version: `仙途 v${versionLabel.value}`,
      data_version: '1',
    });
    toast.success('上传成功');
    uploadTitle.value = '';
    uploadDesc.value = '';
    uploadTagsText.value = '';
    uploadPayload.value = null;
    payloadHint.value = '';
    activeTab.value = 'browse';
    page.value = 1;
    await refreshList();
  } catch {
    // request.ts 已 toast
  } finally {
    uploading.value = false;
  }
};
</script>

<style scoped>
/* 创意工坊 —— 令牌见 styles/xian-tokens.css，通用类见 styles/creation-theme.css */
.workshop-container {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: var(--app-dvh);
  padding: 1.5rem;
  box-sizing: border-box;
  overflow: hidden;
  color: var(--cc-text);
}

.workshop-panel {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  width: min(980px, 100%);
  height: min(760px, 100%);
  box-sizing: border-box;
  background: var(--cc-shell-bg);
  border: 1px solid var(--cc-shell-border);
  border-radius: 6px;
  box-shadow: var(--cc-shell-shadow);
  backdrop-filter: blur(22px) saturate(1.1);
  -webkit-backdrop-filter: blur(22px) saturate(1.1);
}

.workshop-panel::before {
  content: '';
  position: absolute;
  inset: 9px;
  border: 1px solid rgba(var(--cc-gold-rgb), 0.16);
  border-radius: 3px;
  pointer-events: none;
}

.frame-corner {
  position: absolute;
  width: 26px;
  height: 26px;
  border: 0 solid var(--cc-gold);
  opacity: 0.85;
  pointer-events: none;
}

.frame-corner.tl { top: 5px; left: 5px; border-top-width: 2px; border-left-width: 2px; }
.frame-corner.tr { top: 5px; right: 5px; border-top-width: 2px; border-right-width: 2px; }
.frame-corner.bl { bottom: 5px; left: 5px; border-bottom-width: 2px; border-left-width: 2px; }
.frame-corner.br { bottom: 5px; right: 5px; border-bottom-width: 2px; border-right-width: 2px; }

/* ---------- 头部 ---------- */
.header {
  position: relative;
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.6rem 1.9rem 1.1rem;
  border-bottom: 1px solid var(--cc-divider);
  flex-shrink: 0;
}

.emblem {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  flex-shrink: 0;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, rgba(var(--cc-accent-rgb), 0.25) 0%, rgba(var(--cc-accent-rgb), 0.05) 75%);
  box-shadow: 0 0 0 1px rgba(var(--cc-gold-rgb), 0.5);
  font-family: var(--cc-calligraphy);
  font-size: 1.6rem;
  color: var(--cc-accent);
}

.emblem::before {
  content: '';
  position: absolute;
  inset: -5px;
  border-radius: 50%;
  border: 1px dashed rgba(var(--cc-gold-rgb), 0.4);
  transition: transform 0.8s ease;
}

.header:hover .emblem::before {
  transform: rotate(90deg);
}

.title-block {
  flex: 1;
  min-width: 0;
}

.title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem 0.8rem;
}

.title {
  margin: 0;
  font-family: var(--cc-calligraphy);
  font-size: 1.8rem;
  font-weight: 400;
  letter-spacing: 0.15em;
  color: var(--cc-text);
}

.auth-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.15rem 0.3rem 0.15rem 0.6rem;
  border: 1px solid var(--cc-border);
  border-radius: 999px;
  font-size: 0.75rem;
  letter-spacing: 0.06em;
  white-space: nowrap;
  color: var(--cc-text-2);
}

.auth-pill.authed {
  border-color: color-mix(in srgb, var(--cc-success) 45%, transparent);
  background: color-mix(in srgb, var(--cc-success) 10%, transparent);
  color: var(--cc-success);
}

.auth-pill.unauthed {
  border-color: rgba(var(--cc-warning-rgb), 0.45);
  background: rgba(var(--cc-warning-rgb), 0.1);
  color: var(--cc-warning);
}

.pill-link,
.pill-icon {
  display: inline-flex;
  align-items: center;
  padding: 0.1rem 0.35rem;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--cc-accent);
  font-family: inherit;
  font-size: 0.75rem;
  cursor: pointer;
}

.pill-link {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.pill-icon {
  color: inherit;
}

.pill-link:hover,
.pill-icon:hover {
  background: rgba(var(--cc-accent-rgb), 0.14);
}

.subtitle {
  margin: 0.25rem 0 0;
  font-size: 0.82rem;
  letter-spacing: 0.08em;
  color: var(--cc-text-2);
}

.notice {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin: 0.2rem 0 0;
  font-size: 0.75rem;
  color: var(--cc-text-3);
}

.notice svg {
  flex-shrink: 0;
  color: var(--cc-gold);
}

.notice strong {
  margin: 0 0.15em;
  color: var(--cc-gold);
  font-weight: 600;
}

/* ---------- 标签页 ---------- */
.ws-tabs {
  flex-shrink: 0;
  margin: 1rem 1.9rem 0;
}

.tab-lock {
  opacity: 0.6;
}

/* ---------- 主体 ---------- */
.body {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  padding: 0.9rem 1.9rem 0;
}

.filters {
  display: grid;
  grid-template-columns: 140px minmax(0, 1fr) 128px auto;
  gap: 0.6rem;
  align-items: center;
  flex-shrink: 0;
}

.search-wrap {
  position: relative;
  min-width: 0;
  margin: 0;
}

.search-icon {
  position: absolute;
  left: 0.8rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--cc-gold);
  opacity: 0.8;
  pointer-events: none;
}

.filters .cc-input {
  min-height: 38px;
}

.cc-input.search-input {
  padding-left: 2.3rem;
}

.search-input::-webkit-search-cancel-button {
  cursor: pointer;
}

.refresh-btn {
  width: 38px;
  height: 38px;
}

.refresh-btn:disabled {
  opacity: 0.55;
  cursor: progress;
}

.manage-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.4rem 0.75rem;
  margin-top: 0.75rem;
  padding: 0.5rem 0.85rem;
  border: 1px solid var(--cc-border);
  border-left: 3px solid var(--cc-gold);
  border-radius: 6px;
  background: var(--cc-surface);
  flex-shrink: 0;
}

.manage-title {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  letter-spacing: 0.12em;
  color: var(--cc-text);
}

.manage-title svg {
  color: var(--cc-gold);
}

.manage-meta {
  font-size: 0.75rem;
  color: var(--cc-text-3);
}

.list-area {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  margin-top: 0.85rem;
  overflow-y: auto;
  padding: 2px 4px 1rem 2px;
  scrollbar-width: thin;
  scrollbar-color: rgba(var(--cc-gold-rgb), 0.35) transparent;
}

.list-area .cc-state {
  gap: 0.6rem;
}

.cc-placeholder {
  border: 1px dashed var(--cc-border);
  border-radius: 8px;
}

/* ---------- 卡片 ---------- */
.item-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 0.8rem;
}

.ws-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  min-height: 168px;
  padding: 0.9rem 1rem 0.85rem 1.1rem;
  box-sizing: border-box;
  border: 1px solid var(--cc-border);
  border-radius: 8px;
  background: var(--cc-surface);
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.25s ease, transform 0.2s ease;
}

.ws-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 18%;
  bottom: 18%;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: linear-gradient(180deg, var(--cc-gold), rgba(var(--cc-gold-rgb), 0.3));
  opacity: 0;
  transform: scaleY(0.4);
  transition: opacity 0.25s ease, transform 0.3s ease;
}

.ws-card:hover,
.ws-card:focus-visible {
  outline: none;
  background: var(--cc-selected-bg);
  border-color: rgba(var(--cc-gold-rgb), 0.5);
  box-shadow: var(--cc-glow);
  transform: translateY(-2px);
}

.ws-card:focus-visible {
  box-shadow: 0 0 0 3px rgba(var(--cc-accent-rgb), 0.3);
}

.ws-card:hover::before,
.ws-card:focus-visible::before {
  opacity: 1;
  transform: none;
}

.item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.type-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.12rem 0.5rem;
  border: 1px solid rgba(var(--cc-gold-rgb), 0.4);
  border-radius: 999px;
  background: rgba(var(--cc-gold-rgb), 0.07);
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  color: var(--cc-gold);
  white-space: nowrap;
}

.downloads {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  color: var(--cc-text-3);
}

.item-title {
  display: -webkit-box;
  margin: 0.1rem 0 0;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.4;
  letter-spacing: 0.06em;
  word-break: break-word;
  color: var(--cc-text);
}

.ws-card:hover .item-title {
  color: var(--cc-accent);
}

.item-desc {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  font-size: 0.8rem;
  line-height: 1.6;
  color: var(--cc-text-2);
}

.item-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.3rem 0.7rem;
  font-size: 0.74rem;
  color: var(--cc-text-3);
}

.meta-author {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.ws-card .tags {
  max-height: 1.45rem;
  overflow: hidden;
}

.tag {
  padding: 0.05rem 0.4rem;
  border: 1px solid var(--cc-border);
  border-radius: 4px;
  font-size: 0.68rem;
  color: var(--cc-text-2);
  white-space: nowrap;
}

.item-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.4rem;
  margin-top: auto;
  padding-top: 0.45rem;
}

.cc-btn.danger:hover:not(:disabled) {
  color: var(--cc-danger);
  border-color: rgba(var(--cc-danger-rgb), 0.55);
  background: rgba(var(--cc-danger-rgb), 0.08);
}

/* ---------- 空态 / 未解锁 ---------- */
.cc-placeholder.locked {
  flex: 1;
  margin-bottom: 1rem;
}

.locked-inner {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.8rem;
  max-width: 360px;
  line-height: 1.7;
  letter-spacing: 0.08em;
}

.locked-inner > svg {
  color: var(--cc-gold);
}

.locked-actions {
  display: flex;
  gap: 0.6rem;
}

/* ---------- 上传 ---------- */
.upload-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  flex: 1;
  min-height: 0;
  margin: 0;
  overflow-y: auto;
  padding: 0.1rem 4px 1rem 2px;
}

.type-seg {
  flex-wrap: wrap;
}

.req {
  font-style: normal;
  color: var(--cc-seal);
}

.content-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.file-btn {
  cursor: pointer;
}

.file-btn svg,
.content-actions .cc-btn svg {
  color: var(--cc-gold);
}

.payload-hint {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin: 0.15rem 0 0;
  font-size: 0.8rem;
  line-height: 1.55;
  color: var(--cc-text-3);
}

.payload-hint.ok {
  color: var(--cc-success);
}

/* ---------- 底栏 ---------- */
.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.6rem 1rem;
  padding: 0.9rem 1.9rem 1.4rem;
  border-top: 1px solid var(--cc-divider);
  flex-shrink: 0;
}

.pagination {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.page-meta {
  margin-right: 0.35rem;
  font-size: 0.8rem;
  letter-spacing: 0.06em;
  color: var(--cc-text-3);
  font-variant-numeric: tabular-nums;
}

.pagination .cc-icon-btn {
  width: 34px;
  height: 34px;
}

.pagination .cc-icon-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ---------- 弹窗 ---------- */
.modal-title-ellipsis {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.info-list {
  margin: 0;
}

.info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.5rem 0;
  border-bottom: 1px dashed var(--cc-divider);
  font-size: 0.86rem;
}

.info-row dt {
  flex-shrink: 0;
  letter-spacing: 0.1em;
  color: var(--cc-text-3);
}

.info-row dd {
  margin: 0;
  text-align: right;
  word-break: break-all;
  color: var(--cc-text);
}

.info-row dd.gold {
  color: var(--cc-gold);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.info-row dd.tags {
  justify-content: flex-end;
}

.cc-section-title {
  margin: 0.4rem 0 0;
}

.detail-desc {
  margin: 0;
  font-size: 0.88rem;
  line-height: 1.85;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--cc-text-2);
}

.dl-card {
  padding: 0.85rem 1rem;
  border: 1px solid var(--cc-border);
  border-left: 3px solid var(--cc-gold);
  border-radius: 6px;
  background: var(--cc-surface);
}

.dl-title {
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--cc-text);
  word-break: break-word;
}

.dl-sub {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.8rem;
  margin-top: 0.35rem;
  font-size: 0.78rem;
  color: var(--cc-text-3);
}

.dl-sub span {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.cc-modal-foot {
  flex-wrap: wrap;
}

.workshop-container :is(.cc-btn, .cc-icon-btn, .pill-link, .pill-icon, .cc-segmented > button):focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(var(--cc-accent-rgb), 0.3);
}

/* ---------- 响应式 ---------- */
@media (min-width: 481px) and (max-width: 1400px) {
  .header {
    padding-right: 56px;
  }
}

@media (max-width: 768px) {
  .workshop-container {
    padding: 0.75rem;
  }

  .header {
    padding: 1.3rem 1.25rem 0.9rem;
    padding-right: 56px;
  }

  .ws-tabs {
    margin: 0.8rem 1.25rem 0;
  }

  .body {
    padding: 0.8rem 1.25rem 0;
  }

  .filters {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
  }

  .search-wrap {
    grid-column: 1 / -1;
    grid-row: 1;
  }

  .footer {
    padding: 0.8rem 1.25rem 1.1rem;
  }
}

@media (max-width: 480px) {
  .workshop-container {
    padding: 0;
  }

  .workshop-panel {
    width: 100%;
    height: 100%;
    border-radius: 0;
    border-left: none;
    border-right: none;
  }

  .workshop-panel::before,
  .frame-corner {
    display: none;
  }

  .header {
    align-items: flex-start;
    gap: 0.75rem;
    padding: 1rem 64px 0.8rem 1rem;
  }

  .emblem {
    width: 42px;
    height: 42px;
    font-size: 1.3rem;
  }

  .title {
    font-size: 1.5rem;
  }

  .notice {
    display: none;
  }

  .ws-tabs {
    margin: 0.7rem 1rem 0;
  }

  .ws-tabs > button {
    padding: 0.45rem 0.4rem;
    font-size: 0.8rem;
    letter-spacing: 0.04em;
  }

  .body {
    padding: 0.7rem 1rem 0;
  }

  .item-grid {
    grid-template-columns: 1fr;
    gap: 0.6rem;
  }

  .ws-card {
    min-height: 0;
  }

  .ws-card:hover {
    transform: none;
  }

  .footer {
    padding: 0.7rem 1rem calc(0.8rem + env(safe-area-inset-bottom));
  }

  .footer > .cc-btn {
    flex: 1;
  }

  .pagination {
    order: -1;
    width: 100%;
  }

  .page-meta {
    margin-right: auto;
  }

  .cc-modal-foot .cc-btn {
    flex: 1 1 auto;
  }
}

@media (max-height: 640px) and (min-width: 481px) {
  .notice {
    display: none;
  }

  .header {
    padding-top: 1.1rem;
    padding-bottom: 0.8rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ws-card,
  .emblem::before {
    transition: none;
  }

  .ws-card:hover {
    transform: none;
  }
}
</style>

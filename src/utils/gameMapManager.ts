// Pixi.js 游戏地图管理器（不使用 pixi-viewport，手动实现交互）
import * as PIXI from 'pixi.js';
import type { GameMapConfig, GameCoordinates, ViewportState } from '@/types/gameMap';
import type { WorldLocation } from '@/types/location';
import type { CultivationContinent } from '@/types/worldMap';

/**
 * 地图配色（仙侠风）：暗色「墨夜描金」/ 亮色「宣纸淡墨」，与 styles/game-theme.css 的令牌同源。
 * 只影响画面样式，不影响坐标与交互。
 */
interface MapPalette {
  bg: number;
  grid: number;
  gridAlpha: number;
  frame: number;
  continentFill: number;
  continentFillAlpha: number;
  continentLine: number;
  continentLabel: number;
  continentLabelAlpha: number;
  text: string;
  halo: string;
  inner: number;
  npc: number;
  player: number;
  playerRing: number;
  playerText: string;
  types: Record<string, number>;
}

const SERIF = "'Noto Serif SC', 'Source Han Serif SC', 'SimSun', serif";
const CALLI = "'Ma Shan Zheng', 'STXingkai', 'KaiTi', 'STKaiti', serif";

const PALETTES: Record<'dark' | 'light', MapPalette> = {
  dark: {
    bg: 0x141b2b,
    grid: 0xd4b878,
    gridAlpha: 0.06,
    frame: 0xd4b878,
    continentFill: 0x5fbfa9,
    continentFillAlpha: 0.07,
    continentLine: 0xd4b878,
    continentLabel: 0xd4b878,
    continentLabelAlpha: 0.14,
    text: '#eceff5',
    halo: '#141b2b',
    inner: 0xfdf6e3,
    npc: 0x9aa6d6,
    player: 0xc0392b,
    playerRing: 0xd4b878,
    playerText: '#f2d27a',
    types: {
      名山大川: 0x5fbfa9, 宗门势力: 0xd4b878, 城镇坊市: 0x7f9cf0, 洞天福地: 0xa891f2, 奇珍异地: 0xf0a35a, 凶险之地: 0xe0685a, 其他特殊: 0xf2c46b,
    },
  },
  light: {
    bg: 0xeeeadf,
    grid: 0x7f5d27,
    gridAlpha: 0.07,
    frame: 0x7f5d27,
    continentFill: 0x2f7774,
    continentFillAlpha: 0.07,
    continentLine: 0x7f5d27,
    continentLabel: 0x3d3a30,
    continentLabelAlpha: 0.12,
    text: '#233238',
    halo: '#eeeadf',
    inner: 0xfffaf0,
    npc: 0x4b4178,
    player: 0xb8322a,
    playerRing: 0x7f5d27,
    playerText: '#8a3a12',
    types: {
      名山大川: 0x2f7d6f, 宗门势力: 0x7f5d27, 城镇坊市: 0x2c4a86, 洞天福地: 0x5b3fa0, 奇珍异地: 0xa3500f, 凶险之地: 0xb8322a, 其他特殊: 0x9a5b00,
    },
  },
};

const TYPE_ALIAS: Record<string, string> = {
  natural_landmark: '名山大川', sect_power: '宗门势力', city_town: '城镇坊市', blessed_land: '洞天福地',
  treasure_land: '奇珍异地', dangerous_area: '凶险之地', special_other: '其他特殊',
};

const hexNum = (c: string | undefined, fallback: number) => {
  const n = parseInt(String(c || '').replace('#', ''), 16);
  return Number.isFinite(n) ? n : fallback;
};

/** 势力色在墨夜底上偏暗、宣纸底上过亮时，沿原色相拉开亮度，避免范围融进底色。 */
const themeReadable = (color: number, dark: boolean) => {
  let r = (color >> 16) & 255;
  let g = (color >> 8) & 255;
  let b = color & 255;
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  if (dark && lum < 0.55) {
    const t = ((0.55 - lum) / 0.55) * 0.7;
    r = Math.round(r + (255 - r) * t);
    g = Math.round(g + (255 - g) * t);
    b = Math.round(b + (255 - b) * t);
  } else if (!dark && lum > 0.7) {
    const t = ((lum - 0.7) / 0.3) * 0.4;
    r = Math.round(r * (1 - t));
    g = Math.round(g * (1 - t));
    b = Math.round(b * (1 - t));
  }
  return (r << 16) | (g << 8) | b;
};

/**
 * 游戏地图管理器
 * 负责管理Pixi.js应用、容器、图层和地图元素
 */
export class GameMapManager {
  private app: PIXI.Application;
  private worldContainer: PIXI.Container; // 替代 viewport
  private layers: Map<number, PIXI.Container>;
  private config: GameMapConfig;
  private palette: MapPalette;
  private locationSprites: Map<string, PIXI.Container> = new Map();
  private eventCallbacks: Map<string, ((data?: unknown) => void)[]> = new Map();
  private continentBounds: Map<string, {
    bounds: { x: number; y: number }[];
    data: {
      id: string;
      name?: string;
      description?: string;
      特点?: string;
      主要势力?: string[]
    }
  }> = new Map();

  // 手动实现的交互状态
  private isDragging = false;
  private dragStart = { x: 0, y: 0 };
  private lastPosition = { x: 0, y: 0 };
  private dragDistance = 0;

  // 双指缩放状态
  private isPinching = false;
  private initialPinchDistance = 0;
  private initialPinchScale = 1;
  private pinchCenter = { x: 0, y: 0 };

  /** 构造时传入的画布。Pixi 销毁后 app.view 会变空，卸载监听必须用这份引用。 */
  private canvas: HTMLCanvasElement;
  private destroyed = false;

  // 保存绑定的事件处理函数引用，用于正确移除监听器
  private boundOnDragStart: (e: MouseEvent) => void;
  private boundOnDragMove: (e: MouseEvent) => void;
  private boundOnDragEnd: () => void;
  private boundOnTouchStart: (e: TouchEvent) => void;
  private boundOnTouchMove: (e: TouchEvent) => void;
  private boundOnTouchEnd: (e: TouchEvent) => void;
  private boundOnWheel: (e: WheelEvent) => void;

  constructor(canvas: HTMLCanvasElement, config: GameMapConfig) {
    this.canvas = canvas;
    this.config = config;
    const theme = config.theme ?? (document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
    this.palette = PALETTES[theme];

    // 绑定事件处理函数
    this.boundOnDragStart = this.onDragStart.bind(this);
    this.boundOnDragMove = this.onDragMove.bind(this);
    this.boundOnDragEnd = this.onDragEnd.bind(this);
    this.boundOnTouchStart = this.onTouchStart.bind(this);
    this.boundOnTouchMove = this.onTouchMove.bind(this);
    this.boundOnTouchEnd = this.onTouchEnd.bind(this);
    this.boundOnWheel = this.onWheel.bind(this);

    // 获取 canvas 的实际尺寸
    const rect = canvas.getBoundingClientRect();
    const canvasWidth = rect.width || canvas.clientWidth || 800;
    const canvasHeight = rect.height || canvas.clientHeight || 600;

    // 初始化Pixi应用（Pixi.js v7 同步方式）
    // 添加错误处理，避免shader相关错误
    try {
      this.app = new PIXI.Application({
        view: canvas,
        width: canvasWidth,
        height: canvasHeight,
        backgroundColor: config.backgroundColor ?? this.palette.bg,
        antialias: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2), // 限制最大分辨率避免shader问题
        autoDensity: true,
        eventMode: 'none', // 禁用 PixiJS 内置事件系统
        // 添加WebGL选项以提高兼容性
        powerPreference: 'high-performance',
      });
    } catch (error) {
      console.error('[地图管理器] Pixi初始化失败，尝试降级方案:', error);
      // 降级方案：使用更保守的配置
      this.app = new PIXI.Application({
        view: canvas,
        width: canvasWidth,
        height: canvasHeight,
        backgroundColor: config.backgroundColor ?? this.palette.bg,
        antialias: false, // 禁用抗锯齿
        resolution: 1, // 使用标准分辨率
        autoDensity: true,
        eventMode: 'none',
        powerPreference: 'low-power',
      });
    }

    try {
      // 卸掉 Pixi 的 DOM 监听，避免和下面手写的拖拽/缩放抢事件。
      // 不能调用 events.destroy()：那会拆掉事件系统，随后 Application.destroy() 再拆一次时会读到空对象。
      this.app.renderer.events?.setTargetElement(null as unknown as HTMLElement);

      console.log('[地图管理器] Pixi应用初始化完成');

      // 创建世界容器替代 viewport
      this.worldContainer = new PIXI.Container();
      this.worldContainer.sortableChildren = true;
      this.worldContainer.eventMode = 'none';
      this.worldContainer.interactiveChildren = false;
      this.app.stage.addChild(this.worldContainer);

      // 初始化图层
      this.layers = new Map();
      this.initLayers();

      // 绘制背景
      this.drawBackground();

      // 设置交互功能
      this.setupDragInteraction();

      // 初始化视图：整张地图装进画布（先缩放，再居中，顺序很重要）
      const fit = Math.min(canvasWidth / config.width, canvasHeight / config.height) * 0.92;
      this.setZoom(Math.max(config.minZoom || 0.02, fit), false);
      this.centerTo(config.width / 2, config.height / 2, false);
    } catch (error) {
      this.destroy();
      throw error;
    }

    console.log('[地图管理器] 初始化完成', {
      worldSize: `${config.width}x${config.height}`,
      screenSize: `${canvasWidth}x${canvasHeight}`,
      initialZoom: 0.5,
      initialCenter: { x: config.width / 2, y: config.height / 2 },
    });
  }

  /**
   * 设置拖拽和缩放交互
   */
  private setupDragInteraction() {
    const canvas = this.canvas;

    // 鼠标拖拽事件
    canvas.addEventListener('mousedown', this.boundOnDragStart);
    canvas.addEventListener('mousemove', this.boundOnDragMove);
    canvas.addEventListener('mouseup', this.boundOnDragEnd);
    canvas.addEventListener('mouseleave', this.boundOnDragEnd);

    // 触摸事件
    canvas.addEventListener('touchstart', this.boundOnTouchStart, { passive: false });
    canvas.addEventListener('touchmove', this.boundOnTouchMove, { passive: false });
    canvas.addEventListener('touchend', this.boundOnTouchEnd);

    // 滚轮缩放事件
    canvas.addEventListener('wheel', this.boundOnWheel, { passive: false });
  }

  /**
   * 鼠标按下开始拖拽
   */
  private onDragStart(e: MouseEvent) {
    this.isDragging = true;
    this.dragStart = { x: e.clientX, y: e.clientY };
    this.lastPosition = { x: this.worldContainer.x, y: this.worldContainer.y };
    this.dragDistance = 0;
    this.canvas.style.cursor = 'grabbing';

    // 记录点击位置，用于后续判断是否为点击事件
    this.clickStartPos = { x: e.clientX, y: e.clientY };
    this.clickStartTime = Date.now();
  }

  private clickStartPos = { x: 0, y: 0 };
  private clickStartTime = 0;

  /**
   * 鼠标移动拖拽
   */
  private onDragMove(e: MouseEvent) {
    if (!this.isDragging) return;
    const dx = e.clientX - this.dragStart.x;
    const dy = e.clientY - this.dragStart.y;

    // 累计拖拽距离
    this.dragDistance += Math.abs(dx - (this.worldContainer.x - this.lastPosition.x)) +
                         Math.abs(dy - (this.worldContainer.y - this.lastPosition.y));

    this.worldContainer.x = this.lastPosition.x + dx;
    this.worldContainer.y = this.lastPosition.y + dy;
  }

  /**
   * 鼠标松开结束拖拽
   */
  private onDragEnd(e?: MouseEvent) {
    // 判断是否为点击事件（拖拽距离小于10px且时间小于500ms）
    if (e && this.isDragging) {
      const dt = Date.now() - this.clickStartTime;

      console.log('[地图管理器] 拖拽结束:', { dragDistance: this.dragDistance, time: dt });

      if (this.dragDistance < 10 && dt < 500) {
        // 这是一个点击事件，进行手动点击检测
        console.log('[地图管理器] 判定为点击事件');
        this.handleClick(e);
      } else {
        console.log('[地图管理器] 判定为拖拽事件，不触发点击');
      }
    }

    this.isDragging = false;
    this.dragDistance = 0;
    this.canvas.style.cursor = 'grab';
  }

  /**
   * 手动处理点击事件
   */
  private handleClick(e: MouseEvent) {
    const canvas = this.canvas;
    const rect = canvas.getBoundingClientRect();

    // 获取鼠标在 canvas 上的位置
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // 转换为世界坐标
    const scale = this.worldContainer.scale.x;
    const worldX = (mouseX - this.worldContainer.x) / scale;
    const worldY = (mouseY - this.worldContainer.y) / scale;

    // 优先检测地点（更精确的点击范围）
    const locationLayer = this.layers.get(4);
    if (locationLayer) {
      let nearestLocation: any = null;
      let nearestDistance = Infinity;

      locationLayer.children.forEach((child) => {
        if (!(child instanceof PIXI.Container)) return;
        const userData = (child as any).userData;
        if (!userData) return;

        const distance = Math.sqrt(
          Math.pow(worldX - child.x, 2) + Math.pow(worldY - child.y, 2)
        );

        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestLocation = userData;
        }
      });

      // 点击半径按屏幕像素算（约 28px），任何缩放下都好点
      if (nearestLocation && nearestDistance < 28 / scale) {
        console.log(`[地图] 点击地点: ${nearestLocation.data.name}，距离: ${nearestDistance.toFixed(0)}`);
        this.emit('locationClick', {
          ...nearestLocation.data,
          clickPosition: { x: mouseX, y: mouseY }
        });
        return;
      }
    }

    // 如果没有点击到地点，检测势力范围
    const territoryLayer = this.layers.get(3);
    if (territoryLayer) {
      for (const child of territoryLayer.children) {
        if (child instanceof PIXI.Graphics) {
          const userData = (child as any).userData;
          if (userData && userData.type === 'location') {
            // 检测点是否在势力范围内
            const bounds = (child as any).territoryBounds;
            if (bounds && this.isPointInPolygon(worldX, worldY, bounds)) {
              console.log(`[地图] 点击势力范围: ${userData.data.name}`);
              this.emit('locationClick', {
                ...userData.data,
                clickPosition: { x: mouseX, y: mouseY }
              });
              return;
            }
          }
        }
      }
    }

    // 如果没有点击到势力，检测大陆（使用自定义算法）
    console.log(`[地图] 检测大陆点击，世界坐标: (${worldX.toFixed(0)}, ${worldY.toFixed(0)})，共有${this.continentBounds.size}个大陆`);

    const matchedContinents: Array<{
      id: string;
      data: {
        id: string;
        name?: string;
        description?: string;
        特点?: string;
        主要势力?: string[]
      };
      area: number
    }> = [];

    this.continentBounds.forEach((continent, id) => {
      const isInside = this.isPointInPolygon(worldX, worldY, continent.bounds);
      console.log(`[地图] 检测大陆 "${continent.data.name}":`, {
        isInside,
        bounds: continent.bounds,
        boundsCount: continent.bounds.length
      });

      if (isInside) {
        // 计算多边形面积（用于找到最小的匹配区域）
        const area = this.calculatePolygonArea(continent.bounds);
        matchedContinents.push({ id, data: continent.data, area });
      }
    });

    // 如果有多个匹配，选择面积最小的（最精确的）
    if (matchedContinents.length > 0) {
      matchedContinents.sort((a, b) => a.area - b.area);
      const matched = matchedContinents[0];
      console.log(`[地图] 点击大陆: ${matched.data.name}（共匹配${matchedContinents.length}个大陆，选择最小的）`);
      this.emit('continentClick', {
        ...matched.data,
        clickPosition: { x: mouseX, y: mouseY }
      });
      return;
    }

    console.log('[地图] 点击空白区域');
  }

  /**
   * 触发点击事件
   */
  private emitClickEvent(userData: any) {
    if (userData.type === 'location') {
      this.emit('locationClick', userData.data);
    } else if (userData.type === 'continent') {
      this.emit('continentClick', userData.data);
    }
  }


  /**
   * 计算两个触摸点之间的距离
   */
  private getTouchDistance(touches: TouchList): number {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * 计算两个触摸点的中心点
   */
  private getTouchCenter(touches: TouchList): { x: number; y: number } {
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2
    };
  }

  /**
   * 触摸开始
   */
  private onTouchStart(e: TouchEvent) {
    e.preventDefault();

    if (e.touches.length === 2) {
      // 双指触摸 - 开始缩放
      this.isDragging = false;
      this.isPinching = true;
      this.initialPinchDistance = this.getTouchDistance(e.touches);
      this.initialPinchScale = this.worldContainer.scale.x;
      this.pinchCenter = this.getTouchCenter(e.touches);
      this.lastPosition = { x: this.worldContainer.x, y: this.worldContainer.y };
    } else if (e.touches.length === 1) {
      // 单指触摸 - 开始拖拽
      this.isPinching = false;
      const touch = e.touches[0];
      this.isDragging = true;
      this.dragStart = { x: touch.clientX, y: touch.clientY };
      this.lastPosition = { x: this.worldContainer.x, y: this.worldContainer.y };
      this.dragDistance = 0;
    }
  }

  /**
   * 触摸移动
   */
  private onTouchMove(e: TouchEvent) {
    e.preventDefault();

    if (e.touches.length === 2 && this.isPinching) {
      // 双指缩放
      const currentDistance = this.getTouchDistance(e.touches);
      const currentCenter = this.getTouchCenter(e.touches);

      // 计算缩放比例
      const scale = (currentDistance / this.initialPinchDistance) * this.initialPinchScale;

      // 限制缩放范围
      const minScale = this.config.minZoom || 0.1;
      const maxScale = this.config.maxZoom || 4;
      const clampedScale = Math.max(minScale, Math.min(maxScale, scale));

      // 计算缩放中心点在世界坐标系中的位置
      const worldPosX = (this.pinchCenter.x - this.lastPosition.x) / this.initialPinchScale;
      const worldPosY = (this.pinchCenter.y - this.lastPosition.y) / this.initialPinchScale;

      // 应用缩放
      this.worldContainer.scale.set(clampedScale);
      this.syncMarkerScale();

      // 调整位置，使缩放中心点保持不变，同时支持平移
      const centerDx = currentCenter.x - this.pinchCenter.x;
      const centerDy = currentCenter.y - this.pinchCenter.y;
      this.worldContainer.x = this.pinchCenter.x - worldPosX * clampedScale + centerDx;
      this.worldContainer.y = this.pinchCenter.y - worldPosY * clampedScale + centerDy;
    } else if (e.touches.length === 1 && this.isDragging && !this.isPinching) {
      // 单指拖拽
      const touch = e.touches[0];
      const dx = touch.clientX - this.dragStart.x;
      const dy = touch.clientY - this.dragStart.y;

      // 累计拖拽距离
      this.dragDistance += Math.abs(dx - (this.worldContainer.x - this.lastPosition.x)) +
                           Math.abs(dy - (this.worldContainer.y - this.lastPosition.y));

      this.worldContainer.x = this.lastPosition.x + dx;
      this.worldContainer.y = this.lastPosition.y + dy;
    }
  }

  /**
   * 触摸结束
   */
  private onTouchEnd(e: TouchEvent) {
    // 如果还有触摸点，可能是从双指变为单指
    if (e.touches.length === 1 && this.isPinching) {
      // 从双指缩放切换到单指拖拽
      this.isPinching = false;
      this.isDragging = true;
      const touch = e.touches[0];
      this.dragStart = { x: touch.clientX, y: touch.clientY };
      this.lastPosition = { x: this.worldContainer.x, y: this.worldContainer.y };
      this.dragDistance = 0;
    } else if (e.touches.length === 0) {
      // 所有触摸结束
      this.isDragging = false;
      this.isPinching = false;
    }
  }

  /**
   * 滚轮缩放
   */
  private onWheel(e: WheelEvent) {
    e.preventDefault();

    // 计算缩放增量
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = this.worldContainer.scale.x * delta;

    // 限制缩放范围
    const minScale = this.config.minZoom || 0.1;
    const maxScale = this.config.maxZoom || 4;
    const clampedScale = Math.max(minScale, Math.min(maxScale, newScale));

    // 鼠标在画布内的位置（clientX 是视口坐标，需要减去画布偏移）
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // 计算鼠标在世界容器中的位置（缩放前）
    const worldPosX = (mouseX - this.worldContainer.x) / this.worldContainer.scale.x;
    const worldPosY = (mouseY - this.worldContainer.y) / this.worldContainer.scale.y;

    // 应用新的缩放
    this.worldContainer.scale.set(clampedScale);
    this.syncMarkerScale();

    // 调整位置，使鼠标指向的世界坐标保持不变
    this.worldContainer.x = mouseX - worldPosX * clampedScale;
    this.worldContainer.y = mouseY - worldPosY * clampedScale;
  }

  /**
   * 初始化所有图层
   */
  private initLayers() {
    // 创建各个图层容器
    const layerOrder = [0, 1, 2, 3, 4, 5, 6]; // MapLayer枚举值
    layerOrder.forEach((layer) => {
      const container = new PIXI.Container();
      container.sortableChildren = true;
      this.layers.set(layer, container);
      this.worldContainer.addChild(container);
    });

    console.log('[地图管理器] 图层初始化完成，共', this.layers.size, '个图层');
  }

  /**
   * 绘制背景：底色 + 稀疏经纬线 + 描金双线外框（像摊开的舆图）
   */
  private drawBackground() {
    const bgLayer = this.layers.get(0); // MapLayer.BACKGROUND
    if (!bgLayer) return;
    const P = this.palette;
    const { width: W, height: H } = this.config;

    const bg = new PIXI.Graphics();
    bg.beginFill(P.bg);
    bg.drawRect(0, 0, W, H);
    bg.endFill();
    bgLayer.addChild(bg);

    // 经纬线：每 5 格一条，避免满屏细网格
    const grid = new PIXI.Graphics();
    const step = this.config.tileSize * 5;
    grid.lineStyle(Math.max(2, W / 2500), P.grid, P.gridAlpha);
    for (let x = step; x < W; x += step) {
      grid.moveTo(x, 0);
      grid.lineTo(x, H);
    }
    for (let y = step; y < H; y += step) {
      grid.moveTo(0, y);
      grid.lineTo(W, y);
    }
    bgLayer.addChild(grid);

    const frame = new PIXI.Graphics();
    const t = Math.max(6, W / 800);
    frame.lineStyle(t, P.frame, 0.45);
    frame.drawRect(t, t, W - t * 2, H - t * 2);
    frame.lineStyle(t / 3, P.frame, 0.3);
    frame.drawRect(t * 4, t * 4, W - t * 8, H - t * 8);
    bgLayer.addChild(frame);
  }

  /**
   * 添加大陆：淡色填充 + 宽晕边 + 描金细边，大字书法水印
   */
  addContinent(continent: CultivationContinent) {
    const continentLayer = this.layers.get(2); // MapLayer.CONTINENT
    if (!continentLayer) return;
    const P = this.palette;

    const bounds = continent.continent_bounds || continent.大洲边界;
    if (!bounds || bounds.length < 3) return;

    const trace = (g: PIXI.Graphics) => {
      g.moveTo(bounds[0].x, bounds[0].y);
      for (let i = 1; i < bounds.length; i++) g.lineTo(bounds[i].x, bounds[i].y);
      g.closePath();
    };

    const polygon = new PIXI.Graphics();
    polygon.beginFill(P.continentFill, P.continentFillAlpha);
    trace(polygon);
    polygon.endFill();
    polygon.lineStyle(40, P.continentLine, 0.06);
    trace(polygon);
    polygon.lineStyle(5, P.continentLine, 0.55);
    trace(polygon);
    polygon.eventMode = 'none';

    const continentData = {
      id: continent.id,
      name: continent.name || continent.名称,
      description: continent.description || continent.描述,
      特点: continent.特点,
      主要势力: continent.主要势力,
    };
    (polygon as any).userData = { type: 'continent', data: continentData };

    const continentId = continent.id || `continent_${Date.now()}_${Math.random()}`;
    this.continentBounds.set(continentId, { bounds, data: continentData });
    continentLayer.addChild(polygon);

    const center = this.calculatePolygonCenter(bounds);
    const label = new PIXI.Text(continent.name || continent.名称 || '未知大陆', {
      fontFamily: CALLI,
      fontSize: 320,
      fill: P.continentLabel,
      align: 'center',
      letterSpacing: 40,
    });
    label.anchor.set(0.5);
    label.x = center.x;
    label.y = center.y;
    label.alpha = P.continentLabelAlpha;
    label.eventMode = 'none';
    continentLayer.addChild(label);
  }

  /**
   * 添加地点标记
   */
  addLocation(location: WorldLocation) {
    const locationLayer = this.layers.get(4); // MapLayer.LOCATION
    if (!locationLayer) return;

    const clampToMap = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

    const isOverlappingExistingLocation = (x: number, y: number, minDistance: number): boolean => {
      const minDistanceSquared = minDistance * minDistance;
      for (const sprite of this.locationSprites.values()) {
        const dx = x - sprite.x;
        const dy = y - sprite.y;
        if (dx * dx + dy * dy < minDistanceSquared) return true;
      }
      return false;
    };

    const findNonOverlappingLocationPosition = (
      base: GameCoordinates,
      minDistance: number,
      seed: string
    ): GameCoordinates => {
      const mapWidth = this.config.width;
      const mapHeight = this.config.height;

      const startX = clampToMap(Number(base.x) || 0, 0, mapWidth);
      const startY = clampToMap(Number(base.y) || 0, 0, mapHeight);

      if (!isOverlappingExistingLocation(startX, startY, minDistance)) {
        return { x: startX, y: startY };
      }

      let hash = 2166136261;
      for (let i = 0; i < seed.length; i++) {
        hash ^= seed.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      hash >>>= 0;

      const goldenAngle = Math.PI * (3 - Math.sqrt(5));
      const startAngle = ((hash % 360) * Math.PI) / 180;

      const attempts = 80;
      for (let i = 1; i <= attempts; i++) {
        const radius = minDistance * Math.sqrt(i);
        const angle = startAngle + goldenAngle * i;
        const candidateX = clampToMap(startX + Math.cos(angle) * radius, 0, mapWidth);
        const candidateY = clampToMap(startY + Math.sin(angle) * radius, 0, mapHeight);
        if (!isOverlappingExistingLocation(candidateX, candidateY, minDistance)) {
          return { x: candidateX, y: candidateY };
        }
      }

      return { x: startX, y: startY };
    };

    // 势力等级决定图标缩放（基础缩放提升至2.5倍）
    const levelText = String(location.等级 || (location as any).level || '').toLowerCase();
    let scale = 2.5; // 提升基础缩放
    if (levelText.includes('超')) scale = 3.5;
    else if (levelText.includes('一')) scale = 3.2;
    else if (levelText.includes('二')) scale = 2.8;
    else if (levelText.includes('三')) scale = 2.5;

    const minDistance = 44 * scale;
    const resolvedCoordinates = findNonOverlappingLocationPosition(
      location.coordinates || { x: 0, y: 0 },
      minDistance,
      `${location.id}|${location.name}`
    );
    location.coordinates = resolvedCoordinates;

    // 创建地点容器
    const locationContainer = new PIXI.Container();
    locationContainer.x = location.coordinates?.x || 0;
    locationContainer.y = location.coordinates?.y || 0;
    // 禁用交互，使用手动点击检测
    locationContainer.eventMode = 'none';

    // 图标：按类型取主题色（未知类型沿用数据里的颜色）
    const typeKey = TYPE_ALIAS[location.type] || location.type;
    const tone = this.palette.types[typeKey] ?? hexNum(location.iconColor, this.palette.types.其他特殊);
    const icon = this.createLocationIcon(location.type, tone);
    icon.scale.set(scale);
    locationContainer.addChild(icon);

    // 名称：正文色 + 底色描边，任何底色上都清楚
    const label = new PIXI.Text(location.name, {
      fontFamily: SERIF,
      fontSize: 36 * scale,
      fill: this.palette.text,
      fontWeight: '600',
      align: 'center',
      letterSpacing: 4,
      stroke: this.palette.halo,
      strokeThickness: 8,
    });
    label.anchor.set(0.5, 0);
    label.y = 30 * scale;
    label.eventMode = 'none';
    locationContainer.addChild(label);

    // 存储用户数据，用于点击检测
    (locationContainer as any).userData = {
      type: 'location',
      data: {
        id: location.id,
        name: location.name,
        coordinates: location.coordinates || { x: 0, y: 0 },
        location: location,
      },
    };

    locationLayer.addChild(locationContainer);
    locationContainer.scale.set(this.markerScale('place'));
    this.locationSprites.set(location.id, locationContainer);

    console.log('[地图管理器] 添加地点:', location.name, `(${location.coordinates?.x}, ${location.coordinates?.y})`);
  }

  /**
   * 地点图标：外圈柔光 + 底色描边的形状，内部符号用暖白
   */
  private createLocationIcon(type: string, color: number): PIXI.Graphics {
    const P = this.palette;
    const halo = hexNum(P.halo, P.bg);
    const g = new PIXI.Graphics();

    g.beginFill(color, 0.16);
    g.drawCircle(0, 0, 30);
    g.endFill();

    const shape = (draw: () => void) => {
      g.lineStyle(4, halo, 1);
      g.beginFill(color, 0.95);
      draw();
      g.endFill();
      g.lineStyle(0);
    };

    switch (TYPE_ALIAS[type] || type) {
      case '名山大川':
        shape(() => {
          g.moveTo(-18, 14);
          g.lineTo(-6, -8);
          g.lineTo(0, 0);
          g.lineTo(8, -18);
          g.lineTo(20, 14);
          g.closePath();
        });
        g.beginFill(P.inner, 0.9);
        g.moveTo(8, -18);
        g.lineTo(12, -10);
        g.lineTo(4, -10);
        g.closePath();
        g.endFill();
        break;
      case '宗门势力':
        shape(() => g.drawRoundedRect(-17, -12, 34, 28, 3));
        g.beginFill(color, 0.95);
        g.moveTo(-22, -12);
        g.lineTo(0, -26);
        g.lineTo(22, -12);
        g.closePath();
        g.endFill();
        g.beginFill(P.inner, 0.9);
        g.drawRect(-5, 2, 10, 14);
        g.endFill();
        break;
      case '城镇坊市':
        shape(() => g.drawCircle(0, 0, 19));
        g.lineStyle(3, P.inner, 0.9);
        g.drawCircle(0, 0, 9);
        g.moveTo(-19, 0);
        g.lineTo(19, 0);
        g.lineStyle(0);
        break;
      case '洞天福地': {
        shape(() => g.drawCircle(0, 0, 19));
        g.beginFill(P.inner, 0.95);
        for (let i = 0; i < 10; i++) {
          const r = i % 2 === 0 ? 12 : 5;
          const a = (Math.PI / 5) * i - Math.PI / 2;
          if (i === 0) g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
          else g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        g.closePath();
        g.endFill();
        break;
      }
      case '奇珍异地':
        shape(() => {
          g.moveTo(0, -21);
          g.lineTo(17, 0);
          g.lineTo(0, 21);
          g.lineTo(-17, 0);
          g.closePath();
        });
        g.beginFill(P.inner, 0.85);
        g.moveTo(0, -9);
        g.lineTo(7, 0);
        g.lineTo(0, 9);
        g.lineTo(-7, 0);
        g.closePath();
        g.endFill();
        break;
      case '凶险之地':
        shape(() => {
          g.moveTo(0, -21);
          g.lineTo(20, 16);
          g.lineTo(-20, 16);
          g.closePath();
        });
        g.beginFill(P.inner, 0.95);
        g.drawRoundedRect(-2.5, -9, 5, 14, 2);
        g.drawCircle(0, 10, 2.8);
        g.endFill();
        break;
      default:
        shape(() => g.drawCircle(0, 0, 16));
        g.beginFill(P.inner, 0.9);
        g.drawCircle(0, 0, 5);
        g.endFill();
    }

    return g;
  }

  /**
   * 添加势力范围：势力色淡填充 + 细边 + 书法水印
   */
  addTerritory(location: WorldLocation) {
    if (!location.territoryBounds || location.territoryBounds.length < 3) return;

    const territoryLayer = this.layers.get(3); // MapLayer.TERRITORY
    if (!territoryLayer) return;

    const bounds = location.territoryBounds;
    const color = themeReadable(hexNum(location.color, this.palette.types.宗门势力), this.palette.bg < 0x808080);
    const trace = (g: PIXI.Graphics) => {
      g.moveTo(bounds[0].x, bounds[0].y);
      for (let i = 1; i < bounds.length; i++) g.lineTo(bounds[i].x, bounds[i].y);
      g.closePath();
    };

    const polygon = new PIXI.Graphics();
    polygon.beginFill(color, 0.2);
    trace(polygon);
    polygon.endFill();
    polygon.lineStyle(4, color, 0.9);
    trace(polygon);
    polygon.eventMode = 'none';

    (polygon as any).userData = {
      type: 'location',
      data: { id: location.id, name: location.name, coordinates: location.coordinates || { x: 0, y: 0 }, location },
    };
    (polygon as any).territoryBounds = bounds;
    territoryLayer.addChild(polygon);

    const center = this.calculatePolygonCenter(bounds);
    const label = new PIXI.Text(location.name, {
      fontFamily: CALLI,
      fontSize: 120,
      fill: color,
      align: 'center',
      letterSpacing: 12,
      stroke: this.palette.halo,
      strokeThickness: 10,
    });
    label.anchor.set(0.5);
    label.x = center.x;
    label.y = center.y;
    label.alpha = 0.5;
    label.eventMode = 'none';
    territoryLayer.addChild(label);
  }

  /**
   * 清除玩家标记（保留 NPC）
   */
  clearPlayerMarker() {
    const playerLayer = this.layers.get(5); // MapLayer.PLAYER
    if (!playerLayer) return;
    [...playerLayer.children].forEach((child) => {
      if ((child as any).userData?.type !== 'npc') playerLayer.removeChild(child);
    });
  }

  /**
   * 更新 NPC 位置：立在地点上方的「旗签」——圆牌（名字首字）+ 细杆 + 落点，名字写在圆牌上方。
   * 同一处的多人左右排开，与玩家同处时整体让到右侧，避免盖住地点图标和地名。
   */
  updateNPCPositions(npcs: Array<{ name: string; coordinates: GameCoordinates }>) {
    const playerLayer = this.layers.get(5); // NPC 与玩家同层
    if (!playerLayer) return;
    const P = this.palette;
    const halo = hexNum(P.halo, P.bg);

    [...playerLayer.children].forEach((child) => {
      if ((child as any).userData?.type !== 'npc') return;
      playerLayer.removeChild(child);
      try {
        child.destroy({ children: true, texture: false, baseTexture: false });
      } catch {
        // 忽略销毁错误
      }
    });

    const valid = npcs.filter((n) => Number.isFinite(n.coordinates?.x) && Number.isFinite(n.coordinates?.y));
    const keyOf = (c: GameCoordinates) => `${Math.round(c.x / 20)}:${Math.round(c.y / 20)}`;
    const groups = new Map<string, typeof valid>();
    valid.forEach((n) => groups.set(keyOf(n.coordinates), [...(groups.get(keyOf(n.coordinates)) || []), n]));

    groups.forEach((members, key) => {
      const withPlayer = this.playerKey === key;
      members.forEach((npc, i) => {
        const box = new PIXI.Container();
        box.x = npc.coordinates.x;
        box.y = npc.coordinates.y;
        (box as any).userData = { type: 'npc', name: npc.name };

        // 旗签相对落点的水平偏移（局部单位，随标记一起缩放）
        const dx = (withPlayer ? 96 : 0) + (i - (withPlayer ? 0 : (members.length - 1) / 2)) * 60;
        const top = -52;

        const g = new PIXI.Graphics();
        g.lineStyle(2.5, P.npc, 0.75);
        g.moveTo(0, -4);
        g.lineTo(dx, top + 22);
        g.lineStyle(0);
        g.beginFill(P.npc, 0.9);
        g.drawCircle(0, 0, 4);
        g.endFill();
        g.lineStyle(4, halo, 1);
        g.beginFill(P.npc, 0.95);
        g.drawCircle(dx, top, 22);
        g.endFill();
        box.addChild(g);

        const glyph = new PIXI.Text(npc.name.charAt(0), { fontFamily: CALLI, fontSize: 26, fill: P.halo });
        glyph.anchor.set(0.5);
        glyph.x = dx;
        glyph.y = top;
        box.addChild(glyph);

        const label = new PIXI.Text(npc.name, {
          fontFamily: SERIF,
          fontSize: 30,
          fill: P.text,
          fontWeight: '500',
          align: 'center',
          stroke: P.halo,
          strokeThickness: 7,
        });
        label.anchor.set(0.5, 1);
        label.x = dx;
        label.y = top - 26;
        box.addChild(label);

        box.scale.set(this.markerScale('people'));
        playerLayer.addChild(box);
      });
    });
  }

  /** 玩家所在的聚合键（NPC 与玩家同处时让位） */
  private playerKey = '';

  /**
   * 更新玩家位置：朱砂方印「我」立在落点上方，金圈柔光，名字在印上方
   */
  updatePlayerPosition(position: GameCoordinates, playerName: string = '玩家') {
    const playerLayer = this.layers.get(5); // MapLayer.PLAYER
    if (!playerLayer) return;
    if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) {
      this.clearPlayerMarker();
      return;
    }
    const P = this.palette;
    this.playerKey = `${Math.round(position.x / 20)}:${Math.round(position.y / 20)}`;

    [...playerLayer.children].forEach((child) => {
      if ((child as any).userData?.type === 'npc') return;
      playerLayer.removeChild(child);
    });

    const box = new PIXI.Container();
    box.x = position.x;
    box.y = position.y;
    box.zIndex = 10;
    (box as any).userData = { type: 'player' };
    const top = -60;

    const g = new PIXI.Graphics();
    // 落点：金圈
    g.beginFill(P.player, 0.16);
    g.drawCircle(0, 0, 26);
    g.endFill();
    g.lineStyle(2.5, P.playerRing, 0.85);
    g.drawCircle(0, 0, 12);
    g.lineStyle(3, P.playerRing, 0.9);
    g.moveTo(0, -10);
    g.lineTo(0, top + 24);
    g.lineStyle(0);
    // 印
    g.beginFill(P.player, 0.18);
    g.drawCircle(0, top, 40);
    g.endFill();
    g.lineStyle(4, hexNum(P.halo, P.bg), 1);
    g.beginFill(P.player, 1);
    g.drawRoundedRect(-24, top - 24, 48, 48, 6);
    g.endFill();
    box.addChild(g);

    const glyph = new PIXI.Text('我', { fontFamily: CALLI, fontSize: 32, fill: '#fbe9dc' });
    glyph.anchor.set(0.5);
    glyph.y = top;
    box.addChild(glyph);

    const label = new PIXI.Text(playerName, {
      fontFamily: SERIF,
      fontSize: 34,
      fill: P.playerText,
      fontWeight: '700',
      align: 'center',
      letterSpacing: 4,
      stroke: P.halo,
      strokeThickness: 8,
    });
    label.anchor.set(0.5, 1);
    label.y = top - 30;
    box.addChild(label);

    box.scale.set(this.markerScale('people'));
    playerLayer.addChild(box);
  }

  /**
   * 居中到指定坐标
   */
  centerTo(x: number, y: number, animate: boolean = true) {
    const targetX = this.app.screen.width / 2 - x * this.worldContainer.scale.x;
    const targetY = this.app.screen.height / 2 - y * this.worldContainer.scale.y;

    if (animate) {
      // 简单的动画实现
      const startX = this.worldContainer.x;
      const startY = this.worldContainer.y;
      const duration = 500; // 毫秒
      const startTime = Date.now();

      const animateStep = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // 使用 easeInOutQuad 缓动函数
        const easeProgress = progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;

        this.worldContainer.x = startX + (targetX - startX) * easeProgress;
        this.worldContainer.y = startY + (targetY - startY) * easeProgress;

        if (progress < 1) {
          requestAnimationFrame(animateStep);
        }
      };

      requestAnimationFrame(animateStep);
    } else {
      this.worldContainer.x = targetX;
      this.worldContainer.y = targetY;
    }
  }

  /**
   * 获取视口状态
   */
  getViewportState(): ViewportState {
    // 计算中心点在世界坐标系中的位置
    const centerX = (this.app.screen.width / 2 - this.worldContainer.x) / this.worldContainer.scale.x;
    const centerY = (this.app.screen.height / 2 - this.worldContainer.y) / this.worldContainer.scale.y;

    return {
      x: centerX,
      y: centerY,
      scale: this.worldContainer.scale.x,
      screenWidth: this.app.screen.width,
      screenHeight: this.app.screen.height,
    };
  }

  /**
   * 设置缩放级别
   */
  setZoom(scale: number, animate: boolean = true) {
    // 限制缩放范围
    const minScale = this.config.minZoom || 0.1;
    const maxScale = this.config.maxZoom || 4;
    const clampedScale = Math.max(minScale, Math.min(maxScale, scale));

    // 获取当前中心点在世界坐标系中的位置
    const centerX = (this.app.screen.width / 2 - this.worldContainer.x) / this.worldContainer.scale.x;
    const centerY = (this.app.screen.height / 2 - this.worldContainer.y) / this.worldContainer.scale.y;

    if (animate) {
      // 简单的缩放动画
      const startScale = this.worldContainer.scale.x;
      const duration = 300; // 毫秒
      const startTime = Date.now();

      const animateStep = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // 使用 easeInOutQuad 缓动函数
        const easeProgress = progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;

        const currentScale = startScale + (clampedScale - startScale) * easeProgress;
        this.worldContainer.scale.set(currentScale);
        this.syncMarkerScale();

        // 调整位置，保持中心点不变
        this.worldContainer.x = this.app.screen.width / 2 - centerX * currentScale;
        this.worldContainer.y = this.app.screen.height / 2 - centerY * currentScale;

        if (progress < 1) {
          requestAnimationFrame(animateStep);
        }
      };

      requestAnimationFrame(animateStep);
    } else {
      this.worldContainer.scale.set(clampedScale);
      this.syncMarkerScale();
      // 调整位置，保持中心点不变
      this.worldContainer.x = this.app.screen.width / 2 - centerX * clampedScale;
      this.worldContainer.y = this.app.screen.height / 2 - centerY * clampedScale;
    }
  }

  /**
   * 标记（地点 / 人物 / 玩家）保持固定的屏幕尺寸：按当前缩放反向缩放；
   * 大陆和势力水印随地图一起缩放。
   */
  private syncMarkerScale() {
    this.layers.get(4)?.children.forEach((child) => child.scale.set(this.markerScale('place')));
    this.layers.get(5)?.children.forEach((child) => child.scale.set(this.markerScale('people')));
  }

  /** 地点名约 16px、人物名约 14px（与缩放无关） */
  private markerScale(kind: 'place' | 'people') {
    const zoom = this.worldContainer.scale.x || 1;
    return Math.max(0.05, Math.min(8, (kind === 'place' ? 0.18 : 0.48) / zoom));
  }

  /**
   * 计算多边形中心点
   */
  private calculatePolygonCenter(points: { x: number; y: number }[]): { x: number; y: number } {
    if (points.length === 0) return { x: 0, y: 0 };

    const sumX = points.reduce((sum, point) => sum + point.x, 0);
    const sumY = points.reduce((sum, point) => sum + point.y, 0);

    return {
      x: sumX / points.length,
      y: sumY / points.length,
    };
  }

  /**
   * 判断点是否在多边形内（射线法）
   */
  private isPointInPolygon(x: number, y: number, polygon: { x: number; y: number }[]): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x;
      const yi = polygon[i].y;
      const xj = polygon[j].x;
      const yj = polygon[j].y;

      const intersect = ((yi > y) !== (yj > y)) &&
        (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  /**
   * 计算多边形面积（Shoelace公式）
   */
  private calculatePolygonArea(polygon: { x: number; y: number }[]): number {
    let area = 0;
    for (let i = 0; i < polygon.length; i++) {
      const j = (i + 1) % polygon.length;
      area += polygon[i].x * polygon[j].y;
      area -= polygon[j].x * polygon[i].y;
    }
    return Math.abs(area / 2);
  }

  /**
   * 事件监听
   */
  on(event: string, callback: (data?: unknown) => void) {
    if (!this.eventCallbacks.has(event)) {
      this.eventCallbacks.set(event, []);
    }
    this.eventCallbacks.get(event)!.push(callback);
  }

  /**
   * 触发事件
   */
  private emit(event: string, data?: unknown) {
    const callbacks = this.eventCallbacks.get(event);
    if (callbacks) {
      callbacks.forEach((callback) => callback(data));
    }
  }

  /**
   * 跟随页面主题换配色。不重建渲染器。
   */
  setTheme(theme: 'light' | 'dark') {
    if (this.destroyed) return;
    this.palette = PALETTES[theme];
    this.config.theme = theme;
    this.app.renderer.background.color = this.palette.bg;
  }

  /**
   * 清空地图
   */
  clear() {
    // 由于已禁用事件系统，直接清理即可
    this.layers.forEach((layer) => {
      const children = [...layer.children];
      layer.removeChildren();

      children.forEach((child) => {
        try {
          child.destroy({ children: true, texture: false, baseTexture: false });
        } catch {
          // 忽略销毁错误
        }
      });
    });

    this.locationSprites.clear();
    this.continentBounds.clear();
    this.drawBackground();

    console.log('[地图管理器] 地图已清空');
  }

  /**
   * 调整大小
   */
  resize(width: number, height: number) {
    if (this.destroyed || !this.app.renderer || width <= 0 || height <= 0) return;
    this.app.renderer.resize(width, height);
  }

  /**
   * 销毁。可重复调用：主题切换和页面卸载都会走到这里。
   */
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;

    // Pixi 销毁后 app.renderer 会被置空，app.view 随之变成 undefined。
    // 监听绑在构造时的 canvas 上，这里也从它上面卸。
    const canvas = this.canvas;
    canvas.removeEventListener('mousedown', this.boundOnDragStart);
    canvas.removeEventListener('mousemove', this.boundOnDragMove);
    canvas.removeEventListener('mouseup', this.boundOnDragEnd);
    canvas.removeEventListener('mouseleave', this.boundOnDragEnd);
    canvas.removeEventListener('touchstart', this.boundOnTouchStart);
    canvas.removeEventListener('touchmove', this.boundOnTouchMove);
    canvas.removeEventListener('touchend', this.boundOnTouchEnd);
    canvas.removeEventListener('wheel', this.boundOnWheel);

    try {
      this.app.ticker?.stop();
    } catch {
      // ticker 可能已经停过
    }

    try {
      this.worldContainer?.destroy({ children: true });
    } catch {
      // 忽略销毁错误
    }

    try {
      // removeView 必须为 false：画布节点属于 Vue，摘掉后下次初始化会拿到已脱离文档的元素。
      if (this.app.renderer) this.app.destroy(false, { children: true, texture: true, baseTexture: true });
    } catch {
      // 忽略销毁错误
    }

    // 4. 清理引用
    this.layers?.clear();
    this.locationSprites.clear();
    this.eventCallbacks.clear();
    this.continentBounds.clear();

    console.log('[地图管理器] 已销毁');
  }
}

export type AssetProgress = {
  loaded: number;
  total: number;
  url?: string;
};

const CURSOR_ASSETS = [
  '/cursors/default.png',
  '/cursors/hover.png',
  '/cursors/click.png',
  '/cursors/drag.png',
  '/cursors/attack.png',
  '/cursors/unavailable.png',
  '/cursors/loading.png',
  '/cursors/equip.png',
  '/cursors/inventory.png',
  '/cursors/help.png',
];

export const MENU_ASSET_URLS = [
  '/starting-screen.png',
  '/bg.png',
  '/UI.png',
  '/settings-sprite-tab-active.png',
  '/settings-sprite-tab-inactive.png',
  '/settings-sprite-frame.png',
  '/settings-sprite-button-right-2.png',
  '/settings-sprite-acorn.png',
  ...CURSOR_ASSETS,
];

export const GAME_SHELL_ASSET_URLS = [
  '/starting-screen.png',
  '/UI.png',
  '/portrait.png',
  '/settings-sprite-acorn.png',
  '/soundtrack.mp3',
];

export const PHASER_ASSET_URLS = [
  '/bg_cell.png',
  '/bg_cell_open.png',
  '/bg_market.png',
  '/bg_cathedral.png',
  '/bg_gate.png',
  '/bg_escape.png',
  '/bg_city.png',
  '/bg_underground.png',
  '/rat.png',
  '/guide.png',
  '/player_sheet.png',
  '/player_sheet.json',
];

const EXTRA_PUBLIC_ASSET_URLS = [
  '/Gemini_Generated_Image_730nky730nky730n.png',
  '/UI-b.png',
  '/UI-fakebg.png',
  '/UI-fakebg_t.png',
  '/UI-w.png',
  '/UI1.png',
  '/UI1_t.png',
  '/UI1_t_clean.png',
  '/UI2.png',
  '/UI2_t.png',
  '/UI2_t_clean.png',
  '/UI3.png',
  '/UI3_t.png',
  '/UI3_t_clean.png',
  '/UI_clean.png',
  '/UI_final.png',
  '/UI_final_v2.png',
  '/UI_transparent.png',
  '/UI_v3.png',
  '/action_test.png',
  '/elara.png',
  '/envoy.png',
  '/favicon.svg',
  '/guide_bak.png',
  '/icons.png',
  '/icons.svg',
  '/menu_test.png',
  '/merchant.png',
  '/player_sheet_original.png',
  '/portrait_crop.png',
  '/settings-assets-b.png',
  '/settings-assets-transparent.png',
  '/settings-assets-w.png',
  '/settings-assets.png',
  '/settings-sprite-button-right-1.png',
  '/settings-sprite-tab-inactive2.png',
  '/settings-sprite-tab-inactive3.png',
  '/settings.png',
  '/starting_screen_example.png',
  '/test_click.png',
  '/ui-temp.png',
  '/ui_face_area.png',
  '/ui_top_left.png',
];

export const ALL_ASSET_URLS = Array.from(new Set([
  ...MENU_ASSET_URLS,
  ...GAME_SHELL_ASSET_URLS,
  ...PHASER_ASSET_URLS,
  ...EXTRA_PUBLIC_ASSET_URLS,
]));

const ASSET_CACHE_NAME = 'nightshade-assets-v1';

const isImageAsset = (url: string) => /\.(png|jpe?g|gif|webp|svg)$/i.test(url);
const isAudioAsset = (url: string) => /\.(mp3|ogg|wav|m4a)$/i.test(url);

export const preloadBrowserAssets = async (
  urls: string[],
  onProgress?: (progress: AssetProgress) => void,
) => {
  const uniqueUrls = Array.from(new Set(urls));
  let loaded = 0;

  if (uniqueUrls.length === 0) {
    onProgress?.({ loaded: 0, total: 0 });
    return;
  }

  await Promise.all(uniqueUrls.map(async (url) => {
    await cacheAsset(url);

    if (isImageAsset(url)) {
      await decodeImage(url);
    } else if (isAudioAsset(url)) {
      await primeAudio(url);
    }

    loaded += 1;
    onProgress?.({ loaded, total: uniqueUrls.length, url });
  }));
};

export const warmBrowserAssetCache = async (urls: string[]) => {
  await Promise.allSettled(Array.from(new Set(urls)).map((url) => cacheAsset(url)));
};

const cacheAsset = async (url: string) => {
  const response = await fetch(url, { cache: 'force-cache' });
  if (!response.ok) throw new Error(`Failed to fetch asset ${url}: ${response.status}`);

  if (!('caches' in window)) return;

  const cache = await caches.open(ASSET_CACHE_NAME);
  const cached = await cache.match(url);
  if (cached) return;
  await cache.put(url, response.clone());
};

const decodeImage = async (url: string) => {
  const image = new Image();
  image.decoding = 'async';
  image.src = url;
  await image.decode();
};

const primeAudio = async (url: string) => {
  await new Promise<void>((resolve, reject) => {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.oncanplaythrough = () => resolve();
    audio.onerror = () => reject(new Error(`Failed to prime audio ${url}`));
    audio.src = url;
    audio.load();
  });
};

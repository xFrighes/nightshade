export type AssetProgress = {
  loaded: number;
  total: number;
  url?: string;
};

const CURSOR_ASSETS = [
  '/cursors/default.webp',
  '/cursors/hover.webp',
  '/cursors/click.webp',
  '/cursors/drag.webp',
  '/cursors/attack.webp',
  '/cursors/unavailable.webp',
  '/cursors/loading.webp',
  '/cursors/equip.webp',
  '/cursors/inventory.webp',
  '/cursors/help.webp',
];

export const MENU_ASSET_URLS = [
  '/starting-screen.webp',
  '/bg.webp',
  '/UI.webp',
  '/settings-sprite-tab-active.webp',
  '/settings-sprite-tab-inactive.webp',
  '/settings-sprite-frame.webp',
  '/settings-sprite-button-right-2.webp',
  '/settings-sprite-acorn.webp',
  ...CURSOR_ASSETS,
];

export const GAME_SHELL_ASSET_URLS = [
  '/starting-screen.webp',
  '/UI.webp',
  '/portrait.webp',
  '/settings-sprite-acorn.webp',
  '/soundtrack.mp3',
  '/sounds/click.wav',
  '/sounds/collect.wav',
  '/sounds/interact.wav',
  '/sounds/jump.wav',
  '/sounds/footstep.wav',
];

export const PHASER_ASSET_URLS = [
  '/bg_cell.webp',
  '/bg_cell_open.webp',
  '/bg_market.webp',
  '/bg_cathedral.webp',
  '/bg_gate.webp',
  '/bg_escape.webp',
  '/bg_city.webp',
  '/bg_underground.webp',
  '/rat.webp',
  '/guide.webp',
  '/player_sheet.webp',
  '/player_sheet.json',
];

const EXTRA_PUBLIC_ASSET_URLS = [
  '/elara.webp',
  '/favicon.svg',
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

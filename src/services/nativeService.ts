/**
 * Native Service — Capacitor plugins manager
 *
 * Centraliza: StatusBar, Keyboard, Haptics, Hardware Back, Deep Links,
 * Orientation, Screen Capture, Reviews, Push Permissions.
 */

import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

const isNative = Capacitor.isNativePlatform();

// ─── StatusBar — tema dinámico según OS theme ─────────────────────────────
export async function syncStatusBarTheme(): Promise<void> {
  if (!isNative) return;
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    await StatusBar.setStyle({ style: prefersDark ? Style.Dark : Style.Light });
    if (Capacitor.getPlatform() === 'android') {
      await StatusBar.setBackgroundColor({
        color: prefersDark ? '#1a1a2e' : '#1565C0',
      });
    }
  } catch (err) {
    console.warn('[NativeService] StatusBar error:', err);
  }
}

export function watchOsThemeForStatusBar(): () => void {
  if (!isNative) return () => {};
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = () => void syncStatusBarTheme();
  mq.addEventListener('change', handler);
  void syncStatusBarTheme();
  return () => mq.removeEventListener('change', handler);
}

// ─── Keyboard — scroll automático al abrir formularios ───────────────────
export async function setupKeyboardScroll(): Promise<void> {
  if (!isNative) return;
  try {
    const { Keyboard } = await import('@capacitor/keyboard');
    Keyboard.addListener('keyboardWillShow', (info: { keyboardHeight: number }) => {
      document.documentElement.style.setProperty(
        '--keyboard-height',
        `${info.keyboardHeight}px`
      );
      document.body.style.paddingBottom = `${info.keyboardHeight}px`;
    });
    Keyboard.addListener('keyboardWillHide', () => {
      document.documentElement.style.removeProperty('--keyboard-height');
      document.body.style.paddingBottom = '';
    });
  } catch (err) {
    console.warn('[NativeService] Keyboard error:', err);
  }
}

// ─── Haptics ──────────────────────────────────────────────────────────────
export async function hapticLight(): Promise<void> {
  if (!isNative) return;
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {}
}

export async function hapticMedium(): Promise<void> {
  if (!isNative) return;
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch {}
}

export async function hapticSuccess(): Promise<void> {
  if (!isNative) return;
  try {
    const { Haptics, NotificationType } = await import('@capacitor/haptics');
    await Haptics.notification({ type: NotificationType.Success });
  } catch {}
}

// ─── Hardware Back Button ─────────────────────────────────────────────────
export type BackButtonCallback = () => boolean | Promise<boolean>;

let backListenerRegistered = false;
const backStack: BackButtonCallback[] = [];

export function pushBackHandler(cb: BackButtonCallback): () => void {
  if (!isNative) return () => {};
  backStack.push(cb);

  if (!backListenerRegistered) {
    backListenerRegistered = true;
    App.addListener('backButton', async () => {
      const handler = backStack[backStack.length - 1];
      if (handler) {
        const handled = await handler();
        if (!handled) {
          backStack.pop();
          if (!backStack.length) App.exitApp();
        }
      } else {
        App.exitApp();
      }
    });
  }

  return () => {
    const idx = backStack.lastIndexOf(cb);
    if (idx >= 0) backStack.splice(idx, 1);
  };
}

// ─── Orientación — Portrait en phones, Landscape en tablets ──────────────
export async function lockOrientationPortrait(): Promise<void> {
  if (!isNative || Capacitor.getPlatform() !== 'android') return;
  try {
    const isTablet = window.innerWidth >= 768;
    if (!isTablet) {
      // Screen API nativa — disponible en Capacitor >= 6
      (screen as unknown as { orientation?: { lock?: (mode: string) => Promise<void> } })
        .orientation?.lock?.('portrait-primary')
        .catch(() => {});
    }
  } catch {}
}

// ─── In-App Review ────────────────────────────────────────────────────────
const REVIEW_EVENTS_KEY = 'reviewEventCount';
const REVIEW_THRESHOLD = 5;
const REVIEW_REQUESTED_KEY = 'reviewRequested';

export async function trackEventCreatedForReview(): Promise<void> {
  if (!isNative) return;
  const alreadyRequested = localStorage.getItem(REVIEW_REQUESTED_KEY) === 'true';
  if (alreadyRequested) return;

  const current = parseInt(localStorage.getItem(REVIEW_EVENTS_KEY) ?? '0', 10);
  const next = current + 1;
  localStorage.setItem(REVIEW_EVENTS_KEY, String(next));

  if (next >= REVIEW_THRESHOLD) {
    try {
      // Plugin opcional — nombre resuelto en runtime para que Rollup no intente
      // incluirlo en el bundle si no está instalado.
      const pkgName = ['@capacitor-community', 'in-app-review'].join('/');
      const reviewMod = await import(/* @vite-ignore */ pkgName).catch(() => null);
      if (!reviewMod?.InAppReview) return;
      await reviewMod.InAppReview.requestReview();
      localStorage.setItem(REVIEW_REQUESTED_KEY, 'true');
    } catch {}
  }
}

// ─── Push Permissions — diferido, no en splash ───────────────────────────
export async function requestPushPermissionContextual(): Promise<boolean> {
  if (!isNative) return false;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const { display } = await LocalNotifications.checkPermissions();
    if (display === 'granted') return true;
    const result = await LocalNotifications.requestPermissions();
    return result.display === 'granted';
  } catch {
    return false;
  }
}

// ─── Deep Link opener ─────────────────────────────────────────────────────
export function setupDeepLinkListener(
  onDeepLink: (path: string, params: Record<string, string>) => void
): () => void {
  if (!isNative) return () => {};

  const handle = App.addListener('appUrlOpen', ({ url }) => {
    try {
      const parsed = new URL(url);
      const path = parsed.pathname || parsed.host;
      const params: Record<string, string> = {};
      parsed.searchParams.forEach((val, key) => { params[key] = val; });
      onDeepLink(path, params);
    } catch {
      console.warn('[NativeService] Deep link parse error:', url);
    }
  });

  return () => void handle.then((h) => h.remove());
}

// ─── Limpieza de caché WebView ────────────────────────────────────────────
export async function clearWebViewCache(): Promise<void> {
  if (!isNative) return;
  try {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((name) => caches.delete(name)));
    console.log('[NativeService] Cache limpiado');
  } catch {}
}

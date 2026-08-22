import {
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useSyncExternalStore,
} from "react";

import { useI18n } from "@/lib/i18n";
import { useHelmTheme } from "@/theme/ThemeProvider";

type AssetTheme = "dark" | "light";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const FALLBACK_BACKGROUND: Record<AssetTheme, string> = {
  dark: "radial-gradient(circle at 66% 30%, rgba(85, 222, 245, 0.28), transparent 26%), linear-gradient(145deg, #07101b, #12263a 58%, #19233d)",
  light: "radial-gradient(circle at 66% 30%, rgba(22, 201, 231, 0.3), transparent 26%), linear-gradient(145deg, #eef5fb, #dcdcea 58%, #bacbd8)",
};

function subscribeReducedMotion(onStoreChange: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => undefined;
  const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
  mediaQuery.addEventListener("change", onStoreChange);
  return () => mediaQuery.removeEventListener("change", onStoreChange);
}

function getReducedMotionSnapshot(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function useReactiveReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    () => false,
  );
}

function projectPointer(position: number, start: number, size: number): number {
  if (size <= 0) return 0;
  const projected = ((position - start) / size - 0.5) * 12;
  return Math.max(-6, Math.min(6, projected));
}

function setParallax(element: HTMLElement | null, x = 0, y = 0): void {
  if (!element) return;
  element.style.setProperty("--auth-image-x", `${x}px`);
  element.style.setProperty("--auth-image-y", `${y}px`);
  element.style.setProperty("--auth-hud-x", `${x * -0.55}px`);
  element.style.setProperty("--auth-hud-y", `${y * -0.55}px`);
}

interface CockpitPictureProps {
  assetBase: string;
  assetTheme: AssetTheme;
}

function CockpitPicture({ assetBase, assetTheme }: CockpitPictureProps) {
  return (
    <picture
      key={assetTheme}
      className="auth-cockpit-picture"
      style={{ background: FALLBACK_BACKGROUND[assetTheme] }}
      aria-hidden="true"
    >
      <source srcSet={`${assetBase}.avif`} type="image/avif" />
      <img
        src={`${assetBase}.webp`}
        alt=""
        aria-hidden="true"
        width={1800}
        height={1200}
        fetchPriority="high"
        decoding="async"
      />
    </picture>
  );
}

function CockpitHud() {
  return (
    <div className="auth-hud" aria-hidden="true">
      <svg className="auth-hud-nav auth-hud-secondary" viewBox="0 0 320 84" fill="none">
        <path d="M24 70C65 14 255 14 296 70" />
      </svg>
      <span className="auth-hud-bracket auth-hud-bracket-start" />
      <span className="auth-hud-bracket auth-hud-bracket-end" />
      <span className="auth-status-dot" />
      <span className="auth-hud-horizon auth-hud-secondary" />
    </div>
  );
}

export function CockpitVisual() {
  const { theme } = useHelmTheme();
  const { t } = useI18n();
  const reduceMotion = useReactiveReducedMotion();
  const cockpitRef = useRef<HTMLElement>(null);
  const assetTheme: AssetTheme = theme.mode === "dark" ? "dark" : "light";
  const assetBase = `/auth/cockpit-${assetTheme}`;

  useEffect(() => {
    if (reduceMotion) setParallax(cockpitRef.current);
  }, [reduceMotion]);

  const move = (event: ReactPointerEvent<HTMLElement>) => {
    if (reduceMotion || !window.matchMedia("(pointer: fine)").matches) {
      setParallax(event.currentTarget);
      return;
    }
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = projectPointer(event.clientX, bounds.left, bounds.width);
    const y = projectPointer(event.clientY, bounds.top, bounds.height);
    setParallax(event.currentTarget, x, y);
  };

  return (
    <section
      ref={cockpitRef}
      className="auth-cockpit"
      aria-labelledby="cockpit-status"
      onPointerMove={move}
      onPointerLeave={(event) => setParallax(event.currentTarget)}
      onPointerCancel={(event) => setParallax(event.currentTarget)}
    >
      <CockpitPicture assetBase={assetBase} assetTheme={assetTheme} />
      <CockpitHud />
      <p id="cockpit-status" className="auth-cockpit-status">{t("auth.visual.status")}</p>
    </section>
  );
}

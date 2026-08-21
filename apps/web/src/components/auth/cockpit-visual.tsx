import { type PointerEvent as ReactPointerEvent, useEffect } from "react";
import {
  m,
  type MotionValue,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";

import { useI18n } from "@/lib/i18n";
import { useHelmTheme } from "@/theme/ThemeProvider";

type AssetTheme = "dark" | "light";
type MotionCoordinate = MotionValue<number> | number;

const FALLBACK_BACKGROUND: Record<AssetTheme, string> = {
  dark: "radial-gradient(circle at 66% 30%, rgba(85, 222, 245, 0.28), transparent 26%), linear-gradient(145deg, #07101b, #12263a 58%, #19233d)",
  light: "radial-gradient(circle at 66% 30%, rgba(22, 201, 231, 0.3), transparent 26%), linear-gradient(145deg, #eef5fb, #dcdcea 58%, #bacbd8)",
};

function projectPointer(position: number, start: number, size: number): number {
  if (size <= 0) return 0;
  const projected = ((position - start) / size - 0.5) * 12;
  return Math.max(-6, Math.min(6, projected));
}

function useCockpitParallax(reduceMotion: boolean | null) {
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, { stiffness: 110, damping: 24, mass: 0.35 });
  const y = useSpring(rawY, { stiffness: 110, damping: 24, mass: 0.35 });
  const hudX = useTransform(x, (value) => value * -0.55);
  const hudY = useTransform(y, (value) => value * -0.55);
  const reset = () => { rawX.set(0); rawY.set(0); };
  const move = (event: ReactPointerEvent<HTMLElement>) => {
    if (reduceMotion || !window.matchMedia("(pointer: fine)").matches) return reset();
    const bounds = event.currentTarget.getBoundingClientRect();
    rawX.set(projectPointer(event.clientX, bounds.left, bounds.width));
    rawY.set(projectPointer(event.clientY, bounds.top, bounds.height));
  };
  useEffect(() => {
    if (!reduceMotion) return;
    rawX.set(0);
    rawY.set(0);
  }, [rawX, rawY, reduceMotion]);
  return { x, y, hudX, hudY, move, reset };
}

interface CockpitPictureProps {
  assetBase: string;
  assetTheme: AssetTheme;
  x: MotionCoordinate;
  y: MotionCoordinate;
}

function CockpitPicture({ assetBase, assetTheme, x, y }: CockpitPictureProps) {
  return (
    <picture
      key={assetTheme}
      className="auth-cockpit-picture"
      style={{ background: FALLBACK_BACKGROUND[assetTheme] }}
      aria-hidden="true"
    >
      <source srcSet={`${assetBase}.avif`} type="image/avif" />
      <m.img
        src={`${assetBase}.webp`}
        alt=""
        aria-hidden="true"
        width={1800}
        height={1200}
        fetchPriority="high"
        decoding="async"
        style={{ x, y }}
      />
    </picture>
  );
}

function CockpitHud({ reduceMotion, x, y }: { reduceMotion: boolean | null; x: MotionCoordinate; y: MotionCoordinate }) {
  return (
    <m.div className="auth-hud" style={{ x, y }} aria-hidden="true">
      <svg className="auth-hud-nav auth-hud-secondary" viewBox="0 0 320 84" fill="none">
        <m.path
          d="M24 70C65 14 255 14 296 70"
          initial={{ opacity: reduceMotion ? 1 : 0, pathLength: reduceMotion ? 1 : 0 }}
          animate={{ opacity: 1, pathLength: 1 }}
          transition={{ duration: reduceMotion ? 0 : 0.6, ease: "easeOut" }}
        />
      </svg>
      <span className="auth-hud-bracket auth-hud-bracket-start" />
      <span className="auth-hud-bracket auth-hud-bracket-end" />
      <m.span
        className="auth-status-dot"
        animate={{ opacity: reduceMotion ? 0.86 : [0.48, 0.9, 0.48] }}
        transition={reduceMotion ? { duration: 0 } : { duration: 2.8, ease: "easeInOut", repeat: Infinity }}
      />
      <span className="auth-hud-chip auth-hud-secondary">h</span>
      <span className="auth-hud-horizon auth-hud-secondary" />
    </m.div>
  );
}

export function CockpitVisual() {
  const { theme } = useHelmTheme();
  const { t } = useI18n();
  const reduceMotion = useReducedMotion();
  const parallax = useCockpitParallax(reduceMotion);
  const assetTheme: AssetTheme = theme.mode === "dark" ? "dark" : "light";
  const assetBase = `/auth/cockpit-${assetTheme}`;
  const visualInitial = reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 1.025 };

  return (
    <m.section
      className="auth-cockpit"
      aria-labelledby="cockpit-status"
      initial={visualInitial}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.42, ease: "easeOut" }}
      onPointerMove={parallax.move}
      onPointerLeave={parallax.reset}
      onPointerCancel={parallax.reset}
    >
      <CockpitPicture
        assetBase={assetBase}
        assetTheme={assetTheme}
        x={reduceMotion ? 0 : parallax.x}
        y={reduceMotion ? 0 : parallax.y}
      />
      <CockpitHud
        reduceMotion={reduceMotion}
        x={reduceMotion ? 0 : parallax.hudX}
        y={reduceMotion ? 0 : parallax.hudY}
      />
      <p id="cockpit-status" className="auth-cockpit-status">{t("auth.visual.status")}</p>
    </m.section>
  );
}

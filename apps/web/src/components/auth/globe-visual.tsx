import { useI18n } from "@/lib/i18n";

const GLOBE_CONFIG = {
  version: 1,
  preset: "default",
  selection: "world",
  background: "#232a38",
  transparent: true,
  backgroundStyle: "solid",
  density: 90,
  dotSize: 7,
  dotColor: "#06b9ef",
  dotColorAlpha: 0.88,
  dotsVisible: true,
  shape: "Square",
  sizeVary: false,
  shapeRotationSpeed: 0,
  renderMode: "dots",
  worldFill: "#232a38",
  worldFillAlpha: 0,
  worldFillVisible: false,
  worldStrokeAlpha: 0,
  worldStrokeVisible: false,
  shaderSettings: { effect: "none", intensity: 0 },
  globeSettings: {
    look: "borderless",
    autoSpin: true,
    autoSpinSpeed: 16,
    glow: false,
    grid: false,
    network: false,
    surface: false,
  },
  animationsEnabled: true,
};

const GLOBE_SOURCE = `https://globestudio.app/embed?view=globe&autoSpin=1&transparent=1&source=helm-auth&c=${encodeURIComponent(JSON.stringify(GLOBE_CONFIG))}`;

export function GlobeVisual() {
  const { t } = useI18n();

  return (
    <section className="auth-world" aria-label={t("auth.visual.status")}>
      <iframe
        className="auth-world-frame"
        src={GLOBE_SOURCE}
        title={t("auth.visual.status")}
        sandbox="allow-scripts allow-same-origin"
        referrerPolicy="no-referrer"
        tabIndex={-1}
      />
      <div className="auth-world-copy">
        <p>{t("auth.visual.kicker")}</p>
        <h2>{t("auth.visual.title")}</h2>
      </div>
    </section>
  );
}

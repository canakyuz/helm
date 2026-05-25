import { alert as burntAlert, toast as burntToast } from "burnt";

type ToastPreset = "done" | "error" | "none";
type ToastOpts = {
  title: string;
  message?: string;
  preset?: ToastPreset;
};

function show({ title, message, preset = "done" }: ToastOpts) {
  burntToast({
    title,
    preset,
    duration: preset === "error" ? 3 : 2.5,
    haptic: preset === "error" ? "error" : preset === "done" ? "success" : "none",
    ...(message ? { message } : {}),
  });
}

export const toast = {
  show,
  success(title: string, message?: string) {
    show({ title, preset: "done", ...(message ? { message } : {}) });
  },
  error(title: string, message?: string) {
    show({ title, preset: "error", ...(message ? { message } : {}) });
  },
  alert(title: string, message?: string) {
    burntAlert({
      title,
      preset: "done",
      duration: 1.5,
      ...(message ? { message } : {}),
    });
  },
};

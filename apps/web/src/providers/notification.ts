import type { NotificationProvider } from "@refinedev/core";
import { toast } from "sonner";

// Refine bildirimlerini sonner toast'larına bağlar.
export const notificationProvider: NotificationProvider = {
  open: ({ key, message, description, type }) => {
    if (type === "success") {
      toast.success(message, { id: key, description });
    } else if (type === "error") {
      toast.error(message, { id: key, description });
    } else {
      toast(message, { id: key, description });
    }
  },
  close: (key) => {
    toast.dismiss(key);
  },
};

import { Plug } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { IntegrationsPanel } from "@/components/integrations-panel";
import { useScope } from "@/context/scope";

export const IntegrationsPage = () => {
  const { scope, isAll } = useScope();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">
        Entegrasyonlar
      </h1>

      {isAll ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={<Plug className="size-6" />}
              title="Proje seç"
              description="Entegrasyonlar property-bazlıdır. Sidebar'dan üstteki switcher'a tıkla, hangisini yönetmek istiyorsan seç — 'Tüm Property'ler' modunda eklenemez."
            />
          </CardContent>
        </Card>
      ) : (
        <IntegrationsPanel projectId={scope} />
      )}
    </div>
  );
};

import { Card, CardContent } from "@/components/ui/card";
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
            <div className="py-8 text-center text-sm text-muted-foreground">
              Entegrasyonları yönetmek için sidebar'dan bir proje seç.
            </div>
          </CardContent>
        </Card>
      ) : (
        <IntegrationsPanel projectId={scope} />
      )}
    </div>
  );
};

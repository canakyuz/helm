import { Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Onboarding/dönüşüm hunisi. Gerçek adım verisi PostHog funnel sorgusu ister;
// şimdilik yapı hazır, adımlar tanımlı, dönüşüm oranları "—".
const STEPS = [
  { label: "Uygulama açılışı", width: "100%" },
  { label: "Kayıt", width: "78%" },
  { label: "İlk oturum tamamlama", width: "54%" },
  { label: "Satın alma / Abonelik", width: "32%" },
];

export const FunnelPage = () => (
  <div className="space-y-4">
    <h1 className="text-2xl font-semibold tracking-tight">Huni</h1>

    <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
      <Info className="mt-0.5 size-4 shrink-0 text-amber-500" />
      <span>
        Dönüşüm hunisi adımları aşağıda. Gerçek oranlar için PostHog funnel
        sorgusu bağlanmalı (connector işi) — bağlanınca her adımın dönüşüm
        yüzdesi dolacak.
      </span>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>Onboarding Hunisi</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {STEPS.map((step, i) => (
          <div key={step.label} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>
                {i + 1}. {step.label}
              </span>
              <span className="text-muted-foreground">—</span>
            </div>
            <div className="h-8 rounded-md bg-muted">
              <div
                className="flex h-8 items-center rounded-md bg-primary/25 px-3 text-xs text-foreground"
                style={{ width: step.width }}
              >
                bekliyor
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  </div>
);

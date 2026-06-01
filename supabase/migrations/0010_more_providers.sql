-- helm — yeni connector sağlayıcıları: Stripe (web aboneliği), Plausible
-- (web analitiği). project_integrations.provider kısıtı genişletilir.

alter table public.project_integrations
  drop constraint if exists project_integrations_provider_check;

alter table public.project_integrations
  add constraint project_integrations_provider_check
  check (
    provider in (
      'revenuecat', 'admob', 'posthog', 'supabase', 'stripe', 'plausible'
    )
  );

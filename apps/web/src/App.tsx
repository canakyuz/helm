import { lazy, Suspense } from "react";
import { Authenticated, Refine } from "@refinedev/core";
import { DevtoolsPanel, DevtoolsProvider } from "@refinedev/devtools";
import { RefineKbar, RefineKbarProvider } from "@refinedev/kbar";
import routerProvider, {
  CatchAllNavigate,
  DocumentTitleHandler,
  NavigateToResource,
  UnsavedChangesNotifier,
} from "@refinedev/react-router";
import { liveProvider } from "@refinedev/supabase";
import { BrowserRouter, Outlet, Route, Routes } from "react-router";

import { Toaster } from "@/components/ui/sonner";
import { ErrorComponent } from "@/components/error";
import { HelmLayout } from "@/components/layout";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { ScopeProvider } from "@/context/scope";
import { DisplayCurrencyProvider } from "@/context/currency";
import authProvider from "@/providers/auth";
import { dataProvider } from "@/providers/data";
import { notificationProvider } from "@/providers/notification";
import { supabaseClient } from "@/providers/supabase-client";

// Route bazlı kod bölme — her sayfa kendi chunk'ında.
const DashboardPage = lazy(() =>
  import("@/pages/dashboard").then((m) => ({ default: m.DashboardPage })),
);
const LoginPage = lazy(() =>
  import("@/pages/login").then((m) => ({ default: m.LoginPage })),
);
const UsersPage = lazy(() =>
  import("@/pages/users").then((m) => ({ default: m.UsersPage })),
);
const IntegrationsPage = lazy(() =>
  import("@/pages/integrations").then((m) => ({
    default: m.IntegrationsPage,
  })),
);
const SystemPage = lazy(() =>
  import("@/pages/system").then((m) => ({ default: m.SystemPage })),
);
const RevenuePage = lazy(() =>
  import("@/pages/revenue").then((m) => ({ default: m.RevenuePage })),
);
const AlertsPage = lazy(() =>
  import("@/pages/alerts").then((m) => ({ default: m.AlertsPage })),
);
const MailPage = lazy(() =>
  import("@/pages/mail").then((m) => ({ default: m.MailPage })),
);
const SettingsPage = lazy(() =>
  import("@/pages/settings").then((m) => ({ default: m.SettingsPage })),
);
const ReviewsPage = lazy(() =>
  import("@/pages/reviews").then((m) => ({ default: m.ReviewsPage })),
);
const GrowthPage = lazy(() =>
  import("@/pages/growth").then((m) => ({ default: m.GrowthPage })),
);
const LogsPage = lazy(() =>
  import("@/pages/logs").then((m) => ({ default: m.LogsPage })),
);
const SegmentsPage = lazy(() =>
  import("@/pages/segments").then((m) => ({ default: m.SegmentsPage })),
);
const VersionsPage = lazy(() =>
  import("@/pages/versions").then((m) => ({ default: m.VersionsPage })),
);
const FunnelPage = lazy(() =>
  import("@/pages/funnel").then((m) => ({ default: m.FunnelPage })),
);
const PushPage = lazy(() =>
  import("@/pages/push").then((m) => ({ default: m.PushPage })),
);
const CampaignsPage = lazy(() =>
  import("@/pages/campaigns").then((m) => ({ default: m.CampaignsPage })),
);
const AuditPage = lazy(() =>
  import("@/pages/audit").then((m) => ({ default: m.AuditPage })),
);
const ProjectCreate = lazy(() =>
  import("@/pages/projects").then((m) => ({ default: m.ProjectCreate })),
);
const ProjectEdit = lazy(() =>
  import("@/pages/projects").then((m) => ({ default: m.ProjectEdit })),
);

function App() {
  return (
    <BrowserRouter>
      <RefineKbarProvider>
        <ThemeProvider>
          <DevtoolsProvider>
            <Refine
              dataProvider={dataProvider}
              liveProvider={liveProvider(supabaseClient)}
              authProvider={authProvider}
              routerProvider={routerProvider}
              notificationProvider={notificationProvider}
              resources={[
                { name: "dashboard", list: "/", meta: { label: "Cockpit" } },
                {
                  name: "users",
                  list: "/users",
                  meta: { label: "Kullanıcılar" },
                },
                {
                  name: "integrations",
                  list: "/integrations",
                  meta: { label: "Entegrasyonlar" },
                },
                {
                  name: "system",
                  list: "/system",
                  meta: { label: "Sistem" },
                },
                {
                  name: "revenue",
                  list: "/revenue",
                  meta: { label: "Gelir & Reklam" },
                },
                {
                  name: "alerts",
                  list: "/alerts",
                  meta: { label: "Uyarılar" },
                },
                { name: "mail", list: "/mail", meta: { label: "Mail" } },
                {
                  name: "reviews",
                  list: "/reviews",
                  meta: { label: "Yorumlar" },
                },
                {
                  name: "growth",
                  list: "/growth",
                  meta: { label: "Büyüme" },
                },
                { name: "logs", list: "/logs", meta: { label: "Loglar" } },
                {
                  name: "user_segments",
                  list: "/segments",
                  meta: { label: "Segmentler" },
                },
                {
                  name: "versions",
                  list: "/versions",
                  meta: { label: "Sürümler" },
                },
                { name: "funnel", list: "/funnel", meta: { label: "Huni" } },
                { name: "push", list: "/push", meta: { label: "Push" } },
                {
                  name: "campaigns",
                  list: "/campaigns",
                  meta: { label: "Kampanya Geçmişi" },
                },
                {
                  name: "audit",
                  list: "/audit",
                  meta: { label: "Müdahale Geçmişi" },
                },
                {
                  name: "settings",
                  list: "/settings",
                  meta: { label: "Ayarlar" },
                },
                {
                  name: "projects",
                  create: "/projects/create",
                  edit: "/projects/edit/:id",
                  meta: { label: "Proje" },
                },
              ]}
              options={{
                syncWithLocation: true,
                warnWhenUnsavedChanges: true,
              }}
            >
              <ScopeProvider>
                <DisplayCurrencyProvider>
                <Routes>
                  <Route
                    element={
                      <Authenticated
                        key="authenticated-routes"
                        fallback={<CatchAllNavigate to="/login" />}
                      >
                        <HelmLayout />
                      </Authenticated>
                    }
                  >
                    <Route index element={<DashboardPage />} />
                    <Route path="/users" element={<UsersPage />} />
                    <Route
                      path="/integrations"
                      element={<IntegrationsPage />}
                    />
                    <Route path="/system" element={<SystemPage />} />
                    <Route path="/revenue" element={<RevenuePage />} />
                    <Route path="/alerts" element={<AlertsPage />} />
                    <Route path="/mail" element={<MailPage />} />
                    <Route path="/reviews" element={<ReviewsPage />} />
                    <Route path="/growth" element={<GrowthPage />} />
                    <Route path="/logs" element={<LogsPage />} />
                    <Route path="/segments" element={<SegmentsPage />} />
                    <Route path="/versions" element={<VersionsPage />} />
                    <Route path="/funnel" element={<FunnelPage />} />
                    <Route path="/push" element={<PushPage />} />
                    <Route path="/campaigns" element={<CampaignsPage />} />
                    <Route path="/audit" element={<AuditPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route
                      path="/projects/create"
                      element={<ProjectCreate />}
                    />
                    <Route
                      path="/projects/edit/:id"
                      element={<ProjectEdit />}
                    />
                    <Route path="*" element={<ErrorComponent />} />
                  </Route>

                  <Route
                    element={
                      <Authenticated key="auth-pages" fallback={<Outlet />}>
                        <NavigateToResource resource="dashboard" />
                      </Authenticated>
                    }
                  >
                    <Route
                      path="/login"
                      element={
                        <Suspense fallback={null}>
                          <LoginPage />
                        </Suspense>
                      }
                    />
                  </Route>
                </Routes>
                </DisplayCurrencyProvider>
              </ScopeProvider>

              <RefineKbar />
              <UnsavedChangesNotifier />
              <DocumentTitleHandler />
            </Refine>
            <DevtoolsPanel />
          </DevtoolsProvider>
          <Toaster />
        </ThemeProvider>
      </RefineKbarProvider>
    </BrowserRouter>
  );
}

export default App;

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
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
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
const UserDetailPage = lazy(() =>
  import("@/pages/users/$id").then((m) => ({ default: m.UserDetailPage })),
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
// ProjectCreate kaldırıldı — /projects/create artık /properties/create'e redirect olur.
// ProjectEdit korunuyor (CMS publish targets paralel iş edit.tsx'i kullanıyor).
const ProjectEdit = lazy(() =>
  import("@/pages/projects").then((m) => ({ default: m.ProjectEdit })),
);
const PropertyCreate = lazy(() =>
  import("@/pages/properties").then((m) => ({ default: m.PropertyCreate })),
);
const PropertyEdit = lazy(() =>
  import("@/pages/properties").then((m) => ({ default: m.PropertyEdit })),
);
const PropertiesListPage = lazy(() =>
  import("@/pages/properties").then((m) => ({
    default: m.PropertiesListPage,
  })),
);
const BrandEdit = lazy(() =>
  import("@/pages/brands").then((m) => ({ default: m.BrandEdit })),
);
const CollectionsListPage = lazy(() =>
  import("@/pages/cms/collections/list").then((m) => ({
    default: m.CollectionsListPage,
  })),
);
const CollectionEditPage = lazy(() =>
  import("@/pages/cms/collections/edit").then((m) => ({
    default: m.CollectionEditPage,
  })),
);
const EntriesListPage = lazy(() =>
  import("@/pages/cms/entries/list").then((m) => ({
    default: m.EntriesListPage,
  })),
);
const EntryEditPage = lazy(() =>
  import("@/pages/cms/entries/edit").then((m) => ({
    default: m.EntryEditPage,
  })),
);
const AssetsPage = lazy(() =>
  import("@/pages/cms/assets").then((m) => ({ default: m.AssetsPage })),
);

function App() {
  return (
    <BrowserRouter>
      <RefineKbarProvider>
        <ThemeProvider>
          <TooltipProvider>
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
                  meta: { label: "Users" },
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
                  meta: { label: "Alerts" },
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
                  meta: { label: "Growth" },
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
                  meta: { label: "Versions" },
                },
                { name: "funnel", list: "/funnel", meta: { label: "Huni" } },
                { name: "push", list: "/push", meta: { label: "Push" } },
                {
                  name: "campaigns",
                  list: "/campaigns",
                  meta: { label: "Campaign history" },
                },
                {
                  name: "audit",
                  list: "/audit",
                  meta: { label: "Intervention history" },
                },
                {
                  name: "settings",
                  list: "/settings",
                  meta: { label: "Ayarlar" },
                },
                {
                  // `projects` resource'u CMS publish targets edit'i için
                  // /projects/edit/:id'de kalıyor; create artık properties'e gider.
                  name: "projects",
                  edit: "/projects/edit/:id",
                  meta: { label: "Proje (legacy CMS edit)" },
                },
                {
                  name: "properties",
                  list: "/properties",
                  create: "/properties/create",
                  edit: "/properties/edit/:id",
                  meta: { label: "Property'ler" },
                },
                {
                  name: "brands",
                  edit: "/brands/edit/:id",
                  meta: { label: "Brand" },
                },
                {
                  name: "cms_collections",
                  list: "/cms/collections",
                  edit: "/cms/collections/edit/:id",
                  meta: { label: "Content schemas" },
                },
                {
                  name: "cms_entries",
                  list: "/cms/entries",
                  create: "/cms/entries/create",
                  edit: "/cms/entries/edit/:id",
                  meta: { label: "Content" },
                },
                {
                  name: "cms_assets",
                  list: "/cms/assets",
                  meta: { label: "Medya" },
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
                    <Route path="/users/:id" element={<UserDetailPage />} />
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
                      element={<Navigate to="/properties/create" replace />}
                    />
                    {/* Legacy projects/edit: ProjectEdit korunuyor — kullanıcının
                        paralel CMS publish targets işine dokunulmuyor. Yeni Property
                        UI'sı için /properties/edit/:id açıkça çağrılır. */}
                    <Route
                      path="/projects/edit/:id"
                      element={<ProjectEdit />}
                    />
                    <Route
                      path="/properties"
                      element={<PropertiesListPage />}
                    />
                    <Route
                      path="/properties/create"
                      element={<PropertyCreate />}
                    />
                    <Route
                      path="/properties/edit/:id"
                      element={<PropertyEdit />}
                    />
                    <Route
                      path="/brands/edit/:id"
                      element={<BrandEdit />}
                    />
                    <Route
                      path="/cms/collections"
                      element={<CollectionsListPage />}
                    />
                    <Route
                      path="/cms/collections/edit/:id"
                      element={<CollectionEditPage />}
                    />
                    <Route path="/cms/entries" element={<EntriesListPage />} />
                    <Route
                      path="/cms/entries/create"
                      element={<EntryEditPage />}
                    />
                    <Route
                      path="/cms/entries/edit/:id"
                      element={<EntryEditPage />}
                    />
                    <Route path="/cms/assets" element={<AssetsPage />} />
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
          </TooltipProvider>
        </ThemeProvider>
      </RefineKbarProvider>
    </BrowserRouter>
  );
}

export default App;

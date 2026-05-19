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

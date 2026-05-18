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
import { AppWindow, LayoutDashboard } from "lucide-react";
import { BrowserRouter, Outlet, Route, Routes } from "react-router";

import { Toaster } from "@/components/ui/sonner";
import { ErrorComponent } from "@/components/error";
import { HelmLayout } from "@/components/layout";
import { ThemeProvider } from "@/theme/ThemeProvider";
import authProvider from "@/providers/auth";
import { dataProvider } from "@/providers/data";
import { notificationProvider } from "@/providers/notification";
import { supabaseClient } from "@/providers/supabase-client";

import { DashboardPage } from "@/pages/dashboard";
import { LoginPage } from "@/pages/login";
import {
  ProjectCreate,
  ProjectEdit,
  ProjectList,
  ProjectShow,
} from "@/pages/projects";

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
                {
                  name: "dashboard",
                  list: "/",
                  meta: {
                    label: "Cockpit",
                    icon: <LayoutDashboard className="size-4" />,
                  },
                },
                {
                  name: "projects",
                  list: "/projects",
                  create: "/projects/create",
                  edit: "/projects/edit/:id",
                  show: "/projects/show/:id",
                  meta: {
                    label: "Projeler",
                    icon: <AppWindow className="size-4" />,
                  },
                },
              ]}
              options={{
                syncWithLocation: true,
                warnWhenUnsavedChanges: true,
              }}
            >
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
                  <Route path="/projects">
                    <Route index element={<ProjectList />} />
                    <Route path="create" element={<ProjectCreate />} />
                    <Route path="edit/:id" element={<ProjectEdit />} />
                    <Route path="show/:id" element={<ProjectShow />} />
                  </Route>
                  <Route path="*" element={<ErrorComponent />} />
                </Route>

                <Route
                  element={
                    <Authenticated key="auth-pages" fallback={<Outlet />}>
                      <NavigateToResource resource="dashboard" />
                    </Authenticated>
                  }
                >
                  <Route path="/login" element={<LoginPage />} />
                </Route>

                <Route path="/__debug" element={<HelmLayout />} />
              </Routes>

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

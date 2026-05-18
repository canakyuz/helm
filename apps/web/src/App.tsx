import { Authenticated, Refine } from "@refinedev/core";
import { DevtoolsPanel, DevtoolsProvider } from "@refinedev/devtools";
import { RefineKbar, RefineKbarProvider } from "@refinedev/kbar";

import {
  AuthPage,
  ErrorComponent,
  ThemedLayout,
  ThemedTitle,
  useNotificationProvider,
} from "@refinedev/antd";
import "@refinedev/antd/dist/reset.css";
import "./styles/glass.css";

import routerProvider, {
  CatchAllNavigate,
  DocumentTitleHandler,
  NavigateToResource,
  UnsavedChangesNotifier,
} from "@refinedev/react-router";
import { liveProvider } from "@refinedev/supabase";
import { AppstoreOutlined, DashboardOutlined } from "@ant-design/icons";
import { App as AntdApp } from "antd";
import { BrowserRouter, Outlet, Route, Routes } from "react-router";

import { ThemeProvider } from "./theme/ThemeProvider";
import { Header } from "./components/header";
import authProvider from "./providers/auth";
import { dataProvider } from "./providers/data";
import { supabaseClient } from "./providers/supabase-client";

import { DashboardPage } from "./pages/dashboard";
import {
  ProjectCreate,
  ProjectEdit,
  ProjectList,
  ProjectShow,
} from "./pages/projects";

function App() {
  return (
    <BrowserRouter>
      <RefineKbarProvider>
        <ThemeProvider>
          <AntdApp>
            <DevtoolsProvider>
              <Refine
                dataProvider={dataProvider}
                liveProvider={liveProvider(supabaseClient)}
                authProvider={authProvider}
                routerProvider={routerProvider}
                notificationProvider={useNotificationProvider}
                resources={[
                  {
                    name: "dashboard",
                    list: "/",
                    meta: { label: "Cockpit", icon: <DashboardOutlined /> },
                  },
                  {
                    name: "projects",
                    list: "/projects",
                    create: "/projects/create",
                    edit: "/projects/edit/:id",
                    show: "/projects/show/:id",
                    meta: { label: "Projeler", icon: <AppstoreOutlined /> },
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
                        <ThemedLayout
                          Header={Header}
                          Title={({ collapsed }: { collapsed?: boolean }) => (
                            <ThemedTitle
                              collapsed={collapsed ?? false}
                              text="helm"
                            />
                          )}
                        >
                          <Outlet />
                        </ThemedLayout>
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
                    <Route
                      path="/login"
                      element={
                        <AuthPage
                          type="login"
                          registerLink={false}
                          forgotPasswordLink={false}
                          title={
                            <ThemedTitle collapsed={false} text="helm" />
                          }
                        />
                      }
                    />
                  </Route>
                </Routes>

                <RefineKbar />
                <UnsavedChangesNotifier />
                <DocumentTitleHandler />
              </Refine>
              <DevtoolsPanel />
            </DevtoolsProvider>
          </AntdApp>
        </ThemeProvider>
      </RefineKbarProvider>
    </BrowserRouter>
  );
}

export default App;

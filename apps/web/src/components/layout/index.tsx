import { Suspense } from "react";
import { useGetIdentity, useLogout } from "@refinedev/core";
import { Link, Outlet, useLocation } from "react-router";
import {
  Activity,
  Bell,
  Boxes,
  Check,
  ChevronsUpDown,
  LayoutDashboard,
  Loader2,
  LogOut,
  Palette,
  Plug,
  Settings,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProjectSwitcher } from "./project-switcher";
import { useHelmTheme } from "@/theme/ThemeProvider";

type IUser = { id: string; name?: string };

type NavItem = {
  title: string;
  icon: typeof LayoutDashboard;
  url?: string;
  soon?: boolean;
};

// Sidebar modül haritası — gruplu. Yeni modül = buraya bir girdi.
const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Genel",
    items: [{ title: "Cockpit", icon: LayoutDashboard, url: "/" }],
  },
  {
    label: "CRM",
    items: [{ title: "Kullanıcılar", icon: Users, url: "/users" }],
  },
  {
    label: "Analitik",
    items: [
      { title: "Gelir & Reklam", icon: TrendingUp, soon: true },
      { title: "Uyarılar", icon: Bell, soon: true },
    ],
  },
  {
    label: "DevOps",
    items: [
      { title: "Entegrasyonlar", icon: Plug, url: "/integrations" },
      { title: "Senkron & Sağlık", icon: Activity, url: "/system" },
    ],
  },
  {
    label: "Sistem",
    items: [{ title: "Ayarlar", icon: Settings, soon: true }],
  },
];

const NavUser = () => {
  const { data: user } = useGetIdentity<IUser>();
  const { mutate: logout } = useLogout();
  const { themeKey, setThemeKey, themes } = useHelmTheme();

  const name = user?.name ?? "Misafir";
  const initial = name[0]?.toUpperCase() ?? "?";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent"
            >
              <Avatar className="size-8 rounded-md">
                <AvatarFallback className="rounded-md bg-primary text-primary-foreground text-xs">
                  {initial}
                </AvatarFallback>
              </Avatar>
              <span className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{name}</span>
              </span>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" className="w-56">
            <DropdownMenuLabel className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Palette className="size-3.5" /> Tema
            </DropdownMenuLabel>
            {themes.map((t) => (
              <DropdownMenuItem
                key={t.key}
                onClick={() => setThemeKey(t.key)}
              >
                {t.key === themeKey ? (
                  <Check className="size-4" />
                ) : (
                  <span className="size-4" />
                )}
                {t.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => logout()}>
              <LogOut className="size-4" /> Çıkış yap
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
};

const AppSidebar = () => {
  const { pathname } = useLocation();
  const isActive = (url: string) =>
    url === "/" ? pathname === "/" : pathname.startsWith(url);

  return (
    <Sidebar variant="floating">
      <SidebarHeader>
        <ProjectSwitcher />
      </SidebarHeader>

      <SidebarContent>
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  if (item.soon || !item.url) {
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton disabled className="opacity-55">
                          <Icon />
                          <span>{item.title}</span>
                        </SidebarMenuButton>
                        <SidebarMenuBadge>yakında</SidebarMenuBadge>
                      </SidebarMenuItem>
                    );
                  }
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive(item.url)}
                        tooltip={item.title}
                      >
                        <Link to={item.url}>
                          <Icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
};

const HeaderBar = () => (
  <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur">
    <SidebarTrigger />
    <Separator orientation="vertical" className="h-5" />
  </header>
);

export const HelmLayout = () => (
  <SidebarProvider>
    <AppSidebar />
    <SidebarInset>
      <HeaderBar />
      <main className="p-4 lg:p-6">
        <Suspense
          fallback={
            <div className="grid place-items-center py-24">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </main>
    </SidebarInset>
  </SidebarProvider>
);

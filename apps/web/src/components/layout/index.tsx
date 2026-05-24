import { Suspense, useMemo } from "react";
import { useGetIdentity, useLogout } from "@refinedev/core";
import { useKBar } from "@refinedev/kbar";
import { Link, Outlet, useLocation } from "react-router";
import {
  Activity,
  Bell,
  ChevronsUpDown,
  FileText,
  Filter,
  History,
  Image as ImageIcon,
  Layers,
  LayoutDashboard,
  LineChart,
  Loader2,
  LogOut,
  Mail,
  Megaphone,
  Moon,
  Plug,
  ScrollText,
  Search,
  Send,
  Settings,
  Star,
  Sun,
  Tag,
  TrendingUp,
  Users,
  Workflow,
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
    items: [
      { title: "Kullanıcılar", icon: Users, url: "/users" },
      { title: "Segmentler", icon: Filter, url: "/segments" },
      { title: "Yorumlar", icon: Star, url: "/reviews" },
      { title: "Müdahale Geçmişi", icon: History, url: "/audit" },
    ],
  },
  {
    label: "Analitik",
    items: [
      { title: "Gelir & Reklam", icon: TrendingUp, url: "/revenue" },
      { title: "Büyüme", icon: LineChart, url: "/growth" },
      { title: "Huni", icon: Workflow, url: "/funnel" },
      { title: "Uyarılar", icon: Bell, url: "/alerts" },
    ],
  },
  {
    label: "İletişim",
    items: [
      { title: "Mail", icon: Mail, url: "/mail" },
      { title: "Push", icon: Send, url: "/push" },
      { title: "Kampanya Geçmişi", icon: Megaphone, url: "/campaigns" },
    ],
  },
  {
    label: "İçerik (CMS)",
    items: [
      { title: "Şemalar", icon: Layers, url: "/cms/collections" },
      { title: "İçerikler", icon: FileText, url: "/cms/entries" },
      { title: "Medya", icon: ImageIcon, url: "/cms/assets" },
    ],
  },
  {
    label: "DevOps",
    items: [
      { title: "Entegrasyonlar", icon: Plug, url: "/integrations" },
      { title: "Senkron & Sağlık", icon: Activity, url: "/system" },
      { title: "Loglar", icon: ScrollText, url: "/logs" },
      { title: "Sürümler", icon: Tag, url: "/versions" },
    ],
  },
  {
    label: "Sistem",
    items: [{ title: "Ayarlar", icon: Settings, url: "/settings" }],
  },
];

/** Dark/Light tek toggle — sidebar footer'da NavUser üstünde. */
const ModeToggle = () => {
  const { theme, toggleMode } = useHelmTheme();
  const isDark = theme.mode === "dark";
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          onClick={toggleMode}
          tooltip={isDark ? "Aydınlık moda geç" : "Karanlık moda geç"}
        >
          {isDark ? <Sun /> : <Moon />}
          <span>{isDark ? "Aydınlık" : "Karanlık"}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
};

const NavUser = () => {
  const { data: user } = useGetIdentity<IUser>();
  const { mutate: logout } = useLogout();

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
        <ModeToggle />
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
};

/** Aktif route'a göre breadcrumb başlığını NAV_GROUPS'tan al. */
const useBreadcrumb = () => {
  const { pathname } = useLocation();
  return useMemo(() => {
    if (pathname === "/") return "Cockpit";
    for (const g of NAV_GROUPS) {
      for (const it of g.items) {
        if (it.url && it.url !== "/" && pathname.startsWith(it.url)) {
          return it.title;
        }
      }
    }
    return "";
  }, [pathname]);
};

const HeaderBar = () => {
  const title = useBreadcrumb();
  const { data: user } = useGetIdentity<IUser>();
  const initial = (user?.name ?? "?")[0]?.toUpperCase() ?? "?";
  const { query } = useKBar();
  return (
    <header
      data-slot="helm-header"
      className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background/70 px-3 lg:px-4"
    >
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-5" />
      {title && (
        <h2 className="text-sm font-medium tracking-tight">{title}</h2>
      )}

      {/* Orta — Command/Search trigger (⌘K) */}
      <button
        type="button"
        onClick={() => query.toggle()}
        className="ml-2 hidden md:flex flex-1 max-w-md items-center gap-2 rounded-md border bg-muted/40 px-3 py-1.5 text-sm text-muted-foreground ring-1 ring-foreground/5 transition-colors hover:bg-muted/60"
      >
        <Search className="size-4" />
        <span>Hızlı arama…</span>
        <kbd className="ml-auto rounded bg-background/60 px-1.5 py-0.5 font-mono text-[10px] ring-1 ring-foreground/10">
          ⌘K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1">
        <Link
          to="/alerts"
          aria-label="Uyarılar"
          className="grid size-9 place-items-center rounded-md text-muted-foreground ring-1 ring-foreground/5 transition-colors hover:bg-accent hover:text-foreground"
        >
          <Bell className="size-4" />
        </Link>
        <Link
          to="/settings"
          aria-label="Ayarlar"
          className="grid size-9 place-items-center rounded-md ring-1 ring-foreground/5 transition-colors hover:bg-accent"
        >
          <Avatar className="size-7 rounded-md">
            <AvatarFallback className="rounded-md bg-primary text-primary-foreground text-[11px]">
              {initial}
            </AvatarFallback>
          </Avatar>
        </Link>
      </div>
    </header>
  );
};

export const HelmLayout = () => {
  const { pathname } = useLocation();
  const isDashboard = pathname === "/";
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <HeaderBar />
        <main
          className={
            isDashboard
              ? "relative min-h-0 flex-1 overflow-hidden"
              : "min-h-0 flex-1 p-4 lg:p-6"
          }
        >
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
};

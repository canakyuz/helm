import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
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
import { useEnabledModules } from "@/hooks/use-enabled-modules";
import type { ModuleKey } from "@/lib/modules";

type IUser = { id: string; name?: string };

type NavItem = {
  title: string;
  icon: typeof LayoutDashboard;
  url?: string;
  soon?: boolean;
  // Item bu modüle (veya verilen modüllerden HERHANGI BIRINE) bağlı.
  // Hiçbiri açık değilse sidebar'da gizlenir. requires yoksa her zaman görünür.
  requires?: ModuleKey | ModuleKey[];
};

type NavGroup = {
  label: string;
  items: NavItem[];
  // alwaysVisible grup, child filtrelerinden bağımsız her zaman görünür (sistem işleri).
  alwaysVisible?: boolean;
};

// Sidebar modül haritası - gruplu. Yeni modül = buraya bir girdi.
// Detay: .docs/MODULES.md §6
const NAV_GROUPS: NavGroup[] = [
  {
    label: "Genel",
    alwaysVisible: true,
    items: [{ title: "Cockpit", icon: LayoutDashboard, url: "/" }],
  },
  {
    label: "Content (CMS)",
    items: [
      { title: "Schemas", icon: Layers, url: "/cms/collections", requires: "content" },
      { title: "Content", icon: FileText, url: "/cms/entries", requires: "content" },
      { title: "Medya", icon: ImageIcon, url: "/cms/assets", requires: "content" },
    ],
  },
  {
    label: "CRM",
    items: [
      { title: "Users", icon: Users, url: "/users", requires: "users" },
      { title: "Segmentler", icon: Filter, url: "/segments", requires: "users" },
      { title: "Yorumlar", icon: Star, url: "/reviews", requires: "reviews" },
      { title: "Intervention history", icon: History, url: "/audit" },
    ],
  },
  {
    label: "Analitik",
    items: [
      {
        title: "Gelir & Reklam",
        icon: TrendingUp,
        url: "/revenue",
        requires: ["subscriptions", "ads"],
      },
      { title: "Growth", icon: LineChart, url: "/growth", requires: "analytics" },
      { title: "Huni", icon: Workflow, url: "/funnel", requires: "funnel" },
      { title: "Alerts", icon: Bell, url: "/alerts" },
    ],
  },
  {
    label: "Contact",
    items: [
      { title: "Mail", icon: Mail, url: "/mail", requires: "mail" },
      { title: "Push", icon: Send, url: "/push", requires: "push" },
      {
        title: "Campaign history",
        icon: Megaphone,
        url: "/campaigns",
        requires: ["mail", "push"],
      },
    ],
  },
  {
    label: "DevOps",
    alwaysVisible: true,
    items: [
      { title: "Entegrasyonlar", icon: Plug, url: "/integrations" },
      { title: "Sync & health", icon: Activity, url: "/system" },
      { title: "Loglar", icon: ScrollText, url: "/logs" },
      { title: "Versions", icon: Tag, url: "/versions" },
    ],
  },
  {
    label: "Sistem",
    alwaysVisible: true,
    items: [{ title: "Settings", icon: Settings, url: "/settings" }],
  },
];

function itemVisible(item: NavItem, enabled: ModuleKey[]): boolean {
  if (!item.requires) return true;
  const reqs = Array.isArray(item.requires) ? item.requires : [item.requires];
  return reqs.some((r) => enabled.includes(r));
}

/** Dark/Light tek toggle - sidebar footer'da NavUser üstünde. */
const ModeToggle = () => {
  const { theme, toggleMode } = useHelmTheme();
  const isDark = theme.mode === "dark";
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          onClick={toggleMode}
          tooltip={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {isDark ? <Sun /> : <Moon />}
          <span>{isDark ? "Light" : "Dark"}</span>
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
  const enabledModules = useEnabledModules();

  const visibleGroups = useMemo(
    () =>
      NAV_GROUPS.map((g) => ({
        ...g,
        items: g.items.filter((it) => itemVisible(it, enabledModules)),
      })).filter((g) => g.alwaysVisible || g.items.length > 0),
    [enabledModules],
  );

  return (
    <Sidebar variant="floating">
      <SidebarHeader>
        <ProjectSwitcher />
      </SidebarHeader>

      <SidebarContent>
        {visibleGroups.map((group) => (
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
                        <SidebarMenuBadge>coming soon</SidebarMenuBadge>
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

const HeaderBar = ({ scrolled }: { scrolled: boolean }) => {
  const title = useBreadcrumb();
  const { data: user } = useGetIdentity<IUser>();
  const initial = (user?.name ?? "?")[0]?.toUpperCase() ?? "?";
  const { query } = useKBar();
  return (
    <header
      data-slot="helm-header"
      data-scrolled={scrolled ? "true" : "false"}
      className={cn(
        "sticky top-0 z-10 flex h-14 items-center gap-3 border-2 rounded-2xl m-1 px-3 lg:px-4 transition-[background-color,backdrop-filter,border-color] duration-200",
        "sticky top-0 z-10 flex h-14 items-center gap-3 border-2 rounded-2xl m-1 px-3 lg:px-4 transition-[background-color,backdrop-filter,border-color] duration-200",
        scrolled
          ? "border-b border-border bg-background/70 backdrop-blur-md supports-[backdrop-filter]:bg-background/60"
          : "border-b border-transparent bg-transparent backdrop-blur-0",
      )}
    >
      <SidebarTrigger />

      {title && (
        <h2 className="text-sm font-medium tracking-tight">{title}</h2>
      )}

      {/* Orta - Command/Search trigger (⌘K) */}
      <button
        type="button"
        onClick={() => query.toggle()}
        className="ml-2 hidden md:flex flex-1 max-w-md items-center gap-2 rounded-md border bg-muted/40 px-3 py-1.5 text-sm text-muted-foreground ring-1 ring-foreground/5 transition-colors hover:bg-muted/60"
      >
        <Search className="size-4" />
        <span>Quick search…</span>
        <kbd className="ml-auto rounded bg-background/60 px-1.5 py-0.5 font-mono text-[10px] ring-1 ring-foreground/10">
          ⌘K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1">
        <Link
          to="/alerts"
          aria-label="Alerts"
          className="grid size-9 place-items-center rounded-md text-muted-foreground ring-1 ring-foreground/5 transition-colors hover:bg-accent hover:text-foreground"
        >
          <Bell className="size-4" />
        </Link>
        <Link
          to="/settings"
          aria-label="Settings"
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
  const [scrolled, setScrolled] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Sentinel + IntersectionObserver - scroll container'dan bağımsız çalışır
  // (window scroll, sidebar inset scroll, body scroll - hangisi varsa).
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setScrolled(!entry.isIntersecting),
      { threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [pathname]);

  // Route değişiminde reset (yeni sayfa en üstten başlar).
  useEffect(() => setScrolled(false), [pathname]);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div ref={sentinelRef} className="h-px w-full" aria-hidden />
        <HeaderBar scrolled={scrolled} />
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

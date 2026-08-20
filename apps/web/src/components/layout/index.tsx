import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useGetIdentity, useLogout } from "@refinedev/core";
import { useKBar } from "@refinedev/kbar";
import { Link, Outlet, useLocation } from "react-router";
import {
  Activity,
  Bell,
  ChevronDown,
  ChevronsUpDown,
  FileText,
  Filter,
  History,
  Image as ImageIcon,
  Layers,
  LayoutDashboard,
  LayoutGrid,
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProjectSwitcher } from "./project-switcher";
import { useHelmTheme } from "@/theme/ThemeProvider";
import { useEnabledModules } from "@/hooks/use-enabled-modules";
import type { ModuleKey } from "@/lib/modules";

type IUser = { id: string; name?: string; email?: string };

type NavItem = {
  title: string;
  icon: typeof LayoutDashboard;
  url?: string;
  soon?: boolean;
  // Item bu modüle (veya verilen modüllerden HERHANGI BIRINE) bağlı.
  // Hiçbiri açık değilse sidebar'da gizlenir. requires yoksa her zaman görünür.
  requires?: ModuleKey | ModuleKey[];
  // Tree çocukları - açılır item (Kravio referansı: Tickets > All/My Queue).
  children?: NavItem[];
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
    label: "Main Navigation",
    alwaysVisible: true,
    items: [
      { title: "Cockpit", icon: LayoutDashboard, url: "/" },
      {
        title: "Content",
        icon: Layers,
        requires: "content",
        children: [
          { title: "Schemas", icon: Layers, url: "/cms/collections", requires: "content" },
          { title: "Content", icon: FileText, url: "/cms/entries", requires: "content" },
          { title: "Medya", icon: ImageIcon, url: "/cms/assets", requires: "content" },
        ],
      },
      { title: "Users", icon: Users, url: "/users", requires: "users" },
      { title: "Segmentler", icon: Filter, url: "/segments", requires: "users" },
      { title: "Yorumlar", icon: Star, url: "/reviews", requires: "reviews" },
      { title: "Intervention history", icon: History, url: "/audit" },
    ],
  },
  {
    label: "Analytics & Insights",
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
    label: "Messaging",
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
    label: "Support",
    alwaysVisible: true,
    items: [{ title: "Settings", icon: Settings, url: "/settings" }],
  },
];

function itemVisible(item: NavItem, enabled: ModuleKey[]): boolean {
  if (item.children) {
    return item.children.some((c) => itemVisible(c, enabled));
  }
  if (!item.requires) return true;
  const reqs = Array.isArray(item.requires) ? item.requires : [item.requires];
  return reqs.some((r) => enabled.includes(r));
}

/* Kravio aktif item stili: beyaz kart + ince border + minik gölge.
   Pasif item: soluk metin, hover'da hafif zemin. */
const NAV_BUTTON_CLASS = cn(
  "h-9 rounded-lg px-2.5 text-[13px] text-muted-foreground transition-colors",
  "hover:bg-card hover:text-foreground",
  "data-[active=true]:bg-card data-[active=true]:text-foreground",
  "data-[active=true]:font-medium data-[active=true]:shadow-[0_1px_2px_rgba(16,17,20,0.06)]",
  "data-[active=true]:ring-1 data-[active=true]:ring-border",
);

/** Sidebar içi arama - kbar'ı tetikler (Kravio: arama sidebar'da, ⌘K). */
const SidebarSearch = () => {
  const { query } = useKBar();
  return (
    <button
      type="button"
      onClick={() => query.toggle()}
      className="mx-2 flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-2.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground group-data-[collapsible=icon]:hidden"
    >
      <Search className="size-4 shrink-0" />
      <span className="flex-1 truncate text-left">Search anything</span>
      <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
        ⌘K
      </kbd>
    </button>
  );
};

/** Logo satırı + collapse butonu (Kravio üst bloğu). */
const SidebarLogo = () => (
  <div className="flex items-center gap-2 px-2 pt-1">
    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
      <span className="text-sm font-bold">H</span>
    </div>
    <span className="flex-1 truncate text-[15px] font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
      Helm
    </span>
    <SidebarTrigger className="text-muted-foreground group-data-[collapsible=icon]:hidden" />
  </div>
);

/** Footer user kartı: avatar + online dot + isim + email (Kravio alt bloğu). */
const NavUser = () => {
  const { data: user } = useGetIdentity<IUser>();
  const { mutate: logout } = useLogout();
  const { theme, toggleMode } = useHelmTheme();
  const isDark = theme.mode === "dark";

  const name = user?.name ?? "Misafir";
  const initial = name[0]?.toUpperCase() ?? "?";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="h-14 rounded-xl border border-border bg-card px-2.5 shadow-[0_1px_2px_rgba(16,17,20,0.04)] data-[state=open]:bg-card"
            >
              <span className="relative">
                <Avatar className="size-8 rounded-full">
                  <AvatarFallback className="rounded-full bg-primary text-primary-foreground text-xs">
                    {initial}
                  </AvatarFallback>
                </Avatar>
                <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-card bg-emerald-500" />
              </span>
              <span className="grid flex-1 text-left leading-tight">
                <span className="truncate text-[13px] font-semibold">{name}</span>
                {user?.email && (
                  <span className="truncate text-[11px] text-muted-foreground">
                    {user.email}
                  </span>
                )}
              </span>
              <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <DropdownMenuItem onClick={toggleMode}>
              {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
              {isDark ? "Light mode" : "Dark mode"}
            </DropdownMenuItem>
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

/** Tree item - açılır ebeveyn + SidebarMenuSub çocuklar (bağlantı çizgili). */
const NavTreeItem = ({
  item,
  enabled,
  isActive,
}: {
  item: NavItem;
  enabled: ModuleKey[];
  isActive: (url: string) => boolean;
}) => {
  const children = (item.children ?? []).filter((c) => itemVisible(c, enabled));
  const childActive = children.some((c) => c.url && isActive(c.url));
  const [open, setOpen] = useState(childActive);

  // Route değişiminde aktif çocuğun ebeveyni açık kalsın.
  useEffect(() => {
    if (childActive) setOpen(true);
  }, [childActive]);

  const Icon = item.icon;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={() => setOpen((o) => !o)}
        isActive={childActive && !open}
        className={NAV_BUTTON_CLASS}
        tooltip={item.title}
      >
        <Icon />
        <span>{item.title}</span>
        <ChevronDown
          className={cn(
            "ml-auto size-4 text-muted-foreground/70 transition-transform",
            open && "rotate-180",
          )}
        />
      </SidebarMenuButton>
      {open && (
        <SidebarMenuSub className="mr-0 border-border">
          {children.map((child) => (
            <SidebarMenuSubItem key={child.title}>
              <SidebarMenuSubButton
                asChild
                isActive={child.url ? isActive(child.url) : false}
                className="h-8 rounded-lg text-[13px] text-muted-foreground data-[active=true]:bg-card data-[active=true]:font-medium data-[active=true]:text-foreground data-[active=true]:ring-1 data-[active=true]:ring-border"
              >
                <Link to={child.url ?? "#"}>
                  <span>{child.title}</span>
                </Link>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      )}
    </SidebarMenuItem>
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
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarHeader className="gap-3 pb-1">
        <SidebarLogo />
        <SidebarSearch />
        <ProjectSwitcher />
      </SidebarHeader>

      <SidebarContent>
        {visibleGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {group.items.map((item) => {
                  if (item.children) {
                    return (
                      <NavTreeItem
                        key={item.title}
                        item={item}
                        enabled={enabledModules}
                        isActive={isActive}
                      />
                    );
                  }
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
                        className={NAV_BUTTON_CLASS}
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

      <SidebarFooter className="pb-3">
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
};

/** Aktif route'a göre breadcrumb (grup + sayfa) - NAV_GROUPS'tan. */
const useBreadcrumb = (): { group: string; page: string } => {
  const { pathname } = useLocation();
  return useMemo(() => {
    if (pathname === "/") return { group: "Main Navigation", page: "Cockpit" };
    for (const g of NAV_GROUPS) {
      for (const it of g.items) {
        if (it.url && it.url !== "/" && pathname.startsWith(it.url)) {
          return { group: g.label, page: it.title };
        }
        for (const child of it.children ?? []) {
          if (child.url && pathname.startsWith(child.url)) {
            return { group: it.title, page: child.title };
          }
        }
      }
    }
    return { group: "", page: "" };
  }, [pathname]);
};

const HeaderBar = ({ scrolled }: { scrolled: boolean }) => {
  const { group, page } = useBreadcrumb();
  return (
    <header
      data-slot="helm-header"
      data-scrolled={scrolled ? "true" : "false"}
      className={cn(
        "sticky top-0 z-10 flex h-14 items-center gap-2 px-4 transition-colors duration-200 lg:px-6",
        scrolled ? "border-b border-border" : "border-b border-transparent",
      )}
    >
      <SidebarTrigger className="md:hidden" />

      {/* Breadcrumb: grid ikon + grup / sayfa (Kravio üst şeridi) */}
      <div className="flex min-w-0 items-center gap-2 text-sm">
        <LayoutGrid className="size-4 shrink-0 text-muted-foreground" />
        {group && (
          <>
            <span className="truncate text-muted-foreground">{group}</span>
            <span className="text-muted-foreground/50">/</span>
          </>
        )}
        <span className="truncate font-semibold">{page}</span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Link
          to="/alerts"
          aria-label="Alerts"
          className="grid size-9 place-items-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
        >
          <Bell className="size-4" />
        </Link>
        <Link
          to="/settings"
          aria-label="Settings"
          className="grid size-9 place-items-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
        >
          <Settings className="size-4" />
        </Link>
      </div>
    </header>
  );
};

export const HelmLayout = () => {
  const { pathname } = useLocation();
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
        <main className="min-h-0 flex-1 p-4 pt-2 lg:px-6">
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

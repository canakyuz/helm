import { Suspense } from "react";
import { useGetIdentity, useLogout, useMenu } from "@refinedev/core";
import { Link, Outlet } from "react-router";
import {
  Check,
  ChevronsUpDown,
  Loader2,
  LogOut,
  Palette,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
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
import { useHelmTheme } from "@/theme/ThemeProvider";

type IUser = { id: string; name?: string };

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
              <DropdownMenuItem key={t.key} onClick={() => setThemeKey(t.key)}>
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
  const { menuItems, selectedKey } = useMenu();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/">
                <span className="flex aspect-square size-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
                  h
                </span>
                <span className="text-lg font-semibold tracking-tight">
                  helm
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.key}>
                  <SidebarMenuButton
                    asChild
                    isActive={item.key === selectedKey}
                    tooltip={item.label as string}
                  >
                    <Link to={item.route ?? "/"}>
                      {item.icon}
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
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

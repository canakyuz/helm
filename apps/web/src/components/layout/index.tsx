import { useGetIdentity, useMenu } from "@refinedev/core";
import { Link, Outlet } from "react-router";
import { Check, Palette } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
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
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useHelmTheme } from "@/theme/ThemeProvider";

type IUser = { id: string; name?: string };

const AppSidebar = () => {
  const { menuItems, selectedKey } = useMenu();

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="px-2 py-1.5 text-lg font-semibold tracking-tight text-primary">
          helm
        </div>
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
      <SidebarRail />
    </Sidebar>
  );
};

const HeaderBar = () => {
  const { data: user } = useGetIdentity<IUser>();
  const { themeKey, setThemeKey, themes } = useHelmTheme();

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur">
      <SidebarTrigger />
      <div className="flex-1" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <Palette className="size-4" /> Tema
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
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
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="flex items-center gap-2">
        {user?.name && (
          <span className="text-sm text-muted-foreground">{user.name}</span>
        )}
        <Avatar className="size-7">
          <AvatarFallback className="bg-primary text-primary-foreground text-xs">
            {user?.name?.[0]?.toUpperCase() ?? "?"}
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
};

export const HelmLayout = () => (
  <SidebarProvider>
    <AppSidebar />
    <SidebarInset>
      <HeaderBar />
      <main className="p-4 lg:p-6">
        <Outlet />
      </main>
    </SidebarInset>
  </SidebarProvider>
);

import { useList, useNavigation } from "@refinedev/core";
import { Boxes, ChevronsUpDown, Pencil, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useScope } from "@/context/scope";
import type { Project } from "@/types";

// Sidebar üstündeki kapsam seçici — "Tüm Projeler" + projeler + proje ekle.
export const ProjectSwitcher = () => {
  const { scope, setScope } = useScope();
  const { create, edit } = useNavigation();
  const { result } = useList<Project>({
    resource: "projects",
    pagination: { mode: "off" },
  });
  const projects = result.data;

  const active = scope === "all" ? null : projects.find((p) => p.id === scope);
  const label = active?.name ?? "Tüm Projeler";
  const sub =
    scope === "all" ? `${projects.length} proje` : "tek proje görünümü";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Boxes className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{label}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {sub}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-60" align="start">
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Kapsam
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setScope("all")}>
              <Boxes className="size-4" /> Tüm Projeler
            </DropdownMenuItem>
            {projects.map((p) => (
              <DropdownMenuItem
                key={p.id}
                onClick={() => setScope(p.id as string)}
                className="group flex items-center justify-between gap-2"
              >
                <span className="flex flex-1 items-center gap-2 truncate">
                  <span className="size-4" />
                  <span className="truncate">{p.name}</span>
                </span>
                <button
                  type="button"
                  aria-label={`${p.name} projesini düzenle`}
                  onClick={(e) => {
                    e.stopPropagation();
                    edit("projects", p.id as string);
                  }}
                  className="rounded p-1 text-muted-foreground opacity-0 transition hover:bg-muted hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <Pencil className="size-3.5" />
                </button>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => create("projects")}>
              <Plus className="size-4" /> Proje ekle
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
};

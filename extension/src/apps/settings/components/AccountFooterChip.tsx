import { useEffect, useState } from "react";
import { i18n } from "#i18n";
import { Avatar, AvatarFallback, AvatarImage } from "@ui/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@ui/components/ui/dropdown-menu";
import { SidebarMenuButton, useSidebar } from "@ui/components/ui/sidebar";
import { Icons } from "@ui/components/icons";
import { useLockFn } from "@ui/hooks/use-lock-fn";
import { initAuth, signOut, subscribeAuthState, type AuthState } from "@shared/auth/index.js";
import { toast } from "sonner";

function deriveDisplay(state: AuthState): {
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  initial: string;
} {
  if (state.status === "signed-in") {
    const { email, displayName, avatarUrl } = state.identity;
    const seed = displayName ?? email ?? "";
    const initial = seed ? seed.charAt(0).toUpperCase() : "?";
    return { email, displayName, avatarUrl, initial };
  }
  return { email: null, displayName: null, avatarUrl: null, initial: "?" };
}

function openLogin() {
  const url = chrome.runtime.getURL("/login.html");
  void chrome.tabs.create({ url });
}

/**
 * Bottom-of-sidebar account switcher. It only ever does two things: show the
 * signed-in account, or — when signed out — get you signed in in one click.
 * Account *settings* live in the sidebar nav (the "Account" page), not here.
 */
export function AccountFooterChip() {
  const [state, setState] = useState<AuthState>({ status: "signed-out" });
  const { isMobile } = useSidebar();

  useEffect(() => {
    let active = true;
    void initAuth().then((s) => {
      if (active) setState(s);
    });
    const unsub = subscribeAuthState((next) => {
      if (active) setState(next);
    });
    return () => {
      active = false;
      unsub();
    };
  }, []);

  const handleSignOut = useLockFn(async () => {
    try {
      await signOut();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : i18n.t("accountFooter.signOutFailed"));
    }
  });

  // Signed out: a single, instant tap that opens the sign-in page — no menu.
  if (state.status !== "signed-in") {
    return (
      <SidebarMenuButton
        size="lg"
        tooltip={i18n.t("accountFooter.signIn")}
        onClick={openLogin}
        className="press-feedback"
      >
        <Avatar>
          <AvatarFallback className="text-xs">
            <Icons.User className="size-4" aria-hidden />
          </AvatarFallback>
        </Avatar>
        <div className="grid flex-1 text-left text-sm leading-tight">
          <span className="truncate font-medium">{i18n.t("accountFooter.signIn")}</span>
          <span className="text-muted-foreground truncate text-xs">
            {i18n.t("accountFooter.notSignedIn")}
          </span>
        </div>
        <Icons.ExternalLink className="ml-auto size-4 opacity-70" />
      </SidebarMenuButton>
    );
  }

  const { email, displayName, avatarUrl, initial } = deriveDisplay(state);
  const primaryLabel = displayName ?? email ?? i18n.t("accountFooter.signedIn");
  const secondaryLabel = email ?? i18n.t("accountFooter.account");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          size="lg"
          tooltip={primaryLabel}
          className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
        >
          <Avatar>
            {avatarUrl ? <AvatarImage src={avatarUrl} alt={primaryLabel} /> : null}
            <AvatarFallback className="text-xs">{initial}</AvatarFallback>
          </Avatar>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-medium">{primaryLabel}</span>
            <span className="text-muted-foreground truncate text-xs">{secondaryLabel}</span>
          </div>
          <Icons.ChevronUp className="ml-auto size-4 opacity-70" />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={isMobile ? "bottom" : "right"}
        align="end"
        sideOffset={4}
        className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
      >
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-2 px-2 py-1.5 text-left text-sm">
            <Avatar>
              {avatarUrl ? <AvatarImage src={avatarUrl} alt={primaryLabel} /> : null}
              <AvatarFallback className="text-xs">{initial}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 leading-tight">
              <span className="truncate font-medium">{primaryLabel}</span>
              <span className="text-muted-foreground truncate text-xs">{secondaryLabel}</span>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void handleSignOut()}>
          <Icons.X />
          {i18n.t("accountFooter.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

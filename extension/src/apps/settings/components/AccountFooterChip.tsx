import { useEffect, useState } from "react";
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
import {
  initAuth,
  signOut,
  subscribeAuthState,
  type AuthState,
} from "@shared/auth/auth-orchestrator.js";
import { toast } from "sonner";

type Props = {
  onOpenAccount: () => void;
};

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

export function AccountFooterChip({ onOpenAccount }: Props) {
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
      toast.error(err instanceof Error ? err.message : "Sign out failed");
    }
  });

  const isSignedIn = state.status === "signed-in";
  const { email, displayName, avatarUrl, initial } = deriveDisplay(state);
  const primaryLabel = isSignedIn ? (displayName ?? email ?? "Signed in") : "Sign in";
  const secondaryLabel = isSignedIn ? (email ?? "Account") : "Not signed in";

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
        <DropdownMenuItem onSelect={onOpenAccount}>
          <Icons.Settings />
          {isSignedIn ? "Account settings" : "Sign in"}
        </DropdownMenuItem>
        {isSignedIn ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void handleSignOut()}>
              <Icons.X />
              Sign out
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

"use client";

import { cn } from "@/lib/utils";
import Link, { type LinkProps } from "next/link";
import React, { createContext, useContext, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Menu, X } from "lucide-react";

interface Links {
  label: string;
  href: string;
  icon: React.JSX.Element | React.ReactNode;
}

interface SidebarContextProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  animate: boolean;
}

const SidebarContext = createContext<SidebarContextProps | undefined>(undefined);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
};

export const SidebarProvider = ({
  children,
  open: openProp,
  setOpen: setOpenProp,
  animate = true
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  const [openState, setOpenState] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  const open = openProp !== undefined ? openProp : openState;
  const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState;
  const resolvedAnimate = animate && !prefersReducedMotion;

  return (
    <SidebarContext.Provider value={{ open, setOpen, animate: resolvedAnimate }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const Sidebar = ({
  children,
  open,
  setOpen,
  animate
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  return (
    <SidebarProvider open={open} setOpen={setOpen} animate={animate}>
      {children}
    </SidebarProvider>
  );
};

type SidebarBodyProps = React.ComponentProps<typeof motion.div> & {
  showMobile?: boolean;
};

export const SidebarBody = ({ showMobile = true, ...props }: SidebarBodyProps) => {
  return (
    <>
      <DesktopSidebar {...props} />
      {showMobile ? <MobileSidebar {...(props as React.ComponentProps<"div">)} /> : null}
    </>
  );
};

export const DesktopSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<typeof motion.div>) => {
  const { open, setOpen, animate } = useSidebar();
  return (
    <motion.div
      className={cn(
        "hidden h-full flex-shrink-0 border-r border-border/60 bg-surface/95 px-4 py-4 lg:flex lg:flex-col",
        className
      )}
      animate={{
        width: animate ? (open ? "280px" : "72px") : "280px"
      }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export const MobileSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) => {
  const { open, setOpen } = useSidebar();
  const prefersReducedMotion = useReducedMotion();
  const openEase: [number, number, number, number] = [0.16, 1, 0.3, 1];
  const transition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.3, ease: openEase };
  const panelId = "mobile-sidebar-panel";
  return (
    <>
      <div
        className={cn(
          "flex h-12 w-full items-center justify-between border-b border-border/60 bg-bg/95 px-4 lg:hidden",
          className
        )}
        {...props}
      >
        <div className="flex w-full justify-end">
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={open ? "Close menu" : "Open menu"}
            className="rounded-full p-2 text-ink transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <AnimatePresence>
          {open ? (
            <motion.div
              initial={{ x: "-100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "-100%", opacity: 0 }}
              transition={transition}
              id={panelId}
              role="dialog"
              aria-modal="true"
              className="fixed inset-0 z-[100] flex h-full flex-col justify-between bg-bg/95 p-8"
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="absolute right-8 top-8 z-50 rounded-full p-2 text-ink transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
              {children}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </>
  );
};

export const SidebarLink = ({
  link,
  className,
  ...props
}: {
  link: Links;
  className?: string;
  props?: LinkProps;
}) => {
  const { open, animate } = useSidebar();
  return (
    <Link
      href={link.href}
      className={cn(
        "group/sidebar flex items-center justify-start gap-2 rounded-lg px-3 py-2 text-sm font-medium text-ink-muted transition hover:bg-surface-high hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        className
      )}
      aria-label={link.label}
      {...props}
    >
      {link.icon}
      <motion.span
        animate={{
          display: animate ? (open ? "inline-block" : "none") : "inline-block",
          opacity: animate ? (open ? 1 : 0) : 1
        }}
        className="whitespace-pre text-sm transition duration-150 group-hover/sidebar:translate-x-1"
      >
        {link.label}
      </motion.span>
    </Link>
  );
};

"use client";

import { cn } from "@/lib/utils";
import Link, { LinkProps } from "next/link";
import React, { useState, createContext, useContext } from "react";
import { AnimatePresence, motion } from "motion/react";
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

type SidebarVariant = "animated" | "static";

const SidebarContext = createContext<SidebarContextProps | undefined>(
  undefined,
);

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
  variant = "animated",
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  variant?: SidebarVariant;
}) => {
  const [openState, setOpenState] = useState(false);

  const open = openProp !== undefined ? openProp : openState;
  const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState;
  const animate = variant === "animated";

  return (
    <SidebarContext.Provider value={{ open, setOpen, animate }}>
      {children}
    </SidebarContext.Provider>
  );
};

type SidebarShellProps = {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
};

export const SidebarStatic = ({
  children,
  open,
  setOpen,
}: SidebarShellProps) => {
  return (
    <SidebarProvider open={open} setOpen={setOpen} variant="static">
      {children}
    </SidebarProvider>
  );
};

type SidebarComponent = React.FC<SidebarShellProps> & {
  Static: typeof SidebarStatic;
};

export const Sidebar = (({ children, open, setOpen }: SidebarShellProps) => (
  <SidebarProvider open={open} setOpen={setOpen} variant="animated">
    {children}
  </SidebarProvider>
)) as SidebarComponent;

Sidebar.Static = SidebarStatic;

export const SidebarBody = (props: React.ComponentProps<typeof motion.div>) => {
  return (
    <>
      <DesktopSidebar {...props} />
      <MobileSidebar {...(props as React.ComponentProps<"div">)} />
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
        "h-screen sticky top-0 px-4 py-4 hidden md:flex md:flex-col bg-surface/95 border-r border-border/60 flex-shrink-0 overflow-hidden",
        className,
      )}
      initial={false}
      animate={{
        width: animate ? (open ? "240px" : "72px") : "240px",
      }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
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
  return (
    <>
      <div
        className={cn(
          "h-12 px-4 py-2 flex flex-row md:hidden items-center justify-between bg-surface/95 border-b border-border/60 w-full",
        )}
        {...props}
      >
        <div className="flex justify-end z-20 w-full">
          <Menu
            className="text-ink cursor-pointer h-5 w-5"
            onClick={() => setOpen(!open)}
          />
        </div>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ x: "-100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "-100%", opacity: 0 }}
              transition={{
                duration: 0.3,
                ease: "easeInOut",
              }}
              className={cn(
                "fixed h-full w-full inset-0 bg-bg p-10 z-[100] flex flex-col justify-between",
                className,
              )}
            >
              <div
                className="absolute right-10 top-10 z-50 text-ink cursor-pointer"
                onClick={() => setOpen(!open)}
              >
                <X className="h-5 w-5" />
              </div>
              {children}
            </motion.div>
          )}
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
        "flex items-center justify-start gap-3 group/sidebar py-2 px-2 rounded-xl transition hover:bg-surface-high",
        className,
      )}
      {...props}
    >
      {link.icon}
      <span
        className={cn(
          "text-ink text-sm group-hover/sidebar:translate-x-1 transition-all duration-200 whitespace-pre inline-block !p-0 !m-0 lowercase",
          animate && !open ? "opacity-0 w-0 overflow-hidden" : "opacity-100",
        )}
      >
        {link.label}
      </span>
    </Link>
  );
};

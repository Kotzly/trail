"use client";

import { cn } from "@/lib/utils";
import Link, { type LinkProps } from "next/link";
import React, { createContext, useContext, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
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

  const open = openProp !== undefined ? openProp : openState;
  const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState;

  return (
    <SidebarContext.Provider value={{ open, setOpen, animate }}>
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
          "flex h-12 w-full items-center justify-between border-b border-border/60 bg-bg/95 px-4 lg:hidden",
          className
        )}
        {...props}
      >
        <div className="flex w-full justify-end">
          <Menu
            className="h-5 w-5 cursor-pointer text-ink"
            onClick={() => setOpen(!open)}
          />
        </div>
        <AnimatePresence>
          {open ? (
            <motion.div
              initial={{ x: "-100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "-100%", opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="fixed inset-0 z-[100] flex h-full flex-col justify-between bg-bg/95 p-8 backdrop-blur-lg"
            >
              <div
                className="absolute right-8 top-8 z-50 cursor-pointer text-ink"
                onClick={() => setOpen(!open)}
              >
                <X />
              </div>
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
        "group/sidebar flex items-center justify-start gap-2 rounded-lg px-3 py-2 text-sm font-medium text-ink-muted transition hover:bg-surface-high hover:text-ink",
        className
      )}
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

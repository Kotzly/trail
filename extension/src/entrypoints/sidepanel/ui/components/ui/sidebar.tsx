import { cn } from "../../lib/utils.js";
import { AnimatePresence, motion } from "motion/react";
import { Menu, X } from "lucide-react";
import React, { createContext, useContext, useState } from "react";
import { getSidebarLabelState, getSidebarWidth } from "./sidebar-utils";

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
  animate = true,
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
    <SidebarContext.Provider value={{ open, setOpen, animate }}>{children}</SidebarContext.Provider>
  );
};

export const Sidebar = ({
  children,
  open,
  setOpen,
  animate,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  const providerProps: {
    children: React.ReactNode;
    open?: boolean;
    setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
    animate?: boolean;
  } = { children };

  if (open !== undefined) {
    providerProps.open = open;
  }

  if (setOpen !== undefined) {
    providerProps.setOpen = setOpen;
  }

  if (animate !== undefined) {
    providerProps.animate = animate;
  }

  return <SidebarProvider {...providerProps} />;
};

type SidebarBodyProps = Omit<React.ComponentProps<typeof motion.div>, "children"> & {
  children?: React.ReactNode;
  showMobile?: boolean;
  forceDesktop?: boolean;
};

export const SidebarBody = (props: SidebarBodyProps) => {
  const { className, children, showMobile = true, forceDesktop = false, ...rest } = props;
  const desktopClassName = cn(forceDesktop ? "flex flex-col" : undefined, className);

  return (
    <>
      <DesktopSidebar className={desktopClassName} {...rest}>
        {children}
      </DesktopSidebar>
      {showMobile ? <MobileSidebar className={className}>{children}</MobileSidebar> : null}
    </>
  );
};

export const DesktopSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<typeof motion.div>) => {
  const { open, setOpen, animate } = useSidebar();
  const width = getSidebarWidth(open, animate);

  return (
    <motion.div
      className={cn(
        "flex h-full w-[180px] flex-shrink-0 flex-col bg-neutral-100 px-4 py-4 dark:bg-neutral-800",
        className,
      )}
      animate={{
        width,
      }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      onMouseLeave={() => setOpen(false)}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export const MobileSidebar = ({ className, children, ...props }: React.ComponentProps<"div">) => {
  const { open, setOpen } = useSidebar();
  return (
    <>
      <div
        className={cn(
          "flex h-10 w-full flex-row items-center justify-between bg-neutral-100 px-4 py-4 md:hidden dark:bg-neutral-800",
        )}
        {...props}
      >
        <div className="z-20 flex w-full justify-end">
          <Menu
            className="cursor-pointer text-neutral-800 dark:text-neutral-200"
            onClick={() => setOpen(!open)}
          />
        </div>
        <AnimatePresence>
          {open ? (
            <motion.div
              initial={{ x: "-100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "-100%", opacity: 0 }}
              transition={{
                duration: 0.3,
                ease: "easeInOut",
              }}
              className={cn(
                "fixed inset-0 z-[100] flex h-full w-full flex-col justify-between bg-white p-10 dark:bg-neutral-900",
                className,
              )}
            >
              <div
                className="absolute top-10 right-10 z-50 cursor-pointer text-neutral-800 dark:text-neutral-200"
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

type SidebarLinkProps = React.ComponentProps<"a"> & {
  link: Links;
  className?: string;
};

export const SidebarLink = ({ link, className, ...props }: SidebarLinkProps) => {
  const { open, animate } = useSidebar();
  const labelState = getSidebarLabelState(open, animate);

  return (
    <a
      href={link.href}
      className={cn("group/sidebar flex items-center justify-start gap-2 py-2", className)}
      {...props}
    >
      {link.icon}
      <motion.span
        animate={labelState}
        className="!m-0 inline-block !p-0 text-sm whitespace-pre text-neutral-700 transition duration-150 group-hover/sidebar:translate-x-1 dark:text-neutral-200"
      >
        {link.label}
      </motion.span>
    </a>
  );
};

import { cn } from '../../lib/utils.js';
import { AnimatePresence, motion } from 'motion/react';
import { Menu, X } from 'lucide-react';
import React, { createContext, useContext, useState } from 'react';
import { getSidebarLabelState, getSidebarWidth } from './sidebar-utils';

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
    throw new Error('useSidebar must be used within a SidebarProvider');
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

  return (
    <SidebarProvider {...providerProps} />
  );
};

type SidebarBodyProps = Omit<React.ComponentProps<typeof motion.div>, 'children'> & {
  children?: React.ReactNode;
  showMobile?: boolean;
  forceDesktop?: boolean;
};

export const SidebarBody = (props: SidebarBodyProps) => {
  const { className, children, showMobile = true, forceDesktop = false, ...rest } = props;
  const desktopClassName = cn(forceDesktop ? 'flex flex-col' : undefined, className);

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
        'h-full px-4 py-4 flex flex-col bg-neutral-100 dark:bg-neutral-800 w-[180px] flex-shrink-0',
        className
      )}
      animate={{
        width
      }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
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
}: React.ComponentProps<'div'>) => {
  const { open, setOpen } = useSidebar();
  return (
    <>
      <div
        className={cn(
          'h-10 px-4 py-4 flex flex-row md:hidden items-center justify-between bg-neutral-100 dark:bg-neutral-800 w-full'
        )}
        {...props}
      >
        <div className='flex justify-end z-20 w-full'>
          <Menu
            className='text-neutral-800 dark:text-neutral-200 cursor-pointer'
            onClick={() => setOpen(!open)}
          />
        </div>
        <AnimatePresence>
          {open ? (
            <motion.div
              initial={{ x: '-100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '-100%', opacity: 0 }}
              transition={{
                duration: 0.3,
                ease: 'easeInOut'
              }}
              className={cn(
                'fixed h-full w-full inset-0 bg-white dark:bg-neutral-900 p-10 z-[100] flex flex-col justify-between',
                className
              )}
            >
              <div
                className='absolute right-10 top-10 z-50 text-neutral-800 dark:text-neutral-200 cursor-pointer'
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

type SidebarLinkProps = React.ComponentProps<'a'> & {
  link: Links;
  className?: string;
};

export const SidebarLink = ({ link, className, ...props }: SidebarLinkProps) => {
  const { open, animate } = useSidebar();
  const labelState = getSidebarLabelState(open, animate);

  return (
    <a
      href={link.href}
      className={cn('flex items-center justify-start gap-2 group/sidebar py-2', className)}
      {...props}
    >
      {link.icon}
      <motion.span
        animate={labelState}
        className='text-neutral-700 dark:text-neutral-200 text-sm group-hover/sidebar:translate-x-1 transition duration-150 whitespace-pre inline-block !p-0 !m-0'
      >
        {link.label}
      </motion.span>
    </a>
  );
};

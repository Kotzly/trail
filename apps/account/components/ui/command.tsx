"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { cn } from "@/lib/utils";

const Command = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground",
        className,
      )}
      {...props}
    />
  ),
);
Command.displayName = "Command";

type CommandDialogProps = React.ComponentProps<typeof Dialog>;

const CommandDialog = ({ children, ...props }: CommandDialogProps) => (
  <Dialog {...props}>
    <DialogContent className="overflow-hidden p-0 shadow-lg">
      <VisuallyHidden.Root>
        <DialogTitle>Command</DialogTitle>
      </VisuallyHidden.Root>
      <Command className="[&_[data-command-group-heading]]:px-2 [&_[data-command-group-heading]]:font-medium [&_[data-command-group-heading]]:text-muted-foreground [&_[data-command-group]]:px-2 [&_[data-command-item]]:px-2 [&_[data-command-item]]:py-3">
        {children}
      </Command>
    </DialogContent>
  </Dialog>
);

const CommandInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <div className="flex items-center border-b px-3">
    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
    <input
      ref={ref}
      className={cn(
        "flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  </div>
));
CommandInput.displayName = "CommandInput";

const CommandList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("max-h-[300px] overflow-y-auto overflow-x-hidden", className)}
      {...props}
    />
  ),
);
CommandList.displayName = "CommandList";

const CommandEmpty = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  (props, ref) => <div ref={ref} className="py-6 text-center text-sm" {...props} />,
);
CommandEmpty.displayName = "CommandEmpty";

const CommandGroup = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-command-group=""
      className={cn(
        "overflow-hidden p-1 text-foreground [&_[data-command-group-heading]]:px-2 [&_[data-command-group-heading]]:py-1.5 [&_[data-command-group-heading]]:text-xs [&_[data-command-group-heading]]:font-medium [&_[data-command-group-heading]]:text-muted-foreground",
        className,
      )}
      {...props}
    />
  ),
);
CommandGroup.displayName = "CommandGroup";

const CommandSeparator = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("-mx-1 h-px bg-border", className)} {...props} />
  ),
);
CommandSeparator.displayName = "CommandSeparator";

const CommandItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-command-item=""
      className={cn(
        "relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
        className,
      )}
      {...props}
    />
  ),
);
CommandItem.displayName = "CommandItem";

const CommandShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => (
  <span className={cn("ml-auto text-xs tracking-widest text-muted-foreground", className)} {...props} />
);

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
};

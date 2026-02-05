import * as React from "react";
import { cn } from "../utils/cn";

export type TableProps = React.TableHTMLAttributes<HTMLTableElement>;

const TableRoot = ({ className, ...props }: TableProps) => {
  return (
    <div className="w-full overflow-hidden rounded-2xl border border-border/60 bg-surface/70">
      <table className={cn("w-full text-sm", className)} {...props} />
    </div>
  );
};

export type TableSectionProps =
  React.HTMLAttributes<HTMLTableSectionElement>;

const TableHead = ({ className, ...props }: TableSectionProps) => {
  return (
    <thead
      className={cn("bg-surface-high/60 text-xs text-ink-muted", className)}
      {...props}
    />
  );
};

const TableBody = ({ className, ...props }: TableSectionProps) => {
  return (
    <tbody className={cn("divide-y divide-border/40", className)} {...props} />
  );
};

export type TableRowProps = React.HTMLAttributes<HTMLTableRowElement>;

const TableRow = ({ className, ...props }: TableRowProps) => {
  return <tr className={cn("border-border/40", className)} {...props} />;
};

export type TableCellProps = React.TdHTMLAttributes<HTMLTableCellElement>;

const TableCell = ({ className, ...props }: TableCellProps) => {
  return <td className={cn("px-4 py-3 text-ink", className)} {...props} />;
};

export type TableHeaderCellProps =
  React.ThHTMLAttributes<HTMLTableCellElement>;

const TableHeaderCell = ({ className, ...props }: TableHeaderCellProps) => {
  return (
    <th
      className={cn(
        "px-4 py-3 text-left font-semibold uppercase tracking-wide text-ink-subtle",
        className
      )}
      {...props}
    />
  );
};

export type TableComponent = typeof TableRoot & {
  Head: typeof TableHead;
  Body: typeof TableBody;
  Row: typeof TableRow;
  Cell: typeof TableCell;
  HeaderCell: typeof TableHeaderCell;
};

export const Table = Object.assign(TableRoot, {
  Head: TableHead,
  Body: TableBody,
  Row: TableRow,
  Cell: TableCell,
  HeaderCell: TableHeaderCell,
}) as TableComponent;

Table.displayName = "Table";

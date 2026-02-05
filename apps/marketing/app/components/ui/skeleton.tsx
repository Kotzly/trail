"use client";

import { cn } from "@trail/ui";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn("animate-pulse rounded-xl bg-surface-strong/60", className)}
    />
  );
}

// Pre-built skeleton patterns
export function SkeletonCard({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-stroke/40 bg-surface/50 p-6",
        className,
      )}
    >
      <Skeleton className="h-12 w-12 rounded-2xl" />
      <Skeleton className="mt-4 h-6 w-3/4" />
      <Skeleton className="mt-2 h-4 w-full" />
      <Skeleton className="mt-2 h-4 w-2/3" />
    </div>
  );
}

export function SkeletonHero() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-16 text-center">
      <Skeleton className="mx-auto h-8 w-32 rounded-full" />
      <Skeleton className="mx-auto mt-6 h-16 w-3/4 max-w-2xl" />
      <Skeleton className="mx-auto mt-4 h-6 w-2/3 max-w-xl" />
      <div className="mt-8 flex justify-center gap-4">
        <Skeleton className="h-12 w-32 rounded-full" />
        <Skeleton className="h-12 w-32 rounded-full" />
      </div>
    </div>
  );
}

export function SkeletonStats() {
  return (
    <div className="mt-16 grid grid-cols-2 gap-6 md:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-stroke/40 bg-surface/50 p-6 text-center"
        >
          <Skeleton className="mx-auto h-10 w-20" />
          <Skeleton className="mx-auto mt-2 h-4 w-24" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonPricingCard() {
  return (
    <div className="rounded-3xl border border-stroke/40 bg-surface/50 p-6">
      <Skeleton className="h-10 w-10 rounded-xl" />
      <Skeleton className="mt-4 h-6 w-24" />
      <Skeleton className="mt-2 h-4 w-32" />
      <Skeleton className="mt-6 h-12 w-full rounded-full" />
      <div className="mt-6 space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    </div>
  );
}

export function SkeletonBentoGrid() {
  return (
    <div className="grid auto-rows-[200px] grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 lg:grid-rows-3">
      <Skeleton className="lg:col-start-2 lg:row-start-1 lg:row-end-4" />
      <Skeleton className="lg:col-start-1 lg:row-start-1 lg:row-end-3" />
      <Skeleton className="lg:col-start-1 lg:row-start-3" />
      <Skeleton className="lg:col-start-3 lg:row-start-1 lg:row-end-3" />
      <Skeleton className="lg:col-start-3 lg:row-start-3" />
    </div>
  );
}

export function SkeletonTestimonial() {
  return (
    <div className="rounded-2xl border border-stroke/40 bg-surface/50 p-6">
      <div className="flex gap-1">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-4 w-4 rounded-full" />
        ))}
      </div>
      <Skeleton className="mt-4 h-16 w-full" />
      <div className="mt-6 flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-1 h-3 w-16" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonFAQ() {
  return (
    <div className="space-y-3">
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-stroke/40 bg-surface/50 px-6 py-4"
        >
          <Skeleton className="h-6 w-full" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonImage({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl bg-surface-strong/60",
        className,
      )}
    >
      <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-surface/50 to-transparent skeleton-shimmer" />
    </div>
  );
}

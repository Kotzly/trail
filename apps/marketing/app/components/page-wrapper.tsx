"use client";

import { Suspense, ReactNode } from "react";
import { motion } from "framer-motion";
import { SkeletonHero, SkeletonCard, SkeletonStats, SkeletonPricingCard, SkeletonBentoGrid, SkeletonTestimonial, SkeletonFAQ } from "./ui/skeleton";

interface PageWrapperProps {
  children: ReactNode;
  fallback?: ReactNode;
}

// Generic loading fallback
function DefaultFallback() {
  return (
    <div className="min-h-screen bg-base">
      <div className="h-16 border-b border-stroke/40 bg-base/80" />
      <div className="px-6 py-20">
        <SkeletonHero />
      </div>
    </div>
  );
}

export function PageWrapper({ children, fallback }: PageWrapperProps) {
  return (
    <Suspense fallback={fallback || <DefaultFallback />}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {children}
      </motion.div>
    </Suspense>
  );
}

// Page-specific loading states
export function HomeLoading() {
  return (
    <div className="min-h-screen bg-base">
      <div className="h-16 border-b border-stroke/40 bg-base/80" />
      
      {/* Hero Skeleton */}
      <div className="px-6 pt-20 pb-16">
        <SkeletonHero />
        <SkeletonStats />
      </div>

      {/* Showcase Skeleton */}
      <div className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="aspect-video rounded-[2rem] bg-surface-strong/60" />
        </div>
      </div>

      {/* Features Skeleton */}
      <div className="px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto h-8 w-32 rounded-full bg-surface-strong/60" />
          <div className="mx-auto mt-4 h-10 w-64 rounded-full bg-surface-strong/60" />
          <div className="mt-12">
            <SkeletonBentoGrid />
          </div>
        </div>
      </div>

      {/* CTA Skeleton */}
      <div className="px-6 py-16">
        <div className="mx-auto max-w-4xl rounded-3xl bg-surface-strong/60 p-12" />
      </div>

      <div className="h-20 border-t border-stroke/40 bg-base/80" />
    </div>
  );
}

export function PricingLoading() {
  return (
    <div className="min-h-screen bg-base">
      <div className="h-16 border-b border-stroke/40 bg-base/80" />
      
      <div className="px-6 pt-20 pb-8">
        <SkeletonHero />
      </div>

      <div className="px-6 py-12">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-6 md:grid-cols-3">
            <SkeletonPricingCard />
            <SkeletonPricingCard />
            <SkeletonPricingCard />
          </div>
        </div>
      </div>

      <div className="h-20 border-t border-stroke/40 bg-base/80" />
    </div>
  );
}

export function DownloadsLoading() {
  return (
    <div className="min-h-screen bg-base">
      <div className="h-16 border-b border-stroke/40 bg-base/80" />
      
      <div className="px-6 pt-20 pb-16">
        <SkeletonHero />
        
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>

      <div className="h-20 border-t border-stroke/40 bg-base/80" />
    </div>
  );
}

export function FAQLoading() {
  return (
    <div className="min-h-screen bg-base">
      <div className="h-16 border-b border-stroke/40 bg-base/80" />
      
      <div className="px-6 pt-20 pb-8">
        <SkeletonHero />
      </div>

      <div className="px-6 py-12">
        <div className="mx-auto max-w-3xl">
          <SkeletonFAQ />
        </div>
      </div>

      <div className="h-20 border-t border-stroke/40 bg-base/80" />
    </div>
  );
}

export function SupportLoading() {
  return (
    <div className="min-h-screen bg-base">
      <div className="h-16 border-b border-stroke/40 bg-base/80" />
      
      <div className="px-6 pt-20 pb-8">
        <SkeletonHero />
      </div>

      <div className="px-6 py-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-6 md:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      </div>

      <div className="px-6 py-12">
        <div className="mx-auto max-w-4xl rounded-3xl bg-surface-strong/60 p-8" />
      </div>

      <div className="h-20 border-t border-stroke/40 bg-base/80" />
    </div>
  );
}

export function AboutLoading() {
  return (
    <div className="min-h-screen bg-base">
      <div className="h-16 border-b border-stroke/40 bg-base/80" />
      
      <div className="px-6 pt-20 pb-16">
        <SkeletonHero />
        <SkeletonStats />
      </div>

      <div className="px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-6 md:grid-cols-2">
            {[...Array(4)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      </div>

      <div className="h-20 border-t border-stroke/40 bg-base/80" />
    </div>
  );
}

export function ContactLoading() {
  return (
    <div className="min-h-screen bg-base">
      <div className="h-16 border-b border-stroke/40 bg-base/80" />
      
      <div className="px-6 pt-20 pb-8">
        <SkeletonHero />
      </div>

      <div className="px-6 py-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-6 md:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      </div>

      <div className="px-6 py-12">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-3xl bg-surface-strong/60 p-8">
            <div className="space-y-6">
              <div className="h-6 w-48 rounded-full bg-surface/50" />
              <div className="h-12 w-full rounded-xl bg-surface/50" />
              <div className="h-12 w-full rounded-xl bg-surface/50" />
              <div className="h-32 w-full rounded-xl bg-surface/50" />
              <div className="h-12 w-full rounded-full bg-surface/50" />
            </div>
          </div>
        </div>
      </div>

      <div className="h-20 border-t border-stroke/40 bg-base/80" />
    </div>
  );
}

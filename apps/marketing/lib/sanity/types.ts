/**
 * Typed Sanity section schemas for the marketing site.
 * These mirror the Sanity schema definitions in /sanity/schemaTypes/sections/.
 */

export type SanityCtaBlock = {
  _key: string;
  text: string;
  href: string;
  variant?: "primary" | "secondary" | "ghost";
};

export type SanityImage = {
  asset?: { url?: string; _ref?: string };
};

export type SanityFile = {
  asset?: { url?: string; _ref?: string };
};

export type HeroSectionData = {
  _type: "heroSection";
  _key: string;
  eyebrow?: string;
  title: string;
  rotatingWords?: string[];
  description?: string;
  ctas?: SanityCtaBlock[];
  video?: SanityFile;
  poster?: SanityImage;
};

export type BentoFeature = {
  _key: string;
  id?: string;
  name: string;
  description?: string;
  icon?: string;
  href?: string;
  cta?: string;
  className?: string;
};

export type BentoFeaturesSectionData = {
  _type: "bentoFeaturesSection";
  _key: string;
  eyebrow?: string;
  title: string;
  summary?: string;
  features?: BentoFeature[];
};

export type CtaSectionData = {
  _type: "ctaSection";
  _key: string;
  eyebrow?: string;
  title: string;
  rotatingWords?: string[];
  description?: string;
  primaryCta?: SanityCtaBlock;
  secondaryCta?: SanityCtaBlock;
  note?: string;
};

export type SanitySection =
  | HeroSectionData
  | BentoFeaturesSectionData
  | CtaSectionData;

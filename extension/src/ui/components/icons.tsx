/**
 * Centralized icon registry for Trail.
 *
 * All UI code imports concrete icons by app-semantic name through this
 * wrapper (`Icons.Download`, `Icons.Pencil`, ...). The actual icon
 * library used is an implementation detail that can be swapped in one
 * place — no imports of `lucide-react`, `@hugeicons/*`, or any other
 * icon package should leak into application code.
 *
 * This aligns with `components.json` → `"iconLibrary": "lucide"`: every
 * new shadcn component added via the CLI will import icons from
 * `lucide-react`, and this wrapper re-exports those same icons under
 * the same names, so the two paths stay consistent.
 *
 * Named after lucide's own identifier conventions (PascalCase, with
 * trailing `2` disambiguation), so a grep for an icon name lines up
 * across the codebase and the lucide docs.
 */

import {
  type LucideIcon,
  type LucideProps,
  AlertTriangle,
  ArrowLeft,
  Bell,
  BookOpen,
  Bookmark,
  BrainCircuit,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Circle,
  Cloud,
  CloudOff,
  CreditCard,
  Download,
  ExternalLink,
  Flag,
  GitBranchPlus,
  Globe,
  Hand,
  History,
  Info,
  Keyboard,
  Laptop2,
  Layers,
  List,
  ListTree,
  Loader2,
  Maximize,
  Minus,
  Moon,
  MoonStar,
  MousePointer2,
  Move,
  Network,
  Palette,
  Pencil,
  Pin,
  Plus,
  Radius,
  Redo2,
  RotateCcw,
  Search,
  Settings,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Star,
  Sun,
  Tag,
  Trash2,
  Undo2,
  Upload,
  User,
  Volume2,
  VolumeX,
  X,
  XCircle,
  Zap,
  ZoomIn,
  ZoomOut,
  // v1.0 additions used by Settings → Trees
  Archive,
  Folder,
} from "lucide-react";

export type IconProps = LucideProps;

/**
 * Single source of truth — app code always goes `<Icons.Foo />`, never
 * imports directly from `lucide-react` or any other icon package.
 */
export const Icons = {
  AlertTriangle: AlertTriangle as LucideIcon,
  ArrowLeft,
  Archive,
  Bell,
  BookOpen,
  Bookmark,
  BrainCircuit,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CirclePile: Circle,
  Cloud,
  CloudOff,
  CreditCard,
  Download,
  ExternalLink,
  Flag,
  Folder,
  GitBranchPlus,
  Globe,
  Hand,
  History,
  Info,
  Keyboard,
  Laptop2,
  Layers,
  List,
  ListTree,
  Loader2,
  Maximize,
  Minus,
  Moon,
  MoonStar,
  MousePointer2,
  Move,
  Network,
  Palette,
  Pencil,
  Pin,
  Plus,
  Radius,
  Redo2,
  RotateCcw,
  Search,
  Settings,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Star,
  Sun,
  Tag,
  Trash2,
  Undo2,
  Upload,
  User,
  Volume2,
  VolumeX,
  X,
  XCircle,
  Zap,
  ZoomIn,
  ZoomOut,
} as const;

export type IconName = keyof typeof Icons;

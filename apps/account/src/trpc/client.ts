import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@trail/trpc";

export const trpc = createTRPCReact<AppRouter>();

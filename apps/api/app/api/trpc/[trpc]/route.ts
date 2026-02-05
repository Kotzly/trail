import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@trail/trpc/src/router";
import { createTRPCContext } from "@/src/server/trpc-context";

export const runtime = "nodejs";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createTRPCContext(req)
  });

export { handler as GET, handler as POST };

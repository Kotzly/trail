import type { PrismaClient } from "@trail/db";
import type { UUID } from "crypto";

export type User = {
  id: UUID;
  email: string;
  name: string;
  imageUrl?: string;
};

export type AppSession = {
  user: User;
} | null;

export type AppContext = {
  db: PrismaClient;
  session: AppSession;
  headers: Headers;
};

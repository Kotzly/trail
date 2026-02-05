import type { PrismaClient } from "@trail/db";
import type { UUID } from "crypto";

export type User = {
  id: UUID;
  email: string;
  name: string;
  imageUrl?: string;
};

export type AppUser = {
  id: string;
  email: string | null;
  name: string | null;
  imageUrl: string | null;
};

export type AppSession = {
  user: AppUser;
} | null;

export type AppContext = {
  db: PrismaClient;
  session: AppSession;
  headers: Headers;
};

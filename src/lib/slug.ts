import { z } from "zod";

// Top-level paths the app owns or may own; a store at these would shadow a route.
export const RESERVED_SLUGS = new Set([
  "about",
  "account",
  "admin",
  "api",
  "app",
  "auth",
  "dashboard",
  "help",
  "login",
  "logout",
  "new",
  "privacy",
  "settings",
  "shop",
  "signin",
  "signup",
  "static",
  "store",
  "stores",
  "support",
  "terms",
  "www",
]);

export const slugSchema = z
  .string()
  .min(3, "At least 3 characters")
  .max(40, "At most 40 characters")
  .regex(
    /^[a-z0-9]+(-[a-z0-9]+)*$/,
    "Lowercase letters and numbers, single hyphens between them",
  )
  .refine((s) => !RESERVED_SLUGS.has(s), "That address is reserved");

export const createStoreSchema = z.object({
  name: z.string().trim().min(1, "Enter a store name").max(80, "Too long"),
  slug: slugSchema,
});

export type CreateStoreInput = z.infer<typeof createStoreSchema>;

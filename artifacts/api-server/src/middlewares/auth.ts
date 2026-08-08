import { getAuth, clerkClient } from "@clerk/express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import type { Request, Response, NextFunction } from "express";

type LocalUser = typeof usersTable.$inferSelect;

declare global {
  namespace Express {
    interface Request {
      localUser?: LocalUser;
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const { userId: clerkUserId } = getAuth(req);

  if (!clerkUserId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    // 1. Look up local user by Clerk ID
    let [localUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.clerkUserId, clerkUserId))
      .limit(1);

    if (!localUser) {
      // 2. JIT provision: fetch identity from Clerk
      const clerkUser = await clerkClient().users.getUser(clerkUserId);
      const email = clerkUser.emailAddresses[0]?.emailAddress ?? "";
      const firstName = clerkUser.firstName ?? "";
      const lastName = clerkUser.lastName ?? "";
      const name =
        `${firstName} ${lastName}`.trim() || email.split("@")[0] || "User";

      // 3. Check if an existing JWT-era user has the same email (migrate them)
      if (email) {
        [localUser] = await db
          .select()
          .from(usersTable)
          .where(eq(usersTable.email, email))
          .limit(1);
      }

      if (localUser) {
        // Link the Clerk ID to the existing account
        [localUser] = await db
          .update(usersTable)
          .set({ clerkUserId })
          .where(eq(usersTable.id, localUser.id))
          .returning();
      } else {
        // Create a fresh local account
        [localUser] = await db
          .insert(usersTable)
          .values({ clerkUserId, name, email, passwordHash: null })
          .returning();
      }
    }

    if (localUser.status === "suspended") {
      res.status(403).json({ error: "Your account has been suspended" });
      return;
    }

    req.localUser = localUser;
    next();
  } catch (err) {
    console.error("requireAuth error:", err);
    res.status(500).json({ error: "Authentication error" });
  }
}

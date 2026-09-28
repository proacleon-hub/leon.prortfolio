import { revalidatePath, revalidateTag } from "next/cache";
import { getLastChange } from "@/lib/wp";

export const dynamic = "force-dynamic";

// How recent a WordPress change must be for a refresh request to act on it.
const WINDOW_SECONDS = 300;

/**
 * Called by WordPress (the "JL Next.js bridge" plugin) whenever something is
 * saved. No password is needed: we ask WordPress itself whether anything
 * changed in the last few minutes and only then refresh the site, so a
 * stranger calling this address can't do anything useful.
 */
async function handle() {
  const last = await getLastChange();
  const now = Math.floor(Date.now() / 1000);
  if (last === null) return Response.json({ refreshed: false, reason: "wordpress-unreachable" }, { status: 502 });
  if (now - last > WINDOW_SECONDS) return Response.json({ refreshed: false, reason: "no-recent-change" });
  revalidateTag("wp", { expire: 0 });
  revalidatePath("/", "layout");
  return Response.json({ refreshed: true, changedAt: last });
}

export const GET = handle;
export const POST = handle;

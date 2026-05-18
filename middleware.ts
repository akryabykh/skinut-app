import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     *  - _next/static    (Next.js static assets)
     *  - _next/image     (Next.js image optimizer)
     *  - favicon.ico     (browser favicon)
     *  - icons/*         (app icon assets)
     *  - manifest.webmanifest, sw.js  (PWA files)
     *  - any path containing a "." (i.e. has a file extension, e.g. .png)
     *
     * This keeps middleware off static asset requests, which is a sizeable
     * perf win on every page load.
     */
    "/((?!_next/static|_next/image|favicon\\.ico|icons/|manifest\\.webmanifest|sw\\.js|.*\\..*).*)",
  ],
};

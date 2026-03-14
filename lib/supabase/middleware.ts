import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type MiddlewareAuthClient = {
  getUser?: () => Promise<{ data?: { user?: unknown | null } }>;
  getSession?: () => Promise<{ data?: { session?: { user?: unknown | null } | null } }>;
};

function redirectWithCookies(target: URL, response: NextResponse) {
  const redirectResponse = NextResponse.redirect(target);

  response.cookies.getAll().forEach(({ name, value, ...rest }) => {
    redirectResponse.cookies.set(name, value, rest);
  });

  return redirectResponse;
}

async function getAuthUser(auth: MiddlewareAuthClient) {
  if (typeof auth.getUser === "function") {
    const response = await auth.getUser();
    return response.data?.user ?? null;
  }

  if (typeof auth.getSession === "function") {
    const response = await auth.getSession();
    return response.data?.session?.user ?? null;
  }

  return null;
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const pathname = request.nextUrl.pathname;
  const isAuthRoute =
    pathname === "/login" || pathname === "/register" || pathname === "/reset";
  const isProtectedRoute =
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/library" ||
    pathname.startsWith("/library/") ||
    pathname === "/parent" ||
    pathname.startsWith("/parent/") ||
    pathname === "/settings" ||
    pathname.startsWith("/settings/");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Never crash middleware due to missing env in deployment.
  if (!url || !publishableKey) {
    if (isProtectedRoute) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.searchParams.set("error", "Please sign in to continue.");
      return redirectUrl.pathname === pathname ? response : NextResponse.redirect(redirectUrl);
    }
    return response;
  }

  try {
    const supabase = createServerClient(url, publishableKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          response = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    const user = await getAuthUser(supabase.auth as unknown as MiddlewareAuthClient);

    if (!user && isProtectedRoute) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.searchParams.set("error", "Please sign in to continue.");

      return redirectWithCookies(redirectUrl, response);
    }

    if (user && isAuthRoute) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/dashboard";
      redirectUrl.search = "";

      return redirectWithCookies(redirectUrl, response);
    }

    return response;
  } catch {
    if (isProtectedRoute) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.searchParams.set("error", "Please sign in to continue.");
      return NextResponse.redirect(redirectUrl);
    }

    return response;
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // صفحه اصلی عمومی دنتا
    if (url.pathname === "/" || url.pathname === "") {
      return env.ASSETS.fetch(
        new Request(new URL("/home.html", url), request)
      );
    }

    // پنل مدیران و منشی‌های کلینیک
    if (url.pathname === "/panel" || url.pathname === "/panel/") {
      return env.ASSETS.fetch(
        new Request(new URL("/index.html", url), request)
      );
    }

    // پنل مستقل مدیر ارشد دنتا
    if (url.pathname === "/super-admin" || url.pathname === "/super-admin/") {
      return env.ASSETS.fetch(
        new Request(new URL("/super-admin.html", url), request)
      );
    }

    if (url.pathname === "/api/health") {
      return Response.json({
        ok: true,
        app: "Denta",
        status: "running"
      });
    }

    if (url.pathname === "/api/config") {
      const supabaseKey =
        env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;

      return Response.json({
        supabaseUrl: env.SUPABASE_URL,
        supabaseKey
      }, {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store"
        }
      });
    }

    return env.ASSETS.fetch(request);
  }
};
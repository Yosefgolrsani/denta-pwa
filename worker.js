export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // صفحه اصلی عمومی دنتا
    if (url.pathname === "/" || url.pathname === "") {
      return env.ASSETS.fetch(
        new Request(new URL("/home.html", url), request)
      );
    }

    // پنل فعلی دنتا بدون تغییر
    if (url.pathname === "/panel" || url.pathname === "/panel/") {
      return env.ASSETS.fetch(
        new Request(new URL("/index.html", url), request)
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
      return Response.json({
        supabaseUrl: env.SUPABASE_URL,
        supabaseKey: env.SUPABASE_PUBLISHABLE_KEY
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
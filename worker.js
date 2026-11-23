export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // صفحه اصلی عمومی دنتا
    if (url.pathname === "/" || url.pathname === "") {
      return env.ASSETS.fetch(new Request(new URL("/home.html", url), request));
    }

    // ورود مدیران: مسیر را به فایل واقعی پنل هدایت می‌کنیم
    if (url.pathname === "/panel" || url.pathname === "/panel/") {
      return Response.redirect(new URL("/index.html", url), 302);
    }

    // فایل ورود مدیران باید همیشه از نسخه منتشرشده دریافت شود
    if (url.pathname === "/index.html") {
      const response = await env.ASSETS.fetch(new Request(url, {
        method: "GET",
        headers: request.headers
      }));
      const headers = new Headers(response.headers);
      headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    }

    // پنل مدیر ارشد
    if (url.pathname === "/super-admin" || url.pathname === "/super-admin/") {
      return env.ASSETS.fetch(request);
    }

    if (url.pathname === "/api/health") {
      return Response.json({ ok: true, app: "Denta", status: "running" });
    }

    if (url.pathname === "/api/config") {
      const supabaseKey = env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;
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
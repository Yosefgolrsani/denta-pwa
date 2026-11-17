
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // بررسی سلامت دنتا
    if (url.pathname === "/api/health") {
      return Response.json({
        ok: true,
        app: "Denta",
        status: "running"
      });
    }

    // دریافت تنظیمات عمومی اتصال Supabase
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

    // نمایش فایل‌های اصلی سایت
    return env.ASSETS.fetch(request);
  }
};

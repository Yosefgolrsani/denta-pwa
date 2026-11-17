
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // بررسی سلامت Worker
    if (url.pathname === "/api/health") {
      return Response.json({
        ok: true,
        app: "Denta",
        status: "running"
      });
    }

    // نمایش فایل‌های اصلی سایت
    return env.ASSETS.fetch(request);
  }
};

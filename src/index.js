export default {
  async fetch(request, env, ctx) {
    const BACKEND_ORIGIN = "https://your-backend.onrender.com";

    try {
      const url = new URL(request.url);
      const targetURL = BACKEND_ORIGIN + url.pathname + url.search;

      // Handle CORS preflight
      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: corsHeaders(),
        });
      }

      // Clone headers safely
      const headers = new Headers();
      for (const [key, value] of request.headers.entries()) {
        // Skip hop-by-hop headers
        if (
          ["host", "content-length", "cf-connecting-ip", "cf-ray"].includes(
            key.toLowerCase()
          )
        ) {
          continue;
        }
        headers.set(key, value);
      }

      // Forward request
      const controller = new AbortController();
      ctx.waitUntil(
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Backend timeout")), 15000)
        )
      );

      const response = await fetch(targetURL, {
        method: request.method,
        headers,
        body:
          request.method === "GET" || request.method === "HEAD"
            ? null
            : await request.arrayBuffer(),
        signal: controller.signal,
      });

      // Clone response headers safely
      const responseHeaders = new Headers(response.headers);
      responseHeaders.set("access-control-allow-origin", "*");
      responseHeaders.set("access-control-allow-credentials", "true");

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    } catch (err) {
      return new Response(
        JSON.stringify({
          error: "Worker proxy error",
          message: err.message,
        }),
        {
          status: 502,
          headers: {
            "content-type": "application/json",
            ...corsHeaders(),
          },
        }
      );
    }
  },
};

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "*",
  };
}

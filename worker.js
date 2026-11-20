/** GOLDX Cloudflare Worker: keep the existing Netlify market gateway logic. */
import marketGateway from "./netlify/functions/market.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/market" || url.pathname === "/api/market/" ||
        url.pathname === "/.netlify/functions/market") {
      const event = {
        httpMethod: request.method,
        queryStringParameters: Object.fromEntries(url.searchParams)
      };
      try {
        const result = await marketGateway.handler(event);
        const headers = new Headers(result.headers || {});
        // This Netlify-only header is not used by Cloudflare.
        headers.delete("Netlify-CDN-Cache-Control");
        return new Response(result.body || "", {
          status: result.statusCode || 200,
          headers
        });
      } catch (error) {
        console.error("GOLDX market gateway failed:", error);
        return Response.json(
          { error: "API_UNAVAILABLE", message: "ไม่สามารถดึงข้อมูลราคาได้ชั่วคราว" },
          { status: 503, headers: { "Cache-Control": "no-store" } }
        );
      }
    }
    return env.ASSETS.fetch(request);
  }
};

import { getAssetFromKV } from "@cloudflare/kv-asset-handler";

addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event));
});

async function handleRequest(event) {
  try {
    // Serve static assets from the KV store
    return await getAssetFromKV(event, {
      mapRequestToAsset: (req) => {
        const url = new URL(req.url);
        // Default to index.html for root path
        if (url.pathname === "/") {
          url.pathname = "/index.html";
        }
        return new Request(url.toString(), req);
      },
    });
  } catch (e) {
    // If asset not found, return 404
    return new Response("Not Found", { status: 404 });
  }
}

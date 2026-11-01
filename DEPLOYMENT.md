# Deploying to Cloudflare

The app is a static site. Cloudflare serves everything in `public/` directly using
[Workers static assets](https://developers.cloudflare.com/workers/static-assets/), so no Worker script is needed.

## Prerequisites

- Node.js and npm
- A Cloudflare account

## First-time setup

```bash
npm install
npx wrangler login
npm run deploy
```

The site will be at `https://recipe-generator.<your-subdomain>.workers.dev`. To rename it, change
`name` in `wrangler.toml`. You can add a custom domain in the Cloudflare dashboard.

> Location access only works over **https** (or `localhost`). Cloudflare URLs are https by default.

## Updating

1. Edit files in `public/`.
2. If you changed app files, bump `CACHE` in `public/sw.js` (e.g. `dinner-shuffle-v2`) so installed copies refresh.
3. `npm run deploy`

## Local preview

```bash
npm start      # simple static server on :8000
npm run dev    # or run Cloudflare's local server on :8787
```

## Troubleshooting

- Check login: `npx wrangler whoami`
- View deployments: Cloudflare Dashboard → Workers & Pages

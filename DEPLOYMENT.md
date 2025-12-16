# Cloudflare Workers Deployment Guide

## Prerequisites

- Node.js and npm installed
- Cloudflare account (je70917@gmail.com)

## Project Structure

```
windsurf-project-4/
├── public/           # Static assets (HTML, CSS, JS)
├── worker.js         # Cloudflare Worker script
├── wrangler.toml     # Wrangler configuration
└── package.json      # Node dependencies
```

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Run locally:

```bash
npm run dev
```

This will start a local server at `http://localhost:8787`

## Deploy to Cloudflare Workers

### First Time Setup

1. Login to Cloudflare:

```bash
npx wrangler login
```

This will open a browser window to authenticate with your Cloudflare account (je70917@gmail.com).

2. Deploy:

```bash
npm run deploy
```

### Subsequent Deployments

Just run:

```bash
npm run deploy
```

## Configuration

The `wrangler.toml` file contains your Worker configuration:

- `name`: The name of your Worker (recipe-generator)
- `main`: The Worker script file (worker.js)
- `site.bucket`: Directory containing static assets (./public)

## After Deployment

Your site will be available at:
`https://recipe-generator.<your-subdomain>.workers.dev`

You can also add a custom domain in the Cloudflare dashboard.

## Updating the Site

1. Make changes to files in the `public/` directory
2. Run `npm run deploy`
3. Changes will be live in seconds!

## Troubleshooting

If you encounter issues:

- Make sure you're logged in: `npx wrangler whoami`
- Check logs: `npx wrangler tail`
- View deployments: Visit Cloudflare Dashboard → Workers & Pages

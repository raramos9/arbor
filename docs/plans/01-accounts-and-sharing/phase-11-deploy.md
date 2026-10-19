# Phase 11. Hosted project and deploy

[Overview](overview.md)

## Goal

Arbor runs at a public URL backed by a hosted Supabase project, so a published link works for anyone.

## Needs from the user

- A static host. Cloudflare Pages, Netlify, and Vercel all serve a Vite build. The user decides which.
- Approval before the first deploy.

## Changes

- Set the site URL and redirect URLs in the hosted auth settings.
- Deploy `npm run build` output to the chosen host.

## Verification

- Runtime. On the public URL:
  - sign in by magic link;
  - publish a strategy;
  - open its link in a private window and see it;
  - fork it.
- `npx supabase test db --linked` passes against the hosted schema.

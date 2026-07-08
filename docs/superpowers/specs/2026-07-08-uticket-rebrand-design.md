# Üticket rebrand — design spec

Date: 2026-07-08
Source of truth: brand guidelines board v1.0 (provided by the user) — purple identity, Plus Jakarta Sans, "Ü" wordmark.

## Goal

Rebrand the app from **BoletaVIP** to **Üticket** in everything the user sees, applying the brand board's palette, typography and logo system. Internal identifiers stay untouched.

## Scope

### In scope (user-facing)

1. **Design tokens** (`src/app/globals.css`, Tailwind v4 `@theme inline`):
   - Light mode: background `#F5F5F7` (brand Light Gray), foreground `#2B2B2B` (brand Dark Gray), cards white, primary `#6D2BFF` (Primary Purple), primary-hover `#4B14D1` (Secondary Purple), accent `#879CFF` (Lavender), ring lavender, purple-tinted muted/border/soft/shadow tokens.
   - Dark mode ("Negativo sobre oscuro"): near-black purple background `#0F0B1C`, foreground `#F5F5F7`, primary lightened to `#8E5CFF` (≥4.5:1 on background), hover `#A583FF`, accent/ring `#879CFF`.
   - `--danger` stays red. Contrast: white on `#6D2BFF` ≈ 6.3:1; body text ≥ 4.5:1 everywhere (per ui-ux-pro-max checklist).
2. **Typography**: Plus Jakarta Sans (400–800) replaces Geist Sans (body) and Outfit (display); Geist Mono stays for code/QR ids. Board scale (H1 40/48 … caption 12/16) used as reference; existing Tailwind sizing utilities remain.
3. **Logo system**:
   - New `Logo` component: rounded purple square with a white "Ü" glyph (SVG paths, no font dependency) + wordmark "Üticket" — "Ü" in primary, "ticket" in foreground (board's "secundario" variation on light, "negativo" resolves automatically via tokens in dark).
   - `src/app/icon.svg`: purple rounded square + white Ü (board slide 10 app icon).
   - Navbar and MobileMenu use the new logo.
4. **Copy rename**: `layout.tsx` metadata (title/template/description), Footer ©, `eventos/[id]` organizer fallback, home hero headline → brand tagline **"Tu entrada en un clic."** with purple→lavender gradient, README title, CLAUDE.md intro note.

### Out of scope (internal identifiers — unchanged)

- DB name/roles, seed emails (`*@boletavip.com`), `package.json` name, repo/folder name, localStorage key `boletavip-cart` (renaming would drop live carts), Vercel project name, route paths.

## Approach chosen

Token-level rebrand (option A) over component-by-component restyle (option B): all colors already flow through CSS variables, so swapping the palette + fonts + logo achieves the full brand look without touching the user's UI-polish pass (elevation shadows, cards, buttons), which is preserved by design.

## Testing

`pnpm test && pnpm typecheck && pnpm lint && pnpm build`; dev-server smoke: home HTML contains "Üticket" and new tokens; icon.svg rendered and visually checked. No schema/API changes — no new unit tests needed.

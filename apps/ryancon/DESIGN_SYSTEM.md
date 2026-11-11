# Design System Transfer Guide

Use this document to recreate the look and feel of this app in another
repository. It focuses on the exact design tokens, assets, and component
patterns that control the visual signature.

## 1) Non-negotiables (must copy)

### Fonts

- Primary display font: `Cooper`
- Source file: `assets/fonts/COOPBL.woff`
- Global CSS setup:
  - `app/globals.css` defines the `@font-face` and `font-family: "Cooper"`.
  - Headings use `font-cooper` and the shared `.title` class.

### Tailwind Extensions

Copy the following from `tailwind.config.ts` into the target app:

- `fontFamily.cooper`
- `fontSize.display`, `display2`, `display3`, `display4` (fluidType)
- `colors.nametag`
- `screens`: `1xl`, `3xl`, `4xl`
- `animation.disco` + `keyframes.disco`
- `scale.102`
- `brightness.20`, `.25`, `.30`
- `@tailwindcss/aspect-ratio` plugin

### Global Utility Classes

From `app/globals.css`:

- `.timing` for base transitions
- `.title` for heading color
- `.secondary` for subheading/body color

### Theme Mode

- Dark mode uses Tailwind `dark` class on `html` or `body`.
- Color choices are opacity-based (black/white with alpha).

## 2) Core Tokens (use these class values)

### Text

- Primary: `text-black` or `text-black/90`
- Secondary: `text-black/70`
- Tertiary: `text-black/60`
- Dark mode primary: `dark:text-white`
- Dark mode secondary: `dark:text-white/70`
- Dark mode tertiary: `dark:text-white/60`

### Surfaces

- Soft card: `bg-white/80 dark:bg-white/5`
- Solid card: `bg-white/90 dark:bg-white/5`
- High contrast popup: `bg-white/95 dark:bg-white/95`

### Borders

- Default: `border border-black/10 dark:border-white/10`
- Emphasis: `border-black/20 dark:border-white/20`

### Shadows

- Low elevation: `shadow-sm`
- Floating: `shadow-xl`
- Hero glow: `shadow-drop`

### Hover Affordance

- Lift: `hover:-translate-y-1`
- Border emphasize: `hover:border-black/30 dark:hover:border-white/40`

### Meta Label

- `text-xs font-semibold uppercase tracking-caps-wide`

## 3) Typography Rules

- Headings: `Heading` component + `.title` + `font-cooper`.
- Body copy: `Text` component with `text-black/70 dark:text-white/70`.
- Avoid raw `h1`/`p` unless necessary.

## 4) Layout Patterns

- Section spacing: `space-y-6` or `space-y-12`.
- Grids: `gap-4` or `gap-6`.
- Use `sm:` breakpoints early to keep mobile readable.

## 5) Component Inventory (must mirror)

Use the same component APIs if possible. If recreating, match the
classes and variants.

### Buttons

File: `components/global/Button.tsx`

- `variant="primary"`
- `variant="secondary"`
- `variant="outline"`
- `variant="ghost"`

### Cards

File: `components/global/Card.tsx`

- `variant="soft"` or `variant="solid"`
- Avoid custom backgrounds unless a section is meant to stand out.

### Pill

File: `components/global/Pill.tsx`

### Typography

Files: `components/global/Heading.tsx`, `components/global/Text.tsx`

### Inputs

Files: `components/global/Input.tsx`, `components/global/Textarea.tsx`

- Required labels keep the asterisk inline.

## 6) Common Class Snippets (copy verbatim)

### Soft Card Container

```
rounded-2xl border border-black/10 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5
```

### Meta Label

```
text-xs font-semibold uppercase tracking-caps-wide text-black/60 dark:text-white/60
```

### Hoverable Tile

```
transition hover:-translate-y-1 hover:border-black/30 dark:hover:border-white/40
```

## 7) Visual Behavior Notes

- Light mode is soft, not high contrast.
- Dark mode uses subtle white-on-black; avoid bright surfaces.
- Most surfaces are translucent (white with alpha).
- Use the `nametag` red only for small accents or highlights.

## 8) Checklist for a New Repo

- Copy `assets/fonts/COOPBL.woff` and the `@font-face` rule.
- Port Tailwind `extend` values and plugin.
- Recreate `.timing`, `.title`, `.secondary` in global CSS.
- Match the `Heading`, `Text`, `Button`, `Card`, `Pill` APIs.
- Use the same opacity-based text and surface classes.

## Reference Files in This Repo

- `components/global/Button.tsx`
- `components/global/Card.tsx`
- `components/global/Heading.tsx`
- `components/global/Text.tsx`
- `components/global/Pill.tsx`
- `components/global/Input.tsx`
- `components/global/Textarea.tsx`
- `components/home/Landing.tsx`
- `components/sponsors/SponsorCarousel.tsx`
- `components/map/Map.tsx`
- `tailwind.config.ts`
- `app/globals.css`

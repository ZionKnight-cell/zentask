# Zentask Option 1 — Exact Extracted Assets

This pack uses the actual Option 1 image you selected as the source.

Important:
- `icon-192x192.png`, `icon-512x512.png`, and `icon-1024x1024.png` are extracted from the selected blue app icon.
- `favicon.ico` and favicon PNGs are extracted from the selected light favicon preview.
- `apple-touch-icon.png` is extracted from the selected Apple touch icon preview.
- `og-image.png` and `twitter-image.png` preserve the selected social card design and proportions.
- `og-image-1200x630-cropped.png` is included as an optional strict social-card ratio version.

Copy the public files into:

```bash
~/GitHub/zentask/public
```

Recommended `index.html` tags:

```html
<link rel="icon" href="/favicon.ico" sizes="any" />
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<link rel="manifest" href="/site.webmanifest" />

<meta name="theme-color" content="#64B5F6" />

<meta property="og:title" content="Zentask" />
<meta property="og:description" content="Focus. Plan. Complete. Peace of mind." />
<meta property="og:type" content="website" />
<meta property="og:image" content="/og-image.png" />

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="Zentask" />
<meta name="twitter:description" content="Focus. Plan. Complete. Peace of mind." />
<meta name="twitter:image" content="/twitter-image.png" />
```

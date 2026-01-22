# Homepage Tailwind Redesign

## Overview

Migrate txtconv homepage from Bulma CSS to Tailwind CSS, implementing the new Stitch-generated design.

## Decisions

| Decision | Choice |
|----------|--------|
| Login UI | Keep modal login, dropdown when logged in |
| Progress indicators | Circular SVG progress rings |
| Icon library | Material Symbols (replacing Font Awesome) |
| Failed file handling | Add working retry button |
| Footer content | Name, donate, email, Facebook, version |
| CSS framework | Remove Bulma completely, full Tailwind rewrite |
| Modal style | Match Stitch aesthetic (rounded, shadows) |
| Tailwind config | Create tailwind.config.js with custom colors |

## Configuration

### tailwind.config.js

```js
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#00D1B2',
        'primary-hover': '#00bfa3',
        'bg-main': '#f3f4f6',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
```

### postcss.config.js

```js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

## Components

### Files to Modify

| Component | Changes |
|-----------|---------|
| `app/layout.tsx` | Add Material Symbols + Inter fonts, remove Bulma/FA |
| `app/page.tsx` | Update layout structure with Tailwind classes |
| `app/globals.css` | Replace with Tailwind directives |
| `components/Header.tsx` | Sticky header with Tailwind styling |
| `components/AuthButton.tsx` | Tailwind modal + dropdown |
| `components/FileUpload.tsx` | Dropzone + circular progress + retry |
| `components/PricingSection.tsx` | 3-column grid pricing cards |
| `components/Footer.tsx` | Flex layout with Material Symbols |

### Files to Create

| File | Purpose |
|------|---------|
| `tailwind.config.js` | Custom theme configuration |
| `postcss.config.js` | PostCSS plugin config |

### Dependencies to Remove

- `bulma`
- `@fortawesome/fontawesome-free`

## Page Layout

```
<body> (bg-main, min-h-screen, flex flex-col)
  <Header /> (sticky top-0, white bg, shadow-sm)
  <main> (flex-1, max-w-5xl mx-auto, px-6 py-12)
    <section> Hero text
    <section> Dropzone + File list
    <section> Pricing cards
  </main>
  <Footer /> (mt-auto, border-t, white bg)
</body>
```

## File Row States

| State | Indicator | Color | Action |
|-------|-----------|-------|--------|
| Uploading | Pulsing dot + progress ring | Blue | - |
| Converting | Pulsing dot + progress ring | Amber | - |
| Waiting | Static dot + empty ring | Gray | - |
| Finished | Checkmark icon | Green border | Download button |
| Failed | Error icon | Red border | Retry button |

## Circular Progress Ring

```tsx
<svg className="w-10 h-10 -rotate-90" viewBox="0 0 40 40">
  <circle cx="20" cy="20" r="16" fill="none"
    className="stroke-gray-100" strokeWidth="3" />
  <circle cx="20" cy="20" r="16" fill="none"
    className="stroke-primary" strokeWidth="3"
    strokeLinecap="round"
    strokeDasharray="100.48"
    strokeDashoffset={100.48 * (1 - progress)} />
</svg>
```

## Retry Logic

```tsx
const retryFile = (fileId: string) => {
  const failedFile = files.find(f => f.id === fileId);
  if (!failedFile) return;

  setFiles(prev => prev.map(f =>
    f.id === fileId
      ? { ...f, errMessage: null, uploadProgress: 0, convertProgress: 0 }
      : f
  ));

  convertFile(failedFile);
};
```

## Validation Checklist

- [ ] All components render without Bulma classes
- [ ] Circular progress animates smoothly
- [ ] File upload → conversion → download flow works
- [ ] Retry button recovers failed files
- [ ] Login modal styled correctly
- [ ] Pricing cards display properly
- [ ] Footer links work
- [ ] Responsive on mobile
- [ ] No console errors

## Test Files

Sample files in `/downloads` folder:
- `.srt` subtitle files
- `.txt` novel files
- `.xml` data files

# Rashi Tyagi — Personal Portfolio

This repository contains the source code for my personal portfolio website.

## Overview
The website is a responsive single-page portfolio built with:
- HTML
- CSS
- JavaScript

It includes sections for:
- About
- Resume
- Portfolio Projects
- Blog Highlights
- Contact

## Run Locally
Because this is a static site, you can run it directly in a browser.

### Option 1: Open the file
1. Clone or download this repository.
2. Open `index.html` in your browser.

### Option 2: Use a local server (recommended)
From the repository root, run one of the following:

Using Python 3:
```bash
python -m http.server 8000
```
Then open:
- `http://localhost:8000`

## Liquid Glass theme
The site is styled in the spirit of Apple's Liquid Glass design language: translucent, light-bending surfaces over a softly moving colour field.

- **Glass surfaces.** Panels and cards are translucent, blur and saturate what is behind them, and have a 1px rim that catches the light. The highlight follows your pointer.
- **Floating tab bar.** Navigation is a capsule floating at the bottom of the screen. The active tab sits in a glass droplet that stretches and slides when you switch tabs. In Chromium browsers the bar's edges also bend what scrolls beneath it, like a lens; other browsers get plain frosted glass.
- **Light and dark.** The site follows your system appearance. The button at the end of the tab bar cycles between system, light and dark, and remembers the choice.
- **Accessibility.** `prefers-reduced-motion` stops the moving background and animations. `prefers-reduced-transparency` swaps the glass for solid, high-contrast surfaces.

The theme is a layer on top of the original layout: `assets/css/glass.css` (colours and materials) and `assets/js/glass.js` (moving parts). Remove those lines from `index.html` to get the original look back.

## Project Structure
```text
.
├── index.html
├── assets
│   ├── css
│   │   ├── style.css        original layout
│   │   └── glass.css        Liquid Glass theme layer
│   ├── js
│   │   ├── script.js        tabs, filters, modal, form
│   │   └── glass.js         colour field, pointer light, tab droplet, appearance, lens
│   └── images
└── README.md
```

## Updating Content
To update website content:
- Edit text and sections in index.html.
- Update layout in assets/css/style.css, and colours or glass materials in assets/css/glass.css (the tokens at the top).
- Update interactions in assets/js/script.js.
- Replace images in assets/images/ as needed.

## Contact
If you’d like to connect, please use the contact section on the website.

## License
This project is licensed under the MIT License. See LICENSE for details.

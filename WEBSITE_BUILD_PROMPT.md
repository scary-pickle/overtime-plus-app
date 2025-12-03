# Overtime+ Static Website Build Prompt

## Project Overview

Build a minimal static website for **Overtime+**, a React Native mobile app that automates Queensland Health AVAC overtime forms. This website will serve as the public-facing site hosting legal pages and app store links.

**Purpose**: Privacy Policy, Terms of Service, About page, and landing page with app store links.

**Hosting**: Vercel or Netlify (free tier, using free subdomain initially)

**Tech Stack**: Next.js 14+ with TypeScript, Tailwind CSS, static export

---

## Technical Requirements

### 1. Project Setup

- **Framework**: Next.js 14+ with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Build**: Static export (no server-side rendering)
- **Package Manager**: npm

### 2. Required Dependencies

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.9.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0"
  }
}
```

### 3. Next.js Configuration

**`next.config.js`** must be configured for static export:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',  // Enable static export
  images: {
    unoptimized: true,  // Required for static export
  },
  trailingSlash: true,  // Optional: for cleaner URLs
}

module.exports = nextConfig
```

### 4. Project Structure

```
overtime-plus-website/
├── app/
│   ├── layout.tsx          # Root layout with header/footer
│   ├── page.tsx           # Landing/home page
│   ├── privacy/
│   │   └── page.tsx        # Privacy Policy page
│   ├── terms/
│   │   └── page.tsx        # Terms of Service page
│   └── about/
│       └── page.tsx         # About page
├── public/
│   ├── favicon.ico         # Favicon (use app icon)
│   └── icon.png            # App icon (optional, for branding)
├── components/
│   ├── Header.tsx          # Navigation header component
│   ├── Footer.tsx          # Footer component
│   └── AppStoreButtons.tsx # App store download buttons
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
├── package.json
└── README.md
```

---

## Design System (Match Mobile App)

### Color Palette

**Primary Colors:**
- Primary Blue: `#007AFF` (buttons, links, accents)
- Background Light: `#f5f5f5` (main background)
- Background Dark: `#000` (dark mode background)
- Card Light: `#ffffff` (card backgrounds)
- Card Dark: `#1c1c1e` (dark mode cards)

**Text Colors:**
- Primary Text Light: `#111` (headings)
- Secondary Text Light: `#333` (body text)
- Tertiary Text Light: `#666` (muted text)
- Primary Text Dark: `#fff` (dark mode headings)
- Secondary Text Dark: `#aaa` (dark mode body)

**Border Colors:**
- Border Light: `#e5e7eb`
- Border Dark: `#444`

### Typography

- **Font Family**: System fonts (use Tailwind's `font-sans` which defaults to system stack)
- **Headings**: 
  - H1: `text-4xl md:text-5xl font-bold` (48-60px, weight 700)
  - H2: `text-3xl md:text-4xl font-bold` (30-36px, weight 700)
  - H3: `text-2xl font-semibold` (24px, weight 600)
- **Body**: `text-base` (16px, weight 400)
- **Small Text**: `text-sm` (14px)

### Spacing & Layout

- **Container Padding**: `px-4 md:px-6 lg:px-8` (16-32px responsive)
- **Section Spacing**: `py-12 md:py-16 lg:py-20` (48-80px vertical)
- **Card Padding**: `p-6 md:p-8` (24-32px)
- **Gap Between Elements**: `gap-4 md:gap-6` (16-24px)

### Components Styling

**Cards:**
- Background: `bg-white dark:bg-[#1c1c1e]`
- Border Radius: `rounded-2xl` (16px)
- Shadow: `shadow-sm` (subtle shadow)
- Padding: `p-6 md:p-8`

**Buttons:**
- Primary: `bg-[#007AFF] text-white font-semibold rounded-xl px-6 py-3`
- Hover: `hover:opacity-90 transition-opacity`
- Border Radius: `rounded-xl` (12px)

**Links:**
- Color: `text-[#007AFF]`
- Hover: `hover:underline`

---

## Page Requirements

### 1. Root Layout (`app/layout.tsx`)

- Include Header component (navigation)
- Include Footer component
- Set up dark mode support (use `next-themes` or manual implementation)
- Meta tags for SEO
- Font configuration

**Required Meta Tags:**
```html
<title>Overtime+ - Queensland Health Overtime Tracking</title>
<meta name="description" content="Automate your Queensland Health AVAC overtime forms with Overtime+">
<meta name="viewport" content="width=device-width, initial-scale=1">
```

### 2. Header Component (`components/Header.tsx`)

- Logo/Brand name: "Overtime+"
- Navigation links:
  - Home
  - About
  - Privacy Policy
  - Terms of Service
- Mobile-responsive hamburger menu
- Dark mode toggle (optional but recommended)
- Styling: Clean, minimal, matches app design

### 3. Footer Component (`components/Footer.tsx`)

- Links to all pages (Privacy, Terms, About)
- Copyright notice: "© 2024 Overtime+. All rights reserved."
- Optional: Contact/support link
- Styling: Subtle, minimal

### 4. Landing Page (`app/page.tsx`)

**Content Sections:**

1. **Hero Section:**
   - Large heading: "Overtime+"
   - Subheading: "Automate your Queensland Health AVAC overtime forms"
   - Brief description (2-3 sentences)
   - App Store buttons (placeholder for now)

2. **Features Section** (optional, brief):
   - Key features list (3-4 bullet points)
   - Example: "Track overtime hours", "Generate AVAC PDFs", "Manage shift patterns"

3. **App Store Buttons:**
   - iOS App Store button (placeholder)
   - Google Play Store button (placeholder)
   - Use placeholder text: "Coming Soon" or "Download on the App Store" / "Get it on Google Play"
   - Style as buttons matching app design (#007AFF background)

**Styling:**
- Centered layout
- Clean, modern design
- Mobile-responsive
- Use app's color scheme

### 5. Privacy Policy Page (`app/privacy/page.tsx`)

- **Content**: User will provide the Privacy Policy text
- **Format**: 
  - Title: "Privacy Policy"
  - Well-formatted sections with headings
  - Readable typography
  - Proper spacing
- **Styling**: 
  - Max-width container for readability (e.g., `max-w-4xl mx-auto`)
  - Clear section headings
  - Proper line height for readability

### 6. Terms of Service Page (`app/terms/page.tsx`)

- **Content**: User will provide the Terms of Service text
- **Format**: Same as Privacy Policy
- **Styling**: Same as Privacy Policy

### 7. About Page (`app/about/page.tsx`)

**Content to include:**

- **What is Overtime+?**
  - Brief description of the app
  - Purpose: Automate Queensland Health AVAC overtime forms

- **Who is it for?**
  - Queensland Health employees
  - Healthcare workers who track overtime

- **Key Features:**
  - Profile management
  - Usual shifts tracking
  - Quick log creation
  - AVAC PDF generation
  - Offline-first design

- **Contact/Support:**
  - Optional: Support email or contact method
  - Or: "For support, please contact us through the app"

**Styling:**
- Clean, readable layout
- Sections with clear headings
- Match app's design aesthetic

### 8. App Store Buttons Component (`components/AppStoreButtons.tsx`)

- Two buttons: iOS and Android
- Placeholder links for now (use `#` or `/coming-soon`)
- Button text:
  - iOS: "Download on the App Store" or "Coming Soon"
  - Android: "Get it on Google Play" or "Coming Soon"
- Styling:
  - Match app's primary color (#007AFF)
  - Rounded corners (12px)
  - Proper spacing
  - Icon placeholders (optional: use SVG icons for App Store/Play Store)

---

## Dark Mode Support

- Implement dark mode using CSS classes (Tailwind's `dark:` prefix)
- Use system preference detection (optional: `next-themes` package)
- Ensure all text, backgrounds, and cards have dark mode variants
- Test both light and dark modes

---

## Responsive Design

- **Mobile First**: Design for mobile, enhance for desktop
- **Breakpoints**: Use Tailwind defaults (sm: 640px, md: 768px, lg: 1024px)
- **Navigation**: Hamburger menu on mobile, horizontal nav on desktop
- **Typography**: Responsive font sizes (smaller on mobile)
- **Spacing**: Responsive padding/margins

---

## Content Placeholders

Since the user has Privacy Policy and Terms of Service content already, create the pages with:

1. **Placeholder structure** with clear sections
2. **Instructions in comments** on where to add content
3. **Example formatting** so user knows how to structure their content

For example:
```tsx
// Privacy Policy Page
export default function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
      
      {/* 
        ADD YOUR PRIVACY POLICY CONTENT HERE
        Format with <h2> for section headings
        Use <p> for paragraphs
        Use <ul>/<li> for lists
      */}
      
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Section Title</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Your content goes here...
        </p>
      </section>
    </div>
  );
}
```

---

## Deployment Configuration

### Vercel Deployment

1. **Build Command**: `npm run build` (or `next build`)
2. **Output Directory**: `out` (Next.js static export creates this)
3. **Install Command**: `npm install`

### Netlify Deployment

1. **Build Command**: `npm run build`
2. **Publish Directory**: `out`
3. **Install Command**: `npm install`

---

## Package.json Scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "export": "next build"
  }
}
```

---

## Tailwind Configuration

**`tailwind.config.js`** should include:

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class', // or 'media' for system preference
  theme: {
    extend: {
      colors: {
        primary: '#007AFF',
        // Add custom colors if needed
      },
    },
  },
  plugins: [],
}
```

---

## File Requirements Checklist

- [ ] `app/layout.tsx` - Root layout with header/footer
- [ ] `app/page.tsx` - Landing page
- [ ] `app/privacy/page.tsx` - Privacy Policy (with placeholder structure)
- [ ] `app/terms/page.tsx` - Terms of Service (with placeholder structure)
- [ ] `app/about/page.tsx` - About page
- [ ] `components/Header.tsx` - Navigation header
- [ ] `components/Footer.tsx` - Footer
- [ ] `components/AppStoreButtons.tsx` - App store buttons
- [ ] `next.config.js` - Static export configuration
- [ ] `tailwind.config.js` - Tailwind configuration
- [ ] `tsconfig.json` - TypeScript configuration
- [ ] `package.json` - Dependencies
- [ ] `README.md` - Setup instructions

---

## Design Guidelines Summary

1. **Colors**: Use #007AFF as primary, #f5f5f5 for backgrounds, white cards
2. **Typography**: System fonts, bold headings, clean sans-serif
3. **Spacing**: Generous padding (16-32px), clear section spacing
4. **Cards**: White background, rounded corners (16px), subtle shadows
5. **Buttons**: #007AFF background, white text, rounded (12px)
6. **Layout**: Centered content, max-width containers for readability
7. **Responsive**: Mobile-first, breakpoints at 640px, 768px, 1024px
8. **Dark Mode**: Support dark mode with appropriate color variants

---

## Testing Requirements

Before deployment, ensure:

- [ ] All pages load correctly
- [ ] Navigation works on all pages
- [ ] Mobile responsive (test on mobile viewport)
- [ ] Dark mode works correctly
- [ ] All links work (including placeholder app store links)
- [ ] No console errors
- [ ] Fast page loads
- [ ] Proper meta tags for SEO

---

## Additional Notes

1. **Content**: User will provide Privacy Policy and Terms content - create pages with clear structure and comments showing where to add content
2. **App Store Links**: Use placeholders for now - make it easy to update later
3. **Favicon**: Use the app's icon if available, or create a simple one
4. **Performance**: Keep it lightweight, no unnecessary dependencies
5. **Accessibility**: Use semantic HTML, proper heading hierarchy, alt text for images

---

## Build Instructions for AI/Developer

1. Initialize Next.js project with TypeScript and Tailwind
2. Configure for static export in `next.config.js`
3. Set up Tailwind with dark mode support
4. Create the folder structure as specified
5. Build Header component with navigation
6. Build Footer component
7. Build AppStoreButtons component with placeholders
8. Create root layout with Header/Footer
9. Create landing page with hero section and app store buttons
10. Create Privacy Policy page with placeholder structure
11. Create Terms of Service page with placeholder structure
12. Create About page with content
13. Style everything to match the app's design system
14. Test responsive design and dark mode
15. Build and verify static export works
16. Create README with deployment instructions

---

## Expected Output

A fully functional static website that:
- Matches the Overtime+ mobile app's design aesthetic
- Has all required pages (Home, About, Privacy, Terms)
- Is fully responsive and works on mobile/tablet/desktop
- Supports dark mode
- Is ready to deploy to Vercel or Netlify
- Has placeholder content structure for Privacy Policy and Terms
- Has placeholder app store buttons
- Is fast, lightweight, and accessible

---

## Questions to Ask User (if needed)

1. Do you have the app icon/favicon file to use?
2. What specific content should go on the About page?
3. Do you want a contact/support email on the site?
4. Any specific branding guidelines beyond the color scheme?

---

**End of Prompt**



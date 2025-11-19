# App Store Design Brief for Overtime+

## App Overview
**App Name:** Overtime+  
**Purpose:** A professional mobile app for healthcare workers to track shifts and overtime, with automated PDF form generation for Queensland Health AVAC (Attendance Variation and Allowance Claim) forms.  
**Target Audience:** Healthcare professionals, particularly those working in Queensland Health facilities.

---

## Design System

### Color Palette

#### Primary Colors
- **Primary Blue:** `#2563EB` (RGB: 37, 99, 235) - Main brand color, used for primary buttons and key UI elements
- **System Blue:** `#007AFF` (RGB: 0, 122, 255) - iOS system blue, used for links, accents, and interactive elements
- **Light Blue Accent:** `#64B5F6` (RGB: 100, 181, 246) - Used in dark mode for overtime values and highlights

#### Secondary Colors
- **Success Green:** `#10B981` (RGB: 16, 185, 129) - Used for positive actions and success states
- **Success Green Alt:** `#4CAF50` (RGB: 76, 175, 80) - Alternative green for status badges
- **Warning Orange:** `#FFA500` (RGB: 255, 165, 0) - Used for draft status and warnings
- **Info Blue:** `#2196F3` (RGB: 33, 150, 243) - Used for exported status

#### Neutral Colors (Light Mode)
- **Background:** `#FFFFFF` (white) - Main background
- **Secondary Background:** `#F5F5F5` (RGB: 245, 245, 245) - Card backgrounds and secondary surfaces
- **Tertiary Background:** `#F2F2F7` (RGB: 242, 242, 247) - Segment controls and subtle backgrounds
- **Primary Text:** `#111111` (RGB: 17, 17, 17) - Main text color
- **Secondary Text:** `#333333` (RGB: 51, 51, 51) - Secondary text
- **Tertiary Text:** `#666666` (RGB: 102, 102, 102) - Labels and less important text
- **Quaternary Text:** `#999999` (RGB: 153, 153, 153) - Disabled or very subtle text
- **Border:** `#E5E7EB` (RGB: 229, 231, 235) - Input borders
- **Divider:** `#E0E0E0` (RGB: 224, 224, 224) - Card borders

#### Neutral Colors (Dark Mode)
- **Background:** `#000000` (black) - Main background
- **Secondary Background:** `#1C1C1E` (RGB: 28, 28, 30) - Card backgrounds
- **Tertiary Background:** `#2C2C2E` (RGB: 44, 44, 46) - Button backgrounds
- **Primary Text:** `#FFFFFF` (white) - Main text color
- **Secondary Text:** `#AAAAAA` (RGB: 170, 170, 170) - Secondary text
- **Tertiary Text:** `#999999` (RGB: 153, 153, 153) - Labels and less important text

#### Status Colors
- **Draft:** `#FFA500` (Orange)
- **Ready:** `#4CAF50` (Green)
- **Exported:** `#2196F3` (Blue)
- **Error/Delete:** `#D32F2F` (RGB: 211, 47, 47) - Red for destructive actions

### Typography

#### Font Family
- **System Fonts:** The app uses native system fonts (San Francisco on iOS, Roboto on Android)
- **No custom fonts** - relies on platform-native typography for optimal performance and familiarity

#### Font Weights
- **Light:** 300
- **Regular:** 400 (default)
- **Medium:** 500
- **Semibold:** 600 (most common for buttons and labels)
- **Bold:** 700 (headings)
- **Extra Bold:** 800 (large titles)

#### Font Sizes
- **Large Title:** 48px (app name on welcome screen)
- **Title 1:** 32px (main screen titles)
- **Title 2:** 26px (section headers)
- **Title 3:** 18px (card titles)
- **Body:** 16px (primary body text)
- **Subhead:** 15px (secondary text)
- **Footnote:** 13px (labels, metadata)
- **Caption:** 12px (small labels, badges)
- **Tiny:** 11px (very small text)

#### Letter Spacing
- **Tight:** -0.5px (for large titles)
- **Normal:** 0px (default)
- **Wide:** 0.5px (for buttons and emphasis)

### Design Patterns

#### Border Radius
- **Small:** 6px (small buttons, badges)
- **Medium:** 8px (small cards)
- **Large:** 12px (standard cards, buttons)
- **Extra Large:** 16px (large cards, modals)

#### Shadows & Elevation
- **Subtle Shadow:**
  - Color: `#000000`
  - Opacity: 0.06-0.15
  - Offset: (0, 2-4px)
  - Radius: 4-12px
- **Elevation:** 3-8 (Android)

#### Spacing
- **Tight:** 4px
- **Small:** 8px
- **Medium:** 12px
- **Large:** 16px
- **Extra Large:** 24px
- **Huge:** 32px, 48px

#### Design Philosophy
- **Clean & Modern:** Minimalist design with plenty of white space
- **Professional:** Healthcare-focused, trustworthy appearance
- **Accessible:** High contrast, clear hierarchy, readable fonts
- **Card-Based:** Information organized in cards with subtle shadows
- **Dark Mode Support:** Full dark mode with carefully chosen colors
- **iOS/Android Native Feel:** Uses platform conventions and system fonts

---

## Required App Store Assets

### iOS App Store

#### 1. App Icon
- **Size:** 1024x1024px
- **Format:** PNG (no transparency)
- **Requirements:**
  - Must include the app name "Overtime+" or a recognizable logo
  - Should work on both light and dark backgrounds
  - No rounded corners (Apple adds them automatically)
  - Professional, healthcare-focused aesthetic
  - Consider incorporating time/clock elements or a "+" symbol

#### 2. Screenshots (Required for each device size)
- **iPhone 6.7" (iPhone 14 Pro Max, 15 Pro Max, etc.)**
  - Portrait: 1290x2796px
  - Landscape: 2796x1290px (optional)
- **iPhone 6.5" (iPhone 11 Pro Max, XS Max)**
  - Portrait: 1242x2688px
  - Landscape: 2688x1242px (optional)
- **iPhone 5.5" (iPhone 8 Plus)**
  - Portrait: 1242x2208px
  - Landscape: 2208x1242px (optional)
- **iPad Pro 12.9"**
  - Portrait: 2048x2732px
  - Landscape: 2732x2048px (optional)
- **iPad Pro 11"**
  - Portrait: 1668x2388px
  - Landscape: 2388x1668px (optional)

**Screenshot Content Suggestions:**
1. Home screen showing active shift tracking
2. Log entry screen with time inputs
3. Analytics/statistics view
4. Export/PDF generation screen
5. Profile/settings screen

#### 3. App Preview Video (Optional but Recommended)
- **Duration:** 15-30 seconds
- **Format:** MP4, MOV, or M4V
- **Resolution:** Match device screenshot sizes
- **Content:** Show key features in action

### Google Play Store

#### 1. App Icon
- **Size:** 512x512px
- **Format:** PNG (no transparency)
- **Requirements:** Same as iOS icon

#### 2. Feature Graphic
- **Size:** 1024x500px
- **Format:** PNG or JPG
- **Requirements:**
  - Horizontal banner for the top of the Play Store listing
  - Should include app name and key value proposition
  - Text should be readable at small sizes
  - Consider showing app interface mockup or key features

#### 3. Screenshots
- **Minimum:** 2 screenshots required
- **Recommended:** 4-8 screenshots
- **Size:** At least 320px wide, max 3840px wide
- **Aspect Ratio:** 16:9 or 9:16 recommended
- **Format:** PNG or JPG (24-bit color)
- **Content:** Similar to iOS screenshots

#### 4. Promo Video (Optional)
- **Duration:** Up to 2 minutes
- **Format:** YouTube link or uploaded video
- **Content:** Feature demonstration

---

## Design Guidelines for Assets

### Logo Design
- **Style:** Modern, professional, healthcare-focused
- **Elements to Consider:**
  - Clock/time icon (representing shift tracking)
  - Plus symbol (from "Overtime+")
  - Medical/healthcare iconography (subtle)
  - Clean, geometric shapes
- **Color Options:**
  - Primary: Blue (#2563EB or #007AFF) on white/light background
  - Alternative: White logo on blue background
  - Monochrome: For single-color applications
- **Typography:** If including text, use bold, modern sans-serif (similar to system font weights 700-800)

### Screenshot Design
- **Frame Style:** Use actual device frames (iPhone, iPad, Android) or clean, modern mockups
- **Content:** Show real app screens with realistic data
- **Annotations:** Optional - add callouts highlighting key features
- **Background:** 
  - Light mode: White or light gray (#F5F5F5)
  - Dark mode: Black or dark gray (#1C1C1E)
- **Consistency:** Use consistent styling across all screenshots

### Feature Graphic Design
- **Layout:** 
  - Left side: App icon or key visual
  - Right side: App name and tagline
  - Background: Gradient or solid color using brand colors
- **Text:**
  - App name: Large, bold (48-72px)
  - Tagline: Medium size (24-32px)
  - Keep text minimal and readable
- **Colors:** Use primary blue (#2563EB) as main color, white for text

### General Design Principles
1. **Professionalism:** Healthcare app - must look trustworthy and reliable
2. **Clarity:** All text and icons should be clear and readable
3. **Consistency:** Use the same color palette and design language throughout
4. **Simplicity:** Avoid clutter - clean, focused designs
5. **Accessibility:** Ensure sufficient contrast (WCAG AA minimum)
6. **Platform Appropriateness:** iOS assets should feel iOS-native, Android assets Android-native

---

## App Description Context

**Tagline Ideas:**
- "Track shifts and overtime securely across devices"
- "Automated overtime tracking for healthcare professionals"
- "Simplify your shift tracking and AVAC forms"

**Key Features to Highlight:**
- Secure shift and overtime tracking
- Automated PDF form generation (AVAC)
- Offline-first with cloud sync
- Quick log entry with roster integration
- Analytics and insights
- Dark mode support
- Cross-platform (iOS & Android)

---

## Additional Notes

- The app uses a **card-based UI** with rounded corners (12-16px radius)
- **Subtle shadows** create depth and hierarchy
- **Blue** is the primary brand color - use it prominently but not exclusively
- The design should feel **modern** (2024) but not trendy - it needs to age well
- Consider **healthcare iconography** subtly (clocks, calendars, medical symbols)
- The "+" in "Overtime+" could be stylized as a distinctive element

---

## Deliverables Checklist

### For ChatGPT/Design Tool:
- [ ] App icon (1024x1024px) - iOS
- [ ] App icon (512x512px) - Android
- [ ] Feature graphic (1024x500px) - Google Play
- [ ] Screenshot templates/mockups for:
  - [ ] iPhone 6.7" (1290x2796px)
  - [ ] iPhone 6.5" (1242x2688px)
  - [ ] iPhone 5.5" (1242x2208px)
  - [ ] iPad Pro 12.9" (2048x2732px)
  - [ ] iPad Pro 11" (1668x2388px)
  - [ ] Android phone (various sizes)
  - [ ] Android tablet (various sizes)
- [ ] Logo variations (full color, monochrome, light/dark versions)
- [ ] Splash screen design (if needed)

---

## Usage Instructions for ChatGPT

When providing this brief to ChatGPT (or similar AI design tool), use this prompt:

```
I need you to create App Store assets for my mobile app "Overtime+". Please review the design brief in the attached document and create:

1. A professional app icon (1024x1024px for iOS, 512x512px for Android)
2. A feature graphic for Google Play Store (1024x500px)
3. Screenshot mockups showing the app interface

The app is a healthcare shift tracking application. Use the color palette, typography guidelines, and design patterns specified in the brief. The design should be professional, modern, and trustworthy - appropriate for healthcare professionals.

Key requirements:
- Use the primary blue color (#2563EB or #007AFF) as the main brand color
- Include the app name "Overtime+" prominently
- Consider incorporating time/clock elements or a "+" symbol
- Ensure all text is readable and accessible
- Follow the design system guidelines provided

Please create these assets following the specifications in the design brief.
```

---

*This brief was generated based on the actual design system used in the Overtime+ React Native application.*


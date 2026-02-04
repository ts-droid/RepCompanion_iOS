# Design Guidelines: RepCompanion

## Design Approach

**Hybrid Approach:** Apple Human Interface Guidelines foundation with strong reference to professional fitness apps (Strong, Nike Training Club, JEFIT). RepCompanion features a customizable theme system with 8 distinct gradient-based color schemes (Main, Forest, Purple, Ocean, Sunset, Slate, Crimson, Pink), each with dynamic logo variants that adapt to the selected theme and light/dark mode. The design prioritizes information density, quick data entry, and workout tracking efficiency while maintaining iOS native feel.

## Typography System

**Font Stack:**
- Primary: SF Pro Display (Apple system font fallback)
- Headings: SF Pro Display, weight 700, sizes 28px (h1), 24px (h2), 20px (h3)
- Body: SF Pro Text, weight 400, size 16px
- Data/Metrics: SF Pro Display, weight 600, size 18-22px for emphasis
- Labels: SF Pro Text, weight 500, size 14px
- Captions: SF Pro Text, weight 400, size 12px

**Hierarchy Focus:** Bold numerical data (sets, reps, weights) should dominate, with subtle supporting labels.

## Layout System

**Spacing Units:** Tailwind scale of 3, 4, 6, 8, 12 for consistent rhythm
- Card padding: p-4 to p-6
- Section spacing: mb-6 to mb-8
- Component gaps: gap-3 to gap-4
- Screen padding: px-4, py-6

**Grid Structure:**
- Single column primary layout (mobile-first)
- Two-column grids for exercise sets/reps input (grid-cols-2)
- Three-column for equipment thumbnails (grid-cols-3)
- Full-width cards with rounded corners (rounded-2xl)

## Core Screens & Layouts

### 1. Dashboard (Movergy Index Style)
- Large circular progress gauge at top (200px diameter)
- Stats cards in 2-column grid below gauge
- Weekly streak calendar (7-day horizontal scroll)
- Recent workouts list (card-based, chronological)

### 2. Training Programs (ETAPP Overview)
- Horizontal scroll card carousel for active programs
- Card size: Full-width minus margins, 180px height
- Each card shows: Program name, current week/phase, progress bar, next workout time
- "Alla program" link to full program library
- Stacked card shadows for depth

### 3. Exercise Library
- Searchable header with category pills (Warm-up, Styrka, Kondition, Stretching)
- Exercise cards with left-aligned thumbnail (60x60px), exercise name, and muscle group tag
- Expandable cards reveal: sets/reps scheme, equipment needed, notes
- Quick-add FAB button (bottom-right, 56x56px)

### 4. Active Workout Session
- Sticky header: Timer, current exercise name, X/Y exercises completed
- Main area: Large set/rep input fields (numeric keypad optimized)
- Previous set history shown as reference (ghosted)
- Swipe-to-next-exercise gesture
- Bottom action bar: Rest timer, finish workout, skip exercise

### 5. Equipment Library
- 3-column grid of equipment cards
- Square cards (aspect-ratio-1) with image and label
- Filter tabs: Alla, Hantlar, Cables, Resistance Bands, Machines
- Selection state with checkmark overlay

## Theme System & Gradient Guidelines

**CRITICAL RULE:** ALL primary buttons and badges MUST use the gradient system defined in `index.css`. NEVER use custom hardcoded colors like `bg-green-*`, `bg-orange-*`, `bg-emerald-*`, `bg-blue-*`, etc.

### Gradient System
RepCompanion features 8 customizable themes with dynamic gradient colors:
- **Main** (default): Cyan-green gradient
- **Forest**: Green gradient
- **Purple**: Purple-blue gradient
- **Ocean**: Light blue gradient
- **Sunset**: Amber-orange gradient
- **Slate**: Gray-blue gradient
- **Crimson**: Red-burgundy gradient
- **Pink**: Magenta-pink gradient

### Button & Badge Styling Rules

**Buttons:**
- Primary CTA: Use `variant="default"` - automatically applies theme gradient
- Secondary: Use `variant="outline"` or `variant="ghost"` 
- Destructive: Use `variant="destructive"` for errors/warnings
- NEVER override with custom bg colors unless absolutely necessary for design

**Badges:**
- Status (completed, active): Use `variant="default"` - automatically applies theme gradient
- Informational: Use `variant="secondary"` for neutral information
- Errors/Warnings: Use `variant="destructive"` for cancelled/error states
- Minimal: Use `variant="outline"` for subtle labels
- NEVER use custom colors like `bg-orange-500/10`, `bg-green-600`, etc.

### Why Use the Gradient System?
1. **Consistency**: All 8 themes work automatically
2. **Maintainability**: Single source of truth in `index.css`
3. **User Experience**: Themes switch seamlessly without broken colors
4. **Future-proof**: New themes automatically work with existing components

### Examples of Correct Usage
```tsx
// ✅ CORRECT - Uses gradient system
<Badge variant="default">Färdigt</Badge>
<Button variant="default">Starta pass</Button>

// ✅ CORRECT - Uses theme-based variants
<Badge variant="destructive">Avbrutet</Badge>
<Badge variant="outline">Info</Badge>

// ❌ WRONG - Custom hardcoded colors
<Badge className="bg-green-600">Färdigt</Badge>
<Badge className="bg-orange-500/10 text-orange-600">Avbrutet</Badge>
```

## Component Library

### Cards
- Primary cards: rounded-2xl, shadow-lg, backdrop blur effect
- Elevated cards: shadow-xl for interactive elements
- List cards: rounded-xl, subtle shadow, tap feedback
- Padding: p-4 standard, p-6 for feature cards

### Buttons
- Primary CTA: Full-width, rounded-full, h-12, font-semibold
- Secondary: Outlined, rounded-full, h-10
- Icon buttons: Circular, 40x40px minimum tap target
- Pill buttons: Horizontal scroll groups for categories

### Input Fields
- Large numeric inputs: h-16, text-2xl, center-aligned for set/rep entry
- Text inputs: h-12, rounded-lg, with floating labels
- Steppers: +/- buttons flanking value for weight adjustment

### Navigation
- Bottom tab bar: 5 items max (Dashboard, Programs, Exercises, Progress, Profile)
- Icon + label, safe area inset aware
- Active state: Icon fill + slight scale
- Top navigation: Large title style (iOS 11+), search integrated

### Progress Indicators
- Circular progress: Stroke-based, 8px thickness, animated
- Linear progress: h-2, rounded-full, within cards
- Step indicators: Connected dots for program phases
- Streak calendar: 7-day grid, completed days filled

### Data Visualization
- Stat cards: Large number (32px), small label (12px), trend arrow
- Exercise history: Horizontal bar charts for volume over time
- PR badges: Small circular badges with gold accent (when achieved)

## Interaction Patterns

**Gestures:**
- Swipe left/right: Navigate between exercises in workout
- Pull to refresh: Update dashboard, sync Health data
- Long press: Quick actions on exercise cards (edit, delete, favorite)
- Tap and hold: Timer controls (pause/resume)

**Feedback:**
- Haptic feedback on set completion (success haptic)
- Subtle scale animation on button press (0.95 transform)
- Loading states: Skeleton screens for data-heavy views
- Success states: Checkmark animations with bounce

**Transitions:**
- Modal presentations: Bottom sheet slide-up for inputs
- Navigation: Push/pop with iOS native feel
- Card expansions: Smooth height animation
- State changes: 200ms ease-in-out

## Accessibility

- Minimum tap targets: 44x44px (Apple HIG standard)
- High contrast ratios for all text
- VoiceOver labels for all interactive elements
- Dynamic type support (scales with iOS text size settings)
- Reduce motion respect for animations

## PWA-Specific Elements

- Install prompt: Custom bottom sheet on 2nd visit
- Standalone mode: Hide Safari UI, full-screen immersion
- Splash screen: App icon + name on launch
- Home screen icon: 180x180px with rounded corners
- Status bar: Translucent, content-aware scrolling

## Images

**Equipment Library:** High-quality photos of gym equipment (dumbbells, barbells, cables, resistance bands, machines) - 300x300px minimum, transparent or neutral backgrounds

**Exercise Thumbnails:** Illustrated or photographic demonstrations of proper form - 240x240px, consistent style throughout

**Program Cards:** Motivational imagery or abstract fitness graphics - 400x180px hero images for program overview cards

**Avatar/Profile:** User photo placeholder - 80x80px circular

No large hero images needed; this is a utility-focused app prioritizing data density over marketing imagery.
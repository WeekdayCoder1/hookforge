# HookForge v2 - Testing Guide

## Quick Start

Before testing, start the dev server:

```bash
npm run dev
```

Then navigate to `http://localhost:3000` in your browser.

---

## Feature Testing Checklist

### 1. Sidebar Collapse (Desktop Only)

**How to test:**

1. Open the app on desktop (screen width > 768px)
2. Look for a collapse/expand button at the top-left of the sidebar
3. Click the button to toggle between collapsed (80px) and expanded (260px) states

**Expected behavior:**

- Sidebar smoothly animates width change (300ms)
- Logo, text, and buttons hide when collapsed
- Icons remain visible with tooltips on hover
- History shows icon-only view when collapsed
- New Hook, Dark Mode, and user buttons show tooltips

**Preserved:**

- All functionality remains the same
- History items still clickable
- All buttons still work

---

### 2. Mobile Sidebar

**How to test:**

1. Open the app on mobile (screen width < 768px) or resize browser
2. Tap the hamburger menu icon in the top-left
3. Sidebar should slide in from the left
4. Tap the backdrop area or menu items to close

**Expected behavior:**

- Fixed positioning sidebar slides in smoothly
- Backdrop with blur effect appears behind sidebar
- Sidebar closes when you click a history item or backdrop
- No horizontal scroll

---

### 3. Light Mode Design (Glass SaaS)

**How to test:**

1. Open app (check dark mode toggle is OFF)
2. Look at page background, cards, and buttons

**Expected styling:**

- **Page background**: Subtle purple gradient (not plain white)
  ```
  Gradient: #f5f3ff → #fafafe → #f0f4ff
  ```
- **Cards**: Semi-transparent white with blur
  ```
  bg-white/60 + backdrop-blur-xl
  ```
- **Borders**: Subtle white/30 border on cards
- **Buttons**: Purple gradient maintained with smooth hover effects
- **Hover effects**: Cards and buttons lift smoothly

**Preserved:**

- All text remains readable
- No impact on functionality

---

### 4. Dark Mode Design (Glass SaaS + Gradient)

**How to test:**

1. Click the dark mode toggle (sun/moon icon in bottom-left of sidebar)
2. Observe the entire app color scheme change
3. Refresh the page (setting is persisted)

**Expected styling:**

- **Page background**: Dark gradient (almost black to deep purple)
  ```
  from-black via-[#0f0f1a] to-purple-900
  ```
- **Cards**: Dark glass style
  ```
  bg-white/5 + backdrop-blur-xl + border-white/10
  ```
- **Text**: Light text on dark background
- **Smooth transition**: No jarring color change, smooth 300ms transition

**Preserved:**

- All dark mode functionality
- User preference saved to localStorage
- System preference detection still works

---

### 5. Generate Button Validation

**How to test:**

1. Observe the "✦ Generate Hooks" button in the form
2. Try these scenarios:

**Scenario A: Empty topic**

- Leave the topic input empty
- **Expected**: Button is disabled (grayed out), cannot click
- **Disabled styling**: `opacity-50` + `cursor-not-allowed`

**Scenario B: Topic entered**

- Type something in the topic input
- **Expected**: Button becomes enabled (full color)

**Scenario C: While generating**

- Click the button with valid input
- **Expected**: Button is disabled while generating (shows spinner)

**Scenario D: Free tier limit (requires 5 generations)**

- If you have a free account and already generated 5 hooks
- **Expected**: Button is disabled, Usage bar shows 5/5

**Preserved:**

- Generation API works as before
- History saving works as before
- All backend logic untouched

---

### 6. Niche/Tone Modal (NEW!)

**How to test:**

1. Look at the form where Niche and Tone are displayed
2. Instead of dropdown selects, there are now buttons showing current values
3. Click either button to open the modal

**Test Niche Modal:**

1. Click the "Niche" button (currently shows "Motivation")
2. Modern glass modal slides in with animation
3. Full grid of niche options appears: Motivation, Self Improvement, Finance, Tech, Fitness, Education, Storytelling
4. Selected option has purple background
5. Click a new niche to select it
6. Modal closes instantly

**Test Tone Modal:**

1. Click the "Tone" button (currently shows "Bold")
2. Modal shows tone options: Bold, Curious, Controversial, Emotional, Authority, Relatable
3. Same selection/highlight behavior

**Modal Interactions:**

1. **Close by selection**: Click any option to select and close
2. **Close by X button**: Click the × button in top-right to close without changing
3. **Close by backdrop**: Click the dark area outside the modal to close
4. **Tab switching**: Click Niche/Tone tabs at bottom to switch between options

**Expected styling:**

- **Overlay**: `bg-black/40` with blur
- **Modal window**: Glass style with smooth animation
  - Entry: Scale (0.95→1) + opacity (0→1) in 200ms
- **Options**: Button grid with hover states
- **Selected state**: Purple background + border highlight

**Preserved:**

- Niche and tone still affect hook generation
- All selections saved to state properly
- API receives correct values

---

### 7. Micro Animations

Test these animations throughout the app:

**A. Sidebar Collapse Animation**

- Collapse/expand button: Smooth width transition (300ms)
- ✓ Should feel smooth, not jerky

**B. Button Hover Effects**

- Hover over any button (Generate, New Hook, Upgrade, etc.)
- Expected: Subtle scale effect + shadow increase
- Active click: Brief scale-down (0.98) effect

**C. Card Hover Effects**

- Hover over generated hook cards
- Expected: Card lifts with increased shadow
- Border and text may shift color smoothly

**D. Dark Mode Toggle**

- Toggle dark mode on/off
- Expected: Smooth color transitions, no flicker
- Sun/moon emoji rotates smoothly (360deg)

**E. Modal Animation**

- Open niche/tone modal
- Expected: Modal scales in from center + fades in (200ms)
- Not an abrupt pop-in

---

### 8. Core Features Still Work

**Authentication:**

1. Click "Sign In →" button (if not logged in)
2. Magic link modal should appear (not changed)
3. Enter email, receive magic link, should sign in

**Hook Generation:**

1. Enter topic "How to make coffee"
2. Keep niche/tone defaults or change them
3. Select platform (YouTube, Instagram, etc.)
4. Click "Generate Hooks"
5. Should receive 5 hook suggestions

**History:**

1. After generating hooks, log in
2. Click on different history items in sidebar
3. They should load previous hook results
4. Sidebar should close (mobile) or stay open (desktop)

**Usage Tracking:**

1. For free accounts: Should show 5-generation limit
2. Progress bar should accurately reflect usage
3. Plan badge shows correct tier (Free/Pro)

---

## Browser Compatibility

Test on:

- ✓ Chrome/Chromium (Latest)
- ✓ Firefox (Latest)
- ✓ Safari (Latest)
- ✓ Edge (Latest)
- ✓ Mobile browsers (iOS Safari, Chrome Mobile)

---

## Performance Notes

- Glass blur effects use `backdrop-filter` (hardware accelerated)
- Sidebar collapse uses CSS transforms (smooth 300ms)
- Animations use `transition-all` for perceived smoothness
- Modal animations are 200ms (snappy, not slow)
- No janky reflows or layout shifts

---

## Troubleshooting

**Issue**: Sidebar not collapsible

- **Solution**: Make sure you're on desktop (screen width > 768px)
- **Check**: Resize browser window larger if on desktop

**Issue**: Glass effect looks pixelated

- **Solution**: Check browser supports CSS `backdrop-filter`
- **Note**: Fallback colors still work on unsupported browsers

**Issue**: Dark mode colors look wrong

- **Solution**: Clear browser cache and refresh
- **Note**: Gradient should be dark with purple tint

**Issue**: Modal doesn't appear

- **Solution**: Check if JavaScript is enabled
- **Note**: Should see modal animation on click

---

## Success Criteria

All of these should work:

- [ ] Sidebar collapses on desktop
- [ ] Sidebar shows tooltips when collapsed
- [ ] Mobile sidebar slides in/out
- [ ] Light mode has purple gradient
- [ ] Dark mode has dark-to-purple gradient
- [ ] Cards use glass styling
- [ ] Generate button validates empty topic
- [ ] Niche/Tone modal opens and closes
- [ ] Niche/Tone selection works
- [ ] All animations are smooth
- [ ] Login still works
- [ ] Hook generation still works
- [ ] History still works
- [ ] Usage tracking still works

**Once all tests pass**, HookForge v2 is ready for production! ✅

---

## Need Help?

If something doesn't work:

1. Check console for errors: F12 → Console tab
2. Verify dev server running: `npm run dev`
3. Try hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
4. Check the file modifications in summary document

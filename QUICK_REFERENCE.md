# HookForge v2 - Quick Reference

## 🚀 Getting Started

```bash
# Install dependencies (if not done)
npm install

# Start dev server
npm run dev

# Build for production
npm build

# Start production server
npm start
```

Navigate to: `http://localhost:3000`

---

## 📋 Key Features Overview

### Sidebar Collapse (Desktop)

- **Toggle Button**: Top-left corner of sidebar
- **Widths**: 260px (expanded) ↔ 80px (collapsed)
- **Animation**: 300ms smooth width transition
- **Hover Tooltips**: Shows function name on hover when collapsed
- **Mobile**: Slides in from left (fixed position)

### Glass SaaS Design

- **Light Mode**: Subtle purple gradient background
- **Dark Mode**: Dark-to-purple gradient background
- **Cards**: Semi-transparent white/black with blur effect
- **Consistency**: All cards use same glass styling

### Niche/Tone Selection

- **Old Way**: Dropdown selects
- **New Way**: Modal with grid selection
- **Options**:
  - **Niche**: 7 options (Motivation, Finance, Tech, etc.)
  - **Tone**: 6 options (Bold, Curious, Emotional, etc.)
- **Animation**: Scale + fade animation (200ms)
- **Interaction**: Click to select, X to cancel, backdrop to close

### Validation & UX

- **Generate Button**: Disabled if topic is empty
- **Visual Feedback**: 50% opacity when disabled
- **State Management**: Proper enable/disable logic
- **No Breaking Changes**: All existing features work

---

## 🎨 Design System

### Colors

#### Light Mode

- Background Gradient: `#f5f3ff → #fafafe → #f0f4ff`
- Card Background: `rgba(255, 255, 255, 0.6)`
- Card Border: `rgba(255, 255, 255, 0.3)`
- Primary Gradient: Violet → Purple

#### Dark Mode

- Background Gradient: `#000000 → #0f0f1a → #2d1b69`
- Card Background: `rgba(0, 0, 0, 0.4)`
- Card Border: `rgba(255, 255, 255, 0.1)`
- Primary Gradient: Violet → Purple (same)

### Spacing

- Sidebar: 20px padding / 16px when collapsed
- Cards: 24px padding (6)
- Buttons: 16px × 12px padding (default)

### Animations

- Sidebar collapse: 300ms ease-in-out (width)
- Button hover: 300ms smooth (all transitions)
- Modal entry: 200ms ease-out (scale + fade)
- Dark mode toggle: 300ms smooth (no flicker)

### Border Radius

- Sidebar: No border radius (full height)
- Cards: `rounded-2xl` (16px)
- Buttons: `rounded-xl` (12px)
- Small elements: `rounded-lg` (8px)

---

## 📁 File Structure Changes

### Modified Files

```
src/app/
├── page.tsx              (Main page component - UPDATED)
└── globals.css           (Global styles - UPDATED)
```

### New Documentation Files

```
├── UPGRADE_SUMMARY_V2.md  (What changed & why)
├── TESTING_GUIDE_V2.md    (How to test features)
├── CHANGELOG_V2.md        (Detailed code changes)
└── QUICK_REFERENCE.md     (This file)
```

### Unchanged Files

```
src/lib/
├── supabase.ts           (No changes)

src/app/api/
├── generate/
│   └── route.ts           (No changes)

src/app/fonts/            (No changes)
src/app/layout.tsx        (No changes)
```

---

## 🧪 Quick Testing

### Test 1: Sidebar Collapse (30 secs)

```
1. Open app
2. Click collapse button (top-left)
3. Sidebar should animate to 80px wide
4. Click again to expand
5. ✓ Test passes if smooth animation
```

### Test 2: Dark Mode Toggle (20 secs)

```
1. Find dark mode toggle (bottom of sidebar)
2. Click to toggle dark/light
3. Entire app should change theme smoothly
4. ✓ Test passes if no flicker
```

### Test 3: Niche/Tone Modal (30 secs)

```
1. Click "Niche" or "Tone" button in form
2. Modern modal should slide in
3. Click an option to select
4. Modal closes, value updates
5. ✓ Test passes if smooth animation
```

### Test 4: Generate Validation (20 secs)

```
1. Clear topic input
2. Generate button should be grayed out
3. Type something in topic
4. Button should become active
5. ✓ Test passes if button correctly enables/disables
```

### Test 5: Mobile Sidebar (30 secs)

```
1. Resize browser to mobile width (<768px)
2. Click hamburger menu
3. Sidebar should slide in from left
4. Click item or backdrop to close
5. ✓ Test passes if smooth slide
```

---

## 🔒 What Didn't Change

### Core Features

- ✅ Supabase authentication (magic links)
- ✅ Hook generation API (`/api/generate`)
- ✅ Database queries and schema
- ✅ Hook history saving and loading
- ✅ Usage tracking (5 free generations)
- ✅ Free/Pro plan distinction
- ✅ All business logic

### No Breaking Changes

- ✅ Existing database records
- ✅ User sessions
- ✅ Hook generation results
- ✅ History data
- ✅ Stripe integration (if applicable)

---

## 🐛 Debugging

### Common Issues

**Issue**: Sidebar doesn't collapse

- **Cause**: Might be on mobile (< 768px width)
- **Fix**: Resize browser window larger or use desktop

**Issue**: Dark mode looks weird

- **Cause**: Might be CSS caching
- **Fix**: Hard refresh (Ctrl+Shift+R) or Clear cache

**Issue**: Modal doesn't show

- **Cause**: JavaScript disabled or old browser
- **Fix**: Enable JS, try newer browser, check console

**Issue**: Glass effect looks weird

- **Cause**: Old browser doesn't support backdrop-filter
- **Fix**: Fallback colors are still applied, update browser

### Debug Steps

1. Open DevTools: `F12`
2. Check Console tab for errors
3. Check Network tab for API issues
4. Check Elements tab for CSS issues
5. Hard refresh: `Ctrl+Shift+R`

---

## 📊 Performance Metrics

### Animations

- Sidebar collapse: **300ms** (smooth, not jarring)
- Modal entry: **200ms** (snappy)
- Button hover: **300ms** (smooth feedback)
- Dark mode switch: **300ms** (no flicker)

### Hardware Acceleration

- Glass blur uses CSS `backdrop-filter` (GPU)
- Sidebar uses CSS `transform` (GPU)
- All animations use `transition-all` (smooth)

### Bundle Size Impact

- CSS additions: ~50 lines (minimal)
- No new dependencies added
- No JavaScript libraries added
- Pure CSS and component logic

---

## 🚢 Deployment

### Before Deploying

- [ ] Test all features locally
- [ ] Test on multiple browsers
- [ ] Test on mobile device
- [ ] Verify no console errors
- [ ] Run `npm run build` successfully
- [ ] Check changes summary document

### Deployment Command

```bash
npm run build
npm run start
```

### Environment Variables

No new environment variables needed. All existing vars still work:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Any other existing vars

---

## 📚 Documentation Files

| File                    | Purpose                            |
| ----------------------- | ---------------------------------- |
| `UPGRADE_SUMMARY_V2.md` | High-level overview of all changes |
| `TESTING_GUIDE_V2.md`   | Step-by-step testing instructions  |
| `CHANGELOG_V2.md`       | Detailed code changes line-by-line |
| `QUICK_REFERENCE.md`    | This file - quick commands & tips  |

---

## 🎯 Success Criteria

Your HookForge v2 upgrade is successful when:

- [x] Dev server builds without errors
- [x] All UI components render correctly
- [x] Sidebar collapses smoothly on desktop
- [x] Glass effect displays properly
- [x] Dark mode transitions smoothly
- [x] Niche/Tone modal works perfectly
- [x] Generate button validates correctly
- [x] All existing features still work
- [x] No console errors or warnings
- [x] Mobile layout remains responsive

---

## 💡 Tips & Tricks

### For Developers

- Use `smooth-transition` class for any new animated elements
- Glass styling uses `glass` and `glass-sidebar` classes
- Sidebar collapse state is `sidebarCollapsed` boolean
- Modal state is `showNicheToneModal` + `nicheToneTab`

### For Users

- Collapsed sidebar doesn't hide functionality, just saves space
- Hover over collapsed sidebar icons for function names
- Mobile gesture: swipe left to close sidebar
- Setting: Dark mode preference is saved in localStorage

### For Designers

- All colors support light/dark mode automatically
- Glass effect ensures text remains readable
- Purple gradient works with any background
- Animations follow 200-300ms standard for web

---

## 📞 Support

If you encounter any issues:

1. **Check the docs**: Read TESTING_GUIDE_V2.md first
2. **Clear cache**: Hard refresh browser
3. **Check console**: F12 → Console tab
4. **Review changes**: See CHANGELOG_V2.md
5. **Revert if needed**: Git diff shows exactly what changed

---

## 🎉 That's It!

HookForge v2 is now live and ready to use!

Key improvements:

- ✨ Modern glass SaaS design
- ✨ Collapsible sidebar for focused work
- ✨ Smooth animations throughout
- ✨ Better dark mode experience
- ✨ Modern modal for selections
- ✨ All existing features preserved

**Happy coding!** 🚀

---

_Last Updated: March 1, 2026_
_HookForge v2.0.0_

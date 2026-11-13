# Phase 7 — Responsive Design, Accessibility and Polish

## Objective

Improve the overall usability, accessibility,
responsive behavior, and visual quality of WeatherBoard.

## Instructions for Claude Code

### Accessibility

Implement:

- Semantic HTML
- Accessible headings
- Main landmark
- Accessible labels
- Keyboard navigation
- Visible focus indicators
- Appropriate ARIA attributes
- Screen-reader announcements
- Accessible dialogs
- Sufficient color contrast

Target WCAG 2.1 AA where applicable.

### Responsive design

Validate:

- 320px
- 375px
- 768px
- 1280px
- 1440px
- 1920px

Requirements:

1. Prevent horizontal overflow.
2. Handle long city names.
3. Support 200% browser zoom and reflow.
4. Maintain touch targets of at least 44px.
5. Ensure dialogs fit smaller screens.
6. Support landscape layouts.
7. Keep navigation usable across screen sizes.

### Visual polish

- Improve spacing consistency.
- Refine card layouts.
- Improve typography hierarchy.
- Add appropriate loading transitions.
- Improve empty and error states.
- Maintain consistent iconography.

### Animations

If animations are used:

- Keep them lightweight.
- Support reduced-motion preferences.
- Provide static fallbacks.
- Avoid blocking the initial application render.
- Ensure animations do not interfere with accessibility.

### Automated accessibility

Add automated accessibility testing where appropriate.

Run accessibility checks across:

- Relevant application states
- Supported screen sizes
- Light and dark themes

### Testing

Run:

- TypeScript
- ESLint
- Unit tests
- End-to-end tests
- Accessibility scans
- Production build

Document manual accessibility testing limitations.

### Git

Create branch: feature/responsive-polish

Use Conventional Commits.
Do not push directly to main.

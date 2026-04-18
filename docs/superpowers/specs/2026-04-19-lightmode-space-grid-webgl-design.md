# Light Mode WebGL Space Grid Design

## Summary

Replace the current light-mode `LightWarpBackground` canvas effect with a lightweight WebGL scene that renders a clean, scientific, space-inspired 3D grid. The grid should feel like a perspective floor receding toward a horizon, with a cursor-driven gravity well that bends the mesh locally without disturbing the existing globe layer or the dark-mode background.

This design is the `option 3` fallback after canvas-based grid distortion proved visually limited and performance-sensitive on the main thread.

## Goals

- Deliver a cleaner and more premium light-mode background with a stronger "space-time curvature" feel.
- Move the expensive deformation work from 2D canvas path math to GPU-friendly mesh displacement.
- Keep the visual language restrained: scientific, minimal, and cosmic rather than neon or synthwave.
- Preserve the existing globe layer and dark-mode visuals.
- Scope the change to desktop light mode only.

## Non-Goals

- No changes to dark mode.
- No full-screen postprocessing stack.
- No particle storms, plasma blobs, or decorative orbit effects.
- No changes to product, checkout, auth, or other page logic.

## Visual Direction

### Base composition

- Keep the current globe visual as its own layer.
- Add a perspective 3D grid plane in the lower half of the viewport.
- Use a soft white background with a faint cool horizon glow where the grid recedes.
- Add a sparse and subtle starfield only if the scene needs extra depth; stars must stay secondary to the grid.

### Interaction

- Cursor movement creates a localized gravity well in the grid.
- The well should feel like a depression in a spatial surface, not a circular overlay.
- The deformation must stay local and decay smoothly outside the interaction radius.
- When the cursor stops, the mesh should settle quickly and remain stable.

### Color and material

- Grid lines: dark neutral or blue-black, thin and clean.
- Horizon glow: cool white / faint blue, low intensity.
- No saturated neon accents.
- No visible decorative rings or pulsing halos around the cursor.

## Architecture

### Existing boundary

- `frontend/components/ui/LightWarpBackground.tsx` remains the public entry point used by the rest of the app.
- `frontend/components/ui/GlobeBackground.tsx` stays responsible for the globe and existing background layering logic.

### New units

- `frontend/components/ui/LightWarpBackground.tsx`
  - Light-mode entry wrapper.
  - Chooses the WebGL background implementation for desktop light mode.
- `frontend/components/ui/LightSpaceGridScene.tsx`
  - Owns the WebGL canvas, scene setup, resize handling, and interaction lifecycle.
- `frontend/components/ui/light-space-grid-config.ts`
  - Centralizes scene constants such as grid size, subdivision count, horizon ratio, displacement radius, and DPR caps.
- `frontend/components/ui/light-space-grid-material.ts`
  - Encapsulates shader/material logic for the grid surface.
- `frontend/components/ui/light-space-grid-stars.ts`
  - Optional sparse star layer if needed after visual tuning.

## Rendering Approach

### Scene shape

- One perspective camera.
- One grid plane mesh positioned as a receding floor in the lower half of the viewport.
- One lightweight shader or custom material that supports local displacement around the cursor.
- Optional minimal star points layer behind the grid if visual depth is insufficient.

### Displacement model

- Cursor position is projected into normalized scene space.
- The grid shader computes falloff by distance from the projected cursor position.
- Vertices near the cursor are displaced downward and slightly pulled inward to make curvature more legible.
- The effect must not propagate globally across the plane.

### Performance model

- Cap DPR to avoid overdraw on high-resolution displays.
- Avoid postprocessing passes.
- Keep mesh subdivision only as high as needed for a convincing local depression.
- Render continuously only while cursor state is changing; otherwise allow the scene to idle.

## Layering and Integration

- The WebGL light-mode scene sits behind page content.
- The globe remains visually stable and should not be warped by the grid deformation.
- The WebGL grid and the globe must use predictable z-ordering so one does not flicker through the other.
- The dark-mode path must remain untouched.

## Error Handling and Fallbacks

- If WebGL or required APIs are unavailable, fall back to a simple static light background rather than a heavy canvas effect.
- If reduced-motion preferences are detected, reduce displacement strength and skip any non-essential motion.
- If scene initialization fails, fail closed to a plain background without blocking the page.

## Testing Strategy

### Automated

- Update `frontend/__tests__/light-warp-background.test.tsx` to validate:
  - a new `data-warp-mode` marker for the WebGL implementation
  - configuration metadata for the space-grid mode
  - stable light-mode desktop entry behavior
- Add focused tests for:
  - config defaults
  - scene mode selection
  - fallback flags when WebGL is unavailable

### Verification

- `npm test -- --runInBand light-warp-background.test.tsx`
- `npx tsc --noEmit`
- `npm run build`

### Manual visual review

- Check desktop light mode on homepage and at least one content-heavy page.
- Confirm the grid reads as a 3D floor, not a flat 2D overlay.
- Confirm the cursor depression feels local, smooth, and non-laggy.
- Confirm the globe remains stable and visually separate.

## Acceptance Criteria

- Light mode uses a WebGL-based perspective grid instead of the current 2D canvas grid deformation.
- The visual tone is clean, scientific, and space-oriented.
- Cursor interaction produces a localized gravity-well effect that reads clearly as mesh deformation.
- Dark mode remains unchanged.
- The implementation builds cleanly and does not introduce new frontend errors.

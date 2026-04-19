# Light Mode Interstitial Space Lens Design

## Summary

Add a subtle, always-on space-distortion layer between the existing light-mode globe and the WebGL perspective grid. The globe must remain visually untouched. The new layer should read as a thin gravitational lens sheet that slightly bends the space between the globe and the grid, reinforcing the "scientific cosmic" direction without turning into fog, neon, or decorative FX.

This spec extends the WebGL light-mode space-grid direction already defined in [2026-04-19-lightmode-space-grid-webgl-design.md](C:/Users/Asus/Documents/FYP/FYP/docs/superpowers/specs/2026-04-19-lightmode-space-grid-webgl-design.md).

## Goals

- Add depth between the globe and the grid without distorting the globe itself.
- Make the light-mode scene feel more like curved space than a simple grid-on-white background.
- Keep the effect always present but restrained.
- Preserve the clean, scientific, premium visual tone.

## Non-Goals

- No change to dark mode.
- No direct deformation of the globe mesh or globe silhouette.
- No thick volumetric fog, ripples, pulse bands, or plasma-style effects.
- No strong interaction dependency; this effect should not only appear on hover.

## Visual Direction

### Composition

- The globe remains the highest visual anchor in the background stack.
- The grid remains the lower perspective plane.
- A thin `space lens` layer sits visually between them.
- The lens is not a visible object with a hard outline; it is perceived through subtle refraction-like bending and a faint atmospheric compression effect.

### Behavior

- The lens is always on at low intensity.
- It slightly distorts the apparent space above the grid and below the globe.
- The effect should feel strongest near the center band between those two elements, then fade out smoothly.
- It must never create a bright ring, visible bubble, or portal-like edge.

### Color and tone

- Use extremely restrained cool-white / pale-blue energy.
- The lens should be visible mostly by spatial bending and slight luminance compression, not by obvious color.
- The effect should support a clean "space science" aesthetic, not cinematic fantasy.

## Architecture

### Existing units involved

- `frontend/components/ui/GlobeBackground.tsx`
  - Continues to own the globe layer and overall background composition.
- `frontend/components/ui/LightWarpBackground.tsx`
  - Continues to own the light-mode background entry point.
- `frontend/components/ui/LightSpaceGridScene.tsx`
  - Continues to own the WebGL grid scene.

### New unit

- `frontend/components/ui/light-space-lens-config.ts`
  - Central configuration for lens placement, falloff, opacity ceiling, and optional pointer coupling.

### Modified unit responsibilities

- `LightSpaceGridScene.tsx`
  - Gains a second lightweight visual layer representing the interstitial lens.
  - Keeps this layer separate from the grid deformation logic so it can be tuned independently.

## Rendering Approach

### Preferred implementation

- Add a lightweight `lens sheet` between the globe and the grid inside the same WebGL scene.
- The lens can be represented as:
  - a thin transparent plane with a shader, or
  - a second mesh layer that modulates alpha/refraction-like distortion very subtly.

### Lens behavior

- The lens should create:
  - mild spatial compression
  - slight line bending in the grid behind it
  - a faint horizon-to-center depth cue
- The lens should not introduce a second dominant motion system.
- If pointer coupling is added later, it must stay secondary to the current gravity well on the grid.

### Positioning

- The lens should sit above the grid plane and below the globe in scene depth.
- It should span the visual corridor between them, not the entire viewport.
- Its strongest contribution should appear in the middle third of that corridor.

## Performance Constraints

- Keep the lens in the same WebGL scene as the grid to avoid multiple heavy render stacks.
- Avoid postprocessing.
- Prefer one extra lightweight mesh/material over scene-wide screen-space distortion.
- The lens should not require a permanent high-cost animation loop by itself.

## Error Handling and Fallbacks

- If the lens cannot initialize, the scene should fall back to the existing grid-only WebGL background.
- Failures must not block the globe or the page.
- Reduced-motion mode may keep the lens static and lower intensity further.

## Testing Strategy

### Automated

- Extend the light-mode background config metadata to expose:
  - `spaceLensEnabled`
  - `spaceLensMode`
  - `spaceLensAlwaysOn`
- Add or update tests to verify these flags are reported correctly.

### Verification

- `npm test -- --runInBand light-warp-background.test.tsx`
- `npx tsc --noEmit`
- `npm run build`

### Manual visual review

- Confirm the globe remains unchanged.
- Confirm the space between globe and grid feels subtly curved.
- Confirm the lens reads as part of the environment, not as a visible object.
- Confirm the scene still feels clean rather than decorative.

## Acceptance Criteria

- Light mode includes a subtle always-on lens effect between the globe and the grid.
- The globe itself remains visually stable and unwarped.
- The lens improves depth perception without adding visual clutter.
- The implementation keeps the current scientific, clean cosmic direction intact.

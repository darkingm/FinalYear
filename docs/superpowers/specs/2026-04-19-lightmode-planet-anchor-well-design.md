# Light Mode Planet Anchor Well Design

## Summary

Add a second, always-on deformation field to the light-mode WebGL space grid so the grid appears subtly compressed beneath the globe. This field is separate from the existing cursor-driven gravity well and should make the globe feel visually "grounded" in the surrounding curved space without deforming the globe itself.

This spec builds on the existing WebGL grid direction and the interstitial lens layer.

## Goals

- Make the globe feel physically connected to the grid below it.
- Add a subtle always-on depression beneath the globe that reads as gravitational weight.
- Preserve the current cursor-driven well instead of replacing it.
- Keep the effect restrained and scientific rather than theatrical.

## Non-Goals

- No deformation of the globe mesh or its silhouette.
- No direct animation of the globe tied to the well.
- No replacement of the cursor interaction.
- No large ripple waves, pulse rings, or visible shock effects.

## Visual Direction

### Core effect

- The grid should look slightly pulled downward under the globe.
- The depression should be centered beneath the globe, not beneath the cursor.
- It should feel wider and softer than the cursor well.
- The viewer should read it as a static gravitational indentation rather than an interactive event.

### Relationship to existing effects

- The cursor well remains the sharper, more local distortion.
- The planet anchor well remains broad, stable, and always present.
- The lens sheet between globe and grid remains subtle and supportive.
- Together, these layers should make the scene feel spatially coherent:
  - globe above
  - curved space in between
  - weighted grid below

## Architecture

### Existing units involved

- `frontend/components/ui/LightSpaceGridScene.tsx`
  - Already owns the WebGL grid scene and cursor well updates.
- `frontend/components/ui/light-space-grid-config.ts`
  - Already owns grid displacement-related constants.
- `frontend/components/ui/light-space-grid-material.ts`
  - Already owns shader/material logic for the grid.

### New unit

- `frontend/components/ui/light-space-anchor-config.ts`
  - Central config for the planet anchor well: UV position, radius, strength, and softness.

## Rendering Approach

### Preferred implementation

- Keep one grid mesh and one grid material.
- Extend the grid shader to support two deformation sources:
  - `cursor well`
  - `planet anchor well`
- The anchor well should be driven by a fixed UV position derived from the visual placement of the globe/grid relationship.

### Anchor well behavior

- Always active at low-to-medium strength.
- Broader than the cursor well.
- Lower gradient than the cursor well, so it reads as structural curvature rather than a sharp poke.
- Should not require its own animation loop.

## Interaction Model

- Cursor movement continues to update the interactive well.
- The anchor well remains constant regardless of cursor position.
- The shader combines both fields additively or through a controlled blend so they do not produce unrealistic spikes.

## Performance Constraints

- Reuse the existing grid mesh/material path.
- Add only the minimum extra uniforms and math needed for the second field.
- Avoid extra meshes or postprocessing for this effect.

## Error Handling and Fallbacks

- If the anchor well is misconfigured or unavailable, fall back to the current cursor-well-only grid.
- The scene must remain usable if the anchor field is disabled.

## Testing Strategy

### Automated

- Add config coverage for the new anchor config module.
- Extend the light background metadata to expose:
  - `planetAnchorWellEnabled`
  - `planetAnchorWellAlwaysOn`

### Verification

- `npm test -- --runInBand light-warp-background.test.tsx light-space-anchor-config.test.ts`
- `npx tsc --noEmit`
- `npm run build`

### Manual visual review

- Confirm the grid appears subtly compressed under the globe.
- Confirm the cursor well still works independently.
- Confirm the combination does not create over-deformed geometry.
- Confirm the globe still appears stable.

## Acceptance Criteria

- The light-mode grid includes a broad, always-on depression beneath the globe.
- The existing cursor well still works.
- The globe remains undeformed.
- The combined scene reads more clearly as curved space anchored by the planet.

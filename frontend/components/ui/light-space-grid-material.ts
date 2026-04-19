'use client';

import type * as THREE from 'three';
import { getLightSpaceGridConfig } from '@/components/ui/light-space-grid-config';
import { getLightSpaceAnchorConfig } from '@/components/ui/light-space-anchor-config';

const GRID_VERT = /* glsl */ `
  uniform vec2 uCursor;
  uniform float uRadius;
  uniform float uStrength;
  uniform vec2 uAnchorUv;
  uniform float uAnchorRadius;
  uniform float uAnchorStrength;
  uniform float uAnchorSoftness;
  varying vec2 vUv;
  varying float vInfluence;

  void main() {
    vUv = uv;
    float cursorDist = distance(uv, uCursor);
    float cursorInfluence = smoothstep(uRadius, 0.0, cursorDist);
    float anchorDist = distance(uv, uAnchorUv);
    float anchorInfluence = pow(smoothstep(uAnchorRadius, 0.0, anchorDist), uAnchorSoftness);
    float influence = max(cursorInfluence, anchorInfluence * 0.82);
    float centeredX = (uv.x - uCursor.x);
    float centeredY = (uv.y - uCursor.y);
    float anchorOffsetX = (uv.x - uAnchorUv.x);
    float anchorOffsetY = (uv.y - uAnchorUv.y);

    vec3 transformed = position;
    transformed.z -= pow(cursorInfluence, 1.75) * uStrength;
    transformed.z -= anchorInfluence * uAnchorStrength;
    transformed.x -= centeredX * cursorInfluence * 0.28;
    transformed.y -= centeredY * cursorInfluence * 0.18;
    transformed.x -= anchorOffsetX * anchorInfluence * 0.18;
    transformed.y -= anchorOffsetY * anchorInfluence * 0.11;

    vInfluence = influence;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
  }
`;

const GRID_FRAG = /* glsl */ `
  uniform vec3 uLineColor;
  uniform vec3 uMajorLineColor;
  uniform vec3 uHorizonGlow;
  uniform vec2 uMinorDensity;
  uniform vec2 uMajorDensity;
  varying vec2 vUv;
  varying float vInfluence;

  float gridLine(vec2 uv, vec2 density) {
    vec2 grid = abs(fract(uv * density - 0.5) - 0.5) / fwidth(uv * density);
    float line = min(grid.x, grid.y);
    return 1.0 - min(line, 1.0);
  }

  void main() {
    float minor = gridLine(vUv, uMinorDensity);
    float major = gridLine(vUv, uMajorDensity);
    float horizon = smoothstep(0.18, 0.72, vUv.y);
    float fade = smoothstep(0.02, 0.12, vUv.y) * (1.0 - smoothstep(0.88, 1.0, vUv.y));
    float well = smoothstep(0.0, 0.82, vInfluence);

    vec3 color = mix(vec3(1.0), uLineColor, minor * 0.62);
    color = mix(color, uMajorLineColor, major * 0.82);
    color = mix(color, uHorizonGlow, horizon * 0.14);
    color = mix(color, uMajorLineColor * 0.92, well * 0.08);

    float alpha = max(minor * 0.52, major * 0.74);
    alpha = max(alpha, horizon * 0.035);
    alpha *= fade;

    if (alpha <= 0.001) {
      discard;
    }

    gl_FragColor = vec4(color, alpha);
  }
`;

export function createLightSpaceGridMaterial(THREE: typeof import('three')) {
  const config = getLightSpaceGridConfig();
  const anchorConfig = getLightSpaceAnchorConfig();

  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uCursor: { value: new THREE.Vector2(999, 999) },
      uRadius: { value: config.displacementRadius },
      uStrength: { value: config.displacementStrength },
      uAnchorUv: { value: new THREE.Vector2(...anchorConfig.uv) },
      uAnchorRadius: { value: anchorConfig.radius },
      uAnchorStrength: { value: anchorConfig.strength },
      uAnchorSoftness: { value: anchorConfig.softness },
      uLineColor: { value: new THREE.Color('#0f172a') },
      uMajorLineColor: { value: new THREE.Color('#111827') },
      uHorizonGlow: { value: new THREE.Color('#dbeafe') },
      uMinorDensity: { value: new THREE.Vector2(...config.gridMinorDensity) },
      uMajorDensity: { value: new THREE.Vector2(...config.gridMajorDensity) },
    },
    vertexShader: GRID_VERT,
    fragmentShader: GRID_FRAG,
  });
}

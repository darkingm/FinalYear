'use client';

import { getLightSpaceLensConfig } from '@/components/ui/light-space-lens-config';

const LENS_VERT = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const LENS_FRAG = /* glsl */ `
  uniform float uOpacity;
  uniform float uFalloff;
  uniform float uCenterBias;
  uniform vec3 uTint;
  varying vec2 vUv;

  void main() {
    vec2 centered = vUv - 0.5;
    float ellipse = 1.0 - dot(centered * vec2(1.18, 1.7), centered * vec2(1.18, 1.7)) * 4.0;
    float softMask = smoothstep(0.0, uFalloff, ellipse);

    float verticalBand = smoothstep(0.16, 0.52, vUv.y) * (1.0 - smoothstep(0.58, 0.94, vUv.y));
    float centerBand = 1.0 - smoothstep(0.0, 0.34, abs(vUv.x - 0.5));
    float sheetGlow = mix(verticalBand, centerBand, uCenterBias);
    float compression = smoothstep(0.08, 0.38, abs(vUv.x - 0.5));
    float luminance = (sheetGlow * 0.7 + (1.0 - compression) * 0.3) * softMask;
    float alpha = luminance * uOpacity;

    if (alpha <= 0.001) {
      discard;
    }

    gl_FragColor = vec4(uTint, alpha);
  }
`;

export function createLightSpaceLensMaterial(THREE: typeof import('three')) {
  const config = getLightSpaceLensConfig();

  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    uniforms: {
      uOpacity: { value: config.opacity },
      uFalloff: { value: config.falloff },
      uCenterBias: { value: config.centerBias },
      uTint: { value: new THREE.Color('#eaf3ff') },
    },
    vertexShader: LENS_VERT,
    fragmentShader: LENS_FRAG,
  });
}

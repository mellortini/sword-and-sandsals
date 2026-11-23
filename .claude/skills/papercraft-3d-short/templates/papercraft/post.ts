// Post stack: RenderPass -> (Bokeh DOF) -> Bloom -> Grade (warm lift, saturation, vignette, film grain) -> OutputPass.
// All pixel parameters scale with the output height / 1920 so previews and 2K finals match.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export interface LookOpts {
  bloom?: number; bloomRadius?: number; bloomThreshold?: number;
  vignette?: number;       // 0 none ... 1 strong. Bright scenes 0.12, dark scenes 0.6-0.7
  grain?: number;          // luminance sigma in 0-1 units. ~0.012 (= 3/255)
  warm?: number;           // push toward warm 0..0.1
  lift?: [number, number, number]; // lifted blacks (maroon): [0.02, 0.008, 0.012]
  sat?: number;            // 1.1
  dof?: { focus: number; aperture: number; maxblur: number } | null;
}

export const LOOKS: Record<string, LookOpts> = {
  // dark candle / flame / finale scenes
  dark:   { bloom: 0.6, bloomRadius: 0.6, bloomThreshold: 0.92, vignette: 0.62, grain: 0.012, warm: 0.04, lift: [0.022, 0.008, 0.012], sat: 1.12 },
  // inside-body macro scenes (maroon, quilling, town)
  inside: { bloom: 0.55, bloomRadius: 0.55, bloomThreshold: 0.88, vignette: 0.22, grain: 0.010, warm: 0.03, lift: [0.02, 0.007, 0.01], sat: 1.1 },
  // pastel outside world (breakfast, gym, legs)
  day:    { bloom: 0.18, bloomRadius: 0.4,  bloomThreshold: 0.95, vignette: 0.10, grain: 0.008, warm: 0.015, lift: [0.01, 0.01, 0.012], sat: 1.04 },
};

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTime: { value: 0 }, uVig: { value: 0.2 }, uGrain: { value: 0.01 }, uWarm: { value: 0.03 },
    uLift: { value: new THREE.Vector3(0.02, 0.008, 0.012) }, uSat: { value: 1.1 }, uAspect: { value: 9 / 16 }, uGrainScale: { value: 1.0 },
  },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uTime,uVig,uGrain,uWarm,uSat,uAspect,uGrainScale; uniform vec3 uLift; varying vec2 vUv;
    float hash(vec2 p){ p=fract(p*vec2(443.897,441.423)); p+=dot(p,p.yx+19.19); return fract((p.x+p.y)*p.x); }
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      // lifted maroon blacks
      c = c*(1.0-uLift) + uLift;
      // warm split: reds up in lows, cream in highs
      float l = dot(c, vec3(0.2126,0.7152,0.0722));
      c.r += uWarm*(0.6+0.4*l); c.b -= uWarm*0.7*(0.5+0.5*l);
      // saturation
      c = mix(vec3(l), c, uSat);
      // gentle S-curve
      c = mix(c, c*c*(3.0-2.0*c), 0.28);
      // vignette (radial, aspect corrected)
      vec2 d = (vUv-0.5)*vec2(1.0,1.0/uAspect*0.56);
      float v = smoothstep(0.30, 0.95, length(d));
      c *= 1.0 - uVig*v;
      // film grain + paper tooth (animated per frame, slightly chroma-tinted)
      vec2 gp = vUv*vec2(1080.0,1920.0)/uGrainScale;
      float n = hash(gp+uTime*61.7)-0.5; float n2 = hash(gp*0.5+uTime*13.1)-0.5;
      vec3 gr = vec3(n, n*0.8+n2*0.3, n*0.7-n2*0.3);
      c += gr * uGrain * (1.6 - l);
      gl_FragColor = vec4(c,1.0);
    }`,
};

export function makeComposer(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, w: number, h: number, look: LookOpts) {
  const k = h / 1920;
  const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.setSize(w, h);
  composer.addPass(new RenderPass(scene, camera));
  let bokeh: BokehPass | null = null;
  if (look.dof) {
    bokeh = new BokehPass(scene, camera, { focus: look.dof.focus, aperture: look.dof.aperture, maxblur: look.dof.maxblur });
    composer.addPass(bokeh);
  }
  const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), look.bloom ?? 0.6, (look.bloomRadius ?? 0.55), look.bloomThreshold ?? 0.88);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());          // tone map (ACES) + sRGB
  const grade = new ShaderPass(GradeShader);
  const u = grade.uniforms as any;
  u.uVig.value = look.vignette ?? 0.2; u.uGrain.value = look.grain ?? 0.01; u.uWarm.value = look.warm ?? 0.03;
  u.uSat.value = look.sat ?? 1.1; u.uLift.value.set(...(look.lift ?? [0.02, 0.008, 0.012])); u.uAspect.value = w / h; u.uGrainScale.value = Math.max(0.5, k);
  composer.addPass(grade);
  return { composer, bloom, bokeh, grade, setTime: (t: number) => { u.uTime.value = t % 97; } };
}

export function makeRenderer(canvas: HTMLCanvasElement, w: number, h: number): THREE.WebGLRenderer {
  const r = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  r.setSize(w, h, false); r.setPixelRatio(1);
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.VSMShadowMap;
  r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0;
  r.outputColorSpace = THREE.SRGBColorSpace;
  return r;
}

/** Telephoto-ish diorama camera: low fov, long distance. `height` = visible scene height at z=0 in units. */
export function dioramaCamera(aspect = 9 / 16, height = 19.2, fov = 24): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera(fov, aspect, 1, 400);
  cam.position.set(0, 0, (height / 2) / Math.tan(THREE.MathUtils.degToRad(fov / 2)));
  return cam;
}

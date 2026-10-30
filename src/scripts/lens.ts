// Glass background: the page photo seen through vertical glass (one pane, or wide
// panes left and narrow reeds right). The photo's own lights (lamps, windows) bloom
// softly, and scrolling turns the glass edge-on so they refract, frost and fade.
// A second pass draws liquid glass behind every .glass element (cards, nav, buttons).
// Renders only when something changes (scroll, resize, hover, image fade).

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform vec2 uRes;          // canvas size, device px
uniform float uSplit;       // x where the wide panes end and the narrow reeds begin
uniform float uWide;        // wide pane width, device px
uniform float uNarrow;      // narrow reed width, device px
uniform float uClose;       // 0 = strips face you, 1 = turned edge-on
uniform float uWobble;      // small scroll-driven shimmer
uniform float uParallax;    // slow vertical drift of the distant vista
// Outgoing (A) and incoming (B) photo for crossfading between pages, each with a
// mipmapped "glow" copy holding only its bright spots
uniform sampler2D uTexA;
uniform sampler2D uTexB;
uniform sampler2D uGlowA;
uniform sampler2D uGlowB;
uniform vec2 uSizeA;        // image size in px; 0 means "use procedural vista"
uniform vec2 uSizeB;
uniform float uFade;        // 0 = A, 1 = B
uniform float uBlur;        // extra softness: how many mip levels down the photo is read
uniform float uWash;        // 1 = darken toward the bottom for legibility, 0 = leave colours as-is

// Tuned for a bright daytime photo. For a night photo with lamps, try
// PHOTO 0.85, GLOW 1.1, KNEE 0.55, PEAK 0.82, WASH_TOP 0.22, WASH_BOTTOM 0.47.
const float PHOTO = 1.0;   // photo brightness behind the glass
const float GLOW = 0.0;    // strength of the bloom around the photo's lights (0 = off)
const float MAX_TURN = 0.7; // how far the glass turns by the bottom of the page, radians (0.7 = 40°)
const float KNEE = 0.85;   // brightness where compression starts
const float PEAK = 1.0;    // brightest the screen can ever get (1.0 = pure white)
// Curved edges of the big background pane (the warped bands at the screen's sides)
const float EDGE_BEVEL = 0.03; // share of the half-width that curves (0.03 ≈ 20px on a laptop)
const float EDGE_BEND = 0.3;   // how hard that edge bends the photo (0 = no warping)
const float WASH_TOP = 0.0;     // darkening at the top of the screen (0 = none)
const float WASH_BOTTOM = 0.15; // darkening at the bottom, for legibility

// Stand-in vista for when no photo is available: dusk sky and two ridgelines.
vec3 vista(vec2 uv) {
  float h = 0.38;
  vec3 col = mix(vec3(0.70, 0.38, 0.24), vec3(0.05, 0.09, 0.20), smoothstep(h, 1.0, uv.y));
  float r1 = h + 0.05 * sin(uv.x * 5.0 + 1.0) + 0.025 * sin(uv.x * 13.0 + 2.0);
  float r2 = h - 0.06 + 0.04 * sin(uv.x * 3.0 + 4.0) + 0.02 * sin(uv.x * 17.0);
  col = mix(col, vec3(0.16, 0.14, 0.26), 1.0 - smoothstep(r1 - 0.003, r1 + 0.003, uv.y));
  col = mix(col, vec3(0.06, 0.07, 0.16), 1.0 - smoothstep(r2 - 0.003, r2 + 0.003, uv.y));
  return col;
}

// object-fit: cover, zoomed slightly so refracted samples rarely hit the edge
vec2 cover(vec2 uv, vec2 size) {
  float ca = uRes.x / uRes.y;
  float ia = size.x / size.y;
  vec2 s = ca > ia ? vec2(1.0, ia / ca) : vec2(ca / ia, 1.0);
  return (uv - 0.5) * s / 1.08 + 0.5;
}

vec3 layer(sampler2D tex, sampler2D glow, vec2 size, vec2 uv) {
  if (size.x < 1.0) return vista(uv);
  // A 1x1 texture is a solid page colour: show it exactly, no dimming or glow
  if (size.x < 1.5) return texture2D(tex, vec2(0.5)).rgb;
  vec2 t = clamp(cover(uv, size), 0.001, 0.999);
  // Tight glow from a lower mip level plus a wide halo from a much lower one
  vec3 bloom = texture2D(glow, t, 2.0 + uBlur).rgb * 0.5 + texture2D(glow, t, 4.5 + uBlur * 0.5).rgb * 0.9;
  return texture2D(tex, t, uBlur).rgb * PHOTO + bloom * GLOW;
}

vec3 scene(vec2 uv) {
  uv.y += uParallax;
  vec3 b = layer(uTexB, uGlowB, uSizeB, uv);
  if (uFade >= 1.0) return b;
  return mix(layer(uTexA, uGlowA, uSizeA, uv), b, uFade);
}

// Key light in front of the glass, up and to the right; sweeps across strips as they turn
const vec3 KEY = vec3(0.74, 0.18, 0.65);

// Dim room the glass reflects, with a soft key light and a little warm spill
vec3 env(vec3 d) {
  vec3 col = mix(vec3(0.03, 0.04, 0.07), vec3(0.10, 0.13, 0.20), d.y * 0.5 + 0.5);
  col += vec3(1.0, 0.96, 0.9) * pow(max(dot(d, normalize(KEY)), 0.0), 24.0) * 0.6;
  col += vec3(1.0, 0.5, 0.2) * 0.12 * max(d.x, 0.0);
  return col;
}

vec3 rotY(vec3 v, float a) {
  float s = sin(a), k = cos(a);
  return vec3(k * v.x + s * v.z, v.y, -s * v.x + k * v.z);
}

// Cross-section of a slat: flat face with rounded (circular-arc) edges, like a
// liquid-glass bevel. bevel = fraction of the half-width that curves.
vec3 slatNormal(float c, float bevel) {
  float e = abs(c) - (1.0 - bevel);
  if (e <= 0.0) return vec3(0.0, 0.0, 1.0);
  float t = min(e / bevel, 0.97);
  return normalize(vec3(sign(c) * t / sqrt(1.0 - t * t), 0.0, 1.0));
}

void main() {
  vec2 px = vUv * uRes;
  bool wide = px.x < uSplit;
  float w = wide ? uWide : uNarrow;
  float local = wide ? px.x / w : (px.x - uSplit) / w;
  float slot = floor(local);
  float c = fract(local) * 2.0 - 1.0;            // -1..1 across one strip
  float idx = wide ? slot : slot + 100.0;
  float cx = ((wide ? 0.0 : uSplit) + (slot + 0.5) * w) / uRes.x;

  // Strips on the left close first, sweeping right
  float q = clamp(uClose * 1.6 - (1.0 - cx) * 0.6, 0.0, 1.0);
  q = q * q * (3.0 - 2.0 * q);
  float theta = q * MAX_TURN + 0.04 * sin(uWobble + idx * 0.7);

  vec3 V = vec3(0.0, 0.0, 1.0);
  float bevel = wide ? EDGE_BEVEL : 0.85;
  vec3 n = rotY(slatNormal(c, bevel), theta);

  // Refraction: bend through the surface normal, plus the sideways walk a ray
  // takes through a tilted slab. Distortion scales with glass thickness, capped
  // so one huge pane doesn't throw the image clean off-screen.
  vec3 r = refract(-V, n, 1.0 / 1.5);
  float thick = wide ? min(w, 0.35 * uRes.y) : w;
  float bend = r.x / max(-r.z, 0.2) * (wide ? EDGE_BEND : 1.4);
  float walk = tan(theta) * (wide ? 0.5 : 1.6);
  float off = (bend + walk) * thick;
  float aber = r.x * thick * (wide ? 0.03 : 0.08);

  // Frosted blur: perfectly clear while facing you, building up as the glass turns
  float spread = thick * 0.12 * q * q;
  vec3 trans = vec3(0.0);
  for (int i = 0; i < 5; i++) {
    float o = off + (float(i) - 2.0) * spread;
    trans.r += scene(vUv + vec2((o + aber) / uRes.x, 0.0)).r;
    trans.g += scene(vUv + vec2(o / uRes.x, 0.0)).g;
    trans.b += scene(vUv + vec2((o - aber) / uRes.x, 0.0)).b;
  }
  trans /= 5.0;

  // Fresnel: grazing angles reflect the room instead of passing the photo's light.
  // Longer paths through tilted glass absorb more, tinting it cool.
  float cosI = max(dot(n, V), 0.0);
  float fres = clamp(0.04 + 0.96 * pow(1.0 - cosI, 5.0) + 0.5 * pow(1.0 - cosI, 2.0), 0.0, 1.0);
  float path = 1.0 / max(cosI, 0.15) - 1.0;
  trans *= exp(-vec3(0.35, 0.22, 0.16) * path * 0.6);
  vec3 col = mix(trans, env(reflect(-V, n)), fres);

  // Blinn-Phong glint off the key light; flashes as each strip passes the right angle
  vec3 H = normalize(normalize(KEY) + V);
  col += vec3(1.0, 0.95, 0.88) * pow(max(dot(n, H), 0.0), 90.0) * 0.3 * (0.5 + 0.5 * vUv.y);

  // Inner rim light over the curved edge, and a dark hairline where strips meet
  col += smoothstep(1.0 - bevel, 1.0, abs(c)) * 0.05;
  col *= 1.0 - smoothstep(1.0 - bevel * 0.2, 1.0, abs(c)) * 0.5;

  // Bright seam where the wide panes meet the reeds
  col += (1.0 - smoothstep(0.0, 2.0, abs(px.x - uSplit))) * 0.15;

  // Darken toward the bottom so glass panels and text stay legible
  col = mix(col, vec3(0.04, 0.07, 0.14), mix(WASH_BOTTOM, WASH_TOP, vUv.y) * uWash);

  // Soft brightness ceiling: below KNEE is untouched, above it eases toward PEAK
  // instead of clipping to white, so hotspots glow without blinding. Scaling all
  // channels together keeps each light's hue.
  float l = max(col.r, max(col.g, col.b));
  if (l > KNEE) {
    float squashed = KNEE + (PEAK - KNEE) * (1.0 - exp(-(l - KNEE) / (PEAK - KNEE)));
    col *= squashed / l;
  }

  gl_FragColor = vec4(col, 1.0);
}`;

// Second pass: draws the finished background, plus liquid glass behind every
// .glass element on screen. Each panel is a rounded slab whose bevelled rim bends
// the background, frosted, with colour fringes and edge highlights.
const PANEL_VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const MAX_PANELS = 24;

const PANEL_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uBg;      // the rendered background, mipmapped for frosting
uniform vec2 uRes;
uniform float uDpr;
uniform vec4 uRects[${MAX_PANELS}];  // x, y (from bottom-left), width, height in device px
uniform float uRadii[${MAX_PANELS}]; // corner radius, CSS px
uniform int uCount;

const float BEVEL = 12.0;   // width of the curved rim, CSS px
const float THICK = 12.0;   // how far the rim bends the background, CSS px
const float FROST = 3.0;    // blur: mip level the panel samples (higher = frostier)
const vec3 SMOKE = vec3(0.04, 0.06, 0.11); // colour the glass is tinted toward (deep navy)
const float DARKEN = 0.55;  // 0 = clear glass, 1 = solid SMOKE colour

float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

vec3 frosted(vec2 px) {
  float s = 10.0 * uDpr;
  vec3 c = textureLod(uBg, px / uRes, FROST).rgb * 2.0;
  c += textureLod(uBg, (px + vec2(s, s)) / uRes, FROST).rgb;
  c += textureLod(uBg, (px + vec2(-s, s)) / uRes, FROST).rgb;
  c += textureLod(uBg, (px + vec2(s, -s)) / uRes, FROST).rgb;
  c += textureLod(uBg, (px + vec2(-s, -s)) / uRes, FROST).rgb;
  return c / 6.0;
}

void main() {
  vec2 px = vUv * uRes;
  vec3 bg = textureLod(uBg, vUv, 0.0).rgb;

  // Smallest panel whose rounded shape covers this pixel wins: buttons sit on their
  // card, the nav on content, and a pill's corners fall through to the card behind
  int hit = -1;
  float best = 1e20;
  vec2 hs, p;
  float rad, d;
  for (int i = 0; i < ${MAX_PANELS}; i++) {
    if (i >= uCount) break;
    vec4 r = uRects[i];
    if (px.x < r.x || px.x > r.x + r.z || px.y < r.y || px.y > r.y + r.w) continue;
    if (r.z * r.w >= best) continue;
    vec2 h = r.zw * 0.5;
    vec2 q = px - (r.xy + h);
    float rd = min(uRadii[i] * uDpr, min(h.x, h.y));
    float sd = sdRoundBox(q, h, rd);
    if (sd > 1.0) continue;
    best = r.z * r.w;
    hit = i;
    hs = h;
    p = q;
    rad = rd;
    d = sd;
  }
  if (hit < 0) {
    outColor = vec4(bg, 1.0);
    return;
  }

  // Outward direction from the nearest edge
  vec2 e = vec2(1.0, 0.0);
  vec2 g = normalize(vec2(
    sdRoundBox(p + e.xy, hs, rad) - sdRoundBox(p - e.xy, hs, rad),
    sdRoundBox(p + e.yx, hs, rad) - sdRoundBox(p - e.yx, hs, rad)) + 1e-5);

  // Circular-arc rim: flat in the middle, curving down over the last BEVEL px
  float inset = -d;
  float bevel = min(BEVEL * uDpr, min(hs.x, hs.y) * 0.6);
  float t = clamp(1.0 - inset / bevel, 0.0, 0.97);
  vec3 n = normalize(vec3(g * (t / sqrt(1.0 - t * t)), 1.0));

  // Refract through the rim; it pulls in the scene from just beyond the panel's edge
  vec3 rr = refract(vec3(0.0, 0.0, -1.0), n, 1.0 / 1.5);
  vec2 off = rr.xy / -rr.z * THICK * uDpr;
  vec3 glass;
  glass.r = frosted(px - off * 1.1).r;
  glass.g = frosted(px - off).g;
  glass.b = frosted(px - off * 0.9).b;
  // Smoked glass: darken toward SMOKE so white text reads over a bright background
  glass = mix(glass, SMOKE, DARKEN);

  // Rim catches light from the top-left, with a softer bounce on the far side
  float rim = t * t * t;
  float facing = dot(g, normalize(vec2(-0.6, 0.8)));
  glass += rim * (0.04 + 0.16 * max(facing, 0.0) + 0.05 * max(-facing, 0.0));
  // Hairline along the very edge
  glass += (1.0 - smoothstep(0.0, 1.5 * uDpr, inset)) * 0.12;
  glass = min(glass, vec3(0.95));

  outColor = vec4(mix(bg, glass, clamp(0.5 - d, 0.0, 1.0)), 1.0);
}`;

// true = one pane of glass across the whole screen; false = wide panes left, reeds right
const SINGLE_PANE = true;

// Extra blur (mip levels) once the homepage glass has fully turned
const TURN_BLUR = 1;

// Brightness (0..1, brightest channel) where a pixel starts counting as a light
const GLOW_FROM = 0.6;
const GLOW_FULL = 0.95;

interface Layer {
  tex: WebGLTexture;
  glow: WebGLTexture;
  size: [number, number];
}

export interface Lens {
  setImage(url: string | undefined): void;
  // Solid background colour (#rrggbb) instead of a photo
  setColor(hex: string): void;
  setRotate(on: boolean): void;
  setBlur(amount: number): void;
}

export function initLens(canvas: HTMLCanvasElement): Lens | null {
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false });
  if (!gl) return null;

  const bgProgram = createProgram(gl, VERT, FRAG);
  const panelProgram = createProgram(gl, PANEL_VERT, PANEL_FRAG);
  if (!bgProgram || !panelProgram) return null;

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  gl.useProgram(bgProgram);
  const u = (name: string) => gl.getUniformLocation(bgProgram, name);
  const uRes = u('uRes');
  const uSplit = u('uSplit');
  const uWide = u('uWide');
  const uNarrow = u('uNarrow');
  const uClose = u('uClose');
  const uWobble = u('uWobble');
  const uParallax = u('uParallax');
  const uSizeA = u('uSizeA');
  const uSizeB = u('uSizeB');
  const uFade = u('uFade');
  const uBlur = u('uBlur');
  const uWash = u('uWash');
  gl.uniform1i(u('uTexA'), 0);
  gl.uniform1i(u('uTexB'), 1);
  gl.uniform1i(u('uGlowA'), 2);
  gl.uniform1i(u('uGlowB'), 3);

  gl.useProgram(panelProgram);
  const p = (name: string) => gl.getUniformLocation(panelProgram, name);
  const pRes = p('uRes');
  const pDpr = p('uDpr');
  const pRects = p('uRects');
  const pRadii = p('uRadii');
  const pCount = p('uCount');
  gl.uniform1i(p('uBg'), 4);
  const rectData = new Float32Array(MAX_PANELS * 4);
  const radiusData = new Float32Array(MAX_PANELS);
  const radii = new WeakMap<Element, number>();

  // Off-screen target the background renders into, mipmapped so panels can frost it
  const bgTarget = gl.createTexture()!;
  const fbo = gl.createFramebuffer()!;

  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  const blank = createTexture(gl);
  const procedural: Layer = { tex: blank, glow: blank, size: [0, 0] };
  let a = procedural;
  let b = procedural;
  let fade = 1;
  let fadeStart = 0;
  let currentUrl: string | undefined;
  // Stay hidden (the CSS backdrop shows the same photo) until the first real
  // background has loaded, so visitors never see the stand-in scene flash by
  let ready = false;
  let shown = false;

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let scroll = window.scrollY;
  // How far the glass has turned (0..1), eased so switching pages turns it back smoothly
  let close = 0;
  let rotate = true;
  let blur = 0;
  let blurTarget = 0;
  let wash = 1;
  let washTarget = 1;
  let raf = 0;
  // Keep redrawing until this time, for CSS movement we aren't told about frame by frame
  let followUntil = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.round(canvas.clientWidth * dpr);
    const h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h || !gl!.isFramebuffer(fbo)) {
      canvas.width = w;
      canvas.height = h;
      gl!.activeTexture(gl!.TEXTURE4);
      gl!.bindTexture(gl!.TEXTURE_2D, bgTarget);
      gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, w, h, 0, gl!.RGBA, gl!.UNSIGNED_BYTE, null);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR_MIPMAP_LINEAR);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.LINEAR);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
      gl!.bindTexture(gl!.TEXTURE_2D, null);
      gl!.bindFramebuffer(gl!.FRAMEBUFFER, fbo);
      gl!.framebufferTexture2D(gl!.FRAMEBUFFER, gl!.COLOR_ATTACHMENT0, gl!.TEXTURE_2D, bgTarget, 0);
      gl!.bindFramebuffer(gl!.FRAMEBUFFER, null);
      gl!.viewport(0, 0, w, h);
    }
    const mobile = canvas.clientWidth < 640;
    const split = SINGLE_PANE ? w : Math.round(w / 2);
    gl!.useProgram(bgProgram);
    gl!.uniform2f(uRes, w, h);
    gl!.uniform1f(uSplit, split);
    gl!.uniform1f(uWide, SINGLE_PANE ? w : split / (mobile ? 2 : 3));
    gl!.uniform1f(uNarrow, (mobile ? 28 : 44) * dpr);
    gl!.useProgram(panelProgram);
    gl!.uniform2f(pRes, w, h);
    gl!.uniform1f(pDpr, dpr);
    requestRender();
  }

  // Where every visible .glass element is right now, in canvas pixels
  function collectPanels(): number {
    const sx = canvas.width / canvas.clientWidth;
    const sy = canvas.height / canvas.clientHeight;
    let count = 0;
    for (const el of document.querySelectorAll('.glass')) {
      if (count === MAX_PANELS) break;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.bottom < 0 || r.top > canvas.clientHeight) continue;
      let radius = radii.get(el);
      if (radius === undefined) {
        radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
        radii.set(el, radius);
      }
      rectData.set(
        [r.left * sx, (canvas.clientHeight - r.bottom) * sy, r.width * sx, r.height * sy],
        count * 4,
      );
      radiusData[count] = radius;
      count++;
    }
    return count;
  }

  function frame(now: number) {
    raf = 0;
    let animating = now < followUntil;

    // Before the first visible frame everything starts at its final value; after
    // that, ease (unless the visitor prefers reduced motion)
    const snap = reduceMotion || !shown;

    // Ease toward the real scroll position so the glass glides rather than snaps
    const target = window.scrollY;
    scroll = snap ? target : scroll + (target - scroll) * 0.12;
    if (Math.abs(target - scroll) < 0.5) scroll = target;
    else animating = true;

    if (fade < 1) {
      fade = Math.min((now - fadeStart) / 700, 1);
      animating = true;
    }

    // Fully closed after ~1.2 screens, or at the bottom of shorter pages
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const closeDistance = Math.max(Math.min(window.innerHeight * 1.2, maxScroll), 1);
    // Pages with rotation off settle the glass back to facing you
    const closeTarget = rotate ? Math.min(scroll / closeDistance, 1) : 0;
    close = snap ? closeTarget : close + (closeTarget - close) * 0.25;
    if (Math.abs(closeTarget - close) < 0.001) close = closeTarget;
    else animating = true;

    blur = snap ? blurTarget : blur + (blurTarget - blur) * 0.15;
    if (Math.abs(blurTarget - blur) < 0.01) blur = blurTarget;
    else animating = true;

    wash = snap ? washTarget : wash + (washTarget - wash) * 0.15;
    if (Math.abs(washTarget - wash) < 0.005) wash = washTarget;
    else animating = true;

    // Pass 1: background into the off-screen target
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, fbo);
    gl!.useProgram(bgProgram);
    [a.tex, b.tex, a.glow, b.glow].forEach((tex, unit) => {
      gl!.activeTexture(gl!.TEXTURE0 + unit);
      gl!.bindTexture(gl!.TEXTURE_2D, tex);
    });
    gl!.uniform2f(uSizeA, a.size[0], a.size[1]);
    gl!.uniform2f(uSizeB, b.size[0], b.size[1]);
    gl!.uniform1f(uFade, fade * fade * (3 - 2 * fade));
    gl!.uniform1f(uClose, close);
    // Turning glass also frosts the view, so it stays visible but soft at the bottom
    gl!.uniform1f(uBlur, blur + close * close * TURN_BLUR);
    gl!.uniform1f(uWash, wash);
    gl!.uniform1f(uWobble, rotate ? scroll * 0.004 : 0);
    gl!.uniform1f(uParallax, Math.min(scroll / window.innerHeight, 4) * 0.012);
    gl!.drawArrays(gl!.TRIANGLES, 0, 3);

    // Pass 2: background plus liquid glass panels, to the screen
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, null);
    gl!.activeTexture(gl!.TEXTURE4);
    gl!.bindTexture(gl!.TEXTURE_2D, bgTarget);
    gl!.generateMipmap(gl!.TEXTURE_2D);
    gl!.useProgram(panelProgram);
    const count = collectPanels();
    gl!.uniform4fv(pRects, rectData);
    gl!.uniform1fv(pRadii, radiusData);
    gl!.uniform1i(pCount, count);
    gl!.drawArrays(gl!.TRIANGLES, 0, 3);
    // Unbind so pass 1 never renders into a texture that's also bound for reading
    gl!.bindTexture(gl!.TEXTURE_2D, null);

    if (ready) {
      canvas.classList.add('on');
      shown = true;
    }
    if (animating) requestRender();
  }

  function requestRender() {
    if (!raf) raf = requestAnimationFrame(frame);
  }

  // Hover lifts, filter clicks and page transitions move panels with CSS; follow along
  function follow(ms: number) {
    followUntil = Math.max(followUntil, performance.now() + ms);
    requestRender();
  }

  function crossfadeTo(next: Layer) {
    ready = true;
    // The very first background appears directly; later page changes crossfade
    a = shown ? (fade < 0.5 ? a : b) : next;
    b = next;
    fade = shown ? 0 : 1;
    fadeStart = performance.now();
    requestRender();
  }

  window.addEventListener('scroll', requestRender, { passive: true });
  document.addEventListener('pointerover', () => follow(400));
  document.addEventListener('click', () => follow(400));
  document.addEventListener('astro:page-load', () => follow(900));
  new ResizeObserver(resize).observe(canvas);
  new ResizeObserver(requestRender).observe(document.body);
  canvas.addEventListener('webglcontextlost', () => canvas.classList.remove('on'));
  resize();

  return {
    setRotate(on) {
      rotate = on;
      requestRender();
    },
    setBlur(amount) {
      blurTarget = amount;
      requestRender();
    },
    setColor(hex) {
      washTarget = 0;
      const key = `color:${hex}`;
      if (key === currentUrl) return;
      currentUrl = key;
      const n = parseInt(hex.replace('#', ''), 16);
      const tex = createTexture(gl!);
      gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGB, 1, 1, 0, gl!.RGB, gl!.UNSIGNED_BYTE,
        new Uint8Array([(n >> 16) & 255, (n >> 8) & 255, n & 255]));
      crossfadeTo({ tex, glow: blank, size: [1, 1] });
    },
    setImage(url) {
      washTarget = 1;
      if (url === currentUrl) return;
      currentUrl = url;
      if (!url) return crossfadeTo(procedural);
      const img = new Image();
      img.onload = () => {
        if (currentUrl !== url) return;
        crossfadeTo({
          tex: createTexture(gl!, img),
          glow: createGlow(gl!, img),
          size: [img.naturalWidth, img.naturalHeight],
        });
      };
      img.onerror = () => {
        if (currentUrl === url) crossfadeTo(procedural);
      };
      img.src = url;
    },
  };
}

function createTexture(gl: WebGL2RenderingContext, img?: HTMLImageElement): WebGLTexture {
  const tex = gl.createTexture()!;
  gl.activeTexture(gl.TEXTURE5);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  if (img) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
  else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array(3));
  // Mipmaps are pre-blurred copies; reading lower levels is how pages soften the photo
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

// Copy of the photo with everything but its lights blacked out, at a power-of-two
// size so it can be mipmapped; lower mip levels give progressively wider halos.
function createGlow(gl: WebGL2RenderingContext, img: HTMLImageElement): WebGLTexture {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const lum = Math.max(px[i], px[i + 1], px[i + 2]) / 255;
    const t = Math.min(Math.max((lum - GLOW_FROM) / (GLOW_FULL - GLOW_FROM), 0), 1);
    const k = t * t * (3 - 2 * t);
    px[i] *= k;
    px[i + 1] *= k;
    px[i + 2] *= k;
  }
  ctx.putImageData(data, 0, 0);

  const tex = gl.createTexture()!;
  gl.activeTexture(gl.TEXTURE5);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, c);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

function createProgram(gl: WebGL2RenderingContext, vs: string, fs: string) {
  const program = gl.createProgram()!;
  for (const [type, src] of [
    [gl.VERTEX_SHADER, vs],
    [gl.FRAGMENT_SHADER, fs],
  ] as const) {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
      return null;
    }
    gl.attachShader(program, shader);
  }
  // Both programs share the one fullscreen-triangle buffer at attribute 0
  gl.bindAttribLocation(program, 0, 'aPos');
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    return null;
  }
  return program;
}

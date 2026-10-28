export const QUAD_VS = `#version 300 es
layout(location = 0) in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`

export const UPDATE_FS = `#version 300 es
precision highp float;
uniform sampler2D u_particles;
uniform sampler2D u_wind;
uniform vec2 u_particle_res;
uniform vec2 u_wind_min;
uniform vec2 u_wind_max;
uniform float u_rand_seed;
uniform float u_speed;
uniform float u_advect;
uniform float u_step;
uniform float u_speed_ref;
uniform float u_uv_scale;
uniform float u_drop_rate;
uniform float u_wrap;
uniform float u_motion;
uniform float u_wet_min;
uniform vec4 u_view;
in vec2 v_uv;
out vec4 fragColor;

vec2 decode(vec4 c) {
  return vec2(c.r / 255.0 + c.b, c.g / 255.0 + c.a);
}
vec4 encode(vec2 p) {
  p = clamp(p, 0.0, 0.999);
  vec2 rg = fract(p * 255.0);
  return vec4(rg, p - rg / 255.0);
}
float rand(const vec2 co) {
  float t = 12.9898 * co.x + 78.233 * co.y;
  return fract(sin(t) * 43758.5453);
}
vec2 spawnInView(vec2 salt) {
  vec2 r = vec2(rand(salt), rand(salt.yx * 1.73 + u_rand_seed));
  return mix(u_view.xy, u_view.zw, r);
}
void main() {
  vec4 pc = texture(u_particles, v_uv);
  vec2 pos = decode(pc);
  vec4 wtex = texture(u_wind, pos);
  vec2 vel = mix(u_wind_min, u_wind_max, wtex.rg);
  float mask = wtex.b;
  float vmax = max(max(abs(u_wind_min.x), abs(u_wind_max.x)), max(abs(u_wind_min.y), abs(u_wind_max.y)));
  vmax = max(vmax, 0.5);
  // Low bump: high drop teleports particles and reads as 乱窜 vs Ventusky silk.
  float drop = u_drop_rate + length(vel) / vmax * 0.001 * u_uv_scale;
  float r = rand(pos + u_rand_seed);
  bool dead = false;
  if (u_motion > 0.5) {
    pos.y -= u_speed * u_advect * 2.6;
    pos.x += (vel.x / vmax) * u_speed * u_advect * 0.32;
    dead = wtex.a < u_wet_min || r < drop * 1.6;
  } else {
    float mag = length(vel);
    vec2 dir = mag > 1e-5 ? vel / mag : vec2(0.0);
    float nrm = clamp(mag / max(u_speed_ref, 0.4), 0.0, 1.55);
    pos += dir * nrm * u_step * u_uv_scale;
    dead = mask < 0.45 || r < drop;
  }
  if (u_wrap > 0.5) {
    pos.x = fract(pos.x);
    if (pos.y < 0.0 || pos.y > 1.0) dead = true;
  } else if (pos.x < 0.0 || pos.x > 1.0 || pos.y < 0.0 || pos.y > 1.0) {
    dead = true;
  }
  if (pos.x < u_view.x || pos.x > u_view.z || pos.y < u_view.y || pos.y > u_view.w) {
    dead = true;
  }
  if (dead) {
    pos = spawnInView(v_uv + u_rand_seed);
    for (int i = 0; i < 16; i++) {
      vec4 s = texture(u_wind, pos);
      bool ok = u_motion > 0.5 ? s.a >= u_wet_min : s.b >= 0.45;
      if (ok) break;
      pos = spawnInView(pos + vec2(float(i) * 0.17, float(i) * 0.31) + u_rand_seed);
    }
  }
  fragColor = encode(pos);
}
`

const MERCATOR = `
vec2 decode(vec4 c) {
  return vec2(c.r / 255.0 + c.b, c.g / 255.0 + c.a);
}
vec2 mercator(vec2 lonlat) {
  float lon = lonlat.x;
  float lat = clamp(lonlat.y, -85.051129, 85.051129);
  float x = (lon + 180.0) / 360.0;
  float siny = sin(lat * 3.141592653589793 / 180.0);
  float y = 0.5 - 0.25 * log((1.0 + siny) / (1.0 - siny)) / 3.141592653589793;
  return vec2(x, y);
}
vec2 fieldLonLat(vec2 uv, vec4 bbox) {
  return vec2(mix(bbox.x, bbox.z, uv.x), mix(bbox.y, bbox.w, uv.y));
}
`

const MIX7 = `
vec3 mix7(float t, vec3 a, vec3 b, vec3 c, vec3 d, vec3 e, vec3 f, vec3 g) {
  t = clamp(t, 0.0, 1.0);
  float s = t * 6.0;
  if (s < 1.0) return mix(a, b, s);
  if (s < 2.0) return mix(b, c, s - 1.0);
  if (s < 3.0) return mix(c, d, s - 2.0);
  if (s < 4.0) return mix(d, e, s - 3.0);
  if (s < 5.0) return mix(e, f, s - 4.0);
  return mix(f, g, s - 5.0);
}
vec3 windRamp(float t) {
  return mix7(t,
    vec3(0.255, 0.247, 0.557),
    vec3(0.180, 0.420, 0.910),
    vec3(0.090, 0.750, 0.820),
    vec3(0.450, 0.760, 0.180),
    vec3(0.960, 0.780, 0.120),
    vec3(0.940, 0.400, 0.080),
    vec3(0.760, 0.140, 0.280));
}
vec3 oceanRamp(float t) {
  // frost-blue curtain; never the wind speed rainbow
  return mix7(t,
    vec3(0.020, 0.078, 0.176),
    vec3(0.039, 0.176, 0.314),
    vec3(0.078, 0.373, 0.510),
    vec3(0.220, 0.620, 0.720),
    vec3(0.498, 0.831, 0.910),
    vec3(0.620, 0.878, 0.922),
    vec3(0.780, 0.941, 0.949));
}
`

const FBM = `
float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm3(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  v += a * vnoise(p); p *= 2.03; a *= 0.5;
  v += a * vnoise(p); p *= 2.11; a *= 0.5;
  v += a * vnoise(p);
  return v;
}
`

export function makeDrawVS(prelude: string, define: string): string {
  return `#version 300 es
${prelude}
${define}
uniform sampler2D u_particles;
uniform sampler2D u_wind;
uniform vec2 u_particle_res;
uniform vec2 u_wind_min;
uniform vec2 u_wind_max;
uniform vec4 u_bbox;
uniform float u_size;
uniform float u_count;
uniform float u_wrap;
uniform float u_kind;
out float v_speed;
out float v_alive;
out float v_edge;
out float v_kind;
${MERCATOR}
void main() {
  float id = float(gl_VertexID);
  v_kind = u_kind;
  if (id >= u_count) {
    gl_Position = vec4(2.0, 2.0, 0.0, 1.0);
    gl_PointSize = 0.0;
    v_alive = 0.0;
    v_speed = 0.0;
    v_edge = 0.0;
    return;
  }
  vec2 uv = vec2(mod(id, u_particle_res.x) + 0.5, floor(id / u_particle_res.x) + 0.5) / u_particle_res;
  vec2 pos = decode(texture(u_particles, uv));
  vec4 wtex = texture(u_wind, pos);
  vec2 vel = mix(u_wind_min, u_wind_max, wtex.rg);
  v_speed = length(vel);
  v_alive = u_kind > 2.5 ? wtex.a : wtex.b;
  float ex = u_wrap > 0.5 ? 1.0 : min(pos.x, 1.0 - pos.x);
  float ey = min(pos.y, 1.0 - pos.y);
  v_edge = min(ex, ey);
  vec2 lonlat = fieldLonLat(pos, u_bbox);
  gl_Position = projectTile(mercator(lonlat));
  gl_PointSize = u_size;
}
`
}

/** 地理丝带：头尾与宽度都在 lon/lat 挤出再 projectTile。禁止 NDC 回投（地球投影会把丝带压成点）。 */
export function makeRibbonVS(prelude: string, define: string): string {
  return `#version 300 es
${prelude}
${define}
uniform sampler2D u_particles;
uniform sampler2D u_wind;
uniform vec2 u_particle_res;
uniform vec2 u_wind_min;
uniform vec2 u_wind_max;
uniform vec4 u_bbox;
uniform vec2 u_resolution;
uniform float u_count;
uniform float u_ribbon_deg;
uniform float u_ribbon_px;
uniform float u_size;
uniform float u_min_trail;
uniform float u_wrap;
uniform float u_style;
uniform float u_kind;
out float v_alive;
out float v_along;
out float v_edge;
out float v_speed;
out float v_side;
out float v_kind;
${MERCATOR}
void main() {
  float vid = float(gl_VertexID);
  float id = floor(vid / 6.0);
  float k = mod(vid, 6.0);
  v_side = 0.0;
  v_kind = u_kind;
  if (id >= u_count) {
    gl_Position = vec4(2.0, 2.0, 0.0, 1.0);
    v_alive = 0.0;
    v_along = 0.0;
    v_edge = 0.0;
    v_speed = 0.0;
    return;
  }
  float along = (k == 2.0 || k == 3.0 || k == 5.0) ? 1.0 : 0.0;
  float side = (k == 1.0 || k == 4.0 || k == 5.0) ? 1.0 : -1.0;
  v_side = side;
  vec2 uv = vec2(mod(id, u_particle_res.x) + 0.5, floor(id / u_particle_res.x) + 0.5) / u_particle_res;
  vec2 pos = decode(texture(u_particles, uv));
  vec4 wtex = texture(u_wind, pos);
  v_alive = u_kind > 2.5 ? wtex.a : wtex.b;
  float ex = u_wrap > 0.5 ? 1.0 : min(pos.x, 1.0 - pos.x);
  float ey = min(pos.y, 1.0 - pos.y);
  v_edge = min(ex, ey);
  vec2 vel = mix(u_wind_min, u_wind_max, wtex.rg);
  v_speed = length(vel);
  if (v_alive < 0.45 && u_kind < 2.5) {
    gl_Position = vec4(2.0, 2.0, 0.0, 1.0);
    v_along = 0.0;
    return;
  }
  if (u_kind > 2.5 && wtex.a < 0.06) {
    gl_Position = vec4(2.0, 2.0, 0.0, 1.0);
    v_along = 0.0;
    return;
  }
  float vmax = max(max(abs(u_wind_min.x), abs(u_wind_max.x)), max(abs(u_wind_min.y), abs(u_wind_max.y)));
  vmax = max(vmax, 0.5);
  vec2 dir = vel / vmax;
  float dlen = length(dir);
  vec2 ndir;
  float trail;
  float halfW;
  float curl = 0.0;
  if (u_kind > 2.5) {
    vec2 fall = vec2(dir.x * 0.22, -max(0.62, abs(dir.y) * 0.18 + 0.72));
    float fl = length(fall);
    ndir = fl > 1e-5 ? fall / fl : vec2(0.0, -1.0);
    trail = max(u_ribbon_deg, 0.7) * 0.62;
    halfW = max(0.011, u_ribbon_px * (u_wrap > 0.5 ? 0.026 : 0.016));
  } else if (u_kind > 0.5 && u_kind < 1.5) {
    ndir = dlen > 1e-5 ? dir / dlen : vec2(1.0, 0.0);
    trail = max(u_ribbon_deg, 2.4) * max(dlen, 0.35);
    halfW = max(0.07, u_ribbon_px * (u_wrap > 0.5 ? 0.085 : 0.045));
  } else {
    ndir = dlen > 1e-5 ? dir / dlen : vec2(1.0, 0.0);
    trail = max(u_ribbon_deg, 2.2) * max(dlen, 0.24);
    halfW = max(0.018, u_ribbon_px * (u_wrap > 0.5 ? 0.042 : 0.026));
    curl = 0.16 * sin(id * 0.41 + along * 2.4) * halfW;
  }
  vec2 lonlat = fieldLonLat(pos, u_bbox);
  vec2 head = lonlat;
  vec2 tail = lonlat - ndir * trail;
  vec2 perp = vec2(-ndir.y, ndir.x);
  vec2 sampleLL = mix(head, tail, along) + perp * (side * halfW + curl);
  v_along = along;
  gl_Position = projectTile(mercator(sampleLL));
}
`
}

const FALLBACK_PRELUDE =
  'uniform mat4 u_projection_matrix;\nvec4 projectTile(vec2 p) { return u_projection_matrix * vec4(p, 0.0, 1.0); }\n'

export const DRAW_VS = makeDrawVS(FALLBACK_PRELUDE, '')
export const LINE_VS = makeRibbonVS(FALLBACK_PRELUDE, '')
export const makeLineVS = makeRibbonVS

export const DRAW_FS = `#version 300 es
precision mediump float;
uniform vec4 u_color;
uniform float u_style;
uniform float u_speed_ref;
uniform float u_kind;
in float v_speed;
in float v_alive;
in float v_edge;
in float v_kind;
out vec4 fragColor;
${MIX7}
void main() {
  if (v_alive < 0.45 && v_kind < 2.5) discard;
  if (v_kind > 2.5 && v_alive < 0.06) discard;
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float d = length(p);
  if (d > 1.0) discard;
  float core = smoothstep(1.0, 0.42, d);
  float edge = smoothstep(0.0, 0.03, v_edge);
  float nrm = clamp(v_speed / max(u_speed_ref, 0.4), 0.0, 1.0);
  vec3 rgb = u_color.rgb;
  float a = u_color.a * core * edge;
  if (v_kind > 0.5 && v_kind < 1.5) {
    // ocean: cold #7FD4E8 only — never white, never warm, never windRamp
    rgb = u_color.rgb;
    a *= mix(0.5, 0.95, nrm);
  } else {
    // wind: the only white streamline
    rgb = mix(u_color.rgb, vec3(0.92, 0.97, 1.0), nrm * 0.18);
  }
  fragColor = vec4(rgb * a, a);
}
`

export const FADE_FS = `#version 300 es
precision mediump float;
uniform sampler2D u_tex;
uniform float u_fade;
uniform float u_decay;
uniform float u_cap;
in vec2 v_uv;
out vec4 fragColor;
void main() {
  vec4 c = texture(u_tex, v_uv) * u_fade;
  c = max(c - vec4(u_decay), 0.0);
  float lum = max(max(c.r, c.g), c.b);
  if (lum > u_cap && lum > 1e-6) {
    c.rgb *= u_cap / lum;
    c.a = min(c.a, u_cap);
  }
  fragColor = c;
}
`

export const BLIT_FS = `#version 300 es
precision mediump float;
uniform sampler2D u_tex;
uniform float u_gain;
uniform float u_cap;
in vec2 v_uv;
out vec4 fragColor;
void main() {
  vec4 c = texture(u_tex, v_uv);
  float lum = max(max(c.r, c.g), max(c.b, c.a));
  if (lum > u_cap && lum > 1e-6) {
    c *= u_cap / lum;
  }
  fragColor = c * u_gain;
}
`

export const LINE_FS = `#version 300 es
precision highp float;
uniform vec4 u_color;
uniform float u_style;
uniform float u_speed_ref;
uniform float u_kind;
in float v_alive;
in float v_along;
in float v_edge;
in float v_speed;
in float v_side;
in float v_kind;
out vec4 fragColor;
${MIX7}
void main() {
  if (v_alive < 0.45 && v_kind < 2.5) discard;
  if (v_kind > 2.5 && v_alive < 0.06) discard;
  float edge = smoothstep(0.0, 0.045, v_edge);
  float nrm = clamp(v_speed / max(u_speed_ref, 0.4), 0.0, 1.0);
  if (v_kind > 2.5) {
    float fade = mix(1.0, 0.04, v_along);
    float widthFade = 1.0 - smoothstep(0.12, 1.0, abs(v_side));
    vec3 rgb = mix(vec3(0.86, 0.95, 1.0), vec3(0.38, 0.76, 0.94), v_along);
    fragColor = vec4(rgb, 0.82 * fade * widthFade * edge);
    return;
  }
  if (v_kind > 0.5 && v_kind < 1.5) {
    float fade = mix(0.95, 0.28, v_along);
    float widthFade = 1.0 - smoothstep(0.4, 1.0, abs(v_side));
    vec3 rgb = mix(u_color.rgb, oceanRamp(nrm), 0.72);
    fragColor = vec4(rgb, u_color.a * fade * widthFade * edge);
    return;
  }
  float fade = mix(1.0, 0.18, v_along);
  float widthFade = 1.0 - smoothstep(0.28, 1.0, abs(v_side));
  vec3 ramp = windRamp(nrm);
  vec3 rgb = mix(vec3(0.62, 0.72, 0.98), ramp, mix(0.55, 1.0, nrm));
  float alpha = mix(0.48, 0.95, nrm) * fade * widthFade * edge;
  fragColor = vec4(rgb, alpha);
}
`

export function makeQuadGeoVS(prelude: string, define: string): string {
  return `#version 300 es
${prelude}
${define}
uniform vec4 u_bbox;
uniform vec2 u_grid;
uniform float u_lon_shift;
out vec2 v_uv;
vec2 mercator(vec2 lonlat) {
  float lon = lonlat.x;
  float lat = clamp(lonlat.y, -85.051129, 85.051129);
  float x = (lon + 180.0) / 360.0;
  float siny = sin(lat * 3.141592653589793 / 180.0);
  float y = 0.5 - 0.25 * log((1.0 + siny) / (1.0 - siny)) / 3.141592653589793;
  return vec2(x, y);
}
void main() {
  float vid = float(gl_VertexID);
  float nx = max(u_grid.x, 1.0);
  float ny = max(u_grid.y, 1.0);
  float tri = floor(vid / 6.0);
  float k = mod(vid, 6.0);
  float ix = mod(tri, nx);
  float iy = floor(tri / nx);
  vec2 c0 = vec2(ix, iy);
  vec2 c1 = vec2(ix + 1.0, iy);
  vec2 c2 = vec2(ix, iy + 1.0);
  vec2 c3 = vec2(ix + 1.0, iy + 1.0);
  vec2 grid = k == 0.0 || k == 3.0 ? c0 : k == 1.0 ? c1 : k == 2.0 || k == 4.0 ? c3 : c2;
  v_uv = grid / vec2(nx, ny);
  vec2 lonlat = vec2(mix(u_bbox.x, u_bbox.z, v_uv.x) + u_lon_shift, mix(u_bbox.y, u_bbox.w, v_uv.y));
  gl_Position = projectTile(mercator(lonlat));
}
`
}

export const QUAD_GEO_VS = makeQuadGeoVS(FALLBACK_PRELUDE, '')

export const SCALAR_FS = `#version 300 es
precision highp float;
uniform sampler2D u_wind;
uniform float u_mode;
uniform float u_hatch;
uniform float u_wrap;
uniform float u_time;
uniform float u_fade_in;
in vec2 v_uv;
out vec4 fragColor;
${MIX7}
${FBM}

void main() {
  vec4 w = texture(u_wind, v_uv);
  float t = w.a;
  float mask = w.b;
  vec3 rgb;
  float alpha;
  if (u_mode < 0.5) {
    // temp: smooth color curtain only. no particles, no mottling, no hard bands.
    rgb = mix7(t,
      vec3(0.298, 0.114, 0.584),
      vec3(0.118, 0.251, 0.686),
      vec3(0.055, 0.647, 0.914),
      vec3(0.290, 0.871, 0.502),
      vec3(0.980, 0.800, 0.082),
      vec3(0.976, 0.451, 0.086),
      vec3(0.863, 0.149, 0.149));
    alpha = 0.58;
  } else if (u_mode < 1.5) {
    // precip: radar-style blobs. fbm modulates alpha + LUT sample. no particles.
    float n = fbm3(v_uv * vec2(22.0, 34.0) + vec2(u_time * 0.012, -u_time * 0.008));
    float n2 = fbm3(v_uv * vec2(51.0, 41.0) - vec2(u_time * 0.007, u_time * 0.011));
    float mottled = mix(n, n2, 0.42);
    float sampleT = clamp(t * mix(0.82, 1.18, mottled), 0.0, 1.0);
    rgb = mix7(sampleT,
      vec3(0.03, 0.10, 0.28),
      vec3(0.04, 0.38, 0.52),
      vec3(0.10, 0.62, 0.38),
      vec3(0.55, 0.82, 0.12),
      vec3(0.96, 0.78, 0.08),
      vec3(0.94, 0.38, 0.08),
      vec3(0.82, 0.10, 0.14));
    float dryA = 0.035;
    float wet = smoothstep(0.03, 0.16, t);
    float blob = smoothstep(0.32, 0.72, mottled);
    float edge = mix(0.12, 1.0, blob);
    alpha = mix(dryA, mix(0.18, 0.70, sampleT) * edge, wet);
    rgb = mix(vec3(0.03, 0.07, 0.14), rgb, wet);
  } else if (u_mode < 2.5) {
    // wind: |UV| speed curtain; particles are a separate pass
    rgb = windRamp(t);
    alpha = 0.28;
  } else {
    // ocean: frost-blue * hard sea mask. land alpha = 0.
    rgb = oceanRamp(t);
    alpha = 0.34 * mask;
  }
  alpha *= u_fade_in;
  fragColor = vec4(rgb * alpha, alpha);
}
`

export const QUAD_VS = `#version 300 es
layout(location = 0) in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`

const BILINEAR = `
vec4 bilinear(sampler2D tex, vec2 uv) {
  ivec2 ts = textureSize(tex, 0);
  vec2 texel = vec2(ts);
  vec2 coord = uv * texel - 0.5;
  vec2 f = fract(coord);
  ivec2 i0 = ivec2(floor(coord));
  ivec2 lim = ts - 1;
  ivec2 i1 = clamp(i0 + ivec2(1, 0), ivec2(0), lim);
  ivec2 i2 = clamp(i0 + ivec2(0, 1), ivec2(0), lim);
  ivec2 i3 = clamp(i0 + ivec2(1, 1), ivec2(0), lim);
  i0 = clamp(i0, ivec2(0), lim);
  vec4 a = texelFetch(tex, i0, 0);
  vec4 b = texelFetch(tex, i1, 0);
  vec4 c = texelFetch(tex, i2, 0);
  vec4 d = texelFetch(tex, i3, 0);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
`

export const UPDATE_FS = `#version 300 es
precision highp float;
uniform sampler2D u_particles;
uniform sampler2D u_wind;
uniform vec2 u_particle_res;
uniform vec2 u_wind_min;
uniform vec2 u_wind_max;
uniform vec4 u_bbox;
uniform float u_rand_seed;
uniform float u_speed;
uniform float u_dt;
uniform float u_advect_scale;
uniform float u_drop_rate;
uniform float u_wrap;
uniform vec4 u_view;
uniform vec2 u_resolution;
uniform float u_max_step_px;
in vec2 v_uv;
out vec4 fragColor;
${BILINEAR}

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
vec2 fieldLonLat(vec2 uv, vec4 bbox) {
  return vec2(mix(bbox.x, bbox.z, uv.x), mix(bbox.y, bbox.w, uv.y));
}
vec2 lonLatToUv(vec2 lonlat, vec4 bbox) {
  float lonSpan = max(bbox.z - bbox.x, 1e-4);
  float latSpan = max(bbox.w - bbox.y, 1e-4);
  return vec2((lonlat.x - bbox.x) / lonSpan, (lonlat.y - bbox.y) / latSpan);
}
void main() {
  vec4 pc = texture(u_particles, v_uv);
  vec2 pos = decode(pc);
  vec2 lonlat = fieldLonLat(pos, u_bbox);
  vec2 suv = lonLatToUv(lonlat, u_bbox);
  vec4 wtex = bilinear(u_wind, suv);
  vec2 vel = mix(u_wind_min, u_wind_max, wtex.rg);
  float mask = wtex.b;
  float r = rand(pos + u_rand_seed);
  float coslat = max(cos(radians(clamp(lonlat.y, -85.0, 85.0))), 0.2);
  vec2 velAdv = vel * u_speed * u_dt * u_advect_scale;
  vec2 dDeg = vec2(velAdv.x / coslat, velAdv.y);
  vec2 visUv = max(u_view.zw - u_view.xy, vec2(1e-4));
  vec2 visDeg = visUv * vec2(max(u_bbox.z - u_bbox.x, 1e-4), max(u_bbox.w - u_bbox.y, 1e-4));
  vec2 pxPerDeg = u_resolution / visDeg;
  float stepPx = length(vec2(dDeg.x * pxPerDeg.x, dDeg.y * pxPerDeg.y));
  if (stepPx > u_max_step_px && stepPx > 1e-6) {
    dDeg *= u_max_step_px / stepPx;
  }
  lonlat += dDeg;
  pos = lonLatToUv(lonlat, u_bbox);
  bool dead = mask < 0.45 || r < u_drop_rate;
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
      vec4 s = bilinear(u_wind, pos);
      if (s.b >= 0.45) break;
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

/** Prev→curr thin silk. Two verts / particle. Drop reseed/wrap teleports. */
export function makeTrailLineVS(prelude: string, define: string): string {
  return `#version 300 es
${prelude}
${define}
uniform sampler2D u_particles;
uniform sampler2D u_prev;
uniform sampler2D u_wind;
uniform vec2 u_particle_res;
uniform vec2 u_wind_min;
uniform vec2 u_wind_max;
uniform vec4 u_bbox;
uniform float u_count;
uniform float u_wrap;
uniform float u_kind;
uniform float u_max_delta;
out float v_speed;
out float v_kind;
out vec2 v_fieldUv;
${MERCATOR}
void main() {
  float vid = float(gl_VertexID);
  float id = floor(vid * 0.5);
  float isHead = mod(vid, 2.0);
  v_kind = u_kind;
  if (id >= u_count) {
    gl_Position = vec4(2.0, 2.0, 0.0, 1.0);
    v_speed = 0.0;
    v_fieldUv = vec2(0.0);
    return;
  }
  vec2 uv = vec2(mod(id, u_particle_res.x) + 0.5, floor(id / u_particle_res.x) + 0.5) / u_particle_res;
  vec2 prev = decode(texture(u_prev, uv));
  vec2 curr = decode(texture(u_particles, uv));
  vec2 delta = abs(curr - prev);
  if (delta.x > u_max_delta || delta.y > u_max_delta) {
    gl_Position = vec4(2.0, 2.0, 0.0, 1.0);
    v_speed = 0.0;
    v_fieldUv = curr;
    return;
  }
  vec2 pos = mix(prev, curr, isHead);
  vec4 wtex = texture(u_wind, curr);
  vec2 vel = mix(u_wind_min, u_wind_max, wtex.rg);
  v_speed = length(vel);
  v_fieldUv = pos;
  vec2 lonlat = fieldLonLat(pos, u_bbox);
  gl_Position = projectTile(mercator(lonlat));
}
`
}

/** 路径蝌蚪带：沿粒子真实位移 prev→curr 挤出，头粗尾细，随头蜿蜒。 */
export function makePathRibbonVS(prelude: string, define: string): string {
  return `#version 300 es
${prelude}
${define}
uniform sampler2D u_particles;
uniform sampler2D u_prev;
uniform sampler2D u_wind;
uniform vec2 u_particle_res;
uniform vec2 u_wind_min;
uniform vec2 u_wind_max;
uniform vec4 u_bbox;
uniform float u_count;
uniform float u_wrap;
uniform float u_kind;
uniform float u_max_delta;
uniform float u_ribbon_px;
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
    v_alive = 0.0; v_along = 0.0; v_edge = 0.0; v_speed = 0.0;
    return;
  }
  float along = (k == 2.0 || k == 3.0 || k == 5.0) ? 1.0 : 0.0; // 0=head(curr) 1=tail(prev)
  float side = (k == 1.0 || k == 4.0 || k == 5.0) ? 1.0 : -1.0;
  v_side = side;
  v_along = along;
  vec2 uv = vec2(mod(id, u_particle_res.x) + 0.5, floor(id / u_particle_res.x) + 0.5) / u_particle_res;
  vec2 prev = decode(texture(u_prev, uv));
  vec2 curr = decode(texture(u_particles, uv));
  vec2 delta = abs(curr - prev);
  if (delta.x > u_max_delta || delta.y > u_max_delta) {
    gl_Position = vec4(2.0, 2.0, 0.0, 1.0);
    v_alive = 0.0; v_speed = 0.0; return;
  }
  vec4 wtex = texture(u_wind, curr);
  v_alive = u_kind > 2.5 ? wtex.a : wtex.b;
  float ex = u_wrap > 0.5 ? 1.0 : min(curr.x, 1.0 - curr.x);
  float ey = min(curr.y, 1.0 - curr.y);
  v_edge = min(ex, ey);
  vec2 vel = mix(u_wind_min, u_wind_max, wtex.rg);
  v_speed = length(vel);
  if (v_alive < 0.45 && u_kind < 2.5) {
    gl_Position = vec4(2.0, 2.0, 0.0, 1.0); return;
  }
  vec2 headLL = fieldLonLat(curr, u_bbox);
  vec2 tailLL = fieldLonLat(prev, u_bbox);
  vec2 dir = headLL - tailLL;
  float len = length(dir);
  float spd = clamp(v_speed / max(max(abs(u_wind_max.x), abs(u_wind_max.y)), 0.5), 0.0, 1.0);
  // Same soft ribbon as wind (ocean matches wind look).
  float minLen = mix(0.35, 1.2, pow(spd, 0.7));
  if (len < 1e-6) {
    float vmax = max(max(abs(u_wind_min.x), abs(u_wind_max.x)), max(abs(u_wind_min.y), abs(u_wind_max.y)));
    vmax = max(vmax, 0.5);
    vec2 nd = vel / vmax;
    float dl = length(nd);
    nd = dl > 1e-5 ? nd / dl : vec2(1.0, 0.0);
    tailLL = headLL - nd * minLen;
    dir = headLL - tailLL;
    len = length(dir);
  } else if (len < minLen) {
    dir *= (minLen / len);
    tailLL = headLL - dir;
    len = minLen;
  }
  float extend = mix(1.7, 3.4, pow(spd, 0.7));
  tailLL = headLL - normalize(dir) * (len * extend);
  vec2 ndir = normalize(headLL - tailLL);
  vec2 perp = vec2(-ndir.y, ndir.x);
  float halfW = max(0.016, u_ribbon_px * (u_wrap > 0.5 ? 0.022 : 0.015));
  halfW *= mix(1.4, 0.18, along);
  float bend = 0.7 * sin(along * 3.14159265) * halfW * mix(2.2, 0.8, spd);
  bend += 0.15 * sin(id * 0.53) * halfW;
  vec2 sampleLL = mix(headLL, tailLL, along) + perp * (side * halfW + bend);
  gl_Position = projectTile(mercator(sampleLL));
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
    // ocean = same ribbon math as wind
    float spd = clamp(dlen, 0.06, 1.0);
    trail = max(u_ribbon_deg, 2.0) * mix(0.7, 3.4, pow(spd, 0.75));
    halfW = max(0.022, u_ribbon_px * (u_wrap > 0.5 ? 0.055 : 0.034));
    halfW *= mix(1.2, 0.2, along);
    curl = 0.1 * sin(id * 0.41 + along * 2.4) * halfW * (1.0 - along);
  } else {
    ndir = dlen > 1e-5 ? dir / dlen : vec2(1.0, 0.0);
    float spd = clamp(dlen, 0.06, 1.0);
    trail = max(u_ribbon_deg, 2.0) * mix(0.7, 3.4, pow(spd, 0.75));
    halfW = max(0.022, u_ribbon_px * (u_wrap > 0.5 ? 0.055 : 0.034));
    halfW *= mix(1.2, 0.2, along);
    curl = 0.1 * sin(id * 0.41 + along * 2.4) * halfW * (1.0 - along);
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
export const TRAIL_LINE_VS = makeTrailLineVS(FALLBACK_PRELUDE, '')
export const PATH_RIBBON_VS = makePathRibbonVS(FALLBACK_PRELUDE, '')
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
void main() {
  if (v_alive < 0.45 && v_kind < 2.5) discard;
  if (v_kind > 2.5 && v_alive < 0.06) discard;
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float d = length(p);
  if (d > 1.0) discard;
  float core = smoothstep(1.0, 0.25, d);
  float soft = smoothstep(1.0, 0.55, d);
  float edge = smoothstep(0.0, 0.03, v_edge);
  float nrm = clamp(v_speed / max(u_speed_ref, 0.4), 0.0, 1.0);
  vec3 rgb = u_color.rgb;
  float a = u_color.a * mix(soft, core, 0.65) * edge;
  if (v_kind > 0.5 && v_kind < 1.5) {
    rgb = mix(u_color.rgb, vec3(0.95, 0.99, 1.0), 0.35);
    a *= mix(0.45, 1.0, nrm);
  } else {
    rgb = vec3(1.0);
    a = mix(0.4, 0.95, nrm) * mix(soft, core, 0.7) * edge;
  }
  fragColor = vec4(rgb * a, a);
}
`

export const TRAIL_LINE_FS = `#version 300 es
precision mediump float;
uniform sampler2D u_wind;
uniform vec4 u_color;
uniform float u_kind;
uniform float u_speed_ref;
in float v_speed;
in float v_kind;
in vec2 v_fieldUv;
out vec4 fragColor;
void main() {
  float mask = texture(u_wind, v_fieldUv).b;
  float nrm = clamp(v_speed / max(u_speed_ref, 0.4), 0.0, 1.0);
  if (v_kind > 0.5 && v_kind < 1.5) {
    // ocean: #7FD4E8 silk. land mask=0 → discard. never on land.
    if (mask < 0.5) discard;
    vec3 rgb = u_color.rgb;
    float a = u_color.a * mix(0.42, 0.88, nrm);
    fragColor = vec4(rgb * a, a);
    return;
  }
  if (mask < 0.45) discard;
  // wind: thin translucent white silk. alpha locked 0.1–0.3. never opaque wall.
  vec3 rgb = vec3(1.0);
  float a = mix(0.1, 0.3, nrm);
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
    // Match wind silk: thin white ribbon, soft fade along trail.
    float fade = mix(1.0, 0.1, pow(v_along, 0.7));
    float widthFade = 1.0 - smoothstep(0.12, 0.95, abs(v_side));
    vec3 rgb = vec3(1.0);
    float alpha = mix(0.35, 0.92, nrm) * fade * widthFade * edge;
    fragColor = vec4(rgb * alpha, alpha);
    return;
  }
  float fade = mix(1.0, 0.1, pow(v_along, 0.7));
  float widthFade = 1.0 - smoothstep(0.12, 0.95, abs(v_side));
  vec3 rgb = windRamp(nrm);
  float alpha = mix(0.35, 0.92, nrm) * fade * widthFade * edge;
  fragColor = vec4(rgb * alpha, alpha);
}
`

export const PATH_RIBBON_FS = LINE_FS

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
uniform sampler2D u_lut;
uniform vec4 u_bbox;
uniform float u_mode;
uniform float u_hatch;
uniform float u_wrap;
uniform float u_time;
uniform float u_fade_in;
in vec2 v_uv;
out vec4 fragColor;
${BILINEAR}
${FBM}

vec3 lutRgb(float t) {
  return texture(u_lut, vec2(clamp(t, 0.0, 1.0), 0.5)).rgb;
}

void main() {
  vec4 w = bilinear(u_wind, v_uv);
  float t = w.a;
  float mask = w.b;
  vec3 rgb;
  float alpha;
  if (u_mode < 0.5) {
    // temp: 256×1 LINEAR LUT, bilinear field. smooth color curtain only.
    rgb = lutRgb(t);
    alpha = 0.58;
  } else if (u_mode < 1.5) {
    // precip: radar-style blobs. fbm modulates alpha + LUT sample. no particles.
    vec2 lonlat = vec2(mix(u_bbox.x, u_bbox.z, v_uv.x), mix(u_bbox.y, u_bbox.w, v_uv.y));
    vec2 p = lonlat * vec2(0.055, 0.078);
    vec2 q = vec2(
      fbm3(p + vec2(u_time * 0.018, 0.11)),
      fbm3(p + vec2(4.2, 1.7) - vec2(0.0, u_time * 0.014))
    );
    float envelope = fbm3(p + q * 0.95);
    float interior = fbm3(p * 2.35 + q + vec2(2.8, -1.1));
    float mottled = envelope * 0.72 + interior * 0.28;
    float sampleT = clamp(t * mix(0.72, 1.28, mottled), 0.0, 1.0);
    rgb = lutRgb(sampleT);
    float dryA = 0.02;
    float wet = smoothstep(0.02, 0.14, t);
    float blob = smoothstep(0.40, 0.60, envelope);
    float edge = mix(0.10, 1.0, blob);
    alpha = mix(dryA, mix(0.22, 0.78, sampleT) * edge, wet);
    rgb = mix(vec3(0.031, 0.071, 0.157), rgb, wet);
  } else if (u_mode < 2.5) {
    rgb = lutRgb(t);
    float luma = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
    rgb = mix(vec3(luma), rgb, 0.5);
    alpha = 0.5;
  } else {
    // ocean: frost-blue LUT * hard sea mask. land alpha = 0.
    rgb = lutRgb(t);
    alpha = 0.34 * mask;
  }
  alpha *= u_fade_in;
  fragColor = vec4(rgb * alpha, alpha);
}
`

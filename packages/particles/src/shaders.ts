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
uniform float u_uv_scale;
uniform float u_drop_rate;
uniform float u_wrap;
in vec2 v_uv;
out vec4 fragColor;

vec2 decode(vec4 c) {
  return vec2(c.r + c.b / 255.0, c.g + c.a / 255.0);
}
vec4 encode(vec2 p) {
  p = clamp(p, 0.0, 0.999);
  return vec4(fract(p * 255.0), floor(p * 255.0) / 255.0);
}
float rand(const vec2 co) {
  float t = 12.9898 * co.x + 78.233 * co.y;
  return fract(sin(t) * 43758.5453);
}
void main() {
  vec4 pc = texture(u_particles, v_uv);
  vec2 pos = decode(pc);
  vec4 wtex = texture(u_wind, pos);
  vec2 vel = mix(u_wind_min, u_wind_max, wtex.rg);
  float mask = wtex.b;
  float vmax = max(max(abs(u_wind_min.x), abs(u_wind_max.x)), max(abs(u_wind_min.y), abs(u_wind_max.y)));
  vmax = max(vmax, 0.5);
  pos += (vel / vmax) * (u_advect * u_speed * u_uv_scale);
  float drop = u_drop_rate + length(vel) / vmax * 0.01 * u_uv_scale;
  float r = rand(pos + u_rand_seed);
  bool dead = mask < 0.45 || r < drop;
  if (u_wrap > 0.5) {
    pos.x = fract(pos.x);
    if (pos.y < 0.0 || pos.y > 1.0) dead = true;
  } else if (pos.x < 0.0 || pos.x > 1.0 || pos.y < 0.0 || pos.y > 1.0) {
    dead = true;
  }
  if (dead) {
    pos = vec2(rand(v_uv + u_rand_seed), rand(v_uv.yx * 1.73 + u_rand_seed));
    for (int i = 0; i < 8; i++) {
      if (texture(u_wind, pos).b >= 0.45) break;
      vec2 salt = pos + vec2(float(i) * 0.17, float(i) * 0.31) + u_rand_seed;
      pos = vec2(rand(salt), rand(salt.yx * 1.73));
    }
  }
  fragColor = encode(pos);
}
`

const MERCATOR = `
vec2 decode(vec4 c) {
  return vec2(c.r + c.b / 255.0, c.g + c.a / 255.0);
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
out float v_speed;
out float v_alive;
out float v_edge;
${MERCATOR}
void main() {
  float id = float(gl_VertexID);
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
  v_alive = wtex.b;
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
out float v_alive;
out float v_along;
out float v_edge;
out float v_speed;
out float v_side;
${MERCATOR}
void main() {
  float vid = float(gl_VertexID);
  float id = floor(vid / 6.0);
  float k = mod(vid, 6.0);
  v_side = 0.0;
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
  v_alive = wtex.b;
  float ex = u_wrap > 0.5 ? 1.0 : min(pos.x, 1.0 - pos.x);
  float ey = min(pos.y, 1.0 - pos.y);
  v_edge = min(ex, ey);
  vec2 vel = mix(u_wind_min, u_wind_max, wtex.rg);
  v_speed = length(vel);
  if (v_alive < 0.45) {
    gl_Position = vec4(2.0, 2.0, 0.0, 1.0);
    v_along = 0.0;
    return;
  }
  float vmax = max(max(abs(u_wind_min.x), abs(u_wind_max.x)), max(abs(u_wind_min.y), abs(u_wind_max.y)));
  vmax = max(vmax, 0.5);
  vec2 dir = vel / vmax;
  float dlen = length(dir);
  vec2 ndir = dlen > 1e-5 ? dir / dlen : vec2(1.0, 0.0);
  float minLen = u_style > 0.5 ? 0.35 : 0.24;
  float trail = max(u_ribbon_deg, u_style > 0.5 ? 2.4 : 2.2) * max(dlen, minLen);
  vec2 lonlat = fieldLonLat(pos, u_bbox);
  vec2 head = lonlat;
  vec2 tail = lonlat - ndir * trail;
  vec2 perp = vec2(-ndir.y, ndir.x);
  float halfW = u_style > 0.5
    ? max(0.07, u_ribbon_px * (u_wrap > 0.5 ? 0.085 : 0.045))
    : max(0.018, u_ribbon_px * (u_wrap > 0.5 ? 0.048 : 0.026));
  float curl = u_style > 0.5 ? 0.0 : 0.16 * sin(id * 0.41 + along * 2.4) * halfW;
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
in float v_speed;
in float v_alive;
in float v_edge;
out vec4 fragColor;
void main() {
  if (v_alive < 0.45) discard;
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float d = length(p);
  if (d > 1.0) discard;
  float core = smoothstep(1.0, 0.18, d);
  float fog = smoothstep(1.0, 0.0, d);
  float alpha = mix(fog * 0.88, core * 0.8, u_style);
  alpha *= smoothstep(0.0, 0.045, v_edge);
  vec3 frost = vec3(0.722, 0.878, 0.941);
  vec3 mist = vec3(0.91, 0.957, 1.0);
  float nrm = clamp(v_speed / max(u_speed_ref, 0.4), 0.0, 1.0);
  vec3 rgb = u_style > 0.5
    ? mix(u_color.rgb, frost, clamp(v_speed / 1.4, 0.0, 1.0))
    : mix(u_color.rgb, mist, nrm * 0.28);
  fragColor = vec4(rgb, u_color.a * alpha);
}
`

export const LINE_FS = `#version 300 es
precision highp float;
uniform vec4 u_color;
uniform float u_style;
uniform float u_speed_ref;
in float v_alive;
in float v_along;
in float v_edge;
in float v_speed;
in float v_side;
out vec4 fragColor;
void main() {
  if (v_alive < 0.45) discard;
  float edge = smoothstep(0.0, 0.045, v_edge);
  vec3 frost = vec3(0.722, 0.878, 0.941);
  if (u_style > 0.5) {
    float fade = mix(1.0, 0.42, v_along);
    vec3 rgb = mix(u_color.rgb, frost, clamp(v_speed / 1.4, 0.0, 1.0));
    fragColor = vec4(rgb, u_color.a * 0.95 * fade * edge);
  } else {
    float fade = mix(1.0, 0.38, v_along);
    float widthFade = 1.0 - smoothstep(0.35, 1.0, abs(v_side));
    vec3 mist = vec3(0.91, 0.957, 1.0);
    float nrm = clamp(v_speed / max(u_speed_ref, 0.4), 0.0, 1.0);
    vec3 rgb = mix(u_color.rgb, mist, nrm * 0.22);
    fragColor = vec4(rgb, u_color.a * fade * widthFade * edge);
  }
}
`

export function makeQuadGeoVS(prelude: string, define: string): string {
  return `#version 300 es
${prelude}
${define}
uniform vec4 u_bbox;
uniform vec2 u_grid;
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
  vec2 lonlat = vec2(mix(u_bbox.x, u_bbox.z, v_uv.x), mix(u_bbox.y, u_bbox.w, v_uv.y));
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
in vec2 v_uv;
out vec4 fragColor;

// Ventusky-like meteorological ramps on OUR FieldFrame. No remote tiles.
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

void main() {
  vec4 w = texture(u_wind, v_uv);
  float t = w.a;
  float mask = w.b;
  float ey = min(v_uv.y, 1.0 - v_uv.y);
  float ex = min(v_uv.x, 1.0 - v_uv.x);
  float edge = u_wrap > 0.5 ? smoothstep(0.0, 0.012, ey) : smoothstep(0.0, 0.02, min(ex, ey));
  vec4 color;
  if (u_mode < 0.5) {
    vec3 c = mix7(t,
      vec3(0.227, 0.039, 0.431),
      vec3(0.118, 0.235, 0.722),
      vec3(0.071, 0.627, 0.784),
      vec3(0.180, 0.800, 0.443),
      vec3(0.945, 0.769, 0.059),
      vec3(0.902, 0.494, 0.133),
      vec3(0.753, 0.224, 0.169));
    color = vec4(c, mix(0.86, 0.94, t));
  } else if (u_mode < 1.5) {
    float wet = smoothstep(0.02, 1.0, t);
    float a = mix(0.0, 0.88, pow(wet, 0.72));
    if (u_hatch > 0.5) {
      float hatch = abs(fract((v_uv.x + v_uv.y) * 42.0) - 0.5);
      a = mix(a, smoothstep(0.22, 0.08, hatch) * wet * 0.7, 0.35);
    }
    vec3 c = mix7(t,
      vec3(0.780, 0.925, 0.980),
      vec3(0.400, 0.820, 0.950),
      vec3(0.180, 0.470, 0.860),
      vec3(0.160, 0.220, 0.720),
      vec3(0.420, 0.140, 0.680),
      vec3(0.720, 0.080, 0.480),
      vec3(0.830, 0.080, 0.220));
    color = vec4(c, a);
  } else if (u_mode < 2.5) {
    vec3 c = mix7(t,
      vec3(0.078, 0.227, 0.420),
      vec3(0.090, 0.510, 0.620),
      vec3(0.122, 0.690, 0.400),
      vec3(0.780, 0.831, 0.165),
      vec3(0.941, 0.627, 0.125),
      vec3(0.886, 0.227, 0.173),
      vec3(0.545, 0.102, 0.478));
    color = vec4(c, mix(0.82, 0.92, t));
  } else {
    vec3 c = mix7(t,
      vec3(0.040, 0.140, 0.260),
      vec3(0.050, 0.290, 0.430),
      vec3(0.080, 0.520, 0.560),
      vec3(0.200, 0.760, 0.620),
      vec3(0.780, 0.860, 0.380),
      vec3(0.940, 0.720, 0.220),
      vec3(0.900, 0.380, 0.160));
    color = vec4(c, mix(0.55, 0.78, t) * mask);
  }
  color.a *= edge;
  fragColor = color;
}
`

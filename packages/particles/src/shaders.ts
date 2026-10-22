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
  v_speed = length(wtex.rg);
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

/** 地理丝带：沿速度的两端用场 bbox→lonlat→mercator→projectTile；宽度在 NDC 挤出。 */
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
uniform float u_wrap;
out float v_alive;
out float v_along;
out float v_edge;
${MERCATOR}
void main() {
  float vid = float(gl_VertexID);
  float id = floor(vid / 6.0);
  float k = mod(vid, 6.0);
  if (id >= u_count) {
    gl_Position = vec4(2.0, 2.0, 0.0, 1.0);
    v_alive = 0.0;
    v_along = 0.0;
    v_edge = 0.0;
    return;
  }
  float along = (k == 2.0 || k == 3.0 || k == 5.0) ? 1.0 : 0.0;
  float side = (k == 1.0 || k == 4.0 || k == 5.0) ? 1.0 : -1.0;
  vec2 uv = vec2(mod(id, u_particle_res.x) + 0.5, floor(id / u_particle_res.x) + 0.5) / u_particle_res;
  vec2 pos = decode(texture(u_particles, uv));
  vec4 wtex = texture(u_wind, pos);
  v_alive = wtex.b;
  float ex = u_wrap > 0.5 ? 1.0 : min(pos.x, 1.0 - pos.x);
  float ey = min(pos.y, 1.0 - pos.y);
  v_edge = min(ex, ey);
  if (v_alive < 0.45) {
    gl_Position = vec4(2.0, 2.0, 0.0, 1.0);
    v_along = 0.0;
    return;
  }
  vec2 vel = mix(u_wind_min, u_wind_max, wtex.rg);
  float vmax = max(max(abs(u_wind_min.x), abs(u_wind_max.x)), max(abs(u_wind_min.y), abs(u_wind_max.y)));
  vmax = max(vmax, 0.5);
  vec2 dir = vel / vmax;
  vec2 lonlat = fieldLonLat(pos, u_bbox);
  vec2 dlonlat = vec2(dir.x, dir.y) * u_ribbon_deg;
  vec2 tailLonLat = lonlat - dlonlat;
  vec4 clipH = projectTile(mercator(lonlat));
  vec4 clipT = projectTile(mercator(tailLonLat));
  float eps = 1e-5;
  vec2 ndcH = clipH.xy / max(abs(clipH.w), eps) * sign(clipH.w);
  vec2 ndcT = clipT.xy / max(abs(clipT.w), eps) * sign(clipT.w);
  vec2 ndcDir = ndcH - ndcT;
  float len = length(ndcDir);
  vec2 n = len > 1e-6 ? vec2(-ndcDir.y, ndcDir.x) / len : vec2(0.0, 1.0);
  vec2 pixel = vec2(u_ribbon_px / max(u_resolution.x, 1.0), u_ribbon_px / max(u_resolution.y, 1.0)) * 2.0;
  vec2 offset = n * side * pixel * 0.5;
  vec2 ndc = mix(ndcH, ndcT, along) + offset;
  float w = mix(clipH.w, clipT.w, along);
  float z = mix(clipH.z, clipT.z, along);
  v_along = along;
  gl_Position = vec4(ndc * w, z, w);
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
  fragColor = vec4(u_color.rgb, u_color.a * alpha);
}
`

export const LINE_FS = `#version 300 es
precision mediump float;
uniform vec4 u_color;
in float v_alive;
in float v_along;
in float v_edge;
out vec4 fragColor;
void main() {
  if (v_alive < 0.45) discard;
  float fade = mix(1.0, 0.18, v_along);
  float edge = smoothstep(0.0, 0.045, v_edge);
  fragColor = vec4(u_color.rgb, u_color.a * 0.9 * fade * edge);
}
`

export function makeQuadGeoVS(prelude: string, define: string): string {
  return `#version 300 es
${prelude}
${define}
uniform vec4 u_bbox;
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
  vec2 corners[4];
  corners[0] = vec2(u_bbox.x, u_bbox.y);
  corners[1] = vec2(u_bbox.z, u_bbox.y);
  corners[2] = vec2(u_bbox.x, u_bbox.w);
  corners[3] = vec2(u_bbox.z, u_bbox.w);
  vec2 lonlat = corners[gl_VertexID];
  v_uv = vec2(gl_VertexID == 1 || gl_VertexID == 3 ? 1.0 : 0.0, gl_VertexID == 2 || gl_VertexID == 3 ? 1.0 : 0.0);
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
in vec2 v_uv;
out vec4 fragColor;
void main() {
  vec4 w = texture(u_wind, v_uv);
  float t = w.a;
  if (u_mode < 0.5) {
    vec3 cold = vec3(0.22, 0.42, 0.72);
    vec3 mid = vec3(0.78, 0.52, 0.36);
    vec3 cream = vec3(0.93, 0.84, 0.70);
    vec3 c = mix(cold, mid, smoothstep(0.04, 0.52, t));
    c = mix(c, cream, smoothstep(0.52, 0.96, t));
    float a = 0.54 * smoothstep(0.01, 0.9, t);
    fragColor = vec4(c, a);
  } else {
    if (t < 0.07) discard;
    float puddle = smoothstep(0.07, 0.68, t);
    float blob = puddle * puddle * (3.0 - 2.0 * puddle);
    float a = blob * 0.58;
    if (u_hatch > 0.5) {
      float hatch = abs(fract((v_uv.x + v_uv.y) * 42.0) - 0.5);
      float line = smoothstep(0.22, 0.08, hatch);
      a = mix(a, line * puddle * 0.7, 0.55);
    }
    vec3 c = vec3(0.38, 0.70, 0.86);
    fragColor = vec4(c, a);
  }
}
`

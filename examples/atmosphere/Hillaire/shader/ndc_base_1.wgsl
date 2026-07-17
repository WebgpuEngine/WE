// 着色器输入
var <private >  iResolution: vec3f=vec3(0.0,0.0,0.0);           // viewport resolution (in pixels)
var <private >  iTime: f32=0.0;                 // shader playback time (in seconds)
var <private >  iMouse: vec4f=vec4(0.0,0.0,0.0,0.0);                // mouse pixel coords. xy: current (if MLB down), zw: click

fn shadertoy(uv: vec2f,fragCoord: vec2f)->vec4f{
 let color =0.5 + 0.5*cos(iTime + uv.xyx + vec3f(0,2,4));
  return vec4f(color,1.0);
}
//////////////////////////////////////////////////////////////
struct st_uniform_toy {
    u_resolution: vec2f,
    u_mouse_xy: vec2f,
    u_mouse_btn: i32,
    u_time: f32,
};
@group(0) @binding(0) var<uniform> u_toy: st_uniform_toy;
struct VertexOutput {
  @builtin(position) position : vec4f,
  @location(0) uv: vec2f,
}


@vertex fn vs(
  @builtin(vertex_index) VertexIndex : u32
) -> VertexOutput {
  var pos = array<vec2f, 3>(
    vec2(-1.0, 3.0),
    vec2(-1.0, -1.0),
    vec2(3.0, -1.0)
  );
  var xy = pos[VertexIndex];
  return VertexOutput(
    vec4f(xy, 0.0, 1.0),
    vec2(xy)*0.5+0.5,
  );
}
//////////////////////////////////////////////////////////////

// @fragment
// fn fs(fsInput: VertexOutput) -> @location(0) vec4f {
//  iTime = u_toy.u_time;
//  iMouse = vec4f(u_toy.u_mouse_xy, f32(u_toy.u_mouse_btn),f32(u_toy.u_mouse_btn));
//  iResolution = vec3f(u_toy.u_resolution, 0.0);
//   return shadertoy(fsInput.uv,fsInput.position.xy);
// }
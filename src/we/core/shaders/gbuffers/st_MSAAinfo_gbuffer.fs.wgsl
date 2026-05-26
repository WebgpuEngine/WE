
//start : st_MSAAinfo_gbuffer.fs.wgsl   
struct ST_GBuffer{
    @builtin(frag_depth) depth : f32,
    @location(0) id : u32,
    @location(1) normal : vec4f,
    @location(2) RMAO : vec4f,
    @location(3) worldPosition : vec4f,
    @location(4) albedo : vec4f,
    @location(5) emissiveIntensity : vec4f,

}
//end : st_MSAAinfo_gbuffer.fs.wgsl

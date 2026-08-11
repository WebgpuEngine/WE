
//start : st_MSAAinfo_gbuffer.fs.wgsl   
struct ST_GBuffer{
    @builtin(frag_depth) depth : f32,
    @location(0) id : u32,
    @location(1) normal : vec4f,
    @location(2) pbr : vec4u,


}
//end : st_MSAAinfo_gbuffer.fs.wgsl

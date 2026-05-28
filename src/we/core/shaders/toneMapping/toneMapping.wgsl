@group(0) @binding(0) var u_ColorTexture : texture_2d<f32>;
@group(0) @binding(1) var<uniform> u_Exposure : f32;

#includeFile "colorSpace/toneMapping.wgsl"

@vertex fn vs(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position)  vec4f {
    let pos = array(
            vec2f( -1.0,  -1.0),  // bottom left
            vec2f( 1.0,  -1.0),  // top left
            vec2f( -1.0,  1.0),  // top right
            vec2f( 1.0,  1.0),  // bottom right
            );
    return vec4f(pos[vertexIndex], 0.0, 1.0);
}
@fragment fn fs(@builtin(position) pos: vec4f ) -> @location(0) vec4f{
        toneMappingExposure = u_Exposure;
    let color=textureLoad(u_ColorTexture, vec2i(floor(pos.xy) ) ,0);
    //tone mapping 返回颜色代码部分（在程序中替换，有运行时判断，但具有全局一次性）
    $returnColor
}`
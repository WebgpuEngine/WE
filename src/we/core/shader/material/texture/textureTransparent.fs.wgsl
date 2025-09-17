
@fragment 
fn fs(fsInput: VertexShaderOutput) -> ST_GBuffer {    
    initSystemOfFS();
    var output: ST_GBuffer;
    //替换标识符，输出结构体
     $fsOutput
    //延迟渲染的深度渲染，在TS中替换字符串
    $deferRender_Depth
    //材质颜色
    let materialColor =textureSample(u_colorTexture, u_Sampler, fsInput.uv );


    //输出的color
    output.color = materialColor;

    //获取GBuffer的depth,uv,normal,id 值
    var last_depth = textureLoad(u_depth_opacity, vec2i(i32(fsInput.position.x), i32(fsInput.position.y)), 0);
    var last_id = textureLoad(u_entityID_opacity, vec2i(i32(fsInput.position.x), i32(fsInput.position.y)), 0).r;
    var last_normal = textureLoad(u_normal_opacity, vec2i(i32(fsInput.position.x), i32(fsInput.position.y)), 0);
    var last_worldPosition = textureLoad(u_worldPosition_opacity, vec2i(i32(fsInput.position.x), i32(fsInput.position.y)), 0);
    var last_ru_ma_AO = textureLoad(u_ru_ma_AO_opacity, vec2i(i32(fsInput.position.x), i32(fsInput.position.y)), 0);


    //透明情况
    if(materialColor.a < 1.0)
    {
        //是否有reveredZ
        if U_MVP.reversedZ == 1 {
            if (fsInput.position.z> last_depth)//输出当前的color，其他值不变，混合由blend参数决定
            {
                output.depth = last_depth;
                output.normal = last_normal;
                output.id = last_id;
                output.worldPosition = last_worldPosition;
                output.ru_ma_AO = last_ru_ma_AO;
                //output.color = vec4f(0.0, 1.0, 0.0, 1.0);
            } else {
            //在last的像素后方，放弃当前像素
                discard;
                //output.color = vec4f(1.0, .0, 0.0, 1.0);

            }
        }
        else
        {
            //输出当前的color，其他值不变，混合由blend参数决定
            if (fsInput.position.z < last_depth)
            {
                output.depth = last_depth;
                output.normal = last_normal;
                output.id = last_id;
                output.worldPosition = last_worldPosition;
                output.ru_ma_AO = last_ru_ma_AO;
            } else {
                discard;
            }
        }
    }
    //不透明情况
    else
    {
        if U_MVP.reversedZ == 1 {
            if (fsInput.position.z> depth)
            {

            } else {
                discard;

            }
        }
        else
        {
            if (fsInput.position.z < depth)
            {

            } else {
                discard;
            }
        }
    }

    return output;
}


#includeFile "system/structOfCamera.wgsl" 
#includeFile "system/system.wgsl"
#tag gbuffers
#includeFile "function/encodeAndDecode.wgsl"
#includeFile "entity/st_vertex_output.wgsl"


#includeFile "math/baseconst.wgsl"
#includeFile "math/TBN.wgsl"
#includeFile "math/random.wgsl"
#includeFile "shadowmap/fn_pcss.wgsl"
#includeFile "material/phong/phongfunction.wgsl"


struct st_bulin_phong {
  shininess: f32,
  metalness: f32,
  roughness: f32,
  parallaxScale: f32,
  color: vec4f,
  has_color_texture: i32,   //0=vs color，1=color 数据，2= texture
  has_normal_texture: i32,
  has_parallax_texture: i32,
  has_specular_texture: i32,
  parallax_layer: u32,
}
// @group(2) @binding(0) var<uniform> u_bulinphong : st_bulin_phong;
// @group(2) @binding(1) var u_Sampler : sampler; 
// @group(2)  @binding(2) var u_texture_color : texture_2d<f32>;
// @group(2)  @binding(3) var u_texture_normal : texture_2d<f32>;
// @group(2)  @binding(4) var u_texture_parallax : texture_2d<f32>;
// @group(2)  @binding(5) var u_texture_specular : texture_2d<f32>;


@fragment fn fs(fsInput : st_vertex_output) -> ST_GBuffer {
#includeFile "gbuffers/commonGBufferValue.wgsl"  //初始化GBuffer的通用值
    init_system_fs();  

    //0、uniform cotrol follow 
    let parallaxScale = u_bulinphong.parallaxScale;
    let parallaxLayer = u_bulinphong.parallax_layer;//目前未使用，默认32层

     //1、处理specular
    var  inSpecularColor : vec3f =  textureSample(u_specularTexture, u_Sampler,  uv).rgb ;    //读取specular texture的颜色
    if(u_bulinphong.has_specular_texture == 0) {
      inSpecularColor = vec3f(1.0);
    }

    //2、处理color texture 和parallax
    let TBN=getTBN_ForNormal(normal,fsInput.worldPosition,uv);
    let invertTBN=transpose(TBN );
    let viewDir= normalize(invertTBN*fsInput.worldPosition - invertTBN*defaultCameraPosition);//这里的TBN是通过偏导数求得,故TBN空间内摄像机位置较为方向 ，fs的world position是TBN是原点
    

    //$parallax ,20260527,目前关闭
    //处理parallax 纹理，无论是否使用，都需要进行处理一遍。
    //还是使用选择性replace，因为parallax的计算比较占资源，没有必要在没有parallax texture的情况下也进行计算。

    // let uv_parallax = parallax_occlusion(fsInput.uv.xy, viewDir, parallaxScale ,u_parallaxTexture, u_Sampler);//parallax 纹理
    // //判断使用uv的来源
    // if(u_bulinphong.has_color_texture == 2 && u_bulinphong.has_parallax_texture == 1 && u_bulinphong.has_normal_texture == 1)  {
    //     uv = uv_parallax;
    // }

    //读取color texture
    materialColor = textureSample(u_colorTexture, u_Sampler, uv);
    // 判断是否为uniform颜色
    if(u_bulinphong.has_color_texture == 1)  {
       materialColor =u_bulinphong.color;
    }     
    //省略的else，使用vs color，在前置include中已经处理了。

    //3、处理normal 。如果存在parallax，normal也需要偏移后的uv。
    let  normalMap =textureSample(u_normalTexture, u_Sampler,  uv).rgb;       //读取normal texture的颜色
    if(u_bulinphong.has_normal_texture == 1) {
       normal= getNormalFromMap( normal ,normalMap,fsInput.worldPosition, uv); 
    }


    let shininess = u_bulinphong.shininess;
    metallic = u_bulinphong.metalness;
    roughness = u_bulinphong.roughness;

#weStart
    #renderMode  Msaa
     #includeFile "material/MSAA/msaa.wgsl"
#weEnd

#replace user_shader_code

    //光源与阴影代码
    acceptShadow = 1;
    shadowKind = 0;
    acceptlight = 1;
    materialKind = 2;
    //延迟渲染的GBuffer输出,8位. 每个位分别表示;接受阴影、阴影、其他、材质类型
    defer_4xU8InF16=encodeLightAndShadowFromU8x4ToU8bit(acceptShadow,shadowKind,acceptlight,materialKind);   //光源与阴影代码
    albedo=inSpecularColor;
    ao=shininess;
    RMAO=vec3f(roughness,metallic,ao);   

#weStart 
  #renderMode  MsaaInfo  
    //无color输出
  #renderMode  defer     
    //color使用上面代码中的materialColor即可，无需处理
  #renderMode forward  Msaa     
    //phong的主要颜色shader，必须
    materialColor=calcLightAndShadowOfPhong(
        worldPosition,
        normal,
        inSpecularColor,
        metallic,
        roughness,
        shininess,
        materialColor,
        vec3f(0.0, 0.0, 0.0),
        vec3f(1.0)
    );
#weEnd

    var output: ST_GBuffer;
#tag gbuffers_output 

    // 手工参数测试
    // let lightIntensity = 1.0;
    // let lightDir = vec3f(0.0, 1.0, 0.0);
    // let lightColor = vec3f(1.0, 1., 0.0);
    // let onelight = u_lights.lights[0 ]; 
    // let colorOfPhongDS = phongColorDS(fsInput.worldPosition, fsInput.normal, lightDir, lightColor, lightIntensity, defaultCameraPosition,uv);
    // let colorOfAmbient = PhongAmbientColor();
    // output.color =  vec4f((colorOfAmbient + colorOfPhongDS[0]) * materialColor.rgb + colorOfPhongDS[1], materialColor.a);
    // output.color = vec4f( visibility,visibility,visibility   , 1.0);

    //测试shadow map
    // let depth=textureLoad(u_shadowmap_depth_texture, vec2i(i32(fsInput.position.x*2),i32(fsInput.position.y*2)),0,0) ;
    // output.color = vec4f( depth,depth,depth,1);
    
    //测试可见性，
    //  var visibility = getVisibilityOflight(u_lights.lights[1],worldPosition.rgb,normal.rgb); 
    //  output.color  =vec4f(visibility,visibility,visibility,1);
    
    return output;
}

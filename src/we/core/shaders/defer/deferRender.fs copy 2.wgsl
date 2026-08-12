//deferRender.fs.wgsl   ,start

#includeFile "entity/quad/quad.vs.wgsl"
#includeFile "graphic/bindgroup3/bindgroup.wgsl"
// #includeFile "graphic/ibl/struct_ibl.wgsl"
#includeFile "graphic/ibl/ibl_fn.wgsl"

struct st_camera_invertvp_position {
    position:vec3f,
    invertvp:mat4x4f,
    resolution:vec2u,
}


@group(1) @binding(0) var u_colorTexture: texture_2d<f32>;
// @group(1) @binding(1) var u_idTexture: texture_2d<f32>;
@group(1) @binding(1) var u_normalTexture: texture_2d<f32>;
@group(1) @binding(2) var u_depth_texture: texture_depth_2d;
@group(1) @binding(3) var u_pbr_texture: texture_2d<u32>;
@group(1) @binding(4) var<uniform> u_camera_VP_position: st_camera_invertvp_position;
@group(1) @binding(5) var u_worldPositionTexture: texture_2d<f32>;
@group(1) @binding(6) var u_albedoTexture: texture_2d<f32>;
@group(1) @binding(7) var u_RMAOTexture: texture_2d<f32>;



#includeFile "system/structOfCamera.wgsl" 
#includeFile "system/system.wgsl"
#includeFile "function/encodeAndDecode.wgsl"
#includeFile "shadowmap/fn_pcss.wgsl"
#includeFile "material/PBR/PBRfunction.wgsl"
#includeFile "material/phong/phongfunction.wgsl"
#includeFile "math/baseconst.wgsl"
// #includeFile "math/TBN.wgsl"
#includeFile "math/random.wgsl"

fn uv_and_depth_to_world_pos(uv: vec2<f32>, depth: f32, inv_vp: mat4x4<f32>) -> vec3<f32> {
    let worldposition = inv_vp * vec4<f32>(vec3<f32>(uv * vec2<f32>(2.0, -2.0) - vec2<f32>(1.0, -1.0), depth), 1.0);
    return worldposition.xyz / worldposition.w ;
}


@fragment fn fs( @builtin(position) pos : vec4f) ->  @location(0) vec4f {
    init_system_fs();   
    let uv =vec2i(floor(pos.xy));
    let depth = textureLoad(u_depth_texture,uv,0);
    var  color =textureLoad(u_colorTexture,uv,0);
    let  normal =textureLoad(u_normalTexture,uv,0);
    // let  worldPosition =uv_and_depth_to_world_pos(vec2f(uv)/vec2f(u_camera_VP_position.resolution),depth,u_camera_VP_position.invertvp);
    let  worldPosition =textureLoad(u_worldPositionTexture,uv,0);

    let pbr_data=textureLoad(u_pbr_texture,uv,0);   
    let pbr_r:vec4u = decode_u32_to_u8x4(pbr_data.r);
    let pbr_g:vec4u = decode_u32_to_u8x4(pbr_data.g);
    let pbr_b:vec4u = decode_u32_to_u8x4(pbr_data.b);
    let pbr_a:vec4u = decode_u32_to_u8x4(pbr_data.a);

    // let  RMAO =textureLoad(u_RMAOTexture,uv,0);
    // let  albedo =textureLoad(u_albedoTexture,uv,0);

    let  roughness:f32 =decode_u8_to_f32(pbr_r.r);
    let  metallic:f32 = decode_u8_to_f32(pbr_g.g);
    let  ao:f32 = decode_u8_to_f32(pbr_b.b);
    let  materialKind:u32=pbr_r.a;

    let albedo:vec3f= vec3f(decode_u8_to_f32(pbr_g.r), decode_u8_to_f32(pbr_g.g), decode_u8_to_f32(pbr_g.b) );
    // let  albedo =textureLoad(u_albedoTexture,uv,0);

    let acceptlight:u32=pbr_g.a;

    let emissiveRGB:vec3f= vec3f(decode_u8_to_f32(pbr_b.r), decode_u8_to_f32(pbr_b.g), decode_u8_to_f32(pbr_b.b) );
    let acceptShadow:u32=pbr_b.a;


    let emissiveIntensity:vec3f= vec3f(decode_u8_to_f32(pbr_a.r), decode_u8_to_f32(pbr_a.g), decode_u8_to_f32(pbr_a.b) );
    let shadowKind:u32=pbr_a.a;

    var materialColor = vec4f(.0);
    // materialColor = calcLightAndShadowOfPBR(
    //         worldPosition.rgb,
    //         normal.rgb,
    //         albedo.rgb,
    //         metallic,
    //         roughness,
    //         ao,
    //         color,//vec3f(1),albedo的颜色已经在color中，不需要再乘以albedo
    //         emissiveRGB,
    //         emissiveIntensity.rgb);
    // materialColor = calcLightAndShadowOfPhong(
    //         worldPosition.rgb,
    //         normal.rgb,
    //         albedo.rgb,
    //         metallic,
    //         roughness,
    //         ao,
    //         color,//vec3f(1),albedo的颜色已经在color中，不需要再乘以albedo
    //         emissiveRGB,
    //         emissiveIntensity,
    //         );

    materialColor = calcLightAndShadow(
        defaultCameraPosition,
        // u_camera_VP_position.position,  
            worldPosition.rgb,
            normal.rgb,
            albedo.rgb,
            metallic,
            roughness,
            ao,
            color,//vec3f(1),albedo的颜色已经在color中，不需要再乘以albedo
            emissiveRGB,
            emissiveIntensity.rgb,
            materialKind
            );

    if(materialKind==0){  
          materialColor =color;
          }
    else if(materialKind==1){
        //   materialColor =worldPosition;
    }
    // else if(materialKind==2){
    //     // materialColor = calcLightAndShadowOfPhong(
    // }

    //测试阴影贴图
    // let depthTest=textureLoad(u_shadowmap_depth_texture, vec2i(i32(pos.x),i32(pos.y)),1,0) ;//第一个方向光的阴影
    // let depthTest=textureLoad(u_shadowmap_depth_texture, vec2i(i32(pos.x),i32(pos.y)),2,0) ;//第二个方向光的阴影
    // materialColor = vec4f( depthTest,depthTest,depthTest,1);

    // //测试可见性
    //  var visibility = getVisibilityOflight(u_lights.lights[1],worldPosition.rgb,normal.rgb); 
    //  materialColor =vec4f(visibility,visibility,visibility,1);

    // let abc=f32(u_lights.lights[1].shadow_map_array_index);
    // materialColor =vec4f(abc,abc,abc,1);
    return materialColor;
}

fn calcLightAndShadow(
    default_camera_position: vec3f,
    worldPosition : vec3f,
    normal : vec3f,
    albedo : vec3f,
    metallic : f32,
    roughness : f32,
    ao : f32,
    color : vec4f,
    emissiveColor : vec3f,
    emissiveIntensity : vec3f,
    materialKind : u32
    ) -> vec4f
{
    //phong 光照模型
    var colorOfPhoneOfLights : array<vec3f, 2>;             //漫反射，高光反射
    colorOfPhoneOfLights[0]= vec3f(0.0);                    //漫反射：所有光源在pixel上的总和
    colorOfPhoneOfLights[1]= vec3f(0.0);                    //高光反射：所有光源在pixel上的总和

    //PBR 光照模型
    let F0 = vec3(0.04);
    let wo = normalize(default_camera_position - worldPosition);
    var Lo = vec3(0.0);
    //计算光照模型
    if(u_lights.lightNumber >0)
    {
        for (var i : u32 = 0; i < u_lights.lightNumber; i = i + 1)
        {
            // if(i==0) {
            //     continue;
            // }

            //计算当前光源的可见性
            let onelight = u_lights.lights[i ];  
            var visibility = getVisibilityOflight(onelight,worldPosition,normal); 
            //分别计算PBR和Phong光照模型
            if(materialKind==1){
                // let onelight = u_lights.lights[i ];  
                let lightColor = u_lights.lights[i].color;
                let lightPosition = u_lights.lights[i].position;
                let lightIntensity = u_lights.lights[i].intensity;
                var distance = 0.0;                         //方向光没有距离
                var attenuation = lightIntensity;           //方向光没有衰减
                var wi = u_lights.lights[i].direction;      //方向光
                if(u_lights.lights[i].kind!=0)
                {
                    wi = normalize(lightPosition - worldPosition);
                    distance = length(lightPosition - worldPosition);
                    attenuation = lightIntensity / (distance * distance);       //光衰减,这里光是平方,todo:需要考虑gamma校正
                }
                //计算光照强度
                let cosTheta = max(dot(normal, wi), 0.0);
                let radiance = lightColor * attenuation * cosTheta;         //光强
                //计算 DFG
                let halfVector = normalize(wi + wo);
                let f0 = mix(F0, albedo, metallic);
                let F = fresnelSchlick(max(dot(halfVector, wo), 0.0), f0);
                let NDF = DistributionGGX(normal, halfVector, roughness);
                let G = GeometrySmith(normal, wo, wi, roughness);
                //计算Cook-Torrance BRDF:
                let numerator = NDF * G * F;
                let denominator = 4.0 * max(dot(normal, wo), 0.0) * max(dot(normal, wi), 0.0) + 0.0001;
                let specular = numerator / denominator;
                //kS is equal to Fresnel
                let kS = F;
                var kD = vec3(1.0) - kS;
                kD *= 1.0 - metallic;
                //scale light by NdotL   L=wi
                let NdotL = max(dot(normal, wi), 0.0);
                //add to outgoing radiance Lo
                let diffuse = (kD * albedo / PI) * radiance * NdotL;//only diffuse light is currently implemented
                // var visibility = getVisibilityOflight(onelight,worldPosition,normal); 
                Lo += (diffuse + specular) * radiance* visibility;
            }
            else if(materialKind==2){
                let inSpecularColor = albedo;
                let shininess = ao;
                var onelightPhongColor : array<vec3f, 2>;       //当前光源的漫反射，高光反射
                var computeShadow = false;                      //是否计算阴影
                var shadow_map_index = onelight.shadow_map_array_index;         //当前光源的阴影贴图索引
                var inPointShadow = false;                      //是否为点光源的阴影
                if (onelight.kind ==0)
                {
                    onelightPhongColor = phongColorOfDirectionalLight(worldPosition, normal, onelight, default_camera_position,inSpecularColor,roughness,shininess,metallic);
                }
                else if (onelight.kind ==1)
                {
                    onelightPhongColor = phongColorOfPointLight(worldPosition, normal, onelight, default_camera_position,inSpecularColor,roughness,shininess,metallic);
                }
                else if (onelight.kind ==2)
                {
                    onelightPhongColor = phongColorOfSpotLight(worldPosition, normal, onelight, default_camera_position,inSpecularColor,roughness,shininess,metallic);
                }    
                colorOfPhoneOfLights[0] = colorOfPhoneOfLights[0] +visibility * onelightPhongColor[0];
                colorOfPhoneOfLights[1] = colorOfPhoneOfLights[1] +visibility * onelightPhongColor[1];
                }
        }
    }
    var finialColor:vec4f=vec4f(0);
    if(materialKind==1){
        let ambient = get_ambient_color(albedo, ao);
        let emissive = emissiveColor * emissiveIntensity;
        finialColor =vec4f(  color.rgb*(ambient + Lo) + emissive,color.a);
    }
    else if(materialKind==2){
        let colorOfAmbient = PhongAmbientColor();
        colorOfPhoneOfLights[0] = colorOfPhoneOfLights[0] /f32(u_lights.lightNumber);
        colorOfPhoneOfLights[1] = colorOfPhoneOfLights[1] /f32(u_lights.lightNumber);
        finialColor = vec4f((colorOfAmbient + colorOfPhoneOfLights[0]) * color.rgb + colorOfPhoneOfLights[1], color.a);
        finialColor = vec4f(finialColor.rgb, 1.0);
        // finialColor = vec4f(1,0,0,1);
    }
    return finialColor;
}
//deferRender.fs.wgsl   ,end

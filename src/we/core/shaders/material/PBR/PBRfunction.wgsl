//PBRfunction.wgsl   ,start
fn fresnelSchlick(cosTheta : f32, F0 : vec3f) -> vec3f
{
    return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}
//ibl 使用的fresnelSchlickRoughness函数，考虑了粗糙度的影响
fn fresnelSchlickRoughness( cosTheta:f32, F0:vec3f, roughness:f32) -> vec3f
{
    return F0 + (max(vec3(1.0 - roughness), F0) - F0) * pow(1.0 - cosTheta, 5.0);
} 
fn DistributionGGX(normal : vec3f, halfVector : vec3f, roughness : f32) -> f32
{
    let a = roughness * roughness;
    let a2 = a * a;
    let NdotH = max(dot(normal, halfVector), 0.0);
    let NdotH2 = NdotH * NdotH;
    let nom = a2;
    var denom = (NdotH2 * (a2 - 1.0) + 1.0);
    denom = PI * denom * denom;
    return nom / denom;
}
fn GeometrySchlickGGX(NdotV : f32, roughness : f32) -> f32
{
    let r = (roughness + 1.0);
    let k = (r * r) / 8.0;

    let nom = NdotV;
    let denom = NdotV * (1.0 - k) + k;
    return nom / denom;
}

fn GeometrySmith(normal : vec3f, wo : vec3f, wi : vec3f, roughness : f32) -> f32
{
    let NdotV = max(dot(normal, wo), 0.0);
    let NdotL = max(dot(normal, wi), 0.0);
    let ggx2 = GeometrySchlickGGX(NdotV, roughness);
    let ggx1 = GeometrySchlickGGX(NdotL, roughness);

    return ggx1 * ggx2;
}
fn get_ambient_color(albedo : vec3f, ao : f32) -> vec3f
{
    return ambient_light.color * ambient_light.intensity * albedo * ao;
}
fn calcLightAndShadowOfPBR(
    worldPosition : vec3f,
    normal : vec3f,
    albedo : vec3f,
    metallic : f32,
    roughness : f32,
    ao : f32,
    color : vec4f,
    emissiveColor : vec3f,
    emissiveIntensity : vec3f) -> vec4f
{
    let F0 = vec3(0.04);

    let wo = normalize(defaultCameraPosition - worldPosition);
    var Lo = vec3(0.0);
    if(u_lights.lightNumber >0)
    {
        for (var i : u32 = 0; i < u_lights.lightNumber; i = i + 1)
        {
            let onelight = u_lights.lights[i ];  

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
            //let ambient = get_ambient_color(albedo, ao);
            var visibility = getVisibilityOflight(onelight,worldPosition,normal); 
            Lo += (diffuse + specular) * radiance* visibility;
            // Lo += (diffuse + specular) * radiance;
            //Lo=vec3f(metallic);          
        }
    }
    let sh=f32_to_vec3f(&u_ibl_base_info.sh,u_ibl_base_info.use_ibl_index);
    var ambient_ibl = vec3(0.0);
    var specular_ibl = vec3(0.0);
    if(u_ibl_base_info.enable_ibl==1){
        if(u_ibl_base_info.filament_sh==1){
            ambient_ibl = get_diffuse_from_ibl_filament(normal, albedo, ao, sh);
        }
        else {
            ambient_ibl = get_diffuse_from_ibl(normal, albedo, ao, sh);
        }
        let  nDOTv = max(dot(normal, wo), 0.0);
        let  F = fresnelSchlickRoughness(nDOTv, F0, roughness);
        let kS = F;
        var kD = vec3(1.0) - kS;
        kD *= 1.0 - metallic;
        let R = reflect(-wo, normal); 
        // let  prefilteredColor = textureSampleLevel(u_ibl_prefiltered, u_sampler_ibl_prefiltered,R,  roughness * 5.0 ).rgb;   
        let  prefilteredColor = textureSampleLevel(u_ibl_prefiltered, u_sampler_ibl_prefiltered,R,  roughness *f32( u_ibl_base_info.mip_level)).rgb;   
        let  envBRDF  = textureSample(u_ibl_dfg_lut,u_sampler_ibl_dfg_lut, vec2f(max(nDOTv, 0.0), roughness)).rg;
        specular_ibl = prefilteredColor * (F * envBRDF.x + envBRDF.y);
        ambient_ibl*=kD;
    }
    let ambient = get_ambient_color(albedo, ao)+ambient_ibl;
    // let ambient = get_ambient_color(albedo, ao);

    let emissive = emissiveColor * emissiveIntensity;
    // if(u_ibl_base_info.mip_level ==0){ return vec4f(1,0,0,1);}
    return vec4f(  color.rgb*(ambient + Lo + specular_ibl) + emissive,1);
    // return vec4f(  color.rgb*ambient_light.color * ambient_light.intensity,1);
}

//PBRfunction.wgsl   ,end

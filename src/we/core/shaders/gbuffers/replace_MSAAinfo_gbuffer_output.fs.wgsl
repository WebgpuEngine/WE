
//start : replace_infor_gbuffer.output.fs.wgsl 
    output.depth = depth;//fsInput.position.z;
    output.id = entityID;//fsInput.entityID;
    output.normal = vec4f(normal,1);
    output.RMAO = vec4f(RMAO,emissiveRGB.b);
    output.worldPosition = vec4f(worldPosition,bitcast<f32>(defer_4xU8InF16));
    output.albedo = vec4f(albedo,emissiveRGB.r);
    output.emissiveIntensity = vec4f(emissiveIntensity,emissiveRGB.g);
//end :replace_infor_gbuffer.output.fs.wgsl 


//start : replace_infor_gbuffer.output.fs.wgsl 
    output.depth = depth;//fsInput.position.z;
    output.id = entityID;//fsInput.entityID;
    output.normal = vec4f(normal, encodeU8inF32x2ToF16(emissiveRGB.r,emissiveRGB.g));
    output.RMAO = vec4f(RMAO,encodeFromF32AndU8ToF16(emissiveRGB.b,defer_4xU8InF16));
    output.worldPosition = vec4f(worldPosition,1);
    output.albedo = vec4f(albedo,emissiveIntensity);
//end :replace_infor_gbuffer.output.fs.wgsl 

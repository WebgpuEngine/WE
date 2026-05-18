//start : part_replace.st_gbuffer.output.fs.wgsl //这个文件是进行GBuffer输出,使用var定义output，//输出全部的output的值，具体FS shader的输出在这个之后进行
//***GBuffer数量与内容需要人工保持正确性
    output.depth = depth;//fsInput.position.z;
    output.color = materialColor;
    output.id = entityID;//fsInput.entityID;
    // output.normal = vec4f(normal, 1);
    output.normal = vec4f(normal,emissiveRGB.g);
    output.RMAO = vec4f(RMAO,emissiveRGB.b);
    output.worldPosition = vec4f(worldPosition,bitcast<f32>(defer_4xU8InF16));
    output.albedo = vec4f(albedo,emissiveRGB.r);
    output.emissiveIntensity = vec4f(emissiveIntensity,1);
    // output.X = fsInput.worldPosition.x;
    // output.Y = fsInput.worldPosition.y;
    // output.Z = fsInput.worldPosition.z;
//end :part_replace.st_gbuffer.output.fs.wgsl

////////////////////////////////////////////////////////////////////////////////
//material
import textureFSWGSL from "../../shader/material/texture/texture.fs.wgsl?raw";
var textureFS = textureFSWGSL.toString();





import { E_shaderTemplateReplaceType, I_ShaderTemplate, WGSL_replace_gbuffer_output, WGSL_st_Guffer } from "../base"

export var SHT_materialTextureFS_mergeToVS: I_ShaderTemplate = {
    material: {
        owner: "ColorMaterial",
        add: [
            {
                name: "fsOnput",
                code: WGSL_st_Guffer,
            },
            {
                name: "fs",
                code: textureFS,
            },

        ],
        replace: [
            {
                name: "colorFS.output content",
                replace: "$fsOutput",           //
                replaceType: E_shaderTemplateReplaceType.replaceCode,
                replaceCode: WGSL_replace_gbuffer_output
            },
            // {
            //     name: "materialColor",
            //     replace: "$materialColor",           //
            //     replaceType: E_shaderTemplateReplaceType.value,                //output.color = vec4f(red, green, blue, alpha);
            // }
        ],
        // groupAndBinding:[
        //     {
        //         name:"texture",
        //         code:" @group(1) @binding(${binding}) var u_colorTexture: texture_2d<f32>;\n ",
        //         replace:"$binding",
        //         replaceType: E_shaderTemplateReplaceType.value,
        //     },
        //     {
        //         name:"texture",
        //         code:"  @group(1) @binding(${binding}) var u_Sampler : sampler; \n  ",
        //         replace:"$binding",
        //         replaceType: E_shaderTemplateReplaceType.value,
        //     },
        // ]
    }
}


export var SHT_materialTextureTransparentFS_mergeToVS: I_ShaderTemplate = {
    material: {
        owner: "ColorMaterial",
        add: [{
            name: "fsOnput",
            code: WGSL_st_Guffer,
        },
        {
            name: "fs",
            code: textureFS,
        },

        ],
        replace: [
            {
                name: "colorFS.output content",
                replace: "$fsOutput",           //
                replaceType: E_shaderTemplateReplaceType.replaceCode,
                replaceCode: WGSL_replace_gbuffer_output
            },
            {
                name: "materialColor",
                replace: "$materialColor",           //
                replaceType: E_shaderTemplateReplaceType.value,                //output.color = vec4f(red, green, blue, alpha);
            }
        ],
    }
}

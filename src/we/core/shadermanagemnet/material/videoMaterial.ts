////////////////////////////////////////////////////////////////////////////////
//material
import videoTextureFSWGSL from "../../shader/material/texture/video.fs.wgsl?raw";
var videoTextureFS = videoTextureFSWGSL.toString();


import { E_shaderTemplateReplaceType, I_ShaderTemplate, WGSL_replace_gbuffer_output, WGSL_st_Guffer } from "../base"

export var SHT_materialVideoTextureFS_mergeToVS: I_ShaderTemplate = {
    material: {
        owner: "ColorMaterial",
        add: [
            {
                name: "fsOnput",
                code: WGSL_st_Guffer,
            },
            {
                name: "fs",
                code: videoTextureFS,
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
                replaceType: E_shaderTemplateReplaceType.value,
            },
        ],

    }
}



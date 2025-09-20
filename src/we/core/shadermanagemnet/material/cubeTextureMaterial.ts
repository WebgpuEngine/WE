////////////////////////////////////////////////////////////////////////////////
//material
import cubeTextureFSWGSL from "../../shader/material/texture/cubeTexture.fs.wgsl?raw";
var cubeTextureFS = cubeTextureFSWGSL.toString();

import { E_shaderTemplateReplaceType, I_ShaderTemplate, WGSL_replace_gbuffer_output, WGSL_st_Guffer } from "../base"

export var SHT_materialCubeSkyTextureFS_mergeToVS: I_ShaderTemplate = {
    material: {
        owner: "ColorMaterial",
        add: [
            {
                name: "fsOnput",
                code: WGSL_st_Guffer,
            },
            {
                name: "fs",
                code: cubeTextureFS,
            },

        ],
        replace: [
            {
                name: "colorFS.output content",
                replace: "$fsOutput",           //
                replaceType: E_shaderTemplateReplaceType.replaceCode,
                replaceCode: WGSL_replace_gbuffer_output
            },
        ],

    }
}

import cubePositionTextureFSWGSL from "../../shader/material/texture/cubePositionTexture.fs.wgsl?raw";
var cubePositionTextureFS = cubePositionTextureFSWGSL.toString();
export var SHT_materialCubePositionTextureFS_mergeToVS: I_ShaderTemplate = {
    material: {
        owner: "ColorMaterial",
        add: [
            {
                name: "fsOnput",
                code: WGSL_st_Guffer,
            },
            {
                name: "fs",
                code: cubePositionTextureFS,
            },

        ],
        replace: [
            {
                name: "colorFS.output content",
                replace: "$fsOutput",           //
                replaceType: E_shaderTemplateReplaceType.replaceCode,
                replaceCode: WGSL_replace_gbuffer_output
            },
        ],

    }
}


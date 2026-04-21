import { E_shaderTemplateReplaceType, I_ShaderTemplate, I_shaderTemplateReplace, SHT_replaceGBufferCommonValue, SHT_replaceGBufferFSOutput, SHT_replaceGBufferMSAA_FSOutput, SHT_replaceGBufferMSAAinfo_FSOutput, SHT_ScenOfCamera_FS, SHT_vsStructOutput, WGSL_st_Guffer, WGSL_st_MSAA_Guffer, WGSL_st_MSAAinfo_Guffer, WGSL_st_transparentbuffer } from "../base"
import { SHT_replaceTT_FSOutput, SHT_TT, TTPF_FS } from "./TT";

////////////////////////////////////////////////////////////////////////////////
//material
import textureUniformFSWGSL from "../../shader/material/texture/textureUniform.fs.wgsl?raw";
var textureUniformFS = textureUniformFSWGSL.toString();

import textureFSWGSL from "../../shader/material/texture/texture.fs.wgsl?raw";
var textureFS = textureFSWGSL.toString();
/** 纹理材质, 不透明, shader 模板*/
export var SHT_materialTextureFS: I_ShaderTemplate = {
    scene: SHT_ScenOfCamera_FS,
    material: {
        owner: "TextureMaterial forward",
        add: [
            SHT_vsStructOutput,
            {
                name: "uniform",
                code: textureUniformFS,
            },
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
            SHT_replaceGBufferFSOutput,                                            // WGSL_replace_gbuffer_output部分
            SHT_replaceGBufferCommonValue,                                            // WGSL_replace_gbuffer_commonValues部分
        ],

    }
}
import textureMSAAFSWGSL from "../../shader/material/texture/textureMSAA.fs.wgsl?raw";
var textureMSAAFS = textureMSAAFSWGSL.toString();
/** 纹理材质, 不透明MSAA, shader 模板*/
export var SHT_materialTextureFS_MSAA: I_ShaderTemplate = {
    scene: SHT_ScenOfCamera_FS,
    material: {
        owner: "TextureMaterial MSAA",
        add: [
            SHT_vsStructOutput,
            {
                name: "uniform",
                code: textureUniformFS,
            },
            {
                name: "fsOnput",
                code: WGSL_st_MSAA_Guffer,
            },
            {
                name: "fs",
                code: textureMSAAFS,
            },
        ],
        replace: [
            SHT_replaceGBufferMSAA_FSOutput,                                            // WGSL_replace_MSAA_gbuffer_output部分
            SHT_replaceGBufferCommonValue,                                            // WGSL_replace_gbuffer_commonValues部分
        ],

    }
}

/** 纹理材质, 不透明MSAA info, shader 模板*/
import textureMSAAInfoFSWGSL from "../../shader/material/texture/textureMSAAInfo.fs.wgsl?raw";
var textureMSAAInfoFS = textureMSAAInfoFSWGSL.toString();
export var SHT_materialTextureFS_MSAAinfo: I_ShaderTemplate = {
    scene: SHT_ScenOfCamera_FS,
    material: {
        owner: "TextureMaterial MSAA info",
        add: [
            SHT_vsStructOutput,
            {
                name: "uniform",
                code: textureUniformFS,
            },
            {
                name: "fsOnput",
                code: WGSL_st_MSAAinfo_Guffer,
            },
            {
                name: "fs",
                code: textureMSAAInfoFS,
            },
        ],
        replace: [
            SHT_replaceGBufferMSAAinfo_FSOutput,                                            // WGSL_replace_MSAAinfo_gbuffer_output部分
            SHT_replaceGBufferCommonValue,                                            // WGSL_replace_gbuffer_commonValues部分
        ],
    }
}


var replaceAlpha_TT_TTP_TTPF: I_shaderTemplateReplace = {
    name: "alpha",
    replace: "$materialColorRule",                      //alpha 的判断规则，alpha==0，alpha <= alphaTest ,opacity <1.0
    replaceType: E_shaderTemplateReplaceType.value,

}
var replaceOpacityPercent_TT_TTP_TTPF: I_shaderTemplateReplace = {
    name: "opacityPercent",                             // alpha判断需要在此之前
    replace: "$opacityPercent",                         // 根据是否使用opacity透明度判断，是否输出；opacity : 0.0-1.0; 
    replaceType: E_shaderTemplateReplaceType.value,
}

import textureTT_FSWGSL from "../../shader/material/texture/textureTT.fs.wgsl?raw";
var textureTT_FS = textureTT_FSWGSL.toString();
export var SHT_materialTexture_TT_FS: I_ShaderTemplate = {
    scene: SHT_ScenOfCamera_FS,
    material: {
        owner: "TextureMaterial TT",
        add: [
            SHT_vsStructOutput,
            {
                name: "uniform",
                code: textureUniformFS,
            },
            {
                name: "fsOnput",
                code: WGSL_st_Guffer,
            },
            {
                name: "fs",
                code: textureTT_FS,
            },
        ],
        replace: [
            SHT_replaceGBufferFSOutput,                                            // WGSL_replace_gbuffer_output部分
            SHT_replaceGBufferCommonValue,                                            // WGSL_replace_gbuffer_commonValues部分
            // // //TT,TTP,TTPF相同的replace
            // replaceAlpha_TT_TTP_TTPF,
            // replaceOpacityPercent_TT_TTP_TTPF,
        ],
    }
}

import textureTTP_FSWGSL from "../../shader/material/texture/textureTTP.fs.wgsl?raw";
var textureTTP_FS = textureTTP_FSWGSL.toString();
export var SHT_materialTexture_TTP_FS: I_ShaderTemplate = {
    scene: SHT_ScenOfCamera_FS,
    material: {
        owner: "TextureMaterial TTP",
        add: [
            SHT_vsStructOutput,
            {
                name: "uniform",
                code: textureUniformFS,
            },
            SHT_TT,
            {
                name: "fsOnput",
                code: WGSL_st_transparentbuffer,
            }
        ],
        replace: [
            {
                name: "Color",
                replace: "$Color",                                     //材质的主体代码
                replaceType: E_shaderTemplateReplaceType.replaceCode,  //` output.color = vec4f(${this.red}, ${this.green}, ${this.blue}, ${this.alpha});
                replaceCode: textureTTP_FS,
            },
            SHT_replaceGBufferCommonValue,                                            // WGSL_replace_gbuffer_commonValues部分
            SHT_replaceTT_FSOutput,             // replace: "$fsOutput",   ！！！！！！！
            // //TT,TTP,TTPF相同的replace
            // replaceAlpha_TT_TTP_TTPF,
            // replaceOpacityPercent_TT_TTP_TTPF,
        ],
    }
}
import textureTTPF_FSWGSL from "../../shader/material/texture/textureTTPF.fs.wgsl?raw";
var textureTTPF_FS = textureTTPF_FSWGSL.toString();
export var SHT_materialTexture_TTPF_FS: I_ShaderTemplate = {
    scene: SHT_ScenOfCamera_FS,
    material: {
        owner: "TextureMaterial TTPF",
        add: [
            SHT_vsStructOutput,
            {
                name: "uniform",
                code: textureUniformFS,
            },
            {
                name: "fsOnput",
                code: WGSL_st_Guffer,
            },
            {
                name: "fs",
                code: TTPF_FS,
            },
        ],
        replace: [
            {
                name: "fsOutputColor",
                replace: "$fsOutputColor",           // replace target :  color
                /**
                * color = vec4f(red, green, blue, alpha);
                * 根据材质输出color，blend使用
                * 图像纹理需要uniform texture，采样器
                */
                replaceType: E_shaderTemplateReplaceType.replaceCode,
                replaceCode: textureTTPF_FS,
            },
            // //TT,TTP,TTPF相同的replace
            // replaceAlpha_TT_TTP_TTPF,
            // replaceOpacityPercent_TT_TTP_TTPF,
        ],
    }
}
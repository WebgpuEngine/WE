
import {
    E_shaderTemplateReplaceType,
    I_ShaderTemplate,
    I_shaderTemplateAdd,
    I_shaderTemplateReplace,
    SHT_addMathBase,
    SHT_addMathRandom,
    SHT_addMathTBN,
    SHT_addPCSS,
    SHT_replaceGBufferCommonValue,
    SHT_replaceGBufferFSOutput,
    SHT_replaceGBufferMSAA_FSOutput,
    SHT_replaceGBufferMSAAinfo_FSOutput,
    SHT_ScenOfCamera_FS,
    SHT_vsStructOutput,
    WGSL_st_Guffer,
    WGSL_st_MSAA_Guffer,
    WGSL_st_MSAAinfo_Guffer
} from "../base"
import { SHT_replaceMsaaInForward, SHT_replaceMsaaInMsaa } from "./base";


import add_PBR_function_WGSL from "../../shader/material/PBR/PBRfunction.wgsl?raw"
var WGSL_add_PBR_function = add_PBR_function_WGSL.toString();
//PBR 的光影函数单项
export var SHT_add_PBR_function: I_shaderTemplateAdd =
{
    name: "PBR_function",
    code: WGSL_add_PBR_function
}
/**替换PBR $mainColorCode 为计算公式*/
var SHT_replace_PBR_mainColorCode: I_shaderTemplateReplace =
{
    name: "mainColorCode",
    replace: "$mainColorCode",
    replaceType: E_shaderTemplateReplaceType.replaceCode,
    replaceCode: `
    materialColor = calcLightAndShadowOfPBR(
        worldPosition,
        normal,
        albedo,
        metallic,
        roughness,
        ao,
        materialColor,
        emissiveRGB,
        emissiveIntensity
        );
    `
}
/**
 * 替换 $mainColorCode 为空字符串
 */
var SHT_replace_PBR_mainColorCode_null: I_shaderTemplateReplace =
{
    name: "mainColorCode",
    replace: "$mainColorCode",
    replaceType: E_shaderTemplateReplaceType.replaceCode,
    replaceCode: "",
}
/**PBR forward的光影参数($encodeLightAndShadow)编码单项*/
var SHT_replace_PBR_LightAndShadow_encode: I_shaderTemplateReplace =
{
    name: "encodeLightAndShadow",
    replace: "$encodeLightAndShadow",
    replaceType: E_shaderTemplateReplaceType.replaceCode,
    replaceCode: `
    acceptShadow = 1;
    shadowKind = 0;
    acceptlight = 1;
    materialKind = 1;
    //延迟渲染的GBuffer输出,8位. 每个位分别表示;接受阴影、阴影、其他、材质类型
    defer_4xU8InF16=encodeLightAndShadowFromU8x4ToU8bit(acceptShadow,shadowKind,acceptlight,materialKind);
    `
}

import PBRMaterialWGSL from "../../shader/material/PBR/PBR.fs.wgsl?raw"
var PBRFS = PBRMaterialWGSL.toString();

/** PBR forward SHT */
export var SHT_materialPBRFS: I_ShaderTemplate = {
    scene: SHT_ScenOfCamera_FS,
    material: {
        owner: "PBRMaterial forward",
        add: [
            SHT_vsStructOutput,
            {
                name: "fsOnput",
                code: WGSL_st_Guffer,
            },
            {
                name: "fs",
                code: PBRFS,
            },
            SHT_add_PBR_function,
            SHT_addMathBase,
            SHT_addMathTBN,
            SHT_addMathRandom,
            SHT_addPCSS,
        ],
        replace: [
            SHT_replaceMsaaInForward,                                              //替换$MSAA为空
            SHT_replace_PBR_mainColorCode,                                         //替换PBR $mainColorCode 为计算公式
            SHT_replaceGBufferFSOutput,                                            // 替换GBuffer输出
            SHT_replaceGBufferCommonValue,                                         //替换初始化GBuffer的通用值($gbufferCommonValues)
            SHT_replace_PBR_LightAndShadow_encode,                                 //替换PBR forward的光影参数编码单项
            //缺少alpha 透明处理，todo
        ],
    }
}
/** PBR MSAA SHT */
export var SHT_materialPBRFS_MSAA: I_ShaderTemplate = {
    scene: SHT_ScenOfCamera_FS,
    material: {
        owner: "PBRMaterial MSAA",
        add: [
            SHT_vsStructOutput,
            {
                name: "fsOnput",
                code: WGSL_st_MSAA_Guffer,
            },
            {
                name: "fs",
                code: PBRFS,
            },
            SHT_add_PBR_function,
            SHT_addMathBase,
            SHT_addMathTBN,
            SHT_addMathRandom,
            SHT_addPCSS,
        ],
        replace: [
            SHT_replaceMsaaInMsaa,                                                //替换$MSAA为MSAA内容
            SHT_replace_PBR_mainColorCode,                                        //替换PBR $mainColorCode 为计算公式
            SHT_replaceGBufferMSAA_FSOutput,                                      // 替换GBuffer输出
            SHT_replaceGBufferCommonValue,                                        // 替换初始化GBuffer的通用值($gbufferCommonValues)
            SHT_replace_PBR_LightAndShadow_encode,                                 //替换PBR forward的光影参数编码单项
        ],
    }
}

// import PBRMaterialMSAAinfoWGSL from "../../shader/material/PBR/PBRMSAAinfo.fs.wgsl?raw"
// var PBRFS_MSAAinfo = PBRMaterialMSAAinfoWGSL.toString();
/** PBR MSAA info SHT */
export var SHT_materialPBRFS_MSAA_info: I_ShaderTemplate = {
    scene: SHT_ScenOfCamera_FS,
    material: {
        owner: "PBRMaterial MSAA info",
        add: [
            SHT_vsStructOutput,
            {
                name: "fsOnput",
                code: WGSL_st_MSAAinfo_Guffer,
            },
            {
                name: "fs",
                code: PBRFS,
            },
            SHT_addMathBase,
            SHT_addMathTBN,
        ],
        replace: [
            SHT_replaceMsaaInForward,                                               //替换$MSAA为空
            SHT_replace_PBR_mainColorCode_null,                                     //替换$mainColorCode为空字符串
            SHT_replaceGBufferMSAAinfo_FSOutput,                                    // 替换GBuffer输出
            SHT_replaceGBufferCommonValue,                                        // 替换初始化GBuffer的通用值($gbufferCommonValues)
            SHT_replace_PBR_LightAndShadow_encode,                                 //替换PBR forward的光影参数编码单项
        ],
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//defer PBR
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//PBR forward的光影Code内容单项
// var SHT_replace_PBR_deferColorCode: I_shaderTemplateReplace =
// {
//     name: "mainColorCode",
//     replace: "$mainColorCode",
//     replaceType: E_shaderTemplateReplaceType.replaceCode,
//     replaceCode: "",//延迟渲染中，颜色只计算颜色，不需要乘以albedo，albedo在光影中计算
//     // replaceCode: `    materialColor=vec4f(albedo ,1);`
// }

/**
 * forward defer PBR part of forward SHT。(材质统一化)
 */
export var SHT_materialPBRFS_defer: I_ShaderTemplate = {
    scene: SHT_ScenOfCamera_FS,
    material: {
        owner: "PBRMaterial defer color",
        add: [
            SHT_vsStructOutput,                 // vs 输出的struct 定义
            {                                   // fs 输出的GBuffer
                name: "fsOnput",
                code: WGSL_st_Guffer,
            },
            {                                   // PBR.fs.wgsl
                name: "fs",
                code: PBRFS,
            },
            SHT_addMathBase,                    // math base 常量
            SHT_addMathTBN,                     // math tbn 相关函数
        ],
        replace: [
            SHT_replaceMsaaInForward,                //替换$MSAA为空
            // SHT_replace_PBR_deferColorCode,       //替换$mainColorCode为空字符串
            SHT_replace_PBR_mainColorCode_null,      //替换$mainColorCode为 只有颜色的代码
            SHT_replaceGBufferFSOutput,              //替换GBuffer输出
            SHT_replaceGBufferCommonValue,           //替换初始化GBuffer的通用值($gbufferCommonValues)
            SHT_replace_PBR_LightAndShadow_encode,   //替换PBR forward的光影参数编码单项
            //缺少alpha 透明处理，todo
        ],
    }
}


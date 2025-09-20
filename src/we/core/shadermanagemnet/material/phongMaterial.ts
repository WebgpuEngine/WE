
import { E_shaderTemplateReplaceType, I_ShaderTemplate, SHT_replaceDefer, SHT_replaceFSOutput, WGSL_replace_gbuffer_output, WGSL_st_Guffer } from "../base"

import phongMaterialWGSL from "../../shader/material/phong/phongcolor.fs.wgsl?raw"
var phongFS = phongMaterialWGSL.toString();

export var SHT_materialPhongFS_mergeToVS: I_ShaderTemplate = {
    material: {
        owner: "PhongMaterial",
        add: [{
            name: "fsOnput",
            code: WGSL_st_Guffer,
        },
        {
            name: "fs",
            code: phongFS,
        },

        ],
        replace: [
            // {
            //     name: "colorFS.output content",
            //     replace: "$fsOutput",           //
            //     replaceType: E_shaderTemplateReplaceType.replaceCode,
            //     replaceCode: WGSL_replace_gbuffer_output
            // },
            SHT_replaceFSOutput,                                            // WGSL_replace_gbuffer_output部分
            {
                name: "materialColor",
                replace: "$materialColor",           //
                replaceType: E_shaderTemplateReplaceType.value,                //   var materialColor = $materialColor              //颜色或纹理颜色
            },
            {
                name: "normal",
                replace: "$normal",           //
                replaceType: E_shaderTemplateReplaceType.value,                 //var normal =$normal                             //来自VS，还是来自texture
            },
            {
                name: "specular",
                replace: "$specular",           //
                replaceType: E_shaderTemplateReplaceType.value,                //数值，metalness
            },
            // SHT_replaceDefer,                                                   //延迟选用判断部分
        ],
    }
}
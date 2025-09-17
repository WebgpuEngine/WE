////////////////////////////////////////////////////////////////////////////////
//material
import wireFrameFSWGSL from "../../shader/material/wirframe/wireFrame.fs.wgsl?raw";
var wireFrameFS = wireFrameFSWGSL.toString();



import { E_shaderTemplateReplaceType, I_ShaderTemplate, WGSL_replace_gbuffer_output, WGSL_st_Guffer } from "../base"

export var SHT_WireFrameFS_mergeToVS: I_ShaderTemplate = {
    material: {
        owner: "ColorMaterial",
        add: [{
            name: "fsOnput",
            code: WGSL_st_Guffer,
        },
        {
            name: "fs",
            code: wireFrameFS,
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
                name: "colorFS set color",
                replace: "$fsOutputColor",           //
                replaceType: E_shaderTemplateReplaceType.value,                //output.color = vec4f(red, green, blue, alpha);
            }
        ],
    }
}

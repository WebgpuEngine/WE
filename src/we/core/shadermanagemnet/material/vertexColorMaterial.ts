import {
    I_ShaderTemplate,
    SHT_replaceGBufferCommonValue,
    SHT_replaceGBufferFSOutput,
    SHT_replaceGBufferMSAA_FSOutput,
    SHT_replaceGBufferMSAAinfo_FSOutput,
    SHT_ScenOfCamera_FS, SHT_vsStructOutput,
    WGSL_st_Guffer, WGSL_st_MSAA_Guffer,
    WGSL_st_MSAAinfo_Guffer,
} from "../base"
import { SHT_replaceMsaaInForward, SHT_replaceMsaaInMsaa } from "./base";

////////////////////////////////////////////////////////////////////////////////
//material

import colorFSWGSL from "../../shader/material/vertexColor/color.fs.wgsl?raw";
var colorFS = colorFSWGSL.toString();
/** 颜色材质, 不透明, 按需合并到VS中 */
export var SHT_materialVertexColorFS: I_ShaderTemplate = {
    scene: SHT_ScenOfCamera_FS,
    material: {
        owner: "VertexColorMaterial_Forward",
        add: [
            SHT_vsStructOutput,
            {
                name: "fsOnput",
                code: WGSL_st_Guffer,
            },
            {
                name: "fs",
                code: colorFS,
            },
        ],
        replace: [
            SHT_replaceMsaaInForward,
            SHT_replaceGBufferFSOutput,                                            // WGSL_replace_gbuffer_output部分
            SHT_replaceGBufferCommonValue,                                            // WGSL_replace_gbuffer_commonValues部分
        ],
    }
}


/** 颜色材质, 不透明, 按需合并到VS中 */
export var SHT_materialVertexColorFS_MSAA: I_ShaderTemplate = {
    scene: SHT_ScenOfCamera_FS,
    material: {
        owner: "VertexColorMaterial_MSAA",
        add: [
            SHT_vsStructOutput,
            {
                name: "fsOnput",
                code: WGSL_st_MSAA_Guffer,
            },
            {
                name: "fs",
                code: colorFS,
            },
        ],
        replace: [
            SHT_replaceMsaaInMsaa,
            SHT_replaceGBufferMSAA_FSOutput,                                            // WGSL_replace_MSAA_gbuffer_output部分
            SHT_replaceGBufferCommonValue,                                            // WGSL_replace_gbuffer_commonValues部分
        ],
    }
}
/** 颜色材质, 不透明, 按需合并到VS中 */
import colorMSAAInfoFSWGSL from "../../shader/material/vertexColor/colorMSAAInfo.fs.wgsl?raw";
var colorMSAAInfoFS = colorMSAAInfoFSWGSL.toString();
export var SHT_materialVertexColorFS_MSAA_info: I_ShaderTemplate = {
    scene: SHT_ScenOfCamera_FS,
    material: {
        owner: "VertexColorMaterial_MSAA_info",
        add: [
            SHT_vsStructOutput,
            {
                name: "fsOnput",
                code: WGSL_st_MSAAinfo_Guffer,
            },
            {
                name: "fs",
                code: colorMSAAInfoFS,
            },
        ],
        replace: [
            SHT_replaceGBufferMSAAinfo_FSOutput,                                            // WGSL_replace_MSAAinfo_gbuffer_output部分
            SHT_replaceGBufferCommonValue,                                            // WGSL_replace_gbuffer_commonValues部分
        ],
    }
}


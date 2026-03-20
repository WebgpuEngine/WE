/**
 * line SHT
 * lines.ts 未使用，而是使用的 SHT_MeshVS
 */
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
import lineMainWGSL from "../../shader/entity/line/main.vs.wgsl?raw";
import { I_ShaderTemplate, SHT_ScenOfCamera, WGSL_st_output, WGSL_st_location, E_shaderTemplateReplaceType } from "../base";
import { st_entity, replace_meshoutput } from "./common";
var lineMain = lineMainWGSL.toString();
export var SHT_LineVS: I_ShaderTemplate = {
    scene: SHT_ScenOfCamera,
    entity: {
        owner:"line",
        add: [
            {
                name: "st_output",
                code: WGSL_st_output,
            },
            {
                name: "st_location",
                code: WGSL_st_location,
            },
            {
                name: "st_entity",
                code: st_entity,
            },
            {
                name: "vs",
                code: lineMain,
            },

        ],
        replace: [
            {
                name: "st_output",
                replace: "$vsOutput",
                replaceType: E_shaderTemplateReplaceType.replaceCode,
                replaceCode: replace_meshoutput,
            },
            {
                name: "st_entity",
                replace: "$instacnce",
                replaceType: E_shaderTemplateReplaceType.value,
                // replaceCode: replace_meshoutput,
            },
            {
                name: "userCodeVS",
                replace: "$userCodeVS",
                replaceType: E_shaderTemplateReplaceType.replaceCode,
                replaceCode: "",
            }],

    },
}

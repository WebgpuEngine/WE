
import wireFrameWGSL from "../../shader/entity/mesh/wireframe.vs.wgsl?raw"
import { I_ShaderTemplate, SHT_ScenOfCamera, WGSL_st_output, WGSL_st_location, E_shaderTemplateReplaceType } from "../base";
import { st_entity, replace_meshoutput } from "./common";
var wireFrameMain = wireFrameWGSL.toString();
/**Mesh wireframe SHT */
export var SHT_MeshWireframeVS: I_ShaderTemplate = {
    scene: SHT_ScenOfCamera,
    entity: {
        owner:"wireframe",
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
                code: wireFrameMain,
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
            },
            {
                name: "userCodeVS",
                replace: "$userCodeVS",
                replaceType: E_shaderTemplateReplaceType.replaceCode,
                replaceCode: "",
            }],
    },
};

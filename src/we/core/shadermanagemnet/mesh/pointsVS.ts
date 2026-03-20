import { I_ShaderTemplate, SHT_ScenOfCamera, WGSL_st_output, WGSL_st_location, E_shaderTemplateReplaceType } from "../base";
import { st_entity, replace_meshoutput } from "./common";

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
import pointsMainWGSL from "../../shader/entity/point/main.vs.wgsl?raw"
var pointsMain = pointsMainWGSL.toString();
export var SHT_PointVS: I_ShaderTemplate = {
    scene: SHT_ScenOfCamera,
    entity: {
        owner: "point",
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
                code: pointsMain,
            },

        ],
        replace: [
            {
                name: "st_output",
                replace: "$vsOutput",
                replaceType: E_shaderTemplateReplaceType.replaceCode,
                replaceCode: replace_meshoutput,
            },
         
        ]
    },
}


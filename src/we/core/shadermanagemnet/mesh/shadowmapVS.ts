import { I_ShaderTemplate, SHT_addSystemOfLight, WGSL_st_output, WGSL_st_location, E_shaderTemplateReplaceType } from "../base";
import { st_entity, replace_meshoutput } from "./common";

/**Mesh shadow map SHT */
export var SHT_ShadowMapVS: I_ShaderTemplate = {
   
    entity: {
        owner:"mesh",
        add: [
            SHT_addSystemOfLight,
            {
                name: "st_output",
                code: WGSL_st_output,
            },
            {
                name: "st_location",            //创建location，使用entity的DCG的反射location
                code: WGSL_st_location,              //mesh,line,point都是一个结构体
            },
            {
                name: "st_entity",
                code: st_entity,
            },
            {
                name: "vs",
                code: shadowMapMain,
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
};

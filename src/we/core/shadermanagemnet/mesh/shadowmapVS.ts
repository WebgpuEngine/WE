import { E_shaderTemplateReplaceType, I_ShaderTemplate, SHT_ScenOfLight, WGSL_st_location, WGSL_st_output } from "../base";
import { st_entity, replace_meshoutput } from "./common";



import meshMainWGSL from "../../shader/entity/mesh/main.vs.wgsl?raw"
var meshMain = meshMainWGSL.toString();

/**Mesh shadow map SHT 
 * 1、与mesh的结构不同，没有scene。
 * 2、scene被集成到了entity中，需要注意，后期可以更改为一致的形式
*/
export var SHT_MeshShadowMapVS: I_ShaderTemplate = {
    scene: SHT_ScenOfLight,             //这里也是不同的scene
    entity: {
        owner:"mesh shadow map",        //名称必须与mesh的forwar不同，因为后期在DC的bindgroup0的是不同的（light）。
        add: [
            // SHT_addSystemOfLight,
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
                code: meshMain,
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
                replace: "$userCodeVS",         //这个是meshMain中的占位符$userCodeVS
                replaceType: E_shaderTemplateReplaceType.replaceCode,
                replaceCode: "",                       //这里将被用户自定义代码替换,code将会替换replace；如果code="",默认情况,即没有用户自定义代码
            }],
    },
};
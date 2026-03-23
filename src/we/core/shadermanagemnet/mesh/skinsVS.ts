import { E_shaderTemplateReplaceType, I_ShaderTemplate, SHT_ScenOfCamera, WGSL_st_location, WGSL_st_output } from "../base";
import { st_entity, replace_meshoutput } from "./common";

//entity
import meshSkinsMainWGSL from "../../shader/entity/skins/skins.vs.wgsl?raw"
var meshSkinsMain = meshSkinsMainWGSL.toString();

import  st_entityOfSkinsWGSL from "../../shader/entity/skins/st_entity_instances_skins.vs.wgsl?raw";
var st_entitySkins = st_entityOfSkinsWGSL.toString();   

/** Mesh SHT */
export var SHT_MeshSkinsVS: I_ShaderTemplate = {
    scene: SHT_ScenOfCamera,
    entity: {
        owner: "mesh",
        add: [
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
                code: st_entitySkins,
            },
            {
                name: "vs",
                code: meshSkinsMain,
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

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

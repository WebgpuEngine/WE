
///////////////////////////////////////////////////////////////////////////
//
/*
1、每个shader的JSON由以下部分组成
    add,                //添加shader的代码的内容
    replace,            //替换的内容
    uniform,            //uniform的内容

2、replaceType有以下类型
    value,              //替换为程序的变量
    replaceString,      //替换为字符串
    replaceCode,        //替换为WGSL代码
    selectCode,         //选择性替换代码，根据check的内容进行替换（false，true）对应数组（0,1）
*/
///////////////////////////////////////////////////////////////////////////
/** 
 * 替换列表，key是占位符，value是替换的内容 
 * 1、material使用
 * 
*/
// export type T_SHTReplaceList = Map<string, string | ((scope?: any) => string)>;

/**
 * add 模拟部分内容
 */
export interface I_shaderTemplateAdd {
    name: string,
    code: string,
}
/**
 * replace 模板的内容
 */
export interface I_shaderTemplateReplace {
    name: string,
    replace: string,                //替换的内容， "$lightNumber",
    replaceType: E_shaderTemplateReplaceType,            //替换的类型，value,replaceString,replaceCode,selectCode
    check?: string | string[],                 //检查的内容，根据check的内容进行替换（false，true）对应数组（0,1）
    selectCode?: string[],          //选择性替换代码，根据check的内容进行替换（false，true）对应数组（0,1）
    replaceCode?: string,                  //替换的代码
    description?: string,            //描述
    //////////////////////////////////
    //js 数值部分
    varOfJS?: string[],              //JS中的变量，aa.bb.cc
    varOfJSCheck?: any[],             //JS中的变量的检查，根据varOfJSCheck的内容进行替换（false，true）对应器内容
}
/**
 * 替换的类型，同时包含add和replace
 */
export interface I_shaderTemplateReplaceAndAdd extends I_shaderTemplateReplace {
    /**
     * 1、增加，并包含占位符的string
     * 2、如果没有，则有material部分生成，然后进行替换占位符
     */
    code?: string,
}

/**
 * 替换的类型
 */
export enum E_shaderTemplateReplaceType {
    value,              //替换为程序的变量
    // replaceString,      //替换为字符串
    replaceCode,        //替换为WGSL代码
    selectCode,         //选择性替换代码，根据check的内容进行替换（false，true）对应数组（0,1）
    // checkVarOfJS,       //检查JS的变量
}
/**
 * 单个模板的内容组成部分
 */
export interface I_singleShaderTemplate {
    add?: I_shaderTemplateAdd[],
    replace?: I_shaderTemplateReplace[],
    groupAndBinding?: I_shaderTemplateReplaceAndAdd[],
    /**
     * VS、FS的owner是必须的，进行cache使用
     * scene等中的owner会被忽略，仅起到名称作用
     */
    owner: string,
}

/**
 * 着色器模板
 * 场景、实体、材质、DCG的着色器模板
 * 其中mesh一般由entity和material两部分合成，
 *      endity部分一般包含：scene，entity，DCG
 *      material部分一般包含：material，DCG，
 * 所以，DCG可能存在两个部分，需要在DCG的部分合并，先entity，后material的
 */
export interface I_ShaderTemplate {
    [name: string]: I_singleShaderTemplate,
    // scene?: I_singleShaderTemplateWithOwner,
    // entity?: I_singleShaderTemplateWithOwner,
    // material?: I_singleShaderTemplateWithOwner,
    // DCG?: I_singleShaderTemplateWithOwner,
}
/**
 * shader模板的单个内容
 * 比如：scene，entity，material这些组成部分
 */
export interface I_singleShaderTemplate_Final {
    /** shader模板的字符串 */
    templateString: string,
    /** shader模板的绑定字符串 */
    groupAndBindingString: string,
    /** shader模板的绑定当前(已用的)值 */
    binding?: number,
    /** shader模板是否动态绑定资源
     * 1、若是非动态资源，则对应FS的bindgroup的entry实现是静态数据形式。
     * 2、若为动态资源，则对应FS的bindgroup的entry实现是箭头函数。
     *      A、video需要动态绑定
     *      B、与camera 相关texture需要动态绑定。（原因是resize后，texture会注销并新建）
     */
    dynamic?: boolean,
    /** shader模板的所有者名称
     * 1、是DCG进行shader model 缓存的key，
     * 2、要求全局唯一 
     * 3、目前都是string
     */
    owner: string,
    /**是否进行shader model 缓存
     * 1、默认是true，进行缓存。
     * 2、若为false，则不进行缓存。
     *     A、不进行缓存，就是每个shader 都会编译。相对于多个相同的变种
     *     B、不缓存，shader model的编译时间会增加。如果shader 比较多，而且复杂，会较大增加编译时间。
     *     C、自定义shader的材质，不用缓存。
     *     D、
     */
    cache?: boolean,
}
/**
 * 最终的模板内容
 */
export interface I_ShaderTemplate_Final {
    [name: string]: I_singleShaderTemplate_Final
}
//////////////////////////////////////////////////////////////////////////////////
// vs output
import st_outputWGSL from "../shader/entity/st_output.vs.wgsl?raw"
export var WGSL_st_output = st_outputWGSL.toString();

export var SHT_vsStructOutput: I_shaderTemplateAdd =
{
    name: "st_output",
    code: WGSL_st_output,
};
//////////////////////////////////////////////////////////////////////////////////
//GBuffer

//struct 定义
import st_GufferWGSL from "../shader/gbuffers/st_gbuffer.fs.wgsl?raw";
export var WGSL_st_Guffer = st_GufferWGSL.toString();

import st_MSAA_GufferWGSL from "../shader/gbuffers/st_MSAA_gbuffer.fs.wgsl?raw";
export var WGSL_st_MSAA_Guffer = st_MSAA_GufferWGSL.toString();

import st_MSAAinfo_GufferWGSL from "../shader/gbuffers/st_MSAAinfo_gbuffer.fs.wgsl?raw";
export var WGSL_st_MSAAinfo_Guffer = st_MSAAinfo_GufferWGSL.toString();

import st_transgparentbufferWGSL from "../shader/gbuffers/st_transgparentbuffer.fs.wgsl?raw";
export var WGSL_st_transparentbuffer = st_transgparentbufferWGSL.toString();


import st_locationWGSL from "../shader/entity/st_location_ref.vs.wgsl?raw"
export var WGSL_st_location = st_locationWGSL.toString();



import replace_gbuffer_outputWGSL from "../shader/gbuffers/replace_gbuffer_output.fs.wgsl?raw";
export var WGSL_replace_gbuffer_output = replace_gbuffer_outputWGSL.toString();

import replace_MSAA_gbuffer_outputWGSL from "../shader/gbuffers/replace_MSAA_gbuffer_output.fs.wgsl?raw";
export var WGSL_replace_MSAA_gbuffer_output = replace_MSAA_gbuffer_outputWGSL.toString();

import replace_MSAAinfo_gbuffer_outputWGSL from "../shader/gbuffers/replace_MSAAinfo_gbuffer_output.fs.wgsl?raw";
export var WGSL_replace_MSAAinfo_gbuffer_output = replace_MSAAinfo_gbuffer_outputWGSL.toString();

// import deferDepthWGSL from "../shader/defer/replace_deferDepthCompare.fs.wgsl?raw";
// var deferDepthFS = deferDepthWGSL.toString();
// //defer渲染的深度比较,未使用，但有导入引用
// export var SHT_replaceDefer: I_shaderTemplateReplace = {
//     name: "replaceDefer",
//     description: "根据scene.deferRender.deferRenderDepth 判断行为",
//     replace: "$deferRender_Depth",
//     replaceType: E_shaderTemplateReplaceType.checkVarOfJS,
//     varOfJS: ["scene", "deferRender", "deferRenderDepth"],
//     varOfJSCheck: [
//         { "true": deferDepthFS },
//         { "false": "" }],
// }

import WGSL_replace_gbuffer_commonValues from "../shader/gbuffers/commonGBufferValue.wgsl?raw";
var replace_gbuffer_commonValues = WGSL_replace_gbuffer_commonValues.toString();

//GBuffer的通用值替换项
export var SHT_replaceGBufferCommonValue: I_shaderTemplateReplace =
{
    name: "common values",
    replace: "$gbufferCommonValues",           //替换为WGSL_replace_gbuffer_output
    replaceType: E_shaderTemplateReplaceType.replaceCode,
    replaceCode: replace_gbuffer_commonValues
}

//replace GBuffer的通用单项
export var SHT_replaceGBufferFSOutput: I_shaderTemplateReplace =
{
    name: "colorFS.output content",
    replace: "$fsOutput",           //替换为WGSL_replace_gbuffer_output
    replaceType: E_shaderTemplateReplaceType.replaceCode,
    replaceCode: WGSL_replace_gbuffer_output
}

export var SHT_replaceGBufferMSAA_FSOutput: I_shaderTemplateReplace =
{
    name: "colorFS.output content",
    replace: "$fsOutput",
    replaceType: E_shaderTemplateReplaceType.replaceCode,
    replaceCode: WGSL_replace_MSAA_gbuffer_output
}
export var SHT_replaceGBufferMSAAinfo_FSOutput: I_shaderTemplateReplace =
{
    name: "colorFS.output content",
    replace: "$fsOutput",
    replaceType: E_shaderTemplateReplaceType.replaceCode,
    replaceCode: WGSL_replace_MSAAinfo_gbuffer_output
}
//////////////////////////////////////////////////////////////////////////////////
//math
import mathConstWGSL from "../shader/math/baseconst.wgsl?raw"
var mathConst = mathConstWGSL.toString();
import mathTBNWGSL from "../shader/math/TBN.wgsl?raw"
var mathTBN = mathTBNWGSL.toString();
import mathRandomWGSL from "../shader/math/random.wgsl?raw"
var mathRandom = mathRandomWGSL.toString();

//math base const
export var SHT_addMathBase: I_shaderTemplateAdd = {
    name: "mathBase",
    code: mathConst,
}
//math TBN
export var SHT_addMathTBN: I_shaderTemplateAdd = {
    name: "mathTBN",
    code: mathTBN,
}
//math random
export var SHT_addMathRandom: I_shaderTemplateAdd = {
    name: "mathRandom",
    code: mathRandom,
}
//////////////////////////////////////////////////////////////////////////////////
//shadow map MVP
import systemOfLightWGSL from "../shader/system/systemForLight.wgsl?raw"
var systemOfLight = systemOfLightWGSL.toString();

//shadow map 系统变量
export var SHT_addSystemOfLight: I_shaderTemplateAdd = {
    name: "systemOfLight",
    code: systemOfLight,
}

//shadow map 
import shadowmapPCSSWGSL from "../shader/shadowmap/fn_pcss.wgsl?raw"
var shadowmapPCSS = shadowmapPCSSWGSL.toString();
//阴影可见度计算的函数相关的代码单项
export var SHT_addPCSS: I_shaderTemplateAdd = {
    name: "pcss",
    code: shadowmapPCSS,
}


///////////////////////////////////////////////////////////////////////////
//function 定义
import encodeDecodeFunctionWGSL from "../shader/function/encodeAndDecode.wgsl?raw";
var encodeDecodeFunction = encodeDecodeFunctionWGSL.toString();
export var SHT_addEncodeDecodeFunction: I_shaderTemplateAdd = {
    name: "encodeDecodeFunction",
    code: encodeDecodeFunction,
}
///////////////////////////////////////////////////////////////////////////
//scene 和DCG 通用部分

//system
import systemOfCameraWGSL from "../shader/system/system.wgsl?raw"
var systemOfCamera = systemOfCameraWGSL.toString();
//场景相机的系统变量
/**VS部分系统变量模板 */
export var SHT_ScenOfCamera: I_singleShaderTemplate = {
    owner:"scene",
    add: [
        {
            name: "system",
            code: systemOfCamera,
        },
        // SHT_addEncodeDecodeFunction,
    ],
    replace: [
        {
            name: "lightNumber",
            replace: "$lightNumber",
            replaceType: E_shaderTemplateReplaceType.value,                        //replaceType=value,替换为程序的变量
        },
        {
            name: "shadowMapNumber",
            replace: "$lightNumberShadowNumber",
            replaceType: E_shaderTemplateReplaceType.value,
        },
        {
            name: "shadowDepthTextureSize",
            replace: "override shadowDepthTextureSize : f32 = 1024.0;",
            replaceType: E_shaderTemplateReplaceType.value,
        },

    ],
};
/**VS部分系统变量模板 */
export var SHT_ScenOfLight: I_singleShaderTemplate = {
    owner:"scene",
    add: [
       SHT_addSystemOfLight
    ],
    replace:[]
};
/**FS部分系统变量模板 */
export var SHT_ScenOfCamera_FS: I_singleShaderTemplate = {
    owner:"scene",
    add: [
        {
            name: "system",
            code: systemOfCamera,
        },
        SHT_addEncodeDecodeFunction,
    ],
    replace: [
        {
            name: "lightNumber",
            replace: "$lightNumber",
            replaceType: E_shaderTemplateReplaceType.value,                        //replaceType=value,替换为程序的变量
        },
        {
            name: "shadowMapNumber",
            replace: "$lightNumberShadowNumber",
            replaceType: E_shaderTemplateReplaceType.value,
        },
        {
            name: "shadowDepthTextureSize",
            replace: "override shadowDepthTextureSize : f32 = 1024.0;",
            replaceType: E_shaderTemplateReplaceType.value,
        },

    ],
};
//ref DCG 反射location
/**DCG反射location模板 */
export var SHT_refDCG: I_singleShaderTemplate = {
    owner:"DCG",
    replace: [
        {
            name: "refName",                    //创建的反射的其他location，使用entity的DCG的反射location
            replace: "$st_location_ref",
            replaceType: E_shaderTemplateReplaceType.value,
            description: "创建location,使用entity的DCG的反射location到WGSL中",
        },
        {
            name: "refName",
            replace: "$position",
            replaceType: E_shaderTemplateReplaceType.selectCode,                    //replaceType="selectCode",检查是否有属性,并根据check的检查属性进行替换
            check: "position",
            /**
             * 检查是否有position属性
             * 反射属性中没有，false，使用selectCode[0]
             * 反射属性中有，true，使用selectCode[1]
             */
            selectCode: [
                " let position= vec3f(0.0,0.0,0.0); \n ",
                " let position = attributes.position; \n ",
            ],

        },
        {
            name: "refName",
            replace: "$color",
            replaceType: E_shaderTemplateReplaceType.selectCode,                    //replaceType="selectCode",检查是否有属性,并根据check的检查属性进行替换
            check: "color",
            selectCode: [
                " let color= vec3f(1.0,1.0,1.0); \n ",
                " let color = attributes.color; \n ",
            ],
        },
        {
            name: "refName",
            replace: "$normal",
            replaceType: E_shaderTemplateReplaceType.selectCode,                    //replaceType="selectCode",检查是否有属性,并根据check的检查属性进行替换
            check: "normal",
            selectCode: [
                " let normal= vec3f(0.0,0.0,0.0); \n ",
                " let normal = attributes.normal; \n ",

            ],

        },
        {
            name: "refName",
            replace: "$uv",
            replaceType: E_shaderTemplateReplaceType.selectCode,                    //replaceType="selectCode",检查是否有属性,并根据check的检查属性进行替换
            check: "uv",
            selectCode: [
                " var uv= vec4f(0.0,0.0,0.0,0.0); \n ",
                " var uv =vec4f(attributes.uv,0.0,0.0); \n ",
            ],
        },
        {
            name: "refName",
            replace: "$uv1",
            replaceType: E_shaderTemplateReplaceType.selectCode,                    //replaceType="selectCode",检查是否有属性,并根据check的检查属性进行替换
            check: "uv1",
            selectCode: [
                "",
                " uv[2]= attributes.uv1[0]; \n uv[3]= attributes.uv1[1]; \n ",
            ],
        },
        // 骨骼动画
        {
            name: "refName",
            replace: "$skinSkeleton",
            replaceType: E_shaderTemplateReplaceType.selectCode,                    //replaceType="selectCode",检查是否有属性,并根据check的检查属性进行替换
            check: ["joints", "weights"],
            selectCode: [
                "",
                ` 
    if(u_entity_base.animation_kind == 4||u_entity_base.animation_kind == 5||u_entity_base.animation_kind == 6) {
        var skin_mat: mat4x4f = mat4x4f(
            vec4f(0.0, 0.0, 0.0, 0.0), // 第0列
            vec4f(0.0, 0.0, 0.0, 0.0), // 第1列
            vec4f(0.0, 0.0, 0.0, 0.0), // 第2列
            vec4f(0.0, 0.0, 0.0, 0.0)  // 第3列（单位矩阵）
        );

        let count = i32(u_entity_base.joint_matrix_count);
        for(var i=0 ;i < 4;i++) {
            let per_joint = u32(attributes.joints[i]);
            // skin_mat += attributes.weights[i] * joint_matrix[  per_joint];
            skin_mat += attributes.weights[i] * joint_matrix[ attributes.instanceIndex * u_entity_base.joint_matrix_count + per_joint];
        }
        worldPosition = skin_mat * vec4f(position, 1.0);
        // worldPosition = vec4f(world_matrix[attributes.instanceIndex] * vec4f(position, 1.0));
        vsOutput.worldPosition = worldPosition.xyz / worldPosition.w;
        vsOutput.position = matrix_z * MVP *  vec4f(worldPosition.xyz, 1.0);
        vsOutput.normal = normalize(vec4f(skin_mat* vec4f(normal, 0)).xyz);
    }
        `,
            ],
        },
        //  morphTarget动画
        {
            name: "refName",
            replace: "$morphTarget",
            replaceType: E_shaderTemplateReplaceType.selectCode,                    //replaceType="selectCode",检查是否有属性,并根据check的检查属性进行替换
            //使用“position_*”是为了与position区分，position_*是morphTarget的position属性
            check: ["position_1", "position_2"],                                      //检查是否有position_1和position_2属性,至少2个position;
            selectCode: [
                "",
                ` 
  if(u_entity_base.animation_kind == 2||u_entity_base.animation_kind == 3||u_entity_base.animation_kind == 6||u_entity_base.animation_kind == 7) {
    // var positions :array<vec3f,2>=array (attributes.position_1,attributes.position_2);

    let count = i32(u_entity_base.morpht_target_count);
    var position_morph_target :vec3f = attributes.position;
    for(var i=0 ;i < count;i++) {
    // for(var i=0 ;i < 1;i++) {
      position_morph_target += positions[i] * morph_matrix[attributes.instanceIndex * u_entity_base.morpht_target_count+ u32(i)];
    }
    worldPosition = vec4f(world_matrix[attributes.instanceIndex] * vec4f(position_morph_target, 1.0));
    vsOutput.worldPosition = worldPosition.xyz / worldPosition.w;
    vsOutput.position = matrix_z * MVP *  vec4f(worldPosition.xyz, 1.0);
   }                
        `,
            ],
        },
    ]
};
import toneMappingWGSL from "../shaders/colorSpace/toneMapping.wgsl?raw";
import DeferRenderFS_WGSL from "../shaders/defer/deferRender.fs.wgsl?raw";

//////////////////////////////////////////////////////////////////////////////////
// entity bindgroup
import include_bindgroup_entiy_base_wgsl from "../shaders/entity/bindgroup_entiy_base.wgsl?raw"
import include_bindgroup_add_morphTarget_wgsl from "../shaders/entity/morphTarget/bindgroup_add_morphTarget.wgsl?raw"
import include_bindgroup_add_skins_wgsl from "../shaders/entity/skins/bindgroup_add_skins.wgsl?raw"

// VS  :entity
import include_structEntity_wgsl from "../shaders/entity/structEntity.wgsl?raw"
import include_st_vertex_output_wgsl from "../shader/entity/st_vertex_output.wgsl?raw"
import include_code_entity_output_wgsl from "../shaders/entity/code_entity_output.vs.wgsl?raw"
import meshMain_wgsl from "../shaders/entity/mesh/main.vs.wgsl?raw"
// import lineMain_wgsl from "../shaders/entity/mesh/main.vs.wgsl?raw";
// import pointsMain_wgsl from "../shaders/entity/point/main.vs.wgsl?raw"
import shadowmapMain_wgsl from "../shaders/entity/shadowmap/main.vs.wgsl?raw";
import pointEmuSprite_wgsl from "../shaders/entity/sprite/mainSprite.vs.wgsl?raw"
// import wireFrame_wgsl from "../shaders/entity/mesh/wireframe.vs.wgsl?raw"
import oneCubeColor_wgsl from "../shaders/entity/mesh/oneColorCube.vs.wgsl?raw"

import meshMorphTargetMain_wgsl from "../shaders/entity/morphTarget/morphTarget.vs.wgsl?raw"
import meshSkinsMain_wgsl from "../shaders/entity/skins/skins.vs.wgsl?raw"

import quadVS_wgsl from "../shaders/quad/quad.vs.wgsl?raw";
//////////////////////////////////////////////////////////////////////////////////
//GBuffer
//struct 定义
import include_gbuffer_commonValues_wgsl from "../shader/gbuffers/commonGBufferValue.wgsl?raw";

import replace_st_GBuffer_wgsl from "../shader/gbuffers/st_gbuffer.fs.wgsl?raw";
import replace_st_MSAA_GBuffer_wgsl from "../shader/gbuffers/st_MSAA_gbuffer.fs.wgsl?raw";
import replace_st_MSAAinfo_GBuffer_wgsl from "../shader/gbuffers/st_MSAAinfo_gbuffer.fs.wgsl?raw";
// import include_st_transgparent_GBuffer_wgsl from "../shader/gbuffers/st_transgparentbuffer.fs.wgsl?raw";
import replace_gbuffer_outputWGSL from "../shader/gbuffers/replace_gbuffer_output.fs.wgsl?raw";
import replace_MSAA_gbuffer_outputWGSL from "../shader/gbuffers/replace_MSAA_gbuffer_output.fs.wgsl?raw";
import replace_MSAAinfo_gbuffer_outputWGSL from "../shader/gbuffers/replace_MSAAinfo_gbuffer_output.fs.wgsl?raw";

//////////////////////////////////////////////////////////////////////////////////
//math

import include_mathConst_wgsl from "../shader/math/baseconst.wgsl?raw"
import include_mathTBN_wgsl from "../shader/math/TBN.wgsl?raw"
import include_mathRandom_wgsl from "../shader/math/random.wgsl?raw"

//////////////////////////////////////////////////////////////////////////////////
//material 
import include_encodeDecodeFunction_wgsl from "../shader/function/encodeAndDecode.wgsl?raw";
import include_bindgroup_material_base_wgsl from "../shader/material/bindgroup_material_base.wgsl?raw";

import replace_MsaaString_wgsl from "../shaders/material/MSAA/msaa.wgsl?raw";
import colorFS_wgsl from "../shaders/material/color/color.fs.wgsl?raw";
import colorTTFSWGSL from "../../shader/material/color/colorTT.fs.wgsl?raw";
import colorMSAAInfoFSWGSL from "../shaders/material/color/colorMSAAInfo.fs.wgsl?raw";

import cubeSKyTextureFSWGSL from "../shaders/material/texture/cubeSkyTexture.fs.wgsl?raw";
import cubePositionTextureFSWGSL from "../shaders/material/texture/cubeLocalTexture.fs.wgsl?raw";

import PBR_function_WGSL from "../shaders/material/PBR/PBRfunction.wgsl?raw"
import PBRMaterialWGSL from "../shaders/material/PBR/PBR.fs.wgsl?raw"
import add_Phong_function_WGSL from "../shaders/material/phong/phongfunction.wgsl?raw"
import phongMaterialWGSL from "../shaders/material/phong/phongcolor.fs.wgsl?raw"
import phongMaterial_MSAAinfo_WGSL from "../shaders/material/phong/phongMSAAinfo.fs.wgsl?raw"
// import textureUniformFSWGSL from "../shaders/material/texture/textureUniform.fs.wgsl?raw";
import textureFSWGSL from "../shaders/material/texture/texture.fs.wgsl?raw";
import textureMSAAInfoFSWGSL from "../shaders/material/texture/textureMSAAInfo.fs.wgsl?raw";
import textureTT_FSWGSL from "../shaders/material/texture/textureTT.fs.wgsl?raw";
// import colorFSWGSL from "../shaders/material/vertexColor/color.fs.wgsl?raw";
// import colorMSAAInfoFSWGSL from "../shaders/material/vertexColor/colorMSAAInfo.fs.wgsl?raw";
import videoTextureFSWGSL from "../shaders/material/texture/video.fs.wgsl?raw";
import wireFrameFSWGSL from "../shaders/material/wirframe/wireFrame.fs.wgsl?raw";
import wireFrameMSAAInfoFSWGSL from "../shaders/material/wirframe/wireFrameMSAAInfo.fs.wgsl?raw";
import wireFrameMSAASWGSL from "../shaders/material/wirframe/wireFrameMSAA.fs.wgsl?raw";


//////////////////////////////////////////////////////////////////////////////////
//pp
import PP_Blur3x3_FS_WGSL from "../shaders/PostProcess/blur/blur3x3.fs.wgsl?raw";
import PP_FXAA_FS_WGSL from "../shaders/PostProcess/AA/FXAA.fs.wgsl?raw";
import PP_RedToOne_FS_WGSL from "../shaders/PostProcess/test/redToOne.wgsl?raw"
import PP_struct_WGSL from "../shaders/PostProcess/PPstruct.wgsl?raw";

//////////////////////////////////////////////////////////////////////////////////
//shadow map MVP
import systemOfLight_wgsl from "../shader/system/systemForLight.wgsl?raw"
import shadowmapPCSS_wgsl from "../shader/shadowmap/fn_pcss.wgsl?raw"
import systemOfCamera_wgsl from "../shader/system/system.wgsl?raw"
import structOfCamera_wgsl from "../shader/entity/system/structOfCamera.wgsl?raw"


export var WGSL_Include: Record<string, string> = {
    "colorSpace/toneMapping.wgsl": toneMappingWGSL,
    "defer/deferRender.fs.wgsl": DeferRenderFS_WGSL,

    "entity/bindgroup_entiy_base.wgsl": include_bindgroup_entiy_base_wgsl,
    "entity/morphTarget/bindgroup_add_morphTarget.wgsl": include_bindgroup_add_morphTarget_wgsl,
    "entity/skins/bindgroup_add_skins.wgsl": include_bindgroup_add_skins_wgsl,

    "entity/structEntity.wgsl": include_structEntity_wgsl,
    "entity/st_vertex_output.vs.wgsl": include_st_vertex_output_wgsl,
    "entity/code_entity_output.vs.wgsl": include_code_entity_output_wgsl,


    "gbuffers/commonGBufferValue.wgsl": include_gbuffer_commonValues_wgsl,

    // "gbuffers/st_transgparentbuffer.fs.wgsl": include_st_transgparent_GBuffer_wgsl,
    "material/bindgroup_material_base.wgsl": include_bindgroup_material_base_wgsl,
    
    "material/PBR/PBRfunction.wgsl": PBR_function_WGSL,
    "material/phong/phongfunction.wgsl": add_Phong_function_WGSL,

    "math/baseconst.wgsl": include_mathConst_wgsl,
    "math/TBN.wgsl": include_mathTBN_wgsl,
    "math/random.wgsl": include_mathRandom_wgsl,

    "PostProcess/PPstruct.wgsl": PP_struct_WGSL,

    "shadowmap/fn_pcss.wgsl": shadowmapPCSS_wgsl,

    "system/systemForLight.wgsl": systemOfLight_wgsl,
    "system/structOfCamera.wgsl": structOfCamera_wgsl,
    "system/system.wgsl": systemOfCamera_wgsl,
    "function/encodeAndDecode.wgsl": include_encodeDecodeFunction_wgsl,
}

export var WGSL_Replace: Record<string, string> = {
    "gbuffers/st_gbuffer.fs.wgsl": replace_st_GBuffer_wgsl,
    "gbuffers/st_MSAA_gbuffer.fs.wgsl": replace_st_MSAA_GBuffer_wgsl,
    "gbuffers/st_MSAAinfo_gbuffer.fs.wgsl": replace_st_MSAAinfo_GBuffer_wgsl,

    "gbuffers/replace_gbuffer_output.fs.wgsl": replace_gbuffer_outputWGSL,
    "gbuffers/replace_MSAA_gbuffer_output.fs.wgsl": replace_MSAA_gbuffer_outputWGSL,
    "gbuffers/replace_MSAAinfo_gbuffer_output.fs.wgsl": replace_MSAAinfo_gbuffer_outputWGSL,

    "material/MSAA/msaa.wgsl": replace_MsaaString_wgsl,

}

export var WGSL_ShaderCode: Record<string, string> = {
    "entity/mesh/main.vs.wgsl": meshMain_wgsl,
    "entity/shadowmap/main.vs.wgsl": shadowmapMain_wgsl,
    // "entity/line/main.vs.wgsl": lineMain_wgsl,
    "entity/morphTarget/morphTarget.vs.wgsl": meshMorphTargetMain_wgsl,
    "entity/mesh/oneColorCube.vs.wgsl": oneCubeColor_wgsl,
    // "entity/point/main.vs.wgsl": pointsMain_wgsl,
    "entity/quad/quad.vs.wgsl": quadVS_wgsl,
    "entity/point/mainSprite.vs.wgsl": pointEmuSprite_wgsl,
    "entity/skins/skins.vs.wgsl": meshSkinsMain_wgsl,
    // "entity/mesh/wireframe.vs.wgsl": wireFrame_wgsl,

    "material/color/color.fs.wgsl": colorFS_wgsl,
    // "material/color/colorTT.fs.wgsl": colorTTFSWGSL,
    // "material/color/colorMSAAInfo.fs.wgsl": colorMSAAInfoFSWGSL,
    "material/texture/cubeSkyTexture.fs.wgsl": cubeSKyTextureFSWGSL,
    "material/texture/cubeLocalTexture.fs.wgsl": cubePositionTextureFSWGSL,

    "material/PBR/PBR.fs.wgsl": PBRMaterialWGSL,

    "material/phong/phongcolor.fs.wgsl": phongMaterialWGSL,
    "material/phong/phongMSAAinfo.fs.wgsl": phongMaterial_MSAAinfo_WGSL,

    "material/texture/texture.fs.wgsl": textureFSWGSL,
    "material/texture/textureMSAAInfo.fs.wgsl": textureMSAAInfoFSWGSL,
    "material/texture/textureTT.fs.wgsl": textureTT_FSWGSL,

    "material/texture/video.fs.wgsl": videoTextureFSWGSL,
    "material/wirframe/wireFrame.fs.wgsl": wireFrameFSWGSL,
    // "material/wirframe/wireFrameMSAAInfo.fs.wgsl": wireFrameMSAAInfoFSWGSL,
    // "material/wirframe/wireFrameMSAA.fs.wgsl": wireFrameMSAASWGSL,

    "PostProcess/blur/blur3x3.fs.wgsl": PP_Blur3x3_FS_WGSL,
    "PostProcess/AA/FXAA.fs.wgsl": PP_FXAA_FS_WGSL,
    "PostProcess/test/redToOne.fs.wgsl": PP_RedToOne_FS_WGSL,
}

export interface I_aliasShaderCode {
    type: "vs" | "fs" | "quadVs" | "quadFs",
    code: string,
    renderMode?: Record<"forword" | "defer" | "Msaa" | "MsaaInfo" | "blend", boolean>
    // renderMode?: Record<string, boolean>
}
export var WGSL_AliasShaderCode: Record<string, I_aliasShaderCode> = {
    "entity.mesh": {//mesh file
        type: "vs",
        code: WGSL_ShaderCode["entity/mesh/main.vs.wgsl"],
    },
    "entity.line": {//mesh file
        type: "vs",
        code: WGSL_ShaderCode["entity/mesh/main.vs.wgsl"],
    },
    "entity.points": {//mesh file
        type: "vs",
        code: WGSL_ShaderCode["entity/mesh/main.vs.wgsl"],
    },
    "entity.wireframe": {//mesh file
        type: "vs",
        code: WGSL_ShaderCode["entity/mesh/main.vs.wgsl"],
    },
    "entity.shadowmap": {
        type: "vs",
        code: WGSL_ShaderCode["entity/shadowmap/main.vs.wgsl"],
    },
    "entity.sprite": {
        type: "vs",
        code: WGSL_ShaderCode["entity/sprite/mainSprite.vs.wgsl"],
    },
    "entity.oneColorCube": {//mesh file
        type: "vs",
        code: WGSL_ShaderCode["entity/mesh/oneColorCube.vs.wgsl"],
    },
    "entity.morphTarget": {
        type: "vs",
        code: WGSL_ShaderCode["entity/morphTarget/morphTarget.vs.wgsl"],
    },
    "entity.skins": {
        type: "vs",
        code: WGSL_ShaderCode["entity/skins/skins.vs.wgsl"],
    },
    "entity.quad": {
        type: "quadVs",
        code: WGSL_ShaderCode["entity/quad/quad.vs.wgsl"],
    },


    "makterl.color": {
        type: "fs",
        code: WGSL_ShaderCode["material/color/color.fs.wgsl"],
        renderMode: {
            forword: true,
            defer: true,
            Msaa: true,
            MsaaInfo: true,
            blend: true,
        }
    },
    "material.texture": {
        type: "fs",
        code: WGSL_ShaderCode["material/texture/texture.fs.wgsl"],
        renderMode: {
            forword: true,
            defer: true,
            Msaa: true,
            MsaaInfo: true,
            blend: true,
        }
    },
    "material.wireframe": {
        type: "fs",
        code: WGSL_ShaderCode["material/wirframe/wireFrame.fs.wgsl"],
        renderMode: {
            forword: true,
            defer: true,
            Msaa: true,
            MsaaInfo: true,
            blend: false,
        }
    },
    "material.video": {
        type: "fs",
        code: WGSL_ShaderCode["material/texture/video.fs.wgsl"],
        renderMode: {
            forword: true,
            defer: true,
            Msaa: true,
            MsaaInfo: true,
            blend: false,
        }
    },
    "material.cube": {
        type: "fs",
        code: WGSL_ShaderCode["material/texture/cubeLocalTexture.fs.wgsl"],
        renderMode: {
            forword: true,
            defer: true,
            Msaa: true,
            MsaaInfo: true,
            blend: false,
        }
    },
    "material.cubeSky": {
        type: "fs",
        code: WGSL_ShaderCode["material/texture/cubeSkyTexture.fs.wgsl"],
        renderMode: {
            forword: true,
            defer: true,
            Msaa: true,
            MsaaInfo: true,
            blend: false,
        }
    },
    "material.phong": {
        type: "fs",
        code: WGSL_ShaderCode["material/phong/phongcolor.fs.wgsl"],
        renderMode: {
            forword: true,
            defer: true,
            Msaa: true,
            MsaaInfo: true,
            blend: false,
        }
    },
    "material.pbr": {
        type: "fs",
        code: WGSL_ShaderCode["material/PBR/PBR.fs.wgsl"],
        renderMode: {
            forword: true,
            defer: true,
            Msaa: true,
            MsaaInfo: true,
            blend: false,
        }
    },
    "postProcess.blur3x3": {
        type: "fs",
        code: PP_Blur3x3_FS_WGSL,
    },
    "postProcess.FXAA": {
        type: "fs",
        code: PP_FXAA_FS_WGSL,
    },
    "postProcess.redToOne": {
        type: "fs",
        code: PP_RedToOne_FS_WGSL,
    },
}
/**
 * @author TomSong 2025-09-16
 * @description cube纹理材质
 * @version 1.0.0
 * 
 * cube纹理材质
 * 1、支持基础颜色
 * 2、支持纹理
 * 3、支持透明
 *    A、alphaTest，alpha值（texture)
 *    B、opacity,整体透明度
 */
import { E_lifeState } from "../../base/coreDefine";
import { T_uniformOneGroup } from "../../command/base";
import { Clock } from "../../scene/clock";
import { I_ShaderTemplate } from "../../shadermanagemnet/base";
import { IV_TextureMaterial, TextureMaterial } from "./textureMaterial";
import { CubeTexture } from "../../texture/cubeTexxture";
import { E_MaterialType, E_TextureType, I_BundleOfMaterialForMSAA, I_materialBundleOutput, I_UniformBundleOfMaterial } from "../base";
import { SHT_materialCubePositionTextureFS, SHT_materialCubePositionTextureFS_MSAA, SHT_materialCubePositionTextureFS_MSAAinfo, SHT_materialCubeSkyTextureFS, SHT_materialCubeSkyTextureFS_MSAA, SHT_materialCubeSkyTextureFS_MSAAinfo } from "../../shadermanagemnet/material/cubeTextureMaterial";
import { Texture } from "../../texture/texture";

export interface IV_CubeTextureMaterial extends IV_TextureMaterial {
    cubeType?: "sky" | "cube"
}

export class CubeTextureMaterial extends TextureMaterial {

    declare inputValues: IV_CubeTextureMaterial;
    cubeType: IV_CubeTextureMaterial["cubeType"] = "cube";
    constructor(inputValues: IV_CubeTextureMaterial) {
        super(inputValues);
        this.kind = E_MaterialType.cube;
        if (this.inputValues.cubeType) {
            this.cubeType = this.inputValues.cubeType;
        }
    }

    async readyForGPU(): Promise<any> {
        if (this.inputValues.texture == undefined) {
            throw new Error("CubeTextureMaterial 缺少cubeTexture");
        }
        this.defaultSampler = this.checkSampler(this.inputValues);
        if (this.inputValues.texture instanceof Texture) {
            this.textures[E_TextureType.cube] = this.inputValues.texture;
        }
        else if (typeof this.inputValues.texture == "string") {
            let textureInstace = new CubeTexture({ source: this.inputValues.texture }, this.device, this.scene);
            await textureInstace.init(this.scene);
            this.textures[E_TextureType.cube] = textureInstace;
        }
        else {
            throw new Error("CubeTextureMaterial cubeTexture 必须为字符串 或 CubeTexture 实例");
        }
        // this.countOfTexturesOfFineshed++;
        this._state = E_lifeState.finished;
    }
    getUniformEntryBundleOfCommon(startBinding: number = 0): I_UniformBundleOfMaterial {
        let groupAndBindingString: string = "";
        let binding: number = startBinding;
        let uniform1: T_uniformOneGroup = [];
        this.unifromEntryLayout = [];

        ///////////group binding
        ////group binding  texture 字符串
        groupAndBindingString = ` @group(${this.bindGroupNumber}) @binding(${binding}) var u_cubeTexture: texture_cube<f32>;\n `;
        //uniform texture
        let uniformTexture: GPUBindGroupEntry = {
            binding: binding,
            resource: this.textures[E_TextureType.cube].texture.createView({ dimension: 'cube', }),
        };
        //uniform texture layout
        let textureLayout: GPUTextureBindingLayout = {
            sampleType: "float",
            viewDimension: "cube",
            multisampled: false,
        };
        let uniformTextureLayout: GPUBindGroupLayoutEntry =
        {
            binding: binding,
            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
            texture: textureLayout
        };

        this.unifromEntryLayout.push(uniformTextureLayout);
        uniform1.push(uniformTexture);
        binding++;

        ////group bindgin sampler 字符串
        groupAndBindingString += `@group(${this.bindGroupNumber}) @binding(${binding}) var u_Sampler : sampler; \n `;
        //uniform sampler
        let uniformSampler: GPUBindGroupEntry = {
            binding: binding,
            resource: this.defaultSampler,
        };
        //uniform sampler layout
        let uniformSamplerLayout: GPUBindGroupLayoutEntry = {
            binding: binding,
            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
            sampler: {
                type: "filtering",
            },
        };
        this.unifromEntryLayout.push(uniformSamplerLayout);
        uniform1.push(uniformSampler);
        //+1
        binding++;

        let unifromEntryBundle_Common = {
            bindingNumber: binding,
            groupAndBindingString: groupAndBindingString,
            entry: uniform1,
        };
        return unifromEntryBundle_Common;
    }
    generateBundleOutput(template: I_ShaderTemplate, startBinding: number): I_materialBundleOutput {
        let replaceList = new Map<string, string | (() => string)>();
        return this.formatSHT(template, replaceList, startBinding);
    }
    getOpacity_Forward(startBinding: number = 0): I_materialBundleOutput {
        let template: I_ShaderTemplate;
        if (this.cubeType == "sky") {
            template = SHT_materialCubeSkyTextureFS;
        }
        else
            template = SHT_materialCubePositionTextureFS;
        let output = this.generateBundleOutput(template, startBinding);
        output.materialType = "opacity";
        return output;
    }
    getOpacity_MSAA(startBinding: number = 0): I_BundleOfMaterialForMSAA {
        if (this.cubeType == "sky") {
            let MSAA: I_materialBundleOutput = this.generateBundleOutput(SHT_materialCubeSkyTextureFS_MSAA, startBinding);
            let inforForward: I_materialBundleOutput = this.generateBundleOutput(SHT_materialCubeSkyTextureFS_MSAAinfo, startBinding);
            MSAA.materialType = "opacity";
            inforForward.materialType = "opacity";
            return { MSAA, inforForward };
        }
        else {
            let MSAA: I_materialBundleOutput = this.generateBundleOutput(SHT_materialCubePositionTextureFS_MSAA, startBinding);
            let inforForward: I_materialBundleOutput = this.generateBundleOutput(SHT_materialCubePositionTextureFS_MSAAinfo, startBinding);
            MSAA.materialType = "opacity";
            inforForward.materialType = "opacity";
            return { MSAA, inforForward };
        }
    }

    updateSelf(clock: Clock): void {
    }
    saveJSON() {
        throw new Error("Method not implemented.");
    }
    loadJSON(json: any): void {
        throw new Error("Method not implemented.");
    }






}
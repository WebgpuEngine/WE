/**
 * @author TomSong 2025-09-16
 * @description 基础纹理材质
 * @version 1.0.0
 * 
 * 基础纹理材质
 * 1、支持基础颜色
 * 2、支持纹理
 * 3、支持透明
 *    A、alphaTest，alpha值（texture)
 *    B、opacity,整体透明度
 */
import { BaseMaterial, } from "../baseMaterial";

import { Texture } from "../../texture/texture";
import { T_textureSourceType } from "../../texture/base";
import { E_MaterialType, E_TextureType, E_TransparentType, I_BundleOfMaterialForMSAA, I_materialBundleOutput, I_UniformBundleOfMaterial, IV_BaseMaterial } from "../base";
import { E_lifeState } from "../../base/coreDefine";
import { T_uniformOneGroup } from "../../command/base";
import { Clock } from "../../scene/clock";
import { E_shaderTemplateReplaceType, I_ShaderTemplate, I_shaderTemplateAdd, I_shaderTemplateReplace, I_singleShaderTemplate_Final } from "../../shadermanagemnet/base";
import { SHT_materialTexture_TT_FS, SHT_materialTexture_TTP_FS, SHT_materialTexture_TTPF_FS, SHT_materialTextureFS, SHT_materialTextureFS_MSAA } from "../../shadermanagemnet/material/textureMaterial";
import { BaseCamera } from "../../camera/baseCamera";
import { E_resourceKind } from "../../resources/resourcesGPU";
import { I_ShadowMapValueOfDC } from "../../entity/base";
import { SHT_materialColorFS_MSAA_info } from "../../shadermanagemnet/material/colorMaterial";



/**
 * 不透明图像中的alpha值小于1.0时的操作
 */
export type T_opacityAlphaOperations = "discard" | "opacity";
/**
 * 纹理材质的初始化参数 * 
 */
export interface IV_TextureMaterial extends IV_BaseMaterial {
    textures: {
        [name in E_TextureType]?: T_textureSourceType | Texture
    },
    opacityAlphaOperations?: T_opacityAlphaOperations,
}

export class TextureMaterial extends BaseMaterial {



    declare inputValues: IV_TextureMaterial;
    // /**是否上下翻转Y轴 */
    // _upsideDownY: boolean;
    /**纹理收集器 */
    declare textures: {
        [name: string]: Texture
    };
    /**纹理数量 */
    countOfTextures!: number;
    /**自增，纹理加载计算器 */
    countOfTexturesOfFineshed!: number;

    opacityAlphaOperations: T_opacityAlphaOperations = "opacity";

    constructor(input: IV_TextureMaterial) {
        super(input);
        this.kind = E_MaterialType.texture;
        this.textures = {};
        this.countOfTextures = 0;
        this.countOfTexturesOfFineshed = 0;
        if (input.textures)
            this.countOfTextures = Object.keys(input.textures!).length;
        if (input.opacityAlphaOperations) {
            this.opacityAlphaOperations = input.opacityAlphaOperations;
        }
        this._state = E_lifeState.unstart;


        //是否上下翻转Y轴
        // this._upsideDownY = true;
        // if (input.upsideDownY != undefined) {
        //     this._upsideDownY = input.upsideDownY;
        // }

    }
    _destroy() {
        for (let key in this.textures) {
            this.textures[key].destroy();
        }
        this.textures = {};
        this.unifromEntryBundle_Common = undefined;
        this._state = E_lifeState.destroyed;

    }

    async readyForGPU(): Promise<any> {
        this.defaultSampler = this.checkSampler(this.inputValues);
        for (let key in this.inputValues.textures) {
            let texture = this.inputValues.textures[key as keyof IV_TextureMaterial["textures"]]!;
            if (texture instanceof Texture) {
                this.textures[key] = texture;
            }
            else {
                let textureInstace = new Texture({ source: texture }, this.device, this.scene);
                await textureInstace.init(this.scene);
                this.textures[key] = textureInstace;
            }
            // this.countOfTexturesOfFineshed++;

        }
        this._state = E_lifeState.finished;
    }
    setTO(): void {
        this.hasOpaqueOfTransparent = true;
    }
    /**
     * 获取当前材质的uniform组和layout组，必须在材质uniform的第一顺序序列，否则，绑定槽会不同而报错
     * @param startBinding  起始绑定槽位
     * @returns 绑定槽位，组绑定字符串，uniform组，layout组
     */
    getUniformEntryBundleOfCommon(startBinding: number): I_UniformBundleOfMaterial {
        // if (this.unifromEntryBundle_Common != undefined) {
        //     return this.unifromEntryBundle_Common;
        // }
        // else
        {
            let binding = startBinding;
            let groupAndBindingString = "";
            let uniform1: T_uniformOneGroup = [];
            let layout: GPUBindGroupLayoutEntry[] = [];

            {////group binding  texture 字符串
                groupAndBindingString = ` @group(${this.bindGroupNumber}) @binding(${binding}) var u_colorTexture: texture_2d<f32>;\n `;
                //uniform texture
                let uniformTexture: GPUBindGroupEntry = {
                    binding: binding,
                    resource: this.textures[E_TextureType.color].texture.createView(),
                };
                //uniform texture layout
                let uniformTextureLayout: GPUBindGroupLayoutEntry = {
                    binding: binding,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    texture: {
                        sampleType: "float",
                        viewDimension: "2d",
                        // multisampled: false,
                    },
                };
                //添加到resourcesGPU的Map中
                this.scene.resourcesGPU.set(uniformTexture, uniformTextureLayout);
                this.mapList.push({
                    key: uniformTexture,
                    type: E_resourceKind.textureOfString,
                });
                //push到uniform1队列
                uniform1.push(uniformTexture);
                //+1
                binding++;
            }

            {////group bindgin sampler 字符串
                groupAndBindingString += ` @group(${this.bindGroupNumber}) @binding(${binding}) var u_Sampler : sampler; \n `;
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
                        type: this.defaultSamplerBindingType,
                    },
                };
                //添加到resourcesGPU的Map中
                this.scene.resourcesGPU.set(uniformSampler, uniformSamplerLayout);
                this.mapList.push({
                    key: uniformSampler,
                    type: "sampler",
                });
                //push到uniform1队列
                uniform1.push(uniformSampler);
                //+1
                binding++;
            }
            let unifromEntryBundle_Common = {
                bindingNumber: binding,
                groupAndBindingString: groupAndBindingString,
                entry: uniform1,
            };
            return unifromEntryBundle_Common;
        }
    }
    /**
     * 获取前向渲染的不透明材质的bundle，用于生成DC
     * @param startBinding 起始binding
     * @returns 前向渲染的bundle
     */
    getOpacity_Forward(startBinding: number = 0): I_materialBundleOutput {
        return this.getOpaqueCodeFS(SHT_materialTextureFS, startBinding);
    }
    getOpaqueCodeFS(template: I_ShaderTemplate, startBinding: number): I_materialBundleOutput {
        let replaceList = new Map<string, string | (() => string)>();
        let replaceValueFN = () => {
            let replaceString = "";
            if (this._transparent != undefined) {//有透明
                if (this._transparent?.type == E_TransparentType.alpha) { //alpha 透明
                    if (this._transparent.alphaTest != undefined) {//小于test值，discard;大于输出，并写入深度纹理
                        replaceString = ` materialColor.a <= ${this._transparent.alphaTest} `;
                    }
                    else if (this._transparent.opacity != undefined) {//百分比透明
                        replaceString = ` true `;//透明度，discard。(透明度为全部百分比透明)
                    }
                }
            }
            else {//没有透明
                if (this.opacityAlphaOperations === "discard")
                    replaceString = " materialColor.a<1.0 "; //没有透明，所有alpha小于1.0的都discard
                else
                    replaceString = " false ";  //alpha 按照1.0 输出
            }
            return replaceString;
        };
        replaceList.set("$materialColorRule", replaceValueFN);
        return this.formatSHT(template, replaceList, startBinding);
    }
    getOpacity_MSAA(startBinding: number = 0): I_BundleOfMaterialForMSAA {
        let MSAA: I_materialBundleOutput = this.getOpaqueCodeFS(SHT_materialTextureFS_MSAA, startBinding);
        let inforForward: I_materialBundleOutput = this.getOpaqueCodeFS(SHT_materialColorFS_MSAA_info, startBinding);
        return { MSAA, inforForward };
    }
    getOpacity_DeferColorOfMSAA(startBinding: number = 0): I_BundleOfMaterialForMSAA {
        throw new Error("Method not implemented.");
    }
    getOpacity_DeferColor(startBinding: number = 0): I_materialBundleOutput {
        throw new Error("Method not implemented.");
    }
    getFS_TO_MSAA(startBinding: number = 0): I_BundleOfMaterialForMSAA {
        throw new Error("Method not implemented.");
    }
    getFS_TO_DeferColorOfMSAA(startBinding: number = 0): I_BundleOfMaterialForMSAA {
        throw new Error("Method not implemented.");
    }
    getFS_TO_DeferColor(startBinding: number = 0): I_materialBundleOutput {
        throw new Error("Method not implemented.");
    }

    getFS_TT(renderObject: BaseCamera | I_ShadowMapValueOfDC, startBinding: number): I_materialBundleOutput {
        let template = SHT_materialTexture_TT_FS;
        let replaceList = new Map<string, string | (() => string)>();
        replaceList.set("$materialColorRule", () => (this.materialColorRule(this)));
        replaceList.set("$opacityPercent", () => (this.opacityPercent(this)));
        return this.formatSHT(template, replaceList, startBinding);
    }
    getFS_TTPF(renderObject: BaseCamera | I_ShadowMapValueOfDC, startBinding: number): I_materialBundleOutput {
        let template = SHT_materialTexture_TTPF_FS;
        if (renderObject instanceof BaseCamera) {
            let replaceList = new Map<string, string | (() => string)>();
            // replaceList.set("$materialColorRule", this.materialColorRule(this));
            // replaceList.set("$opacityPercent", this.opacityPercent(this));
            replaceList.set("$materialColorRule", () => (this.materialColorRule(this)));
            replaceList.set("$opacityPercent", () => (this.opacityPercent(this)));
            let output = this.formatSHT(template, replaceList, 0);
            // let output = this.formatSHT(template, replaceList, 0,true,renderObject);
            output.shaderTemplateFinal.material.dynamic = true// 因为绑定的uniform有camera的texture，如果resize，会变，所以时动态的
            {//获取当前材质的TTPF的输出uniform bundle 。
                let uniformBundle = this.getUniformEntryBundleOfTTPF(renderObject, output.bindingNumber);
                output.uniformGroup.push(...uniformBundle.entry);
                output.bindingNumber = uniformBundle.bindingNumber;
                output.shaderTemplateFinal.material.groupAndBindingString += uniformBundle.groupAndBindingString;
            }
            return output;
        }
        else {
            throw new Error("Method not implemented.");
        }
    }
    getFS_TO(_startBinding: number): I_materialBundleOutput {
        return this.getOpacity_Forward(_startBinding);
    }
    formatFS_TTP(renderObject: BaseCamera | I_ShadowMapValueOfDC): I_materialBundleOutput {
        let template: I_ShaderTemplate;
        let code: string = "";
        if (renderObject instanceof BaseCamera) {
            //format code 
            template = SHT_materialTexture_TTP_FS;


            let replaceList = new Map<string, string | (() => string)>();
            // replaceList.set("$materialColorRule", this.materialColorRule(this));
            // replaceList.set("$opacityPercent", this.opacityPercent(this));
            replaceList.set("$materialColorRule", () => (this.materialColorRule(this)));
            replaceList.set("$opacityPercent", () => (this.opacityPercent(this)));
            let output = this.formatSHT(template, replaceList, 0);
            return output;
        }
        //light shadow map TT
        else {
            throw new Error("light shadow map 透明 todo");
        }
    }
    materialColorRule(scope: TextureMaterial): string {
        let replaceString = "";
        let opacityPercent: number | false = false;
        if (scope._transparent != undefined) {
            if (scope._transparent?.type == E_TransparentType.alpha) {
                if (scope._transparent.alphaTest != undefined) {//与不透明相反，>test值，discard;大于输出，并写入深度纹理
                    replaceString = ` materialColor.a >= ${scope._transparent.alphaTest} `;
                }
                else if (scope._transparent.opacity != undefined) {
                    replaceString = ` false`;
                    opacityPercent = scope._transparent.opacity;
                }
            }
        }
        else {
            replaceString = " materialColor.a<1.0 ";
        }
        return replaceString;
    };
    opacityPercent(scope: TextureMaterial): string {
        let replaceString = "";
        let opacityPercent: number | false = false;
        if (scope._transparent != undefined) {
            if (scope._transparent?.type == E_TransparentType.alpha) {
                if (scope._transparent.opacity != undefined) {
                    opacityPercent = scope._transparent.opacity;
                }
            }
        }
        if (opacityPercent !== false) {
            replaceString = `  materialColor.a=${opacityPercent}; \n `;
        }
        return replaceString;
    };

    updateSelf(clock: Clock): void {
    }
    saveJSON() {
        throw new Error("Method not implemented.");
    }
    loadJSON(json: any): void {
        throw new Error("Method not implemented.");
    }




}
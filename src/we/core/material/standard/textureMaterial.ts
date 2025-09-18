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
import { textureSourceType } from "../../texture/base";
import { E_TextureType, I_TransparentOfMaterial, IV_BaseMaterial } from "../base";
import { E_lifeState } from "../../base/coreDefine";
import { T_uniformGroup } from "../../command/base";
import { Clock } from "../../scene/clock";
import { E_shaderTemplateReplaceType, I_ShaderTemplate, I_shaderTemplateAdd, I_shaderTemplateReplace, I_singleShaderTemplate_Final } from "../../shadermanagemnet/base";
import { SHT_materialTextureFS_mergeToVS, SHT_materialTextureTransparentFS_mergeToVS } from "../../shadermanagemnet/material/textureMaterial";
import { BaseCamera } from "../../camera/baseCamera";
import { getBundleOfGBufferOfUniformOfDefer } from "../../gbuffers/base";


/**
 * 纹理材质的初始化参数 * 
 */
export interface IV_TextureMaterial extends IV_BaseMaterial {
    textures: {
        [name in E_TextureType]?: textureSourceType | Texture
    },
}

export class TextureMaterial extends BaseMaterial {


    sampler!: GPUSampler;
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


    constructor(input: IV_TextureMaterial) {
        super(input);
        this.textures = {};
        this.countOfTextures = 0;
        this.countOfTexturesOfFineshed = 0;
        if (input.textures)
            this.countOfTextures = Object.keys(input.textures!).length;
        this._state = E_lifeState.unstart;


        //是否上下翻转Y轴
        // this._upsideDownY = true;
        // if (input.upsideDownY != undefined) {
        //     this._upsideDownY = input.upsideDownY;
        // }
        if (input.transparent != undefined) {// && this.input.transparent.opacity != undefined && this.input.transparent.opacity < 1.0)) {//如果是透明的，就设置为透明

            //默认混合
            let transparent: I_TransparentOfMaterial = {
                blend: {
                    color: {
                        srcFactor: "src-alpha",//源
                        dstFactor: "one-minus-src-alpha",//目标
                        operation: "add"//操作
                    },
                    alpha: {
                        srcFactor: "one",//源
                        dstFactor: "one-minus-src-alpha",//目标
                        operation: "add"//操作  
                    }
                }
            };

            if (input.transparent != undefined) {
                this._transparent = input.transparent;
            }
            else {
                this._transparent = transparent;
            }

            if (input.transparent.blend != undefined) {
                this._transparent.blend = input.transparent.blend;
            }
            else {
                this._transparent.blend = transparent.blend;
            }

            if (input.transparent.alphaTest == undefined && input.transparent.opacity == undefined) {//如果没有设置alphaTest,且没有opacity，就设置为0.0
                this._transparent.alphaTest = 0.0;//直接使用texture的alpha，（因为有其他alpha的半透明）；就是不做任何处理。
            }
            else if (input.transparent.alphaTest != undefined && input.transparent.opacity == undefined) {//如果有设置alphaTest，就设置为alphaTest
                this._transparent.alphaTest = input.transparent.alphaTest;//FS 中使用的是alphaTest对应texture的alpha进行比较，小于阈值的= 0.0，大于阈值的不变（因为有可能有大于阈值的半透明）
            }
            else if (input.transparent.alphaTest == undefined && input.transparent.opacity != undefined) {//如果没有设置alphaTest，就设置为opacity
                // this._transparent.alphaTest = input.transparent.opacity;
                this._transparent.opacity = input.transparent.opacity;//FS code中使用的是opacity，而不是alphaTest
            }

        }
    }
    destroy() {
        for (let key in this.textures) {
            this.textures[key].destroy();
        }
        this.textures = {};
        this._state = E_lifeState.destroyed;
        this._destroy = true;
    }

    async readyForGPU(): Promise<any> {
        if (this.inputValues.samplerFilter == undefined) {
            this.sampler = this.device.createSampler({
                magFilter: "linear",
                minFilter: "linear",
            });
        }
        else {
            this.sampler = this.device.createSampler({
                magFilter: this.inputValues.samplerFilter,
                minFilter: this.inputValues.samplerFilter,
            });
        }
        for (let key in this.inputValues.textures) {
            let texture = this.inputValues.textures[key as keyof IV_TextureMaterial["textures"]]!;
            if (texture instanceof Texture) {
                this.textures[key] = texture;
            }
            else {
                let textureInstace = new Texture({ source: texture }, this.device, this.scene);
                await textureInstace.init();
                this.textures[key] = textureInstace;
            }
            // this.countOfTexturesOfFineshed++;
            this._state = E_lifeState.finished;
        }
    }
    checkSamplerBindingType() {
        if (this.sampler == undefined) {
            this.sampler = this.device.createSampler({
                magFilter: "linear",
                minFilter: "linear",
            });
        }
    }
    getOneGroupUniformAndShaderTemplateFinal(camera: BaseCamera, startBinding: number): { uniformGroup: T_uniformGroup, singleShaderTemplateFinal: I_singleShaderTemplate_Final } {
        let template: I_ShaderTemplate;
        let groupAndBindingString: string = "";
        let binding: number = startBinding;
        let uniform1: T_uniformGroup = [];
        let code: string = "";
        ///////////group binding
        ////group binding  texture 字符串
        groupAndBindingString = ` @group(1) @binding(${binding}) var u_colorTexture: texture_2d<f32>;\n `;
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
                multisampled: false,

            },
        };
        //添加到resourcesGPU的Map中
        this.scene.resourcesGPU.set(uniformTexture, uniformTextureLayout)
        //push到uniform1队列
        uniform1.push(uniformTexture);
        //+1
        binding++;

        ////group bindgin sampler 字符串
        groupAndBindingString += ` @group(1) @binding(${binding}) var u_Sampler : sampler; \n `;
        //uniform sampler
        let uniformSampler: GPUBindGroupEntry = {
            binding: binding,
            resource: this.sampler,
        };
        //uniform sampler layout
        let uniformSamplerLayout: GPUBindGroupLayoutEntry = {
            binding: binding,
            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
            sampler: {
                type: "filtering",
            },
        };
        //添加到resourcesGPU的Map中
        this.scene.resourcesGPU.set(uniformSampler, uniformSamplerLayout)
        //push到uniform1队列
        uniform1.push(uniformSampler);
        //+1
        binding++;

        if (this.getTransparent()) {
            let bundle = getBundleOfGBufferOfUniformOfDefer(binding, this.scene, camera);
            uniform1.push(...bundle.uniformGroup);
            groupAndBindingString += bundle.groupAndBindingString;
            binding = bundle.binding;
            template = SHT_materialTextureTransparentFS_mergeToVS;
        }
        else {
            ////////////////shader 模板格式化部分
            template = SHT_materialTextureFS_mergeToVS;
            for (let perOne of template.material!.add as I_shaderTemplateAdd[]) {
                code += perOne.code;
            }
            for (let perOne of template.material!.replace as I_shaderTemplateReplace[]) {
                if (perOne.replaceType == E_shaderTemplateReplaceType.replaceCode) {
                    code = code.replace(perOne.replace, perOne.replaceCode as string);
                }
            }
        }




        let outputFormat: I_singleShaderTemplate_Final = {
            templateString: code,
            groupAndBindingString: groupAndBindingString,
            binding: binding,
            owner: this,
        }
        return { uniformGroup: uniform1, singleShaderTemplateFinal: outputFormat };

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
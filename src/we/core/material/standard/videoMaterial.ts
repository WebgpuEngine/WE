import { BaseMaterial, } from "../baseMaterial";
import { E_MaterialType, E_materialTypeForBindGroup, E_TextureType, E_TransparentType, I_BundleOfMaterialForMSAA, I_materialBundleOutput, I_UniformBundleOfMaterial, IV_BaseMaterial } from "../base";
import { E_lifeState } from "../../base/coreDefine";
import { T_uniformEntries, T_uniformOneGroup } from "../../command/base";
import { Clock } from "../../scene/clock";
import { E_shaderTemplateReplaceType, I_ShaderTemplate, I_shaderTemplateAdd, I_shaderTemplateReplace, I_singleShaderTemplate_Final } from "../../shadermanagemnet/base";
import { IV_OptionVideoTexture, T_modelOfVideo, T_VIdeoSourceType, VideoTexture } from "../../texture/videoTexture";
import { SHT_materialVideoTextureFS, SHT_materialVideoTextureFS_MSAA_info, SHT_materialVideoTextureFS_MSAA } from "../../shadermanagemnet/material/videoMaterial";
import { BaseCamera } from "../../camera/baseCamera";
import { BaseLight } from "../../light/baseLight";
import { I_ShadowMapValueOfDC } from "../../entity/base";
/**
 * 视频材质的初始化参数 * 
 */
export interface IV_VideoMaterial extends IV_BaseMaterial {
    textures: {
        [E_TextureType.video]: T_VIdeoSourceType | VideoTexture
    },
    videoOption?: {
        loop?: boolean,
        // autoplay?: boolean,//默认必须的
        muted?: boolean,
        controls?: boolean,
        waitFor?: "canplaythrough" | "loadedmetadata",
        model?: T_modelOfVideo,
    }
}

export class VideoMaterial extends BaseMaterial {
    declare inputValues: IV_VideoMaterial;
    // /**是否上下翻转Y轴 */
    // _upsideDownY: boolean;
    /**纹理收集器 */
    declare textures: {
        [name: string]: VideoTexture
    };
    /**纹理数量 */
    countOfTextures!: number;
    /**自增，纹理加载计算器 */
    countOfTexturesOfFineshed!: number;


    constructor(input: IV_VideoMaterial) {
        super(input);
        this.kind = E_MaterialType.video;
        this.textures = {};
        this.countOfTextures = 0;
        this.countOfTexturesOfFineshed = 0;
        if (input.textures[E_TextureType.video] == undefined) {
            throw new Error("VideoMaterial must have a video texture");
        }
        this.countOfTextures = Object.keys(input.textures).length;
        this.shtOfMaterialType = {
            opacityForward: SHT_materialVideoTextureFS,
            opacityDefer: SHT_materialVideoTextureFS,
            opacityMSAA: SHT_materialVideoTextureFS_MSAA,
            opacityMSAAInfo: SHT_materialVideoTextureFS_MSAA_info,

            TO_Forward: SHT_materialVideoTextureFS,
            TO_Defer: SHT_materialVideoTextureFS,
            TO_MSAA: SHT_materialVideoTextureFS_MSAA,
            TO_MsaaInfo: SHT_materialVideoTextureFS_MSAA_info,

            TT: undefined,

            TTP: undefined,
            TTPF: undefined,
        };
        this._state = E_lifeState.unstart;
    }
    _destroy(): void {
        for (let key in this.textures) {
            this.textures[key].destroy();
        }
        this.textures = {};
        this._state = E_lifeState.destroyed;
    }

    async readyForGPU(): Promise<any> {
        this.defaultSampler = this.checkSampler(this.inputValues);
        if (this.inputValues.textures[E_TextureType.video] instanceof VideoTexture) {
            this.textures[E_TextureType.video] = this.inputValues.textures[E_TextureType.video] as VideoTexture;
        }
        else {
            let option: IV_OptionVideoTexture = {
                source: this.inputValues.textures[E_TextureType.video] as T_VIdeoSourceType,
            }
            if (this.inputValues.videoOption) {
                option = {
                    ...option,
                    ...this.inputValues.videoOption,
                }
            }
            let video = new VideoTexture(option, this.device);
            await video.init(this.scene);
            this.textures[E_TextureType.video] = video;
        }
        this._state = E_lifeState.finished;
    }
    setTO(): void {
        this.hasOpaqueOfTransparent = false;
    }

   getUniformEntryBundleOfCommon(startBinding: number): { entriesBundle: I_UniformBundleOfMaterial, layoutEntries: GPUBindGroupLayoutEntry[] } {
        let groupAndBindingString: string = "";
        let binding: number = startBinding;

        let uniformEntries: T_uniformOneGroup = [];
        let layoutEntries: GPUBindGroupLayoutEntry[] = [];

        let code: string = "";
        ///////////group binding
        ////group binding  texture 字符串
        //uniform texture
        let uniformTexture: T_uniformEntries;
        //uniform texture layout
        let uniformTextureLayout: GPUBindGroupLayoutEntry
        if (this.textures[E_TextureType.video].texture instanceof GPUTexture) {
            groupAndBindingString = ` @group(${this.bindGroupNumber}) @binding(${binding}) var u_videoTexture: texture_2d<f32>;\n `;//这里的名称是固定的
            uniformTexture = {
                binding: binding,
                resource: this.textures[E_TextureType.video].texture.createView(),
            };
            uniformTextureLayout = {
                binding: binding,
                visibility: GPUShaderStage.FRAGMENT,
                texture: {
                    sampleType: "float",
                    viewDimension: "2d",
                    multisampled: false,
                },
            };

        }
        else // if (this.textures[E_TextureType.video].texture instanceof GPUExternalTexture) 
        {
            this.Dynamic = true;
            groupAndBindingString = `@group(${this.bindGroupNumber}) @binding(${binding}) var u_videoTexture: texture_external;\n `;//这里的名称是固定的
            uniformTexture = ({
                binding: binding,
                // resource: this.textures[E_TextureType.video].getExternalTexture(this.textures[E_TextureType.video])
                label: "videoTexture External模式",
                scope: this.textures[E_TextureType.video],
                getResource: this.textures[E_TextureType.video].getExternalTexture,
            });

            uniformTextureLayout = {
                binding: binding,
                visibility: GPUShaderStage.FRAGMENT,
                externalTexture: {},
            };
            // dynamic = true;
        }
        layoutEntries.push(uniformTextureLayout);
        uniformEntries.push(uniformTexture);
        //+1
        binding++;

        ////group bindgin sampler 字符串
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
        layoutEntries.push(uniformSamplerLayout);
        uniformEntries.push(uniformSampler);
        //+1
        binding++;
        let entriesBundle = {
            bindingNumber: 1,//shader中使用的绑定号，用于绑定uniform参数
            groupAndBindingString,
            entry: uniformEntries
        };
        return {
            entriesBundle,
            layoutEntries,
        };
    }

    override generateBundleOutput(template: I_ShaderTemplate, startBinding: number = 0, materialType: E_materialTypeForBindGroup): I_materialBundleOutput {
        let dynamic: boolean = false;
        if (this.textures[E_TextureType.video].texture instanceof GPUExternalTexture)
            dynamic = true;

        let replaceList = new Map<string, string | (() => string)>();
        let replaceValueFN = () => {
            let replaceString = "";
            if (this.textures[E_TextureType.video].model == "copy") {
                //texture 默认是 'rgba8unorm-srgb'，已经完成解gamma
                replaceString = `materialColor = textureSample(u_videoTexture, u_Sampler, fsInput.uv.xy ); `;
            }
            else {
                //外部texture 是 'rgba8unorm'，需要解gamma到线性空间
                replaceString = `
                                materialColor = textureSampleBaseClampToEdge(u_videoTexture, u_Sampler, vec2f(fsInput.uv.x,1.0-fsInput.uv.y) ); 
                                materialColor =vec4f( pow(materialColor.rgb,vec3f(2.2)),materialColor.a);
                                 `;
            }
            return replaceString;
        };
        replaceList.set("$materialColor", replaceValueFN);
        let output = this.formatSHT(template, replaceList, startBinding, materialType);
        // 如果是动态材质，需要在DrawCommand中添加dynamic属性,并每帧重新生成bind group
        if (dynamic) {
            output.shaderTemplateFinal.material.dynamic = dynamic;
        }
        return output;

    }
    /////////////////////////////////////三个不透明的模板输出/////////////////////////////////////
    override getOpacity_Forward(startBinding: number = 0): I_materialBundleOutput {
        let template = SHT_materialVideoTextureFS;
        return this.generateBundleOutput(template, startBinding, E_materialTypeForBindGroup.opacityForward);
    }
    override getOpacity_MSAA(startBinding: number = 0): I_BundleOfMaterialForMSAA {
        let MSAA: I_materialBundleOutput = this.generateBundleOutput(SHT_materialVideoTextureFS_MSAA, startBinding, E_materialTypeForBindGroup.opacityMSAA);
        let inforForward: I_materialBundleOutput = this.generateBundleOutput(SHT_materialVideoTextureFS_MSAA_info, startBinding, E_materialTypeForBindGroup.opacityMSAAInfo);
        return { MSAA, inforForward };
    }

    override getOpacity_DeferColor(startBinding: number = 0): I_materialBundleOutput {
        return this.getOpacity_Forward(startBinding);
    }
    /////////////////////////////////////三个TO的模板输出/////////////////////////////////////


    // getFS_TO(_startBinding: number): I_materialBundleOutput {
    //     throw new Error("Method not implemented.");
    // }
    // getFS_TO_MSAA(startBinding: number = 0): I_BundleOfMaterialForMSAA {
    //     throw new Error("Method not implemented.");
    // }
    // getFS_TO_DeferColor(startBinding: number = 0): I_materialBundleOutput {
    //     throw new Error("Method not implemented.");
    // }
    /////////////////////////////////////三个透明TT、TTP、TTPF的模板输出/////////////////////////////////////

    // getFS_TT(renderObject: BaseCamera | I_ShadowMapValueOfDC, _startBinding: number): I_materialBundleOutput {
    //     throw new Error("Method not implemented.");
    // }
    getFS_TTPF(renderObject: BaseCamera | I_ShadowMapValueOfDC, startBinding: number): I_materialBundleOutput {
        throw new Error("Method not implemented.");
    }
    formatFS_TTP(renderObject: BaseCamera | I_ShadowMapValueOfDC): I_materialBundleOutput {
        throw new Error("Method not implemented.");
    }

    updateSelf(clock: Clock): void {
        // this.textures[E_TextureType.video].updateSelf();
    }
    saveJSON() {
        throw new Error("Method not implemented.");
    }
    loadJSON(json: any): void {
        throw new Error("Method not implemented.");
    }




}
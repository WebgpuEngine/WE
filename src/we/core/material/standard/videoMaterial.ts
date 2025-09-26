import { BaseMaterial, } from "../baseMaterial";
import { Texture } from "../../texture/texture";
import { T_textureSourceType } from "../../texture/base";
import { E_TextureType, I_materialBundleOutput, IV_BaseMaterial } from "../base";
import { E_lifeState } from "../../base/coreDefine";
import { T_uniformEntries, T_uniformGroup } from "../../command/base";
import { Clock } from "../../scene/clock";
import { E_shaderTemplateReplaceType, I_ShaderTemplate, I_shaderTemplateAdd, I_shaderTemplateReplace, I_singleShaderTemplate_Final } from "../../shadermanagemnet/base";
import { SHT_materialTextureFS_mergeToVS, SHT_materialTextureTransparentFS_mergeToVS } from "../../shadermanagemnet/material/textureMaterial";
import { getBundleOfGBufferOfUniformOfDefer } from "../../gbuffers/base";
import { IV_OptionVideoTexture, T_modelOfVideo, T_VIdeoSourceType, VideoTexture } from "../../texture/videoTexture";
import { SHT_materialVideoTextureFS_mergeToVS } from "../../shadermanagemnet/material/videoMaterial";


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


    sampler!: GPUSampler;
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
        this.textures = {};
        this.countOfTextures = 0;
        this.countOfTexturesOfFineshed = 0;
        if (input.textures[E_TextureType.video] == undefined) {
            throw new Error("VideoMaterial must have a video texture");
        }
        this.countOfTextures = Object.keys(input.textures).length;
        this._state = E_lifeState.unstart;
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
        this.sampler = this.checkSampler(this.inputValues);
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

    getOneGroupUniformAndShaderTemplateFinal(startBinding: number): I_materialBundleOutput {
        let template: I_ShaderTemplate;
        let groupAndBindingString: string = "";
        let binding: number = startBinding;
        let uniform1: T_uniformGroup = [];
        let code: string = "";
        let dynamic: boolean = false;
        ///////////group binding
        ////group binding  texture 字符串
        //uniform texture
        let uniformTexture: T_uniformEntries;
        //uniform texture layout
        let uniformTextureLayout: GPUBindGroupLayoutEntry
        if (this.textures[E_TextureType.video].texture instanceof GPUTexture) {
            groupAndBindingString = ` @group(1) @binding(${binding}) var u_videoTexture: texture_2d<f32>;\n `;//这里的名称是固定的
            uniformTexture = {
                binding: binding,
                resource: this.textures[E_TextureType.video].texture.createView(),
            };
            uniformTextureLayout = {
                binding: binding,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                texture: {
                    sampleType: "float",
                    viewDimension: "2d",
                    multisampled: false,
                },
            };
        }
        else // if (this.textures[E_TextureType.video].texture instanceof GPUExternalTexture) 
        {
            groupAndBindingString = ` @group(1) @binding(${binding}) var u_videoTexture: texture_external;\n `;//这里的名称是固定的
            uniformTexture = ({
                binding: binding,
                // resource: this.textures[E_TextureType.video].getExternalTexture(this.textures[E_TextureType.video])
                label: "videoTexture External模式",
                scopy: this.textures[E_TextureType.video],
                getResource: this.textures[E_TextureType.video].getExternalTexture,
            });

            uniformTextureLayout = {
                binding: binding,
                visibility: GPUShaderStage.FRAGMENT,
                externalTexture: {},
            };
            dynamic = true;
        }

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
                type: this._samplerBindingType,
            },
        };
        //添加到resourcesGPU的Map中
        this.scene.resourcesGPU.set(uniformSampler, uniformSamplerLayout)
        //push到uniform1队列
        uniform1.push(uniformSampler);
        //+1
        binding++;

        // if (this.getTransparent()) {
        //     let bundle = getBundleOfGBufferOfUniformOfDefer(binding, this.scene, camera);
        //     uniform1.push(...bundle.uniformGroup);
        //     groupAndBindingString += bundle.groupAndBindingString;
        //     binding = bundle.binding;
        //     template = SHT_materialTextureTransparentFS_mergeToVS;
        // }
        // else
        {
            ////////////////shader 模板格式化部分
            template = SHT_materialVideoTextureFS_mergeToVS;
            for (let perOne of template.material!.add as I_shaderTemplateAdd[]) {
                code += perOne.code;
            }
            for (let perOne of template.material!.replace as I_shaderTemplateReplace[]) {
                if (perOne.replaceType == E_shaderTemplateReplaceType.replaceCode) {
                    code = code.replace(perOne.replace, perOne.replaceCode as string);
                }
                else if (perOne.replaceType == E_shaderTemplateReplaceType.value) {
                    if (perOne.name == "materialColor") {
                        if (this.textures[E_TextureType.video].model == "copy") {
                            code = code.replace(perOne.replace, `materialColor = textureSample(u_videoTexture, u_Sampler, fsInput.uv );  `);
                        }
                        else {
                            code = code.replace(perOne.replace, `
                                materialColor = textureSampleBaseClampToEdge(u_videoTexture, u_Sampler, vec2f(fsInput.uv.x,1.0-fsInput.uv.y) ); 
                                materialColor =vec4f( pow(materialColor.rgb,vec3f(1.0/2.2)),materialColor.a);
                                 `);
                        }
                    }
                }
            }
        }
        let outputFormat: I_singleShaderTemplate_Final = {
            templateString: code,
            groupAndBindingString: groupAndBindingString,
            binding: binding,
            owner: this,
        }
        // 如果是动态材质，需要在DrawCommand中添加dynamic属性,并每帧重新生成bind group
        if (dynamic) {
            outputFormat.dynamic = dynamic;
        }

        return { uniformGroup: uniform1, singleShaderTemplateFinal: outputFormat };
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
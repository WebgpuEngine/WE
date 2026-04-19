import { weColor4, E_lifeState } from "../../base/coreDefine";
import { isWeColor4 } from "../../base/coreFunction";
import { E_BOLBufferType } from "../../bufferBlock/base";
import { I_pointerCreateParams } from "../../bufferBlock/pointer";
import { BaseCamera } from "../../camera/baseCamera";
import { T_uniformEntries, T_uniformOneGroup } from "../../command/base";
import { I_ShadowMapValueOfDC } from "../../entity/base";
import { Clock } from "../../scene/clock";
import { I_ShaderTemplate } from "../../shadermanagemnet/base";
import { SHT_materialColor_TTP_FS, SHT_materialColor_TT_FS, SHT_materialColorFS, SHT_materialColor_TTPF_FS, SHT_materialColorFS_MSAA, SHT_materialColorFS_MSAA_info } from "../../shadermanagemnet/material/colorMaterial";
import { IV_BaseMaterial, I_materialBundleOutput, I_AlphaTransparentOfMaterial, E_TransparentType, E_MaterialType, I_UniformBundleOfMaterial, E_materialTypeForBindGroup } from "../base";
import { BaseMaterial } from "../baseMaterial";

export interface I_ColorMaterial extends IV_BaseMaterial {
    color: weColor4;
}

export class ColorMaterial extends BaseMaterial {

    override inputValues: I_ColorMaterial;

    _color: weColor4 = [1, 1, 1, 1];
    get Color(): weColor4 {
        return this._color;
    }
    set Color(value: weColor4) {
        this._color = value;
        this.writeUniformBuffer(true);
    }

    constructor(input: I_ColorMaterial) {
        super(input);
        this.kind = E_MaterialType.color;
        this.inputValues = input;
        if (isWeColor4(input.color)) {

            this._color = input.color;
            if (input.color[3] < 1.0 || (input.transparent != undefined && (input.transparent?.type == undefined || input.transparent.type == "alpha"))) {
                //在BaseMaterial中只验证了有transparent参数时
                //colorMaterial 如果没有transparent参数，就需要验证alpha是否小于1.0
                let transparentValue: I_AlphaTransparentOfMaterial | undefined;
                if (input.transparent)
                    transparentValue = input.transparent as I_AlphaTransparentOfMaterial;
                else
                    transparentValue = undefined;
                //如果是透明的，就设置为透明
                let transparent: I_AlphaTransparentOfMaterial = {
                    blend: {
                        color: {
                            operation: "add",//操作
                            srcFactor: "src-alpha",//源
                            dstFactor: "one-minus-src-alpha",//目标
                        },
                        alpha: {
                            operation: "add",//操作  
                            srcFactor: "one",//源
                            dstFactor: "one-minus-src-alpha",//目标
                        }
                    },
                    type: E_TransparentType.alpha,
                };
                this._transparent = transparent;
                if (this._color[3] < 1.0) {//如果alpha<1.0，就设置为alpha
                    //预乘
                }
                else if (transparentValue && transparentValue.opacity && transparentValue.opacity < 1.0) {//如果alpha=1.0，就设置为opacity
                    //预乘

                    this._color = [
                        this._color[0] * transparentValue.opacity,
                        this._color[1] * transparentValue.opacity,
                        this._color[2] * transparentValue.opacity,
                        transparentValue.opacity
                    ];
                }
            }
        }
        else {
            throw new Error("ColorMaterial color is undefined or not Color4");
        }
        this.shtOfMaterialType = {
            opacityForward: SHT_materialColorFS,
            opacityDefer: SHT_materialColorFS,
            opacityMSAA: SHT_materialColorFS_MSAA,
            opacityMSAAInfo: SHT_materialColorFS_MSAA_info,

            TO_Forward: undefined,
            TO_Defer: undefined,
            TO_MSAA: undefined,
            TO_MsaaInfo: undefined,

            TT: SHT_materialColor_TT_FS,

            TTP: SHT_materialColor_TTP_FS,
            TTPF: SHT_materialColor_TTPF_FS,
        };
    }
    async readyForGPU(): Promise<any> {
        this.writeUniformBuffer();
        this._state = E_lifeState.finished;
        // console.log(this._state);
    }
    writeUniformBuffer(update: boolean = false) {
        if (this.uniformPointer == undefined) {
            let pointerParams: I_pointerCreateParams = {
                name: `uniform ${this.kind} material: ${this.UUID}`,
                byteSize: this.getPointerByteSize(16),//4 * 4,最小256字节对齐
                type: E_BOLBufferType.uniform,
                viewType: "f32",//由于data是ArrayBuffer,按照u8处理
                data: {
                    sourceData: {
                        data: this._color,
                    },
                }
            };
            this.uniformPointer = this.scene.pointers.createPointer(pointerParams);
        }
        else {
            this.scene.pointers.updatePointerData(
                this.uniformPointer,
                {
                    sourceData: {
                        data: this._color,
                    },
                }
            );
        }
    }
    /**没有透明中的不透明部分，要不透明，要么全部alpha的透明 */
    setTO(): void {
        this.hasOpaqueOfTransparent = false;
    }
    /**
     * ColorMaterial 的公用uniform，所以返回的都是空数组和空字符串
     * @param startBinding 
     * @returns I_UniformBundleOfMaterial
     */
    getUniformEntryBundleOfCommon(startBinding: number): { entriesBundle: I_UniformBundleOfMaterial, layoutEntries: GPUBindGroupLayoutEntry[] } {
        let binding: number = startBinding;

        let uniformEntries: T_uniformOneGroup = [];
        let layoutEntries: GPUBindGroupLayoutEntry[] = [];

        // let groupAndBindingString: string = ''
        let groupAndBindingString: string = `
        struct color_material_uniform  {
            color: vec4f,
        }
        @group(2) @binding(0) var<uniform> u_color_material_uniform: color_material_uniform;
        `;

        let uniformBuffer: GPUBindGroupEntry = {
            binding: binding,
            resource: this.uniformPointer.gpuBufferView,
            // resource: {
            //     buffer: this.uniformPointer.gpuBuffer,
            //     offset: this.uniformPointer.offset,
            //     size: this.uniformPointer.byteLength
            // },
        };
        let uniformBufferLayout: GPUBindGroupLayoutEntry = {
            binding: binding,
            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
            buffer: {
                type: "uniform",
            },
        };
        layoutEntries.push(uniformBufferLayout);

        //push到uniform1队列
        uniformEntries.push(uniformBuffer);
        //20260311 ,这里必须是新的变量，这个变量会被传递给后续的function，内容会被修改。
        // 如果使用this.unifromEntryBundle_Common，后续的function会修改这个变量，导致错误。
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

    // /**
    //  *  不透明材质的Oqa
    //  * @param _startBinding 
    //  * @returns 
    //  */
    // generateBundleOutput(template: I_ShaderTemplate, _startBinding: number): I_materialBundleOutput {
    //     let replaceList = new Map<string, string | (() => string)>();
    //     let output = this.formatSHT(template, replaceList, _startBinding);
    //     return output;
    //     // let uniform1: T_uniformOneGroup = [];
    //     // let shaderTemplateFinal: I_ShaderTemplate_Final = {};
    //     // for (let i in template) {
    //     //     let perPartSHT = template[i] as I_ShaderTemplate;
    //     //     if (i == "scene") {
    //     //         let shader = this.scene.getShaderCodeOfSHT_SceneOfCamera(perPartSHT);
    //     //         shaderTemplateFinal[i] = shader.scene;
    //     //     }
    //     //     else if (i == "material") {
    //     //         let code: string = "";
    //     //         code += this.convertAddPartOfSHT(perPartSHT.add as I_shaderTemplateAdd[]);
    //     //         for (let perOne of perPartSHT.replace as I_shaderTemplateReplace[]) {
    //     //             if (perOne.replaceType == E_shaderTemplateReplaceType.replaceCode) {
    //     //                 code = code.replace(perOne.replace, perOne.replaceCode as string);
    //     //             }
    //     //             //$color
    //     //             if (perOne.replaceType == E_shaderTemplateReplaceType.value) {
    //     //                 // let replaceValue: string = ` output.color = vec4f(${this.red}, ${this.green}, ${this.blue}, ${this.alpha}); \n`;
    //     //                 // code = code.replace(perOne.replace, replaceValue);
    //     //             }
    //     //         }
    //     //         shaderTemplateFinal[i] = {
    //     //             templateString: code,
    //     //             groupAndBindingString: "",
    //     //             owner: perPartSHT.owner,
    //     //         }
    //     //     }
    //     // }
    //     // return { uniformGroup: uniform1, shaderTemplateFinal, bindingNumber: _startBinding };
    // }

    /////////////////////////////////////三个不透明的模板输出/////////////////////////////////////
    // getOpacity_Forward(startBinding: number = 0): I_materialBundleOutput {
    //     let template = SHT_materialColorFS;
    //     let replaceList = new Map<string, string | (() => string)>();
    //     // replaceList.set("$fsOutputColor", ` output.color = vec4f(${this.red}, ${this.green}, ${this.blue}, ${this.alpha}); \n`);
    //     let output = this.formatSHT(template, replaceList, startBinding);
    //     return output;
    //     // return this.generateBundleOutput(SHT_materialColorFS, startBinding);
    // }

    // getOpacity_MSAA(startBinding: number = 0): I_BundleOfMaterialForMSAA {
    //     let MSAA: I_materialBundleOutput = this.generateBundleOutput(SHT_materialColorFS_MSAA, startBinding);
    //     MSAA.materialType = E_materialTypeForBindGroup.opacityMSAA;
    //     let inforForward: I_materialBundleOutput = this.generateBundleOutput(SHT_materialColorFS_MSAA_info, startBinding);
    //     inforForward.materialType = E_materialTypeForBindGroup.opacityMSAAInfo;
    //     return { MSAA, inforForward };
    // }

    // //同Forward
    // getOpacity_DeferColor(startBinding: number = 0): I_materialBundleOutput {
    //     return this.getOpacity_Forward(startBinding);
    // }
    /////////////////////////////////////三个TO的模板输出/////////////////////////////////////

    // //color 不需要
    // getFS_TO(startBinding: number): I_materialBundleOutput {
    //     throw new Error("Method not implemented.");
    //     // return this.generateBundleOutput(SHT_materialColorFS, startBinding);
    // }
    // //color 不需要
    // getFS_TO_MSAA(startBinding: number = 0): I_BundleOfMaterialForMSAA {
    //     throw new Error("Method not implemented.");
    // }
    // //color 不需要
    // getFS_TO_DeferColor(startBinding: number = 0): I_materialBundleOutput {
    //     throw new Error("Method not implemented.");
    // }



    /////////////////////////////////////三个透明TT、TTP、TTPF的模板输出/////////////////////////////////////
    // getFS_TT(_renderObject: BaseCamera | I_ShadowMapValueOfDC, startBinding: number = 0): I_materialBundleOutput {
    //     let output = this.generateBundleOutput(SHT_materialColor_TT_FS, startBinding, E_materialTypeForBindGroup.TT);
    //     // output.materialType = E_materialTypeForBindGroup.TT;
    //     return output;
    // }
    getFS_TTPF(renderObject: BaseCamera | I_ShadowMapValueOfDC, startBinding: number): I_materialBundleOutput {
        let template = SHT_materialColor_TTPF_FS;
        let replaceList = new Map<string, string | (() => string)>();
        // let replaceValue: string = ` color = vec4f(${this.red}, ${this.green}, ${this.blue}, ${this.alpha}); \n`;
        if (renderObject instanceof BaseCamera) {
            // replaceList.set("$fsOutputColor", replaceValue);
            let output = this.formatSHT(template, replaceList, 0);
            output.shaderTemplateFinal.material.dynamic = true// 因为绑定的uniform有camera的texture，如果resize，会变，所以时动态的
            {//获取当前材质的TTPF的输出uniform bundle 。
                let uniformBundle = this.getUniformEntryBundleOfTTPF(renderObject, output.bindingNumber);
                (output.uniformGroup as T_uniformEntries[]).push(...uniformBundle.entry as T_uniformEntries[]);
                output.bindingNumber = uniformBundle.bindingNumber;
                output.shaderTemplateFinal.material.groupAndBindingString += uniformBundle.groupAndBindingString;
            }
            output.materialType = E_materialTypeForBindGroup.TTPF;
            return output;
        }
        else {
            throw new Error("Method not implemented.");
        }
    }

    /**
     * 格式化TP的shader代码，并返回
     * @param renderObject 渲染对象，相机或阴影映射
     * @returns 
     */
    formatFS_TTP(renderObject: BaseCamera | I_ShadowMapValueOfDC): I_materialBundleOutput {
        let template: I_ShaderTemplate;
        let code: string = "";
        if (renderObject instanceof BaseCamera) {
            //camera 的TTP  SHT
            template = SHT_materialColor_TTP_FS;
            let replaceList = new Map<string, string | (() => string)>();
            // replaceList.set("$fsOutputColor", ` color = vec4f(${this.red}, ${this.green}, ${this.blue}, ${this.alpha}); \n`);
            let output = this.formatSHT(template, replaceList, 0);
            output.materialType = E_materialTypeForBindGroup.TTP;
            return output;
        }
        //light shadow map TT
        else {
            throw new Error("ColorMaterial TTP 级别透明阴影 todo");
        }
    }

    updateSelf(clock: Clock): void {
        // throw new Error("Method not implemented.");
    }
    saveJSON() {
        throw new Error("Method not implemented.");
    }
    loadJSON(json: any): void {
        throw new Error("Method not implemented.");
    }

}
import { weColor4, E_lifeState } from "../../base/coreDefine";
import { isWeColor4 } from "../../base/coreFunction";
import { BaseCamera } from "../../camera/baseCamera";
import { I_dynamicTextureEntryForView, T_uniformGroups, T_uniformOneGroup } from "../../command/base";
import { I_ShadowMapValueOfDC } from "../../entity/base";
import { Clock } from "../../scene/clock";
import { E_shaderTemplateReplaceType, I_ShaderTemplate, I_ShaderTemplate_Final, I_shaderTemplateAdd, I_shaderTemplateReplace, I_singleShaderTemplate_Final } from "../../shadermanagemnet/base";
import { SHT_materialColor_TTP_FS, SHT_materialColor_TT_FS, SHT_materialColorFS, SHT_materialColor_TTPF_FS, SHT_materialColorFS_MSAA, SHT_materialColorFS_MSAA_info } from "../../shadermanagemnet/material/colorMaterial";
import { IV_BaseMaterial, I_materialBundleOutput, I_AlphaTransparentOfMaterial, E_TransparentType, I_BundleOfMaterialForMSAA, E_MaterialType } from "../base";
import { BaseMaterial } from "../baseMaterial";

export interface I_ColorMaterial extends IV_BaseMaterial {
    color: weColor4;
}

export class ColorMaterial extends BaseMaterial {


    declare inputValues: I_ColorMaterial;
    color: weColor4 = [1, 1, 1, 1];
    red: number = 1;
    green: number = 1;
    blue: number = 1;
    alpha: number = 1;

    constructor(input: I_ColorMaterial) {
        super(input);
        this.kind = E_MaterialType.color;
        this.inputValues = input;
        if (isWeColor4(input.color)) {

            this.color = input.color;
            this.red = input.color[0];
            this.green = input.color[1];
            this.blue = input.color[2];
            this.alpha = input.color[3];
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
                if (this.alpha < 1.0) {//如果alpha<1.0，就设置为alpha
                    //预乘
                    this.red = this.red;// * this.alpha;
                    this.green = this.green;// * this.alpha;
                    this.blue = this.blue;// * this.alpha;
                }
                else if (transparentValue && transparentValue.opacity && transparentValue.opacity < 1.0) {//如果alpha=1.0，就设置为opacity
                    //预乘
                    this.red = this.red * transparentValue.opacity;
                    this.green = this.green * transparentValue.opacity;
                    this.blue = this.blue * transparentValue.opacity;
                    this.alpha = transparentValue.opacity;
                }
            }
        }
        else {
            throw new Error("ColorMaterial color is undefined or not Color4");
        }
    }
    async readyForGPU(): Promise<any> {
        this._state = E_lifeState.finished;
        // console.log(this._state);
    }

    setTO(): void {
        this.hasOpaqueOfTransparent = false;
    }

    getOpacity_Forward(startBinding: number = 0): I_materialBundleOutput {
        let template = SHT_materialColorFS;
        let replaceList = new Map<string, string | (() => string)>();
        replaceList.set("$fsOutputColor", ` output.color = vec4f(${this.red}, ${this.green}, ${this.blue}, ${this.alpha}); \n`);
        let output = this.formatSHT(template, replaceList, startBinding);
        return output;
        // return this.getOpaqueCodeFS(SHT_materialColorFS, startBinding);
    }
    /**
     *  不透明材质的Oqa
     * @param _startBinding 
     * @returns 
     */
    getOpaqueCodeFS(template: I_ShaderTemplate, _startBinding: number): I_materialBundleOutput {
        let uniform1: T_uniformOneGroup = [];
        let shaderTemplateFinal: I_ShaderTemplate_Final = {};
        for (let i in template) {
            let perPartSHT = template[i] as I_ShaderTemplate;
            if (i == "scene") {
                let shader = this.scene.getShaderCodeOfSHT_SceneOfCamera(perPartSHT);
                shaderTemplateFinal[i] = shader.scene;
            }
            else if (i == "material") {
                let code: string = "";
                code += this.convertAddPartOfSHT(perPartSHT.add as I_shaderTemplateAdd[]);
                for (let perOne of perPartSHT.replace as I_shaderTemplateReplace[]) {
                    if (perOne.replaceType == E_shaderTemplateReplaceType.replaceCode) {
                        code = code.replace(perOne.replace, perOne.replaceCode as string);
                    }
                    //$color
                    if (perOne.replaceType == E_shaderTemplateReplaceType.value) {
                        let replaceValue: string = ` output.color = vec4f(${this.red}, ${this.green}, ${this.blue}, ${this.alpha}); \n`;
                        code = code.replace(perOne.replace, replaceValue);
                    }
                }
                shaderTemplateFinal[i] = {
                    templateString: code,
                    groupAndBindingString: "",
                    owner: perPartSHT.owner,
                }
            }
        }
        return { uniformGroup: uniform1, shaderTemplateFinal, bindingNumber: _startBinding };
    }
    getOpacity_MSAA(startBinding: number = 0): I_BundleOfMaterialForMSAA {
        let MSAA: I_materialBundleOutput = this.getOpaqueCodeFS(SHT_materialColorFS_MSAA, startBinding);
        let inforForward: I_materialBundleOutput = this.getOpaqueCodeFS(SHT_materialColorFS_MSAA_info, startBinding);
        return { MSAA, inforForward };
    }
    //同MSAA
    getOpacity_DeferColorOfMSAA(startBinding: number = 0): I_BundleOfMaterialForMSAA {
        return this.getOpacity_MSAA(startBinding);
    }
    //同Forward
    getOpacity_DeferColor(startBinding: number = 0): I_materialBundleOutput {
        return this.getOpacity_Forward(startBinding);
    }
    //color 不需要
    getFS_TO(startBinding: number): I_materialBundleOutput {
        throw new Error("Method not implemented.");
        // return this.getOpaqueCodeFS(SHT_materialColorFS, startBinding);
    }
    //color 不需要
    getFS_TO_MSAA(startBinding: number = 0): I_BundleOfMaterialForMSAA {
        throw new Error("Method not implemented.");
    }
    //color 不需要
    getFS_TO_DeferColorOfMSAA(startBinding: number = 0): I_BundleOfMaterialForMSAA {
        throw new Error("Method not implemented.");
    }
    //color 不需要
    getFS_TO_DeferColor(startBinding: number = 0): I_materialBundleOutput {
        throw new Error("Method not implemented.");
    }


    getFS_TT(_renderObject: BaseCamera | I_ShadowMapValueOfDC, startBinding: number = 0): I_materialBundleOutput {
        return this.getOpaqueCodeFS(SHT_materialColor_TT_FS, startBinding);
    }

    getFS_TTPF(renderObject: BaseCamera | I_ShadowMapValueOfDC, startBinding: number): I_materialBundleOutput {
        let template = SHT_materialColor_TTPF_FS;
        let replaceList = new Map<string, string | (() => string)>();


        let replaceValue: string = ` color = vec4f(${this.red}, ${this.green}, ${this.blue}, ${this.alpha}); \n`;
        if (renderObject instanceof BaseCamera) {

            // //格式化SHT  ，同TT
            // for (let perOne of template.material!.add as I_shaderTemplateAdd[]) {
            //     code += perOne.code;
            // }
            // for (let perOne of template.material!.replace as I_shaderTemplateReplace[]) {
            //     if (perOne.replaceType == E_shaderTemplateReplaceType.replaceCode) {
            //         code = code.replace(perOne.replace, perOne.replaceCode as string);
            //     }
            //     //$color
            //     if (perOne.replaceType == E_shaderTemplateReplaceType.value) {
            //         code = code.replace(perOne.replace, replaceValue);
            //     }
            // }
            replaceList.set("$fsOutputColor", replaceValue);
            let output = this.formatSHT(template, replaceList, 0);
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
            replaceList.set("$fsOutputColor", ` color = vec4f(${this.red}, ${this.green}, ${this.blue}, ${this.alpha}); \n`);
            let output = this.formatSHT(template, replaceList, 0);
            return output;
            // let uniform1: T_uniformOneGroup = [];
            // let shaderTemplateFinal: I_ShaderTemplate_Final = {};
            // for (let i in template) {
            //     let perPartSHT = template[i] as I_ShaderTemplate;
            //     if (i == "scene") {
            //         let shader = this.scene.getShaderCodeOfSHT_SceneOfCamera(perPartSHT);
            //         shaderTemplateFinal[i] = shader.scene;
            //     }
            //     else if (i == "material") {
            //         let code: string = "";
            //         //add
            //         code += this.convertAddPartOfSHT(perPartSHT.add as I_shaderTemplateAdd[]);
            //         //replace 
            //         for (let perOne of perPartSHT.replace as I_shaderTemplateReplace[]) {
            //             if (perOne.replaceType == E_shaderTemplateReplaceType.replaceCode) {
            //                 code = code.replace(perOne.replace, perOne.replaceCode as string);
            //             }
            //             if (perOne.replaceType == E_shaderTemplateReplaceType.value) {
            //                 //$OutputColor
            //                 if (perOne.replace == "$OutputColor") {
            //                     let replaceValue: string = ` color = vec4f(${this.red}, ${this.green}, ${this.blue}, ${this.alpha}); \n`;
            //                     code = code.replace(perOne.replace, replaceValue);
            //                 }
            //             }
            //         }
            //         shaderTemplateFinal[i] = {
            //             templateString: code,
            //             groupAndBindingString: "",
            //             owner: this,
            //         }
            //     }
            // }
            // return { uniformGroup: uniform1, shaderTemplateFinal, bindingNumber: 0 };
        }
        //light shadow map TT
        else {
            throw new Error("ColorMaterial TTP 级别透明阴影 todo");
        }
    }
    /**
     * ColorMaterial 的没有uniform，所以返回的都是空数组和空字符串
     * @param startBinding 
     * @returns 
     */
    getUniformEntryBundleOfCommon(startBinding: number): { bindingNumber: number; groupAndBindingString: string; entry: T_uniformOneGroup; } {
        this.unifromEntryBundle_Common = {
            bindingNumber: startBinding,
            groupAndBindingString: "",
            entry: []
        };
        return this.unifromEntryBundle_Common;
    }

    _destroy(): void {
        // throw new Error("Method not implemented.");
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
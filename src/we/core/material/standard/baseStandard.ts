
import { getSampler } from "../../sampler/baseFunction";
import { E_TransparentType, I_AlphaTransparentOfMaterial, IV_BaseStandardMaterial } from "../base";
import { BaseMaterial } from "../baseMaterial";

export abstract class BaseStandardMaterial extends BaseMaterial {
    declare inputValues: IV_BaseStandardMaterial;
    constructor(input?: IV_BaseStandardMaterial) {
        super(input);
        if (input) {
            this.inputValues = input;
            this.checkTransparent(input);
        }
        else
            this.inputValues = {};
        if (input?.samplerDescriptor != undefined && input.samplerBindingType == undefined) {
            throw new Error("samplerDescriptor 必须指定samplerBindingType")
        }

    }
    /**
     * 检查透明状态,如果是透明的，就设置为透明.（color 透明的除外，需要在color material中验证）
     * 默认：alpha透明，没有设置alphaTest，图像本身alpha=0.0的将透明（diacard） ）
     * @param input IV_BaseMaterial  基础材质的初始化参数
     */
    checkTransparent(input: IV_BaseStandardMaterial) {
        if (input.transparent) {
            if (input.transparent.alphaMode == "opaque") {
                this._ToTaTp.opaqueOfTransparent = false;
                this._ToTaTp.alphaOfTransparent = false;
            }
            else if (input.transparent.alphaMode == "alphaTest") {
                this._ToTaTp.opaqueOfTransparent = true;
                this._ToTaTp.alphaOfTransparent = false;
                this._ToTaTp.alphaParams = {
                    alphaMode: "alphaTest",
                    alphaCutOff: input.transparent.alphaCutOff || 0.5,
                }
            }
            else if (input.transparent.alphaMode == "blend") {
                this._ToTaTp.opaqueOfTransparent = true;
                this._ToTaTp.alphaOfTransparent = true;
                let blend: GPUBlendState = {
                    color: {
                        operation: "add",//操作
                        // srcFactor: "src-alpha",//源
                        srcFactor: "one",//源
                        dstFactor: "one-minus-src-alpha",//目标
                    },
                    alpha: {
                        operation: "add",//操作  
                        srcFactor: "one",//源
                        dstFactor: "one-minus-src-alpha",//目标
                    }
                };
                if (input.transparent.blendParams == undefined) {
                    input.transparent.blendParams = { blend };
                }
                else if (input.transparent.blendParams.blend == undefined) {
                    input.transparent.blendParams.blend = blend;
                }
                this._ToTaTp.alphaParams = {
                    alphaMode: "blend",
                    blendParams: input.transparent.blendParams
                }
            }
        }
        else {

        }
    }
    /**
     * 1、检查材质的sampler是否存在，不存在就创建一个。
     * 2、设置this._samplerBindingType:GPUSamplerBindingType
     * @param input IV_BaseMaterial 材质的输入参数
     * @returns GPUSampler 材质的sampler
     */
    override checkSampler(input: IV_BaseStandardMaterial): GPUSampler {
        let { sampler, bindingType } = getSampler(input, this.scene);
        this.defaultSamplerBindingType = bindingType;
        this.defaultSampler = sampler;
        return sampler;
    }

}
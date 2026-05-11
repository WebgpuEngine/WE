
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
        if (input.transparent != undefined) {// && this.input.transparent.opacity != undefined && this.input.transparent.opacity < 1.0)) {//如果是透明的，就设置为透明
            //如果input存在，则使用input的参数
            if (input.transparent != undefined) {
                this._transparent = input.transparent;
            }
            //如果input没有，则判断处理（ColorMaterial 除外）
            if (input.transparent != undefined) {
                if (input.transparent?.type == undefined || input.transparent?.type == E_TransparentType.alpha) {
                    if (this._transparent == undefined) {
                        this._transparent = {} as I_AlphaTransparentOfMaterial;
                    }
                    (this._transparent as I_AlphaTransparentOfMaterial).type = E_TransparentType.alpha;
                    if (input.transparent.blend != undefined)
                        (this._transparent as I_AlphaTransparentOfMaterial).blend = input.transparent.blend;
                    else {
                        //默认混合 add
                        (this._transparent as I_AlphaTransparentOfMaterial).blend = {
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
                        };
                    }
                    if (input.transparent.alphaTest == undefined && input.transparent.opacity == undefined) {//如果没有设置alphaTest,且没有opacity，就设置为0.0
                        (this._transparent as I_AlphaTransparentOfMaterial).alphaTest = 0.0;//直接使用texture的alpha，（因为有其他alpha的半透明）；就是不做任何处理。
                    }
                    else if (input.transparent.alphaTest != undefined && input.transparent.opacity == undefined) {//如果有设置alphaTest，就设置为alphaTest
                        (this._transparent as I_AlphaTransparentOfMaterial).alphaTest = input.transparent.alphaTest;//FS 中使用的是alphaTest对应texture的alpha进行比较，小于阈值的= 0.0，大于阈值的不变（因为有可能有大于阈值的半透明）
                    }
                    else if (input.transparent.alphaTest == undefined && input.transparent.opacity != undefined) {//如果没有设置alphaTest，就设置为opacity
                        // this._transparent.alphaTest = input.transparent.opacity;
                        (this._transparent as I_AlphaTransparentOfMaterial).opacity = input.transparent.opacity;//FS code中使用的是opacity，而不是alphaTest
                    }
                }
            }
        }
    }
}
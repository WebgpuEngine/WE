import { I_Update, Color4 } from "../base/coreDefine";
import { BaseEntity } from "../entity/baseEntity";
import { Scene } from "../scene/scene";
import { I_mipmap } from "../texture/base";

/**透明材质的初始化参数 */
export interface I_TransparentOfMaterial {
    /** 不透明度，float32，默认=1.0 
     * 
     * 如果opacity与alphaTest同时存在，那么alphaTest会覆盖opacity。
    */
    opacity?: number,
    /**alphaTest时要使用的alpha值。如果不透明度低于此值，则不会渲染材质。默认值为0 */
    alphaTest?: number,
    /** blending ，直接使用webGPU的GPUBlendState interface格式
     * 
     * 如果动态更改blending内容，则entity的pipeline需要重新创建
     * opacityopacity
     * The blending behavior for this color target. 
    */
    blend?: GPUBlendState,
    /** color 4f 
     * https://www.w3.org/TR/webgpu/#dom-gpurenderpassencoder-setblendconstant
     * 
     * Sets the constant blend color and alpha values used with "constant" and "one-minus-constant" GPUBlendFactors.
     * If this value is not specified, the value of the color attachment's clear color is used.
     * If the color attachment has no clear color, the value is [0, 0, 0, 0].
    */
    blendConstants?: number[],
}

/**基础材质的初始化参数
     * 
     * 1、代码实时构建，延迟GPU device相关的资源建立需要延迟。需要其顶级使用者被加入到stage中后，才能开始。有其上级类的readyForGPU() 给材料进行GPUDevice的传值
     * 
     * 2、加载场景模式，原则上是通过加载器带入parent参数。todo
     */
export interface IV_BaseMaterial extends I_Update {

    /**指定的fragment code */
    code?: string,

    /**透明材质的初始化参数
     * 默认不透明：没有此参数
     */
    transparent?: I_TransparentOfMaterial,
    /** 
     * 1、简单设置采样器模式，如果有samplerDescriptor设置 ，则忽略此设置 
     * 2、采样器过滤模式，默认为linear
     * 3、在material中设置，会覆盖此类设置。
     */
    samplerFilter?: GPUFilterMode,
    /**采样器。
     * 1、若有此参数，忽略samplerFilter的参数
     * 2、在material中设置，会覆盖此类设置。
     */
    samplerDescriptor?: GPUSamplerDescriptor,
    /** 采样器绑定类型，默认是filtering
     * 如果指定了samplerDescriptor，则必须指定samplerBindingType
     */
    samplerBindingType?: GPUSamplerBindingType,
    
    mipmap?: I_mipmap

}
/**三段式初始化的第二步：init */
export interface IV_BaseMaterialStep2 {
    parent: any,    //20250911 测试更改
    // parent: BaseEntity,
    scene: Scene,//为获取在scene中注册的resource
    // deferRenderDepth: boolean,
    // deferRenderColor: boolean,
    // reversedZ: boolean,
}

/** 材质中使用的texture类型 */
export enum E_TextureType {
    /** 颜色贴图 */
    color = "color",
    /** 立方体贴图 */
    cube = "cube",
    /** 法线贴图 */
    normal = "normal",
    /** 金属度贴图 */
    specular = "specular",
    /** 视差贴图 */
    parallax = "parallax",
    /** 基础颜色贴图 */
    albedo = "albedo",
    /** 金属度贴图 */
    metallic = "metallic",
    /** 粗糙度贴图 */
    roughness = "roughness",
    /** 环境光遮蔽贴图 */
    ao = "ao",
    /** 深度贴图 */
    depthMap = "depthMap",
    /** 视频贴图 */
    video = "video",
}
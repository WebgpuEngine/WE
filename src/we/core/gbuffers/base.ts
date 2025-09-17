import { BaseCamera } from "../camera/baseCamera"
import { T_uniformGroup } from "../command/base"
import { Scene } from "../scene/scene"

/**GBuffer的 GPUTexture集合 
 * 每个camera最终的GBuffer存储位置
*/
export interface I_GBuffer {
    [name: string]: GPUTexture
};
// /**多cameras中，多个摄像机对应的GBuffer */
// export interface I_GBufferGroup {
//     /**name= camera  的 id */
//     [name: string]: I_GBuffer,
// }
/**GBuffer的组成描述 */
export interface I_GBufferStruct {
    format: GPUTextureFormat,
    label: string,
    usage: number
}
export enum E_GBufferNames {
    depth = "depth",
    color = "color",
    id = "id",
    normal = "normal",
    worldPosition = "worldPosition",
    ru_ma_AO = "ru_ma_AO",
}
/**GBuffer的组成描述的集合（最终的集合） */
export interface I_GBufferName {
    [name: string]: I_GBufferStruct
}

/**
 * 预定义的GBuffer变量
 */
export var V_GBufferNames: I_GBufferName = {
    "depth": {
        "format": "depth32float",
        "label": "GBuffer depth attachment:",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING
    },
    "color": {
        "format": "rgba16float",
        "label": "GBuffer color :",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING
    },
    "id": {
        "format": "r32uint",
        "label": "GBuffer id :",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING
    },
    "normal": {
        "format": "rgba8unorm",
        "label": "GBuffer normal :",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING
    },
    "worldPosition": {
        "format": "rgba32float",
        "label": "GBuffer worldPosition :",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING
    },
    "ru_ma_AO": {
        "format": "rgba8unorm",
        "label": "GBuffer ru_ma_AO :",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING
    },
}
/**
 * 预定义的GBuffer和RPD的集合
 */
export interface I_GBufferGroup {
    /**      name = camera 的 id     */
    [name: string]: {
        /** 每个camera最终的GBuffer的渲染描述 */
        RPD: GPURenderPassDescriptor,
        /**
         * 每个camera最终的GBuffer的颜色附件描述
         */
        colorAttachmentTargets: GPUColorTargetState[],
        /** 每个camera最终的GBuffer存储位置 */
        GBuffer: I_GBuffer,
        /** 每个camera最终的GBuffer的深度附件描述 */
        deferRPD?: GPURenderPassDescriptor,
        /** 每个camera延迟渲染的buffer */
        deferGBuffer?: GPUTexture,
    }
}

/**
 * material 获取相机对应的texture的GBuffer的uniform的bundle
 */
export interface I_GBufferBundle {
    binding: number,
    groupAndBindingString: string,
    uniformGroup: T_uniformGroup,
}

/**
 * 获取GBuffer的uniform的bundle 
 * 1、获取相机对应的texture的GBuffer的uniform的bundle
 * 2、根据相机对应的texture的GBuffer的uniform的bundle，获取相机对应的texture的GBuffer的uniform的bundle的字符串
 * 3、Map机对应的texture的GBuffer的uniform的layout
 * @param binding ：绑定的起始位置
 * @param scene ：场景
 * @param camera ：相机
 * @returns I_GBufferBundle
 */
export function getBundleOfGBufferOfUniformOfDefer(binding: number, scene: Scene, camera: BaseCamera): I_GBufferBundle {
    let bundle: I_GBufferBundle = {
        binding: binding,
        groupAndBindingString: "",
        uniformGroup: [],
    }
    Object.entries(V_GBufferNames).forEach(([name, struct]) => {
        let texture = scene.cameraManager.getGBufferTextureByUUID(camera.UUID, name);
        let uniform: GPUBindGroupEntry = {
            binding: binding,
            resource: texture.createView(),
        }
        //uniform texture layout
        let sampleType:GPUTextureSampleType;
        switch (name) {
            case "depth":
                sampleType = "depth";
                break;
            case "color":
                sampleType = "float";
                break;
            case "id":
                sampleType = "uint";
                break;
            case "ru_ma_AO":
                sampleType = "float";
                break;
            case "normal":
                sampleType = "float";
                break;
            case "worldPosition":
                sampleType = "float";
                break;
            default:
                throw new Error("GBuffer name not found");      
                break;
        }
        let uniformTextureLayout: GPUBindGroupLayoutEntry = {
            binding: binding,
            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
            texture: {
                sampleType,
                viewDimension: "2d",
                // multisampled: false,
            },
        };
        //添加到resourcesGPU的Map中
        scene.resourcesGPU.set(uniform, uniformTextureLayout)
        bundle.uniformGroup.push(uniform);
        bundle.groupAndBindingString += `uniform texture2D u_${name} : binding = ${binding};\n`;
        binding++;
    })
    return bundle;
}
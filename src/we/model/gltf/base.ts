import { I_indexGPUBufferBundle, I_vsGPUBufferBundle } from "../../core/command/DrawCommandGenerator";

/**accessor 资源的使用模式 */
export enum E_accessorUseFor {
    vertex,
    indexTriangleList,
    indexTriangleStrip,
    indexTriangleFan,
    indexLineStrip,
    indexLineList,
    indexLineLoop,
    indexPointList,
    samplerAnimation,//animation.samplers
    inverseBindMatrices,//skins[].inverseBindMatrices
}

export type T_accessorBufferSource = GPUBufferBinding | I_vsGPUBufferBundle | I_indexGPUBufferBundle;
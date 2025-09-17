import type { I_uniformBufferPart, uniformEntries, uniformGroup } from "../command/base";

export class ResourceManagerOfGPU {
    //所有为分类的
    resources: Map<any, any> = new Map();


    /////////////////////////////////////////////////////////////////////////////////////////
    //基础单位数据
    /**顶点资源管理器 */
    vertices: Map<any, GPUBuffer> = new Map();
    /**索引资源管理器 */
    indexes: Map<any, GPUBuffer> = new Map();//GPUBuffer默认使用uint32的格式。
    /**单个uniform的ArrayBuffer 对应的GPUBuffer 资源管理器 */
    uniformBuffer: Map<any, GPUBuffer> = new Map();
    /////////////////////////////////////////////////////////////////////////////////////////
    // 单个（每个binding）uniform-->GPUBindGroupLayoutEntry
    /**一个bind group 内的对应的layout */
    entriesToEntriesLayout: Map<uniformEntries, GPUBindGroupLayoutEntry> = new Map();
    /////////////////////////////////////////////////////////////////////////////////////////
    // uniform[]-->BindGroup-->BindGroupLayout
    /**uniformGrpu 对应的 BindGrouop */
    uniformGroupToBindGroup: Map<uniformGroup, GPUBindGroup> = new Map();
    /** bindGroup 对应的layout */
    bindGroupToGroupLayout: Map<GPUBindGroup, GPUBindGroupLayout> = new Map();

    /////////////////////////////////////////////////////////////////////////////////////////
    //shadowmap
    shadowmapOfID2BindGroup: Map<string, GPUBindGroup> = new Map;
    shadowmapOfBindGroup2Layout: Map<GPUBindGroup, GPUBindGroupLayout> = new Map();


    /////////////////////////////////////////////////////////////////////////////////////////
    // pipeline,按照pipeline进行归类，高效渲染使用
    renderPipelineDescriptor: Map<GPURenderPipelineDescriptor, GPURenderPipeline> = new Map();
    computePipelineDescriptor: Map<GPUComputePipelineDescriptor, GPUComputePipeline> = new Map();
    ValueToPipeline: Map<any, GPURenderPipeline | GPUComputePipeline> = new Map();
    pipeline: Map<GPURenderPipeline | GPUComputePipeline, any[]> = new Map();

    /////////////////////////////////////////////////////////////////////////////////////////
    //sytem Group0 
    systemGroup0ByID: Map<string, GPUBindGroup> = new Map();
    systemGroupToGroupLayout: Map<GPUBindGroup, GPUBindGroupLayout> = new Map();

    has(key: any, _kind?: string) {
        if (_kind) {
            if (_kind == "vertices") return this.vertices.has(key);
            else if (_kind == "indexes") return this.indexes.has(key);
            else if (_kind == "uniformBuffer") return this.uniformBuffer.has(key);
        }
        else {
            if (key instanceof GPUBindGroup) {
                return this.bindGroupToGroupLayout.has(key as GPUBindGroup);
            }
            else if (isUniformGroup(key)) {
                return this.uniformGroupToBindGroup.has(key);
            }
            // else if (key instanceof GPUBindGroupEntryImpl || key instanceof I_uniformBufferPartImpl) {
            //     return this.entriesToEntriesLayout.get(key);
            // }
            else if (isGPUBindGroupEntry(key)) {
                return this.entriesToEntriesLayout.has(key);
            }
            else if (isUniformBufferPart(key)) {
                return this.entriesToEntriesLayout.has(key);
            }
            else {
                if (this.resources.has(key))
                    return this.resources.has(key);
            }
        }
        return false;
    }
    get(key: any, _kind?: string) {
        if (_kind) {
            if (_kind == "vertices") return this.vertices.get(key);
            else if (_kind == "indexes") return this.indexes.get(key);
            else if (_kind == "uniformBuffer") return this.uniformBuffer.get(key);

        }
        else {
            if (key instanceof GPUBindGroup) {
                return this.bindGroupToGroupLayout.get(key as GPUBindGroup);
            }
            else if (isUniformGroup(key)) {
                return this.uniformGroupToBindGroup.get(key);
            }
            // else if (key instanceof GPUBindGroupEntryImpl || key instanceof I_uniformBufferPartImpl) {
            //     return this.entriesToEntriesLayout.get(key);
            // }
            else if (isGPUBindGroupEntry(key)) {
                return this.entriesToEntriesLayout.get(key);
            }
            else if (isUniformBufferPart(key)) {
                return this.entriesToEntriesLayout.get(key);
            }
            else {
                if (this.resources.has(key))
                    return this.resources.get(key);
            }
        }
        return false;
    }
    set(key: any, value: any, _kind?: string) {
        if (_kind) {
            if (_kind == "vertices") this.vertices.set(key, value);
            else if (_kind == "indexes") this.indexes.set(key, value);
            else if (_kind == "uniformBuffer") this.uniformBuffer.set(key, value);
        }
        else {
            if (key instanceof GPUBindGroup) {
                this.bindGroupToGroupLayout.set(key as GPUBindGroup, value);
            }
            else if (isUniformGroup(key)) {
                this.uniformGroupToBindGroup.set(key, value);
            }
            //ok
            // else if (key instanceof GPUBindGroupEntryImpl) {
            //     this.entriesToEntriesLayout.set(key, value);
            // }
            // else if (key instanceof I_uniformBufferPartImpl) {
            //     this.entriesToEntriesLayout.set(key, value);
            // }
            else if (isGPUBindGroupEntry(key)) {
                this.entriesToEntriesLayout.set(key, value);
            }
            else if (isUniformBufferPart(key)) {
                this.entriesToEntriesLayout.set(key, value);
            }
            else {
                this.resources.set(key, value);
            }
        }
    }

}

class GPUBindGroupEntryImpl implements GPUBindGroupEntry {
    binding!: number;
    resource!: GPUBindingResource;
}
class I_uniformBufferPartImpl implements I_uniformBufferPart {
    label!: string;
    binding!: number;
    type?: "uniform" | "storage" | undefined;
    usage?: number | undefined;
    size!: number;
    data!: ArrayBuffer;
    update?: boolean | undefined;
}

export function isGPUBindGroupEntry(obj: unknown): obj is GPUBindGroupEntry {
    return (
        typeof obj === 'object' &&
        obj !== null &&
        'binding' in obj &&
        typeof (obj as GPUBindGroupEntry).binding === 'number' &&
        'resource' in obj &&
        typeof (obj as GPUBindGroupEntry).resource === 'object'
    );
}

export function isUniformBufferPart(obj: unknown): obj is I_uniformBufferPart {
    return (
        typeof obj === 'object' &&
        obj !== null &&
        'binding' in obj &&
        typeof (obj as I_uniformBufferPart).binding === 'number' &&
        'size' in obj &&
        typeof (obj as I_uniformBufferPart).size === 'number' &&
        'data' in obj &&
        typeof (obj as I_uniformBufferPart).data === 'object'
    );
}

export function isUniformGroup(obj: unknown): obj is uniformGroup {
    return (
        Array.isArray(obj) &&
        obj.every(isUniformBufferPart || isGPUBindGroupEntry)
    );
}





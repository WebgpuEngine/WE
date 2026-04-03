import { E_renderForDC } from "../base/coreDefine";
import { BaseEntity } from "../entity/baseEntity";
import { Clock } from "../scene/clock";
import { Scene } from "../scene/scene";
import { I_drawMode, I_drawModeIndexed, I_viewport, IV_BaseCommand, T_BindGroupType, T_drawMode } from "./base";
import { I_baseGPUBufferBundle } from "./DrawCommandGenerator";


/**
 * DrawCommand input value 
 */
export interface IV_BaseDrawCommand extends IV_BaseCommand {
    scene: Scene,
    viewport?: I_viewport,
    renderPassDescriptor: GPURenderPassDescriptor | (() => GPURenderPassDescriptor),
    drawMode: T_drawMode,
    system?: {
        UUID: string,
        type: E_renderForDC,//"camera" | "light"
    },
    parent?: BaseEntity,
}

/**
 * 顶点缓冲区入口
 * 用于setVertexBuffer方法
 * 1、buffer：顶点缓冲区
 * 2、offset：顶点缓冲区中的偏移量
 * 3、size：顶点缓冲区中的数据大小
 */
export interface I_VertexBufferEntry {
    /** 顶点缓冲区名称
     * 20260316增加，目的动态更新vertex GPUBuffer使用。不推荐使用动态更新vertex GPUBuffer，有写入成本。之后会建立dynamicMesh 类。
     */
    name?: string,
    buffer: GPUBuffer,
    offset?: number,
    byteSize?: number,
}
export type I_IndexBufferEntry = I_VertexBufferEntry;

export abstract class BaseDrawCommand {
    _isDestroy: boolean = false;
    /** 
     * 1、owner=true,会释放GPU的重资源
     * 2、owner=false,不会释放GPU的重资源，由resourcesGPU管理
     */
    isOwner: boolean = false;
    /**bind group 是否动态更新,例如：GPUTexture的注销与重建(外部模式的video等) */
    dynamic: boolean = false;
    drawMode: T_drawMode;
    scene: Scene;
    clock: Clock;
    label: string;
    // rawUniform!: boolean;
    device!: GPUDevice;
    renderPassDescriptor!: GPURenderPassDescriptor | (() => GPURenderPassDescriptor);
    vertexBuffers: I_VertexBufferEntry[] = [];
    indexBuffer!: I_VertexBufferEntry | undefined;
    indexFormat: GPUIndexFormat = "uint32";
    bindGroups: T_BindGroupType[] = [];//GPUBindGroup[] = [];
    pipeline!: GPURenderPipeline;

    inputValues!: IV_BaseDrawCommand;

    /**
     * 系统bindGroup 0，用于绑定组1的更新（uniform）
     * 用于camera和light shadow map
     */
    system: {
        UUID: string,
        type: E_renderForDC,//"camera" | "light"
    } | undefined;
    /**
     * 20251225 增加，用于entity merge instance 模式
     * 父实体，用于bingGroup 1 的更新（uniform），用于instance模式（M*N）
     * 非instance模式下，为undefined
     * 非BaseEntity的子类，为undefined
     */
    parent?: BaseEntity;

    constructor(input: IV_BaseDrawCommand) {
        this.scene = input.scene;
        this.clock = this.scene.clock;
        this.label = input.label;
        this.device = input.device;
        this.drawMode = input.drawMode;
        this.renderPassDescriptor = input.renderPassDescriptor;
        if (input.system)
            this.system = input.system;
        if (input.parent)
            this.parent = input.parent;
    }
    abstract destroy(): void;
    get IsDestroy() {
        return this._isDestroy;
    }
    set IsDestroy(v: boolean) {
        this._isDestroy = v;
    }
    /**
     * 完整的绘制命令编码
     * @returns GPUCommandBuffer
     */
    update(): GPUCommandBuffer {
        let device = this.device;
        /**
         * 1、动态更新bind group：适用于GPUTexture的注销与重建(外部模式的video等)等
         * 2、增加一个判断pointer是否有更新过的机制。
         *    A、unix时间戳判断pointer是否有更新过（BOL的rebulid）。
         */
        // if (this.dynamic === true) {
        //     this.generateBindGroup();
        // }
        const commandEncoder = device.createCommandEncoder({ label: this.label });
        let passEncoder: GPURenderPassEncoder;
        if (typeof this.renderPassDescriptor === "function")
            passEncoder = commandEncoder.beginRenderPass(this.renderPassDescriptor());
        else
            passEncoder = commandEncoder.beginRenderPass(this.renderPassDescriptor);
        passEncoder.setPipeline(this.pipeline);
        this.doEncoder(passEncoder);
        passEncoder.end();
        const commandBuffer = commandEncoder.finish();
        return commandBuffer;
    }

    /**
     * 绘制命令编码
     * @param passEncoder 
     */
    doEncoder(passEncoder: GPURenderPassEncoder) {
        for (let i in this.vertexBuffers) {
            const verticesBuffer = this.vertexBuffers[i];
            if (verticesBuffer.offset !== undefined && verticesBuffer.byteSize !== undefined)
                passEncoder.setVertexBuffer(parseInt(i), verticesBuffer.buffer, verticesBuffer.offset, verticesBuffer.byteSize);//四个参数： slot, buffer, offset, size
            else
                passEncoder.setVertexBuffer(parseInt(i), verticesBuffer.buffer);//四个参数： slot, buffer, offset, size
        }
        if (this.inputValues.viewport) {
            let minDepth = this.inputValues.viewport.minDepth == undefined ? 0 : this.inputValues.viewport.minDepth;
            let maxDepth = this.inputValues.viewport.maxDepth == undefined ? 1 : this.inputValues.viewport.maxDepth;

            passEncoder.setViewport(this.inputValues.viewport.x, this.inputValues.viewport.y, this.inputValues.viewport.width, this.inputValues.viewport.height, minDepth, maxDepth);
        }

        // // 如果有system(camera,light)，则绑定system的bindGroup0
        // if (this.system !== undefined) {
        //     /**
        //      * 目标：
        //      * 1、为DC绑定camera的bindGroup0（动态增加光源的阴影贴图后，shadowmap textture 会重建，原来绑定的会失效）
        //      * 2、透明的shadowmap渲染，预计也可能有类似的问题。（如果是copy 到公用的uniform depth texture的方式，应该没有此问题）todo
        //      */
        //     if (this.system.type === E_renderForDC.camera) {
        //         let bindGroupBundle = this.scene.getSystemBindGroupAndBindGroupLayoutForZero(this.system.UUID, this.system.type);
        //         this.bindGroups[0] = bindGroupBundle.bindGroup;
        //     }
        // }
        // // 如果有parent(entity)，则绑定parent的bindGroup0; PP的DC也有parent
        // if (this.parent !== undefined && this.parent.type === "entity") {
        //     let bindGroupBundle = this.parent.getBindGroupAndBindGroupLayout();
        //     this.bindGroups[1] = bindGroupBundle.bindGroup;

        // }

        for (let i in this.bindGroups) {
            if (this.bindGroups[i] != undefined)
                passEncoder.setBindGroup(parseInt(i), this.bindGroups[i]);
        }

        // 绘制实例 :函数返回多个instance数组(merge instance模式).主要的工作模式
        if (typeof this.drawMode === "function") {
            if (this.system !== undefined) {
                let drawModeTemp: I_drawMode[] | I_drawModeIndexed[] = this.drawMode(this.system.UUID, this.system.type);
                this.drawInstacnceArray(passEncoder, drawModeTemp);
            }
            else {
                throw new Error("drawMode is  function and  must be have system input value ");
            }
        }
        // 绘制实例 :多个instance数组。测试模拟merge
        else if (Array.isArray(this.drawMode)) {
            this.drawInstacnceArray(passEncoder, this.drawMode);
        }
        // 绘制实例 :单个instance。测试模拟single instance模式，raw模式
        else {
            this.drawInstacnce(passEncoder, this.drawMode);
        }
    }
    drawInstacnceArray(passEncoder: GPURenderPassEncoder, drawMode: I_drawMode[] | I_drawModeIndexed[]) {
        for (let i in drawMode) {
            this.drawInstacnce(passEncoder, drawMode[i]);
        }
    }
    /** 绘制实例 :单个instance*/
    drawInstacnce(passEncoder: GPURenderPassEncoder, drawMode: I_drawMode | I_drawModeIndexed) {
        if ("vertexCount" in drawMode) {
            const count = drawMode.vertexCount;
            let instanceCount = 1;
            let firstIndex = 0;
            let firstInstance = 0;
            if ("instanceCount" in drawMode) {
                instanceCount = drawMode.instanceCount as number;
            }
            if ("firstIndex" in drawMode) {
                firstIndex = drawMode.firstIndex as number;
            }
            if ("firstInstance" in drawMode) {
                firstInstance = drawMode.firstInstance as number;
            }

            passEncoder.draw(count, instanceCount, firstIndex, firstInstance);

        }
        else if ("indexCount" in drawMode) {
            if (this.indexBuffer === undefined) {
                console.warn("indexBuffer is undefined");
                return;
            }
            const indexCount = drawMode.indexCount;
            let instanceCount = 1;
            let firstIndex = 0;
            let firstInstance = 0;
            let baseVertex = 0;
            if ("instanceCount" in drawMode) {
                instanceCount = drawMode.instanceCount as number;
            }
            if ("firstIndex" in drawMode) {
                firstIndex = drawMode.firstIndex as number;
            }
            if ("firstInstance" in drawMode) {
                firstInstance = drawMode.firstInstance as number;
            }
            if ("baseVertex" in drawMode) {
                baseVertex = drawMode.baseVertex as number;
            }
            passEncoder.setIndexBuffer(this.indexBuffer.buffer, this.indexFormat, this.indexBuffer.offset, this.indexBuffer.byteSize);// 'uint32');
            passEncoder.drawIndexed(indexCount, instanceCount, firstIndex, baseVertex, firstInstance);
        }
        else {
            // throw new Error("draw 模式设置错误");
            console.error("draw 模式设置错误,label=", this.inputValues.label);
        }
    }
    /**
     * 提交单次命令
     */
    submit() {
        // 检查动态drawMode的数组长度是否为空
        if (typeof this.drawMode === "function") {
            let drawModeTemp: I_drawMode[] | I_drawModeIndexed[];// = this.drawMode();
            if (this.system !== undefined) {
                drawModeTemp = this.drawMode(this.system.UUID, this.system.type);
                if (drawModeTemp.length === 0) {
                    return;
                }
            }
            else {
                throw new Error("drawMode is  function and  must be have system input value ");
            }
        }
        let commandBuffer = this.update()
        this.device.queue.submit([commandBuffer]);
    }
    /**
    * 合批开始，获取passEncoder和commandEncoder
    * @returns 
    */
    doEncoderStart(): { passEncoder: GPURenderPassEncoder, commandEncoder: GPUCommandEncoder } {
        const commandEncoder = this.device.createCommandEncoder({ label: "Draw Command :commandEncoder" });
        let passEncoder;
        if (typeof this.renderPassDescriptor === "function")
            passEncoder = commandEncoder.beginRenderPass(this.renderPassDescriptor());
        else
            passEncoder = commandEncoder.beginRenderPass(this.renderPassDescriptor);
        passEncoder.setPipeline(this.pipeline);
        return { passEncoder, commandEncoder };
    }
    /**
     * 合批结束，提交commandBuffer
     * @param passEncoder 
     * @param commandEncoder 
     */
    dotEncoderEnd(passEncoder: GPURenderPassEncoder, commandEncoder: GPUCommandEncoder): GPUCommandBuffer {
        passEncoder.end();
        const commandBuffer = commandEncoder.finish();
        return commandBuffer;
        // this.device.queue.submit([commandBuffer]);
    }
    abstract generateBindGroup(): any

}
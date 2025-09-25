import type { I_drawMode, I_drawModeIndexed, I_PipelineStructure, IV_BaseCommand } from "./base";
/**
 * https://www.w3.org/TR/webgpu/#ref-for-dom-gpurenderpassencoder-setviewport%E2%91%A1
 */
export interface I_viewport {
    x: number,
    y: number,
    width: number,
    height: number,
    minDepth: number,
    maxDepth: number
}

export interface IV_DrawCommand extends IV_BaseCommand {
    // /** label */
    // label: string,
    // device: GPUDevice,
    pipeline: GPURenderPipeline,
    vertexBuffers: GPUBuffer[],
    indexBuffer?: GPUBuffer,
    uniform?: GPUBindGroup[],
    viewport?: I_viewport,
    renderPassDescriptor: () => GPURenderPassDescriptor,
    drawMode: I_drawMode | I_drawModeIndexed,
    dynamic: boolean,

}

export class DrawCommand {

    dynamic: boolean = false;
    label!: string;
    rawUniform!: boolean;
    device!: GPUDevice;

    pipeline!: GPURenderPipeline;
    /**
     * 不使用“auto”布局，需要手动创建布局。(不使用auto布局，可以bindgroup0可以共享）
     */
    pipelineLayout: GPUPipelineLayout | "auto" = "auto";
    renderPassDescriptor: () => GPURenderPassDescriptor;// GPURenderPassDescriptor;

    vertexBuffers!: GPUBuffer[];
    indexBuffer!: GPUBuffer;

    bindGroups: GPUBindGroup[] = [];
    // bindGroupDescriptors: GPUBindGroupDescriptor[] = [];
    // bindGroupLayouts: GPUBindGroupLayout[] = [];
    // bindGroupLayoutDescriptors: GPUBindGroupLayoutDescriptor[] = [];

    drawMode: I_drawMode | I_drawModeIndexed

    _isDestroy: boolean = false;

    _inputValues: IV_DrawCommand;

    cacheFlagPipeline!: I_PipelineStructure;

    constructor(inputValues: IV_DrawCommand) {
        this._inputValues = inputValues;
        this.label = inputValues.label;
        this.device = inputValues.device;
        this.pipeline = inputValues.pipeline;
        this.vertexBuffers = inputValues.vertexBuffers;
        if (inputValues.indexBuffer) this.indexBuffer = inputValues.indexBuffer;
        if (inputValues.uniform) this.bindGroups = inputValues.uniform;
        this.drawMode = inputValues.drawMode;
        this.renderPassDescriptor = inputValues.renderPassDescriptor;
        if (inputValues.dynamic && inputValues.dynamic === true) this.dynamic = true;
    }
    destroy() { }
    /**
     * 完整的绘制命令编码
     * @returns GPUCommandBuffer
     */
    update(): GPUCommandBuffer {
        let device = this.device;
        const commandEncoder = device.createCommandEncoder({ label: "Draw Command :commandEncoder" });
        const passEncoder = commandEncoder.beginRenderPass(this.renderPassDescriptor());
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
            passEncoder.setVertexBuffer(parseInt(i), verticesBuffer);
        }
        if (this._inputValues.viewport) {
            let minDepth = this._inputValues.viewport.minDepth == undefined ? 0 : this._inputValues.viewport.minDepth;
            let maxDepth = this._inputValues.viewport.maxDepth == undefined ? 1 : this._inputValues.viewport.maxDepth;

            passEncoder.setViewport(this._inputValues.viewport.x, this._inputValues.viewport.y, this._inputValues.viewport.width, this._inputValues.viewport.height, minDepth, maxDepth);
        }

        for (let i in this.bindGroups) {
            passEncoder.setBindGroup(parseInt(i), this.bindGroups[i]);
        }


        if ("vertexCount" in this.drawMode) {
            const count = this.drawMode.vertexCount;
            let instanceCount = 1;
            let firstIndex = 0;
            let firstInstance = 0;
            if ("instanceCount" in this.drawMode) {
                instanceCount = this.drawMode.instanceCount as number;
            }
            if ("firstIndex" in this.drawMode) {
                firstIndex = this.drawMode.firstIndex as number;
            }
            if ("firstInstance" in this.drawMode) {
                firstInstance = this.drawMode.firstInstance as number;
            }

            passEncoder.draw(count, instanceCount, firstIndex, firstInstance);

        }
        else if ("indexCount" in this.drawMode) {
            const indexCount = this.drawMode.indexCount;
            let instanceCount = 1;
            let firstIndex = 0;
            let firstInstance = 0;
            let baseVertex = 0;
            if ("instanceCount" in this.drawMode) {
                instanceCount = this.drawMode.instanceCount as number;
            }
            if ("firstIndex" in this.drawMode) {
                firstIndex = this.drawMode.firstIndex as number;
            }
            if ("firstInstance" in this.drawMode) {
                firstInstance = this.drawMode.firstInstance as number;
            }
            if ("baseVertex" in this.drawMode) {
                baseVertex = this.drawMode.baseVertex as number;
            }
            passEncoder.setIndexBuffer(this.indexBuffer, 'uint32');
            passEncoder.drawIndexed(indexCount, instanceCount, firstIndex, baseVertex, firstInstance);
        }
        else {
            // throw new Error("draw 模式设置错误");
            console.error("draw 模式设置错误,label=", this._inputValues.label);
        }
    }
    /**
     * 提交单次命令
     */
    submit() {
        let commandBuffer = this.update()
        this.device.queue.submit([commandBuffer]);
    }
    /**
     * 获取pipeline和renderPassDescriptor、group数量、vertex属性buffer数量
     * @returns I_PipelineStructure
     */
    getPipeLineStructure(): I_PipelineStructure {
        if (this.cacheFlagPipeline == undefined) {
            this.cacheFlagPipeline = {
                pipeline: this.pipeline,
                groupCount: this.bindGroups.length,
                attributeCount: this.vertexBuffers.length,
            }
        }
        return this.cacheFlagPipeline;

    }
    /**
     * 合批开始，获取passEncoder和commandEncoder
     * @returns 
     */
    doEncoderStart(): { passEncoder: GPURenderPassEncoder, commandEncoder: GPUCommandEncoder } {
        const commandEncoder = this.device.createCommandEncoder({ label: "Draw Command :commandEncoder" });
        const passEncoder = commandEncoder.beginRenderPass(this.renderPassDescriptor());
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
}
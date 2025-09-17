import type { IV_BaseCommand } from "./base";

export abstract class BaseCommand {
    /** webGPU 的device */
    device!: GPUDevice;
    rawUniform!: boolean;

    /***pipeline 句柄 */
    pipeline!: GPURenderPipeline | GPUComputePipeline;


    pipelineLayout: GPUPipelineLayout | "auto" = "auto";

    bindGroupLayout!: GPUBindGroupLayout;

    bindGroups: GPUBindGroup[] = [];
    bindGroupDescriptors: any[] = [];
    // bindGroupDescriptors: GPUBindGroupDescriptor[] = [];
    bindGroupLayouts: GPUBindGroupLayout[] = [];
    bindGroupLayoutDescriptors: any[] = [];
    // bindGroupLayoutDescriptors: GPUBindGroupLayoutDescriptor[] = [];


    _isDestroy: boolean = false;
    label!: string;
    _inputValues: IV_BaseCommand;

    constructor(inputValues: IV_BaseCommand) {
        this._inputValues = inputValues;
        this.device = inputValues.device;
        this.label = inputValues.label;
    }
    abstract init(): any
    abstract destroy(): any
    set isDestroy(visable: boolean) {
        this._isDestroy = visable;
    }
    get isDestroy() {
        return this._isDestroy;
    }

    abstract update():GPUCommandBuffer
}

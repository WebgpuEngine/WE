import { isArrayBuffer } from "../command/baseFunction";
import { Clock } from "../scene/clock";
import { E_BufferType } from "./base";
import { I_pointerInfoInBOL } from "./BOL";
import { BlockPointerCoordinator } from "./BPC";

/** 指针数据视图类型 */
export type T_pointerDataView = Uint8Array | Int8Array | Uint16Array | Int16Array | Uint32Array | Int32Array | Float32Array;
/** 指针数据类型 */
export type T_pointerDataType = "i8" | "u8" | "i16" | "u16" | "i32" | "u32" | "f32" | "array";

/** 指针结构 */
export interface I_pointerStruct {
    ////////////////////////////指针数据//////////////////////////
    pointerID: number;
    type: E_BufferType;
    name: string;
    viewType: T_pointerDataType;
    /** 最后写入时间 
     * 1、默认值为0，未写入过
    */
    writeTime: number;
    ////////////////////////////BOL View//////////////////////////
    cpuBufferView: T_pointerDataView
    gpuBufferView: GPUBufferBinding;
    ////////////////////////////BOL 数据//////////////////////////
    /** 所属BOL的BlockID
     * 1、为后期跨Block进行内存调度适用
     */
    BolID: number;
    offset: number;
    byteLength: number;
    cpuBuffer: ArrayBuffer;
    gpuBuffer: GPUBuffer;

}



/** 指针数据参数 */
export interface I_pointerDataParams {
    type: T_pointerDataType;
    /** 指针数据视图或数组 */
    buffer?: T_pointerDataView | number[] | ArrayBuffer;
    // /** TypedArray.set()中的偏移量 */
    // offset?: number;
    // /** 指针数据长度 */
    // byteLength?: number;
}
/** 创建指针参数 */
export interface I_pointerCreateParams {
    /** 指针ID 
     * 1、纯新建，没有；
     * 2、resize时，有；
    */
    pointerID?: number;
    name: string;
    byteSize: number;
    data: I_pointerDataParams;
    /** 指针数据类型，适配到相同类型的BOL的Block */
    type: E_BufferType;
}
/**
 * Pointer在scene中创建，全局唯一；
 * 
 * 目标：
 * 1、提供：创建(分配)、释放(释放内存)、resize(调整大小)、
 * 2、GPU侧不需要管理，直接适用GPUBufferBinding即可；
 * 3、GPU侧有两种访问方式
 *   A、静态：直接使用GPUBufferBinding，无变化的情况
 *   B、动态：在DC等使用者中通过箭头函数动态获取GPUBufferBinding：
 *     a、 数据有resize操作，需要动态调整GPUBufferBinding。
 *     b、 BOL进行内存块调度，优化CPU到GPU的数据传输时（如：优化批量写入）。(此种情况，BOL的block一定是动态情况)
 * 4、初期不考虑CPU侧的跨BOL的内存管理，调度范围限制在BOL的Block内。
 */
export class Pointers {

    name: string = 'pointer';
    parent: BlockPointerCoordinator;
    pointers: Map<number, I_pointerStruct> = new Map();
    /** 指针ID集合
     * 1、设计为自增，所以需要记录最后一个ID。
     * 2、ID删除后，也不再使用
     */
    pointerID: Set<number> = new Set();
    /** 最后一个指针ID */
    lastPointerID: number = 0;
    clock: Clock;

    constructor(bpc: BlockPointerCoordinator) {
        this.parent = bpc;
        this.clock = bpc.scene.clock;
    }
    /** 创建指针ID */
    createPointerID() {
        let id = this.lastPointerID;
        do {
            id = this.lastPointerID++;
        } while (this.pointerID.has(id));
        this.pointerID.add(id);
        return id;
    }
    getPointer(id: number): I_pointerStruct | undefined {
        return this.pointers.get(id);
    }
    /** 创建指针 */
    createPointer(params: I_pointerCreateParams): I_pointerStruct | false {
        /**
         * 1、创建pointerID；
         * 2、分配内存
         *    2.1、根据类型发送到BPC->BOL，分配内存；返回指针信息
         *    2.2、创建view
         * 3、在pointers中记录指针信息；
         * 4、如果有初始化数据，写入BOL
         * 5、返回指针信息；
         */
        //1、创建pointerID；
        let pointerID: number;
        if (params.pointerID) {
            pointerID = params.pointerID;
        } else {
            pointerID = this.createPointerID();
        }
        //2.1、分配内存
        let pointerInfo = this.parent.allocatePointerBOL(pointerID, params);

        //2.2、创建view
        let cpuBufferView: T_pointerDataView;
        switch (params.data.type) {
            case "i8":
                cpuBufferView = new Int8Array(pointerInfo.cpuBuffer, pointerInfo.offset, pointerInfo.byteLength);
                break;
            case "u8":
                cpuBufferView = new Uint8Array(pointerInfo.cpuBuffer, pointerInfo.offset, pointerInfo.byteLength);
                break;
            case "i16":
                cpuBufferView = new Int16Array(pointerInfo.cpuBuffer, pointerInfo.offset, pointerInfo.byteLength);
                break;
            case "u16":
                cpuBufferView = new Uint16Array(pointerInfo.cpuBuffer);
                break;
            case "i32":
                cpuBufferView = new Int32Array(pointerInfo.cpuBuffer, pointerInfo.offset, pointerInfo.byteLength);
                break;
            case "u32":
                cpuBufferView = new Uint32Array(pointerInfo.cpuBuffer, pointerInfo.offset, pointerInfo.byteLength);
                break;
            case "f32":
                cpuBufferView = new Float32Array(pointerInfo.cpuBuffer, pointerInfo.offset, pointerInfo.byteLength);
                break;
            default:
                cpuBufferView = new Uint8Array(pointerInfo.cpuBuffer, pointerInfo.offset, pointerInfo.byteLength);
                break;
        }
        let gpuBufferView: GPUBufferBinding = {
            buffer: pointerInfo.gpuBuffer,
            offset: pointerInfo.offset,
            size: pointerInfo.byteLength,
        };
        let perOnePointer: I_pointerStruct = {
            pointerID,
            name: params.name,
            type: params.type,
            viewType: params.data.type,

            cpuBufferView,
            gpuBufferView,

            byteLength: pointerInfo.byteLength,
            offset: pointerInfo.offset,
            BolID: pointerInfo.BolID,
            writeTime: this.clock.last,
            cpuBuffer: pointerInfo.cpuBuffer,
            gpuBuffer: pointerInfo.gpuBuffer,
        };
        //3、在pointers中记录指针信息；
        this.pointers.set(pointerID, perOnePointer);

        //4、如果有初始化数据，写入BOL
        if (params.data.buffer) {
            this.updatePointerData(pointerID, params.data);
        }

        //5、返回指针信息；
        return perOnePointer;
    }
    /** 更新指针数据 */
    updatePointerData(pointerID: number, params: I_pointerDataParams) {
        let pointer = this.pointers.get(pointerID);
        if (pointer) {
            if (Array.isArray(params.buffer)) {
                pointer.cpuBufferView.set(params.buffer);
            }
            else {
                if (ArrayBuffer.isView(params.buffer)) {
                    pointer.cpuBufferView.set(params.buffer as ArrayBufferView as typeof pointer.cpuBufferView);
                }
                else if (isArrayBuffer(params.buffer)) {
                    let u8ViewOfCopyFrom = new Uint8Array(params.buffer as ArrayBuffer);
                    let u8ViewOfCopyTo = new Uint8Array(pointer.cpuBuffer, pointer.offset, pointer.byteLength);
                    u8ViewOfCopyTo.set(u8ViewOfCopyFrom);
                }
            }
        }
        else {
            console.error("指针不存在");
            return false;
        }
    }
    /** 更新指针偏移量和BOLID */
    updatePointerOffset(pointerID: number, offset: number, BolID: number) {
        let pointer = this.pointers.get(pointerID);
        if (pointer) {
            pointer.offset = offset;
            pointer.BolID = BolID;
        }
    }
    /** 释放指针 */
    releasePointer(id: number) {
        //1、释放BOL内存
        this.parent.releasePointer(id);
        //2、删除指针
        this.pointers.delete(id);
        this.pointerID.delete(id);
    }
    /** 获取指针的GPUBufferBinding */
    getGPUBufferBindingByPointerID(id: number): GPUBufferBinding | undefined {
        return this.pointers.get(id)?.gpuBufferView;
    }
    /** 获取指针的CPUBufferView */
    getCPUBufferViewByPointerID(id: number): ArrayBufferView | undefined {
        return this.pointers.get(id)?.cpuBufferView;
    }
    /** 重置指针大小 */
    resizePointer(pointerID: number, byteLength: number) {
        let pointerOld = this.pointers.get(pointerID);
        let params: I_pointerCreateParams;
        if (!pointerOld) {
            throw new Error("指针不存在");
        }
        params = {
            name: pointerOld.name,
            byteSize: byteLength,
            type: pointerOld.type,
            data: {
                type: pointerOld.viewType,
            },
        }
        this.releasePointer(pointerID);
        return this.createPointer(params);
    }
}
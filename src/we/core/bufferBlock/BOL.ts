import { createEmptyGPUBuffer } from "../command/baseFunction";
import { WeGenerateUUID } from "../math/baseFunction";
import { I_UUID } from "../organization/root";
import { Clock } from "../scene/clock";
import { Scene } from "../scene/scene";
import { E_BOLState, V_BolStrideSizeOfUpdate, E_BufferType } from "./base";
import { BlockPointerCoordinator } from "./BPC";
import { Pointers } from "./pointer";

/** 指针结构 */
export interface I_pointerInfoInBOL {
    pointerID: number;
    /** 所属BOL的BlockID
     * 1、为后期跨Block进行内存调度适用
     */
    BolID: number;
    offset: number;
    byteLength: number;
    cpuBuffer: ArrayBuffer;
    gpuBuffer: GPUBuffer;
}
/** BOL创建参数 */
export interface IV_BOL {
    name: string;
    /** BOL大小，单位：字节。
     * 1、尺寸必须是4的倍数，webGPU的buffer必须是4的倍数。
     * 2、最小值为64K。
     * 3、如果有初始化数据，size必须大于或等于data的长度。
     */
    size: number;
    /**初始化数据
     * 1、静态VS，必须有初始化数据。
     * 2、动态VS，data的长度必须小于等于size。
     */
    data?: {
        /** 初始化数据 */
        buffer: ArrayBuffer;
        /** 是否释放 ,默认false
         * 1、如果为true，则BOL状态为released。不保存初始化数据，交予GC回收（如果存在其他持久化的引用，则不会被回收）。
         *  A、适用于静态VS的属性数据；
         *  B、或其他CPU端不再操作的数据，不考虑类型。
         * 2、如果为false，则BOL状态根据容量适用设定状态
        */
        released?: boolean;
    }
    /** buffer 类型 */
    type: E_BufferType;
    /** BOL ID 、id由BPC生成    */
    id: number;

    /** 合并更新间距阈值*/
    thresholdOfMergeUpdateStrideSize?: number;

}
/**
 * BOL偏移量和长度映射类
 * 1、CPU和GPU中的buffer具有相同的offset和byteLength
 * 2、更新偏移量和长度时，需要更新CPU和GPU中的buffer（重新写入数据）。
 */
export class BlockOffsetLength implements I_UUID {
    parent: BlockPointerCoordinator
    device: GPUDevice;
    clock: Clock;
    scene: Scene;
    /** 指针管理器 */
    pointers: Pointers;
    name: string = 'BOL';
    type: E_BufferType;
    /** BOL大小，单位：字节。 
     * 默认大小64K,也是最小值。
    */
    size: {
        total: number;
        used: number;
        free: number;
        released: number;
        lastFree: number;
    } = {
            total: 64 * 1024,
            used: 0,
            free: 64 * 1024,
            released: 0,
            lastFree: 64 * 1024,
        };
    /** release阈值，默认0.4，即40%的free值 */
    thresholdOfRelease: number = 0.4;
    /** 合并更新间距阈值，默认64K
     */
    thresholdOfMergeUpdateStrideSize: number;

    /** GPUBufferUsageFlags类型 */
    usage: GPUBufferUsageFlags = GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE | GPUBufferUsage.INDEX | GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC;

    UUID: string = '';
    _isDestroy: boolean = false;

    _id: number = 1;
    state: E_BOLState = E_BOLState.open;

    /** 最后一次分配的偏移量 
     * 1、默认从0开始分配。
     * 2、每次分配，偏移量增加指针大小。
     * 3、rebuild时，偏移量重置为0，然后按照每次分配的指针大小，更新此值。
    */
    lastOffset: number = 0;
    cpuBuffer!: ArrayBuffer;
    gpuBuffer!: GPUBuffer;
    /** 指针ID列表 */
    pointerIdList: number[] = [];
    /**
     * 指针偏移量映射表,用于聚合更新
     * 1、key:指针offset
     * 2、value:pointerID;
     * 更新：
     * 1、分配指针时，更新映射表。
     * 2、释放指针时，更新映射表。
     * 3、rebuild时，重置映射表。
     */
    pointerOffsetMap: Map<number, number> = new Map();

    inputValues: IV_BOL;

    /**
     * 聚合更新的偏移量和长度表，update（）按照offset，length进行更新。
     * 1、每帧清空
     * 2、根据更新偏移量和长度，计算更新的offset和length。
     *      A、连续更新的offset的间距为：64K。即小于64K，则合并更新。
     * [number, number][] = [offset, length][]
     * offset: 更新偏移量（聚合更新的偏移量）
     * length: 更新长度(聚合长度)
     */
    updateOffsetAndLenght: [number, number][] = [];

    /**向GPU写入所有数据
     * 0、目的，简化rebuild之后的聚合更新，
     * 1、默认false
     * 2、调用rebuild()后，需要写入所有数据。
     *  A、release的阈值触发,由BPC触发
     *  B、按需调用rebuild
     *  C、update之后，更改flag为false
     * 3、带数据的整合初始化之后，不需要改变flag，已经采取了立即写入模式
     */
    flagWriteAll: boolean = false;

    constructor(input: IV_BOL, parent: BlockPointerCoordinator) {
        this.inputValues = input;
        this.parent = parent;
        this.type = input.type;
        this.scene = parent.scene;
        this.pointers = parent.pointers;
        this.device = parent.device;
        this.clock = parent.clock;
        this.thresholdOfMergeUpdateStrideSize = input.thresholdOfMergeUpdateStrideSize || V_BolStrideSizeOfUpdate[this.type as keyof typeof V_BolStrideSizeOfUpdate];
        this.name = input.name;
        if (input.id != undefined) {
            this.ID = input.id!;
        }
        this.UUID = WeGenerateUUID();
        if (input.type == E_BufferType.staticVS) {
            this.usage = GPUBufferUsage.VERTEX | GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST;
        }
        else if (input.type == E_BufferType.VS) {
            this.usage = GPUBufferUsage.VERTEX | GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST;
        }
        else if (input.type == E_BufferType.uniform) {
            this.usage = GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC;
        }
        else if (input.type == E_BufferType.storage) {
            this.usage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC;
        }
        else {
            throw new Error("type not support");
        }
        this.type = input.type;
        let size = this.inputValues.size;
        let complementOfNumber = size % 4;
        if (complementOfNumber !== 0) {
            complementOfNumber = 4 - complementOfNumber;
            console.warn(`BOL ${this.name} size is not 4's multiple, add ${complementOfNumber} bytes.`);
        }
        size += complementOfNumber;
        this.size = {
            total: size,
            used: 0,
            free: size,
            released: 0,
            lastFree: size,
        }
        this.init();
    }

    destroy(): boolean {
        this.gpuBuffer.destroy();
        // @ts-ignore
        this.cpuBuffer = null;
        this._isDestroy = true;
        return this._isDestroy;
    }
    set ID(id: number) {
        this._id = id;
    }
    get ID() {
        return this._id;
    }
    /** 设置合并更新间距阈值 */
    setThresholdOfMergeUpdateStrideSize(size: number) {
        this.thresholdOfMergeUpdateStrideSize = size;
    }
    init() {
        this.cpuBuffer = new ArrayBuffer(this.inputValues.size);
        let label = `BOL ${this.name}`;
        this.gpuBuffer = createEmptyGPUBuffer(this.device, this.usage, this.inputValues.size, label);
        if (this.inputValues.data) {
            this.device.queue.writeBuffer(this.gpuBuffer, 0, this.inputValues.data.buffer);
        }
    }

    /**
     * 重新构建BOL
     * 1、重新紧密排布指针数据，即内部调度
     * 2、更新指针的offset和byteLength
     */
    rebuild() {
        /**         
         * 步骤：
         * 1、设置flagWriteAll为true，以及size重置
         * 2、slice 一个新副本，作为原数据
         * 3、重置 updateOffsetMap ,
         * 4、for pointerList，
         *      A、重新写入数据到cpuBuffer
         *      B、更新指针的offset和byteLength，适用pointers.updatePointerOffset(pointerID, offset, BolID)
         *      C、写入updateOffsetMap
         *      D、更新lastOffset和size，以及设置lastOffset为当前指针偏移量
         * 5、pointerList 不变；
         */
        //1、设置flagWriteAll为true，以及size重置
        this.flagWriteAll = true;
        let offset = 0;     //当前偏移量 
        this.size.used = 0;
        this.size.free = this.size.total;
        this.size.released = 0;
        //2、slice 一个新副本，作为原数据
        let cloneBuffer = this.cpuBuffer.slice();
        //3、重置 updateOffsetMap ,
        this.pointerOffsetMap.clear();
        //4、for pointerList，
        for (let i of this.pointerIdList) {
            let oldPointerStruct = this.pointers.getPointer(i);
            if (oldPointerStruct == undefined) {
                continue;
            }
            //4.1 重新写入数据到cpuBuffer
            let oneViewOfClone = new Uint8Array(cloneBuffer, oldPointerStruct.offset, oldPointerStruct.byteLength);
            let oneViewOfRebuild = new Uint8Array(this.cpuBuffer, offset, oldPointerStruct.byteLength);
            oneViewOfRebuild.set(oneViewOfClone);

            //4.2 更新指针的offset和byteLength
            this.pointers.updatePointerOffset(oldPointerStruct.pointerID, offset, this.ID);

            //4.3 聚合更新的Map
            this.pointerOffsetMap.set(offset, oldPointerStruct.pointerID);

            //4.4 更新lastOffset和size
            this.updateSizeOfUsed("add", oldPointerStruct.byteLength, offset);
            offset += oldPointerStruct.byteLength;
            this.lastOffset = offset;
        }
    }
    /** 生成更新偏移量和长度的映射表
     */
    generateUpdateOffsetAndLenght(clock: Clock) {
        let lastUpdateTime = clock.last;
        this.updateOffsetAndLenght = [];
        //上一个有效的偏移量
        let lastOffset = 0;
        //上一个有效的长度
        let lastAtEndOfPointer = 0;
        //两个指针之间的不更新byteLength间距
        let strideSize = 0;
        // 上一个有效的长度+strideSize(未达到阈值时)
        let lastAtEndOfPointer_add_strideSize = 0;
        for (let [offset, pointerID] of this.pointerOffsetMap) {
            let pointer = this.pointers.getPointer(pointerID)!;

            //判断pointer 当前帧是否有写入数据。如果无，累计strideSize，
            if (pointer.writeTime < lastUpdateTime) {
                strideSize += pointer.byteLength;           //累计strideSize
                //大于阈值，提交上次最后的lastOffset 和 lastAtEndOfPointer 之间的长度
                if (strideSize >= this.thresholdOfMergeUpdateStrideSize && lastOffset != lastAtEndOfPointer) {
                    // if (lastOffset != 0 && lastAtEndOfPointer != 0) {
                    if (lastAtEndOfPointer != 0) {
                        this.updateOffsetAndLenght.push([lastOffset, lastAtEndOfPointer]);
                    }
                    //重置strideSize，lastOffset，lastAtEndOfPointer
                    strideSize = 0;
                    lastOffset = lastAtEndOfPointer;
                    // lastAtEndOfPointer = 0;
                    // lastAtEndOfPointer_add_strideSize = lastAtEndOfPointer;
                }
                else {
                    lastAtEndOfPointer_add_strideSize = lastAtEndOfPointer + strideSize;
                }
            }
            //否则，更新lastAtEndOfPointer
            else {
                let atEndOfPointer = offset + pointer.byteLength;       //当前指针的偏移量+当前指针的长度=当前指针的结束偏移量
                //如果是第一个指针或重置，直接赋值
                if (lastOffset === 0 && lastAtEndOfPointer === 0 && strideSize === 0) {
                    lastOffset = offset;
                    lastAtEndOfPointer = atEndOfPointer;
                    continue;
                }
                //上一个指针的结束偏移量等于当前指针的偏移量，直接赋值。中间存在stride
                else if (lastAtEndOfPointer == lastOffset) {
                    lastOffset = offset;
                    lastAtEndOfPointer = atEndOfPointer;
                }
                else {
                    //更新lastAtEndOfPointer
                    lastAtEndOfPointer = atEndOfPointer;
                    //重置strideSize，无strideSize或strideSize小于阈值.
                    strideSize = 0;
                }
            }
        }
        //提交最后一个指针的偏移量和长度
        if (lastAtEndOfPointer != 0) {
            this.updateOffsetAndLenght.push([lastOffset, lastAtEndOfPointer]);
        }
    }
    /** 更新BOL     */
    update(clock: Clock) {
        if (this.type == E_BufferType.staticVS) {
            return;
        }
        if (this._isDestroy) {
            return;
        }
        if (this.state == E_BOLState.rebuilding) {
            return;
        }
        if (this.flagWriteAll === true) {
            this.device.queue.writeBuffer(this.gpuBuffer, 0, this.cpuBuffer);
            this.flagWriteAll = false;
        }
        else {
            this.generateUpdateOffsetAndLenght(clock);
            for (let i of this.updateOffsetAndLenght) {
                this.device.queue.writeBuffer(this.gpuBuffer, i[0], this.cpuBuffer, i[0], i[1]);
            }
        }
    }
    /**
     * 分配指针缓冲区
     * @param pointerID 指针ID
     * @param pointerID 指针大小，单位：字节
     * @returns 指针信息
    */
    allocatePointer(pointerID: number, byteSize: number): I_pointerInfoInBOL {
        let offset = this.lastOffset;
        if (offset + byteSize > this.size.total) {
            throw new Error("BOL size not enough");
        }
        this.lastOffset += byteSize;
        let pointerInfo: I_pointerInfoInBOL = {
            pointerID: pointerID,
            offset: offset,
            byteLength: byteSize,
            BolID: this.ID,
            cpuBuffer: this.cpuBuffer,
            gpuBuffer: this.gpuBuffer,
        }
        this.pointerIdList.push(pointerID);     //添加指针ID到pointerIdList
        this.pointerOffsetMap.set(offset, pointerID);//更新pointer的Offse tMap的映射
        this.updateSizeOfUsed("add", byteSize, offset); //更新BOL的size使用量
        return pointerInfo;
    }
    /** 释放指针
     * 1、从pointerIdList中移除指针ID
     * 2、从pointerOffsetMap中移除偏移量和指针ID的映射
     * 3、更新BOL的size使用量
     * 4、不考虑聚合更新的Map的问题，不再这里处理（在update中调用 this.generateUpdateOffsetAndLenght(clock);）
     * @param pointerID 指针ID
     */
    releasePointer(pointerID: number) {
        let pointerStruct = this.pointers.getPointer(pointerID);
        if (pointerStruct == undefined) {
            console.warn("pointerID not found");
            return;
        }
        let index = this.pointerIdList.indexOf(pointerID);
        if (index == -1) {
            console.warn("pointerID not found");
            return;
        }
        this.pointerIdList.splice(index, 1);
        this.pointerOffsetMap.delete(pointerStruct.offset);
        this.updateSizeOfUsed("remove", pointerStruct.byteLength);
    }
    /** 更新BOL的size使用量
     * @param option add或remove
     * @param byteSize 指针大小，单位：字节
     */
    updateSizeOfUsed(option: "add" | "remove", byteSize: number, offset?: number,) {
        if (option == "remove") {
            this.size.free += byteSize;
            this.size.used -= byteSize;
            if (this.size.used > 0)
                this.size.released += byteSize;
            else {
                this.size.released = 0;
                this.size.lastFree = this.size.total;
            }

        }
        else {

            this.size.used += byteSize;
            this.size.free -= byteSize;
            if (offset == undefined) {
                throw new Error("offset or byteLength is undefined");
                return;
            }
            this.size.lastFree = this.size.total - (offset + byteSize);
        }
    }
}
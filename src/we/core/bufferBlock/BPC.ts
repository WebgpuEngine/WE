import { Clock } from "../scene/clock";
import { Scene } from "../scene/scene";
import { E_BOLState, E_BufferType } from "./base";
import { BlockOffsetLength, I_pointerInfoInBOL, IV_BOL } from "./BOL";
import { MemoryBlockManager } from "./MBM";
import { I_pointerCreateParams, Pointers } from "./pointer";

/** BOL大小定义接口 */
export interface I_defineSizeOfBOL {
    [E_BufferType.staticVS]: number;
    [E_BufferType.VS]: number;
    [E_BufferType.uniform]: number;
    [E_BufferType.storage]: number;
}
/**
 * BPC（BOL Pointer Coordinator） 是BOL和pointer的协作管理器
 * 1、负责BOL的数量与类型管理
 * 2、负责pointer的分配、释放、resize到BOL的任务传递
 *    A、resize时，原来BOL的内存可能不够用，则需要调度（释放原来BOL的内存，申请新的BOL并分配pointer需要的空间）
 *    B、目前不进行跨BOL的内存调度，下一步功能稳定后进行；
 * 3、更新Pointer的对应内容
 * 4、
 */
export class BlockPointerCoordinator {
    name: string = 'BPC';
    scene: Scene;
    device: GPUDevice;
    clock: Clock;

    /** 指针管理器 */
    pointers: Pointers;
    /** BOL集合，key为BOLID，value为BOL实例 */
    // BOLs: Map<number, BlockOffsetLength> = new Map();
    BOLs: {
        [E_BufferType.staticVS]: Map<number, BlockOffsetLength>,
        [E_BufferType.VS]: Map<number, BlockOffsetLength>,
        [E_BufferType.uniform]: Map<number, BlockOffsetLength>,
        [E_BufferType.storage]: Map<number, BlockOffsetLength>,
        "all": Map<number, BlockOffsetLength>,
    } = {
            [E_BufferType.staticVS]: new Map(),
            [E_BufferType.VS]: new Map(),
            [E_BufferType.uniform]: new Map(),
            [E_BufferType.storage]: new Map(),
            "all": new Map(),
        }
    /** BOLID集合 */
    BOLid: Set<number> = new Set();
    /** 最后一个BOLID */
    lastBOLid: number = 1;
    /** BOL大小定义 */
    sizeOfBOL: I_defineSizeOfBOL = {
        [E_BufferType.staticVS]: 1024 * 1024 * 20,//20MB
        [E_BufferType.VS]: 1024 * 1024 * 10,//10MB
        [E_BufferType.uniform]: 1024 * 64,//64KB
        [E_BufferType.storage]: 1024 * 1024 * 10,//10MB
    };
    /** 默认BOL类型 */
    defaultBOL: string[] = [E_BufferType.staticVS, E_BufferType.VS, E_BufferType.uniform, E_BufferType.storage];
    constructor(scene: Scene) {
        this.scene = scene;
        this.device = scene.device;
        this.clock = scene.clock;
        this.pointers = new Pointers(this);
        this.init();
    }
    init() {
        for (let i of this.defaultBOL) {
            let params: IV_BOL = {
                size: this.sizeOfBOL[i as E_BufferType],
                type: i as E_BufferType,
                id: -1,
                name: i,
            }
            this.createBOL(params);
        }
    }
    /** 创建指针ID */
    createBolID() {
        let id = this.lastBOLid;
        do {
            id = this.lastBOLid++;
        } while (this.BOLid.has(id));
        this.BOLid.add(id);
        return id;
    }
    /** 创建静态顶点BOL
     * 1、为加载WE静态模型数据准备的BOL
     * 2、静态VS必须有初始化数据，且不可更改 
     * 3、静态VS的CPU侧内存不会保留
     */
    createStaticVertexBolWithData(param: IV_BOL) {
        let id = this.createBolID();
        let bol = new BlockOffsetLength(param, this);
        this.BOLs.all.set(id, bol);
        this.BOLs[E_BufferType.staticVS].set(id, bol);
        return id;
    }
    /** 分配指针到BOL，并分配内存空间，返回指针信息InBOL */
    allocatePointerBOL(pointerID: number, pointerParams: I_pointerCreateParams): I_pointerInfoInBOL {
        let bol = this.getBOLsByType(pointerParams.type, pointerParams.byteSize);
        let pointerInfo = bol.allocatePointer(pointerID, pointerParams.byteSize);

        return pointerInfo;
    }
    /** 获取BOL */
    getBOLsByType(type: E_BufferType, byteSize: number) {
        if (type == E_BufferType.staticVS) {
            // return this.staticVertexBOLs;
            throw new Error("staticVertex BOL 不能申请分配，只能通过createStaticVertexBolWithData创建，且必须有初始化数据，且不可更改");
        }
        else {
            for (let [id, bol] of this.BOLs[type]) {
                //rebuilding状态原则上不会和分配状态冲突，因为在不同的执行阶段。
                if (bol.state == E_BOLState.released || bol.state == E_BOLState.close || bol.state == E_BOLState.rebuilding) {
                    continue;
                }
                //这里需要考虑最后的连续byteSize是否足够分配
                if (bol.size.lastFree >= byteSize) {
                    return bol;
                }
            }
            let params: IV_BOL = {
                size: this.sizeOfBOL[type] > byteSize ? this.sizeOfBOL[type] : byteSize,
                type: type,
                id: this.createBolID(),
                name: ""
            }
            return this.createBOL(params);
        }
    }
    /** 创建BOL */
    createBOL(params: IV_BOL) {
        if (params.id == undefined || params.id < 1 ) {
            params.id = this.createBolID();
        }
        else if (this.BOLid.has(params.id)) {
            console.warn(`BOL ${params.id} 已存在`);
            params.id = this.createBolID();
        }
        let bol = new BlockOffsetLength(params, this);
        this.BOLs.all.set(params.id, bol);
        this.BOLs[params.type].set(params.id, bol);
        return bol;
    }
    /** 释放指针 */
    releasePointer(pointerID: number,BolID:number) {
        let bol = this.BOLs.all.get(BolID);
        if (bol) {
            bol.releasePointer(pointerID);
        }
    }
    /** 删除BOL */
    deleteBolByID(id: number) {
        if(typeof id !== "number"){
           console.warn("id必须是number类型");
           return false;
        }
        let bol = this.BOLs.all.get(id);
        if (bol) {
            let pointerCount = bol.pointerIdList.length;
            if (pointerCount > 0) {
                console.warn(`BOL ${id} 有 ${pointerCount} 个指针，不能删除`);
                //有指针，不能删除
                return false;
            }
            let isDestroy = bol.destroy();
            if (isDestroy) {
                this.BOLs.all.delete(id);
                this.BOLs[E_BufferType.staticVS].delete(id);
                this.BOLs[E_BufferType.VS].delete(id);
                this.BOLs[E_BufferType.uniform].delete(id);
                this.BOLs[E_BufferType.storage].delete(id);
                this.BOLid.delete(id);
            }
            return isDestroy;
        }
    }
    /**
     * 管理BOL
        * 1、BPC.managerBOL()在scene.update()中调用
        * 2、在MEM之前调用，确保所有BOL都已完成调度
        *     A、在rootManager->entityManager之后
        *     B、MEM在renderManager之前
     * 
     * BOL release 阈值调度
        * 1、for BOLs.all，根据size.release阈值，判断是否需要rebuild
        * 2、如果需要，调用BOL的rebuild方法
        * 
     * 
     * BOL间调度：
         * 1、只在内部调用
         * 2、外部调度增加：
         *      A、BPC先clone一个ArrayBuffer，缓存指针数据；
         *      B、先rebuild，
         *      C、分配指针内存。
         *      D、然后由BPC更新指针的offset和byteLength。
         *      E、BPC调用指针的updateDataByPointerID方法，写入clone的data
         * 3、被调度的BOL
         *      A、同2.A
         *      B、删除BOL内指针：pointerIdList 和 pointerOffsetMap
         *      C、按需 调用rebuild()
     */
    update(clock: Clock) {
    }

}

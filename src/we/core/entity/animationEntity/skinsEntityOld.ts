import { I_bindGroupAndGroupLayout } from "../../command/base";
import { createEmptyGPUBuffer } from "../../command/baseFunction";
import { Clock } from "../../scene/clock";
import { Scene } from "../../scene/scene";
import { IV_BaseEntity } from "../base";
import { AnimationEntity } from "./animationEntity";

export abstract class SkinsEntity extends AnimationEntity {
    /**storage array(初始化默认一个矩阵，以适配没有joint的通用情况；)
     * 每个instance的joint matrix size
     * 1、matrix以16*4 byte一个单位计算
     * 2、当前entity的jonit数组数量：N=1(不使用时),N=关节数量
     * 3、instance 数量（M=1，动态，程序中）
     * 4、size= M*(N*16*4)
     */
    _instanceJointMatrixByteSize = 16 * 4;
    set JointMatrixByteSize(value: number) {
        this._instanceJointMatrixByteSize = value;
    }
    get JointMatrixByteSize(): number {
        return this._instanceJointMatrixByteSize;
    }


    /**Buffer(uniform and storage )在CPU端的ArrayBuffer */
    override bufferCPU: {
        /** 最终输出@group(1) @binding(0)的uniform buffer*/
        uniformCommonEntity?: ArrayBuffer;//instance的uniform 数组数量，在createDCCC中进行字符串替换，每个子类单独进行
        /** 实例化数组@group(1) @binding(1)*/
        instances?: ArrayBuffer;
        /** 世界矩阵数组@group(1) @binding(2)*/
        wolrdMatrix?: ArrayBuffer;

        /** 骨骼矩阵数组@group(1) @binding(4)*/
        jointMatrix?: ArrayBuffer;
    } = {};
    /**Buffer(uniform and storage )在GPU端的 GPUBuffer */
    override bufferGPU: {
        /** 最终输出@group(1) @binding(0)的uniform buffer*/
        uniformCommonEntity?: GPUBuffer;//instance的uniform 数组数量，在createDCCC中进行字符串替换，每个子类单独进行
        /** 实例化数组@group(1) @binding(1)*/
        instances?: GPUBuffer;
        /** 世界矩阵数组@group(1) @binding(2)*/
        wolrdMatrix?: GPUBuffer;

        /** 骨骼矩阵数组@group(1) @binding(4)*/
        jointMatrix?: GPUBuffer;
    } = {};

    constructor(input: IV_BaseEntity) {
        super(input);
    }

    async init(scene: Scene): Promise<any> {
        await super.init(scene);
        this.updateJointMatrixBuffer();
    }
    _jointsMattricesCount: number = 0;
    /** 获取骨骼动画数量 */
    get JointsMatCount(): number {
        return this._jointsMattricesCount;
    }
    set JointsMatCount(count: number) {
        this._jointsMattricesCount = count;
    }

    /**
     * 被update调用，更新vs、fs的uniform
     * 
     * this.flagUpdateForPerInstance 影响是否单独更新每个instance，使用用户更新的update（）的结果，或连续的结果
     */
    override updateUniformCommonEntity(clock: Clock, _write: boolean = true): void {
        super.updateUniformCommonEntity(clock, false);
        if (this.bufferCPU.uniformCommonEntity !== undefined) {
            const st_entityValues = this.bufferCPU.uniformCommonEntity;
            const st_entityViews = {
                animation_kind: new Uint32Array(st_entityValues, 16, 1),
                joint_matrix_count: new Uint32Array(st_entityValues, 28, 1),
            };
            st_entityViews.animation_kind[0] = this.getAnimationKind();
            st_entityViews.joint_matrix_count[0] = this.JointsMatCount;
            this.device.queue.writeBuffer(this.bufferGPU.uniformCommonEntity!, 0, this.bufferCPU.uniformCommonEntity);
        }
    }
    /**
     * 检查相关storage buffer的状态，根据instance数量已经动画进行创建、更新或保持
     * @param name buffer name
     * @returns  boolen :是否存在
     * 1、instances 和 worldMatrix 会忽略返回值
     * 2、morph target 和 骨骼动画 根据是否有动画返回boolean值
     */
    override checkStorageBuffer(name: string): boolean {
        if (name == "jointMatrix") {
            /**
            * 1、判断ArrayBuffer是否存在
            * 2、判断长度是否与instance数量匹配
            * 3、判断是否存在动画
            *      A、morph target
            *      B、skins
            * 4、根据reNew是否创建ArrayBuffer和GPUBuffer
            */
            let reNew = false;
            let nameCPU = name as keyof typeof this.bufferCPU;

            //骨骼动画
            if (name == "jointMatrix") {
                //如果有骨骼动画
                if (this.isSkeletonAnimation()) {
                    //没有
                    if (this.bufferCPU[nameCPU] == undefined) {
                        reNew = true;
                    }
                    //长度不相等,默认是四个关联矩阵
                    else if (this.bufferCPU[nameCPU].byteLength != this.getInstancesCount() * this._instanceJointMatrixByteSize) {
                        reNew = true;
                    }
                }
                else {
                    return false;//不存在
                }
            }
            //new or renew :cpu and gpu
            if (reNew) {
                this.flagInstanceArrayBufferReNew = true;//更新需要reNew的时间
                let size = 16;
                if (name == "jointMatrix") {
                    size = this._instanceJointMatrixByteSize;
                }

                else {
                    throw new Error("checkStorageBuffer: unknown name:" + name);
                }
                let sizeOfInstances = this.getInstancesCount() * size;
                //创建ArrayBuffer，旧的ArrayBuffer由GC回收
                this.bufferCPU[nameCPU] = new ArrayBuffer(sizeOfInstances);     //创建新的ArrayBuffer，空的，不是N个单位矩阵
                //销毁旧的GPUBuffer，句柄由webGPU GC回收
                if (this.bufferGPU[nameCPU] && this.bufferGPU[nameCPU] != this.scene.getResourceOneStorageMatrix()) {
                    this.bufferGPU[nameCPU].destroy();
                }
                //创建新的GPUBuffer
                this.bufferGPU[nameCPU] = createEmptyGPUBuffer(this.device, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST, sizeOfInstances, name + ":" + this.ID);
            }

            return this.bufferCPU[nameCPU] != undefined;
        }
        return super.checkStorageBuffer(name);
    }

    async updateAnimationBuffer() {
        this.updateJointMatrixBuffer();
    }
    /**
     * 骨骼动画 update 
     * 如果没有morph target，使用默认的storage buffer占位
     */
    updateJointMatrixBuffer() {
        let state = this.checkStorageBuffer("jointMatrix");
        // 如果没有jointMatrix，且GPU没有jointMatrix，使用默认的storage buffer占位
        if (state == false && this.bufferGPU.jointMatrix == undefined) {
            this.bufferGPU.jointMatrix = this.scene.getResourceOneStorageMatrix();
        }
        else if (this.bufferGPU.jointMatrix != this.scene.getResourceOneStorageMatrix()) {
            // throw new Error("未完成")
            //update：cpu and gpu
            if (this.bufferGPU.jointMatrix && this.bufferCPU.jointMatrix) {
                for (let i in this.outSideInstance) {
                    let perNode = this.outSideInstance[i];
                    let instanceIndex = parseInt(i);
                    for (let j = 0; j < this.instance.numInstances; j++) {
                        let offset = (instanceIndex * this.instance.numInstances + j) * this.JointMatrixByteSize;    //内外部instance的偏移量加上内部instance的偏移量
                        this.device.queue.writeBuffer(this.bufferGPU.jointMatrix, offset, perNode.JointsMat!);//写入每个instance的矩阵,内部instance写入相同的矩阵
                    }
                }
            }
            else {
                throw new Error("更新世界矩阵数组与GPU世界矩阵数组失败");
            }
        }
    }
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //uniform merge part
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /**
     * 获取bindGroup和bindGroupLayout。由DCG.initUniformPart() 和BaseDrawCommand.doEncoder()调用
     * 时间轴：render阶段
     * @returns I_bindGroupAndGroupLayout
     */
    override getBindGroupAndBindGroupLayout(): I_bindGroupAndGroupLayout {
        /**
         * 1、判断bind group 和layout 是否存在，没有新建
         *      A、判断 this.bindGroup ,this.bindGroupLayout  undefined
         *      B、新建
         *      C、缓存layout ，bindgroup
         * 2、如果存在，判断是否需要更新bind group。layout 不变.
         *      A、判断 flagInstanceArrayBufferReNew ，
         *      B、如果=true ，更新，并重置为false
         *      C、返回值
         * 
         */
        //undefined，创建
        if (this.bindGroup == undefined && this.bindGroupLayout == undefined) {
            //////////////////////////////////////////////////
            //bind group  layout
            let bindGroupLayoutDescriptor: GPUBindGroupLayoutDescriptor = {
                label: `entity:${this.ID} @ ${this.scene.clock.now}`,
                entries: [
                    {//@group(1) @binding(0) var<uniform> u_entity_base:st_entity;
                        binding: 0,
                        visibility: GPUShaderStage.VERTEX,
                        buffer: {
                            type: "uniform"
                        }
                    },
                    {//@group(1) @binding(1) var<storage> u_entity_instances: array<st_instance_info>;      //length=instance count
                        binding: 1,
                        visibility: GPUShaderStage.VERTEX,
                        buffer: {
                            type: "read-only-storage"
                        }
                    },
                    {//@group(1) @binding(2) var<storage> world_matrix: array<mat4x4f>;          //length=instance count;
                        binding: 2,
                        visibility: GPUShaderStage.VERTEX,
                        buffer: {
                            type: "read-only-storage"
                        }
                    },
                    // {//@group(1) @binding(3) var<storage> morph_matrix: array<f32>;              //length=instance count * morph target count * vertex count
                    //     binding: 3,
                    //     visibility: GPUShaderStage.VERTEX,
                    //     buffer: {
                    //         type: "read-only-storage"
                    //     }
                    // },
                    {//@group(1) @binding(3) var<storage> joint_matrix: array<mat4x4f>;           //length=instance count * joint matrix count
                        binding: 3,
                        visibility: GPUShaderStage.VERTEX,
                        buffer: {
                            type: "read-only-storage"
                        }
                    },
                ]
            }
            this.bindGroupLayout = this.device.createBindGroupLayout(bindGroupLayoutDescriptor);;
            //////////////////////////////////////////////////
            //bind group  
            let entries: GPUBindGroupEntry[] = this.generateGPUBindGroupEntries();
            let bindGroupDescriptor: GPUBindGroupDescriptor = {
                label: `entity:${this.ID} @ ${this.scene.clock.now}`,
                layout: this.bindGroupLayout,
                entries: entries
            }
            this.bindGroup = this.device.createBindGroup(bindGroupDescriptor);
        }
        //当前帧有instance变化，更新
        else if (this.flagInstanceArrayBufferReNew === true) {
            let entries: GPUBindGroupEntry[] = this.generateGPUBindGroupEntries();
            let bindGroupDescriptor: GPUBindGroupDescriptor = {
                label: `entity:${this.ID} @ ${this.scene.clock.now}`,
                layout: this.bindGroupLayout,
                entries: entries
            }
            this.bindGroup = this.device.createBindGroup(bindGroupDescriptor);
            this.flagInstanceArrayBufferReNew = false;//重置为false
        }
        return {
            bindGroup: this.bindGroup,
            bindGroupLayout: this.bindGroupLayout
        }
    }
    /**
    * 获取bind group 的binding,固定的与shader中的顺序对应
    * 说明：
    *  1、bufferGPU使用的对象，没有使用Map。原因是需要有通用的占位Storage buffer，直接指向对象可以共享占位GPUBuffer。
    *  2、对象不能保障顺序，所以需要一个单独绑定的顺序。
    * @param name 
    * @returns number
    */
    override getBindingOfBindGroup(name: string): number {
        switch (name) {
            case "uniformCommonEntity":
                return 0;
            case "instances":
                return 1;
            case "wolrdMatrix":
                return 2;
 
            case "jointMatrix":
                return 3;
        }
        throw new Error(`未找到绑定${name}`);
    }
}
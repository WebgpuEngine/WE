import { sup } from "../../../../@loaders.gl/draco/dist/draco-worker-node";
import { I_pointerStruct } from "../../bufferBlock/pointer";
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
        this.storageBufferList.find((item) => item.name == "jointMatrix")!.byteSize = value;
    }
    get JointMatrixByteSize(): number {
        return this._instanceJointMatrixByteSize;
    }
    _jointsMattricesCount: number = 0;
    /** 获取骨骼动画数量 */
    get JointsMatCount(): number {
        return this._jointsMattricesCount;
    }
    set JointsMatCount(count: number) {
        this._jointsMattricesCount = count;
    }


    // /**Buffer(uniform and storage )在CPU端的ArrayBuffer */
    // bufferCPU: {
    //     /** 最终输出@group(1) @binding(0)的uniform buffer*/
    //     uniformCommonEntity?: ArrayBuffer;//instance的uniform 数组数量，在createDCCC中进行字符串替换，每个子类单独进行
    //     /** 实例化数组@group(1) @binding(1)*/
    //     instances?: ArrayBuffer;
    //     /** 世界矩阵数组@group(1) @binding(2)*/
    //     wolrdMatrix?: ArrayBuffer;

    //     /** 骨骼矩阵数组@group(1) @binding(4)*/
    //     jointMatrix?: ArrayBuffer;
    // } = {};
    /**Buffer(uniform and storage )在GPU端的 GPUBuffer */
    bufferGPU: {
        // /** 最终输出@group(1) @binding(0)的uniform buffer*/
        // uniformCommonEntity?: GPUBuffer;//instance的uniform 数组数量，在createDCCC中进行字符串替换，每个子类单独进行
        // /** 实例化数组@group(1) @binding(1)*/
        // instances?: GPUBuffer;
        // /** 世界矩阵数组@group(1) @binding(2)*/
        // wolrdMatrix?: GPUBuffer;

        /** 骨骼矩阵数组@group(1) @binding(4)*/
        jointMatrix: GPUBuffer;
    } = {};


    override storageBufferList: {
        name: string;
        byteSize: number;
    }[] = [
            {
                name: "instances",
                byteSize: this._instanceInfoByteSize
            },
            {
                name: "wolrdMatrix",
                byteSize: this._instanceWorldMatrixByteSize
            },
            {
                name: "jointMatrix",
                byteSize: this._instanceJointMatrixByteSize
            }
        ];

    override bufferPointers: {
        uniformCommonEntity: I_pointerStruct | undefined;
        instances: I_pointerStruct | undefined;
        wolrdMatrix: I_pointerStruct | undefined;
        jointMatrix: I_pointerStruct | undefined;
    } = {
            uniformCommonEntity: undefined,
            instances: undefined,
            wolrdMatrix: undefined,
            jointMatrix: undefined,
        };

    constructor(input: IV_BaseEntity) {
        super(input);
        let abc = 1;
    }

    // async init(scene: Scene): Promise<any> {
    //     await super.init(scene);

    //     this.bufferGPU.jointMatrix = createEmptyGPUBuffer(this.device,
    //         GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    //         this.JointMatrixByteSize * 4,
    //         "Test jointsMat of Entity :" + this.ID);
    // }

    /**
     * 被update调用，更新vs、fs的uniform
     * 
     * this.flagUpdateForPerInstance 影响是否单独更新每个instance，使用用户更新的update（）的结果，或连续的结果
     */
    override updateUniformCommonEntity(clock: Clock, _write: boolean = true): void {
        super.updateUniformCommonEntity(clock, false);//super的动画类型是为空：0
        if (this.bufferPointers.uniformCommonEntity !== undefined) {
            // const st_entityValues = this.bufferPointers.uniformCommonEntity;
            const st_entityValues = this.bufferPointers.uniformCommonEntity.cpuBuffer;
            let offset = this.bufferPointers.uniformCommonEntity.offset;
            const st_entityViews = {
                animation_kind: new Uint32Array(st_entityValues, offset + 16, 1),
                // morpht_target_count: new Uint32Array(st_entityValues, offset + 20, 1),
                vertex_count: new Uint32Array(st_entityValues, offset + 24, 1),
                joint_matrix_count: new Uint32Array(st_entityValues, offset + 28, 1),
            };
            st_entityViews.animation_kind[0] = this.getAnimationKind();
            st_entityViews.joint_matrix_count[0] = this.JointsMatCount;
            // console.log(st_entityViews.joint_matrix_count[0],st_entityViews.animation_kind[0] );
            //更新写入时间，这个不能忘记。否则，数据不会更新到GPU
            this.scene.pointers.updatePointerWriteTime(this.bufferPointers.uniformCommonEntity);
        }
    }

    /**
     * 检查相关storage buffer的状态，根据instance数量已经动画进行创建、更新或保持
     * @param name buffer name
     * @returns  boolen :是否存在
     * 1、instances 和 worldMatrix 会忽略返回值
     * 2、morph target 和 骨骼动画 根据是否有动画返回boolean值
     */
    // override  checkStorageBuffer(bufferList: {
    //     name: string;
    //     byteSize: number;
    // }[])  {
    //     super.checkStorageBuffer(bufferList);
    //     if (name == "jointMatrix") {
    //         /**
    //         * 1、判断ArrayBuffer是否存在
    //         * 2、判断长度是否与instance数量匹配
    //         * 3、判断是否存在动画
    //         *      A、morph target
    //         *      B、skins
    //         * 4、根据reNew是否创建ArrayBuffer和GPUBuffer
    //         */
    //         let reNew = false;
    //         let nameCPU = name as keyof typeof this.bufferCPU;

    //         //骨骼动画
    //         if (name == "jointMatrix") {
    //             //如果有骨骼动画
    //             if (this.isSkeletonAnimation()) {
    //                 //没有
    //                 if (this.bufferCPU[nameCPU] == undefined) {
    //                     reNew = true;
    //                 }
    //                 //长度不相等,默认是四个关联矩阵
    //                 else if (this.bufferCPU[nameCPU].byteLength != this.getInstancesCount() * this._instanceJointMatrixByteSize) {
    //                     reNew = true;
    //                 }
    //             }
    //             else {
    //                 return false;//不存在
    //             }
    //         }
    //         //new or renew :cpu and gpu
    //         if (reNew) {
    //             this.flagInstanceArrayBufferReNew = true;//更新需要reNew的时间
    //             let size = 16;
    //             if (name == "jointMatrix") {
    //                 size = this._instanceJointMatrixByteSize;
    //             }

    //             else {
    //                 throw new Error("checkStorageBuffer: unknown name:" + name);
    //             }
    //             let sizeOfInstances = this.getInstancesCount() * size;
    //             //创建ArrayBuffer，旧的ArrayBuffer由GC回收
    //             this.bufferCPU[nameCPU] = new ArrayBuffer(sizeOfInstances);     //创建新的ArrayBuffer，空的，不是N个单位矩阵
    //             //销毁旧的GPUBuffer，句柄由webGPU GC回收
    //             if (this.bufferGPU[nameCPU] && this.bufferGPU[nameCPU] != this.scene.getResourceOneStorageMatrix()) {
    //                 this.bufferGPU[nameCPU].destroy();
    //             }
    //             //创建新的GPUBuffer
    //             this.bufferGPU[nameCPU] = createEmptyGPUBuffer(this.device, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST, sizeOfInstances, name + ":" + this.ID);
    //         }

    //         return this.bufferCPU[nameCPU] != undefined;
    //     }
    //     return super.checkStorageBuffer(name);
    // }

    async updateAnimationBuffer() {
        this.updateJointMatrixBuffer();
    }
    /**
     * 骨骼动画 update 
     * 如果没有morph target，使用默认的storage buffer占位
     */
    updateJointMatrixBuffer() {
        if (this.bufferPointers.jointMatrix != undefined) {
            for (let i in this.outSideInstance) {
                let offset = this.bufferPointers.jointMatrix.offset;
                let perNode = this.outSideInstance[i];
                if (perNode.JointsMat) {
                    let instanceIndex = parseInt(i);
                    for (let j = 0; j < this.instance.numInstances; j++) {
                        //内外部instance的偏移量加上内部instance的偏移量 + pointer offset
                        let offsetOfReal = (instanceIndex * this.instance.numInstances + j) * this.JointMatrixByteSize + offset;
                        let jointsMatViewOfPointer = new Float32Array(this.bufferPointers.jointMatrix.cpuBuffer, offsetOfReal, this.bufferPointers.jointMatrix.byteLength / 4);
                        let jointsMatViewOfNodeObject = new Float32Array(perNode.JointsMat);
                        jointsMatViewOfPointer.set(jointsMatViewOfNodeObject);//写入每个instance的矩阵,内部instance写入相同的矩阵
                        // this.device.queue.writeBuffer(this.bufferGPU.jointMatrix, (instanceIndex * this.instance.numInstances + j) * this.JointMatrixByteSize, perNode.JointsMat);
                        // console.log(jointsMatViewOfNodeObject)
                    }
                }
            }
            this.scene.pointers.updatePointerWriteTime(this.bufferPointers.jointMatrix);
            let abc = 1;
            // console.log(this.bufferPointers.jointMatrix.cpuBufferView);
        }
        else {
            throw new Error("updateJointMatrixBuffer: jointMatrix is undefined");
        }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //uniform merge part
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////

    override generateGPUBindGroupLayoutDescriptor(): GPUBindGroupLayoutDescriptor {
        return {
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
    }
    override checkPointerRebuildTime(): boolean {
        //当前帧匹配，调试模式下，使用手工调用rebuild，不能精确匹配。非手工模式可以
        // if (this.bufferPointers.uniformCommonEntity?.rebuildTime == this.scene.clock.now
        //     ||
        //     this.bufferPointers.instances?.rebuildTime == this.scene.clock.now
        //     ||
        //     this.bufferPointers.wolrdMatrix?.rebuildTime == this.scene.clock.now
        // )

        //匹配手工和当前帧模式
        if (this.bufferPointers.uniformCommonEntity?.rebuildTime
            ||
            this.bufferPointers.instances?.rebuildTime
            ||
            this.bufferPointers.wolrdMatrix?.rebuildTime
            ||
            this.bufferPointers.jointMatrix?.rebuildTime
        ) {
            //重新设置为0
            this.bufferPointers.uniformCommonEntity!.rebuildTime = 0;
            this.bufferPointers.instances!.rebuildTime = 0;
            this.bufferPointers.wolrdMatrix!.rebuildTime = 0;
            this.bufferPointers.jointMatrix!.rebuildTime = 0;
            return true;
            // console.log("rebuild time:", this.bufferPointers.wolrdMatrix?.rebuildTime, "system time:", this.scene.clock.now);
        }
        return false;
    }
    // generateGPUBindGroupEntries(): GPUBindGroupEntry[] {
    //     let entries: GPUBindGroupEntry[] = [];
    //     for (let i in this.bufferPointers) {
    //         let binding = this.getBindingOfBindGroup(i);//获取绑定的顺序
    //         let perEntry: GPUBindGroupEntry;
    //         if (i == "jointMatrix") {
    //             perEntry = {
    //                 binding: binding,
    //                 resource: {
    //                     buffer: this.bufferGPU.jointMatrix,
    //                 }
    //             }
    //         }
    //         else {
    //             perEntry = {
    //                 binding: binding,
    //                 resource: {
    //                     buffer: this.bufferPointers[i as keyof typeof this.bufferPointers]!.gpuBufferView.buffer,
    //                     offset: this.bufferPointers[i as keyof typeof this.bufferPointers]!.gpuBufferView.offset,
    //                     size: this.bufferPointers[i as keyof typeof this.bufferPointers]!.gpuBufferView.size,
    //                 }
    //             }
    //         }
    //         entries.push(perEntry)
    //     }
    //     return entries;
    // }
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
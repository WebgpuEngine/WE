import { I_pointerStruct } from "../../bufferBlock/pointer";
import { Clock } from "../../scene/clock";
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
        if (this.bufferPointers.uniformCommonEntity !== undefined) {
            const st_entityValues = this.bufferPointers.uniformCommonEntity.cpuBuffer;
            let offset = this.bufferPointers.uniformCommonEntity.offset;
            const st_entityViews = {
                animation_kind: new Uint32Array(st_entityValues, offset + 16, 1),
                joint_matrix_count: new Uint32Array(st_entityValues, offset + 28, 1),
            };
            st_entityViews.animation_kind[0] = this.getAnimationKind();
            st_entityViews.joint_matrix_count[0] = this.JointsMatCount;
            this.scene.pointers.updatePointerWriteTime(this.bufferPointers.uniformCommonEntity);
        }
    }
    async updateAnimationBuffer() {
        this.updateJointMatrixBuffer();
    }
    /**
     * 骨骼动画 update 
     * 如果没有morph target，使用默认的storage buffer占位
     */
    updateJointMatrixBuffer() {

        if (this.bufferPointers.jointMatrix) {
            for (let i in this.outSideInstance) {
                let offset = this.bufferPointers.jointMatrix.offset;
                let perNode = this.outSideInstance[i];
                if (perNode.JointsMat) {
                    let instanceIndex = parseInt(i);
                    for (let j = 0; j < this.instance.numInstances; j++) {
                        let offsetOfPointer = (instanceIndex * this.instance.numInstances + j) * this.JointMatrixByteSize + offset;    //内外部instance的偏移量加上内部instance的偏移量
                        // this.device.queue.writeBuffer(this.bufferGPU.jointMatrix, offset, perNode.JointsMat!);//写入每个instance的矩阵,内部instance写入相同的矩阵
                        let f32DataViewOfPointer = new Float32Array(this.bufferPointers.jointMatrix.cpuBuffer, offsetOfPointer, this.bufferPointers.jointMatrix.byteLength / 4);
                        let f32DataViewOfNodeObject = new Float32Array(perNode.JointsMat);
                        f32DataViewOfPointer.set(f32DataViewOfNodeObject);
                    }
                    this.scene.pointers.updatePointerWriteTime(this.bufferPointers.jointMatrix);

                }
            }
        }
        else {
            throw new Error("更新世界矩阵数组与GPU世界矩阵数组失败");
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
import { mat4, vec3 } from "wgpu-matrix";
import { E_lifeState, I_Update } from "../base/coreDefine";
import { BaseCamera } from "../camera/baseCamera";
import { Clock } from "../scene/clock";
import { I_ShaderTemplate } from "../shadermanagemnet/base";
import { I_ShadowMapValueOfDC, I_EntityBundleOutput } from "./base";
import { BaseEntity } from "./baseEntity";


export interface IV_InstanceEntity extends I_Update {
    entity: BaseEntity;
}

export class instanceEntity extends BaseEntity {
    detachData(): void {
        throw new Error("Method not implemented.");
    }
    checkStatus(): boolean {
        return this.Entity.checkStatus();
    }
    generateBoxAndSphere(): void {
        throw new Error("Method not implemented.");
    }
    getBlend(): GPUBlendState | undefined {
        return this.Entity.getBlend();
    }
    getTransparent(): boolean {
        return this.Entity.getTransparent();
    }
    createDeferDepthDC(camera: BaseCamera): void {
        throw new Error("Method not implemented.");
    }
    createForwardDC(camera: BaseCamera): void {
        throw new Error("Method not implemented.");
    }
    createTransparent(camera: BaseCamera): void {
        throw new Error("Method not implemented.");
    }
    createShadowMapDC(input: I_ShadowMapValueOfDC): void {
        throw new Error("Method not implemented.");
    }
    createShadowMapTransparentDC(input: I_ShadowMapValueOfDC): void {
        throw new Error("Method not implemented.");
    }
    getVSUniformAndShaderTemplateFinal(SHT_VS: I_ShaderTemplate, startBinding: number): I_EntityBundleOutput {
        throw new Error("Method not implemented.");
    }
    updateUniformLayerOfTTPF(): void {
        throw new Error("Method not implemented.");
    }
    readyForGPU(): Promise<any> {
        throw new Error("Method not implemented.");
    }
    _destroy(): void {
        throw new Error("Method not implemented.");
    }
    saveJSON() {
        throw new Error("Method not implemented.");
    }
    loadJSON(json: any): void {
        throw new Error("Method not implemented.");
    }


    Entity: BaseEntity;

    constructor(input: IV_InstanceEntity) {
        super(input);
        this.Entity = input.entity;
        this.type = "instanceEntity";
        this._state = E_lifeState.constructed;
    }


    update(clock: Clock, updateSelftFN: boolean = true): boolean {
        // if (this.updatePerFrame === true || this.needUpdate === true || this._state != E_lifeState.finished) {
        //     super.update(clock, updateSelftFN);
        // }
        super.update(clock, updateSelftFN);
        return this.needUpdate;
    }

    updateSelf(clock: Clock) {
        //uniform @group(1) @binding(0)
        this.updateUniformBuffer();
        //比如：material 是在运行中是可以更改的，需要重新初始化。
        //由人工按需触发
        if (this.needUpdate === true) {
            this._state = E_lifeState.constructed;//重新初始化，下一帧进行重新初始化工作 
            this.DCG.clear();
        }
        if (this._state === E_lifeState.constructed) {
            this.clearDC();
            if (this.checkStatus()) {
                this._state = E_lifeState.initializing;
                this.generateBoxAndSphere();
                this.upgradeLights();//todo:20250911 ，light完成
                this.upgradeCameras();
                this._state = E_lifeState.finished;//this.createDCCC(valueOfCamera);
            }
            this.needUpdate = false;
        }
        //初始化是完成状态，同时checkStatus=true
        //material 是在运行中是可以更改的，所以需要检查状态。
        else if (this._state === E_lifeState.finished && this.checkStatus()) {
            //检查是否有新摄像机，有进行更新
            this.checkUpgradeCameras();
            //检查是否有新光源，有进行更新
            this.checkUpgradeLights();
        }
        else if (this._state == E_lifeState.initializing) {
            this.checkStatus();
        }
        this.DCG.upadate();
    }
    /**
     * 被update调用，更新vs、fs的uniform
     * 
     * this.flagUpdateForPerInstance 影响是否单独更新每个instance，使用用户更新的update（）的结果，或连续的结果
     */
    updateUniformBuffer(): void {
        if (this.instance.numInstances == 1) {
            this.matrixWorldBuffer.set(this.matrixWorld, 0 * 16);
        }
        else if (this.instance.numInstances > 1) {
            let positionEnable: boolean = false;
            let rotateEnable: boolean = false;
            let scaleEnable: boolean = false;
            if (this.instance.position && this.instance.position.length > 0) {
                positionEnable = true;
            }
            if (this.instance.rotate && this.instance.rotate.length > 0) {
                rotateEnable = true;
            }
            if (this.instance.scale && this.instance.scale.length > 0) {
                scaleEnable = true;
            }
            if (this.instance.index && this.instance.numInstances != this.instance.index.length) {
                this.instance.numInstances = this.instance.index.length;
            }
            else if (this.instance.position && this.instance.numInstances != this.instance.position.length / 3) {
                this.instance.numInstances = this.instance.position.length / 3;
            }
            for (let i = 0; i < this.instance.numInstances; i++) {
                let perMatrix = this.matrixWorldBuffer.subarray(i * 16, (i + 1) * 16);
                let index: number = i;
                if (this.instance.index) {
                    index = this.instance.index[i];
                }
                perMatrix = mat4.identity();
                if (scaleEnable) {
                    let perScale = vec3.fromValues(this.instance.scale![index * 3 + 0], this.instance.scale![index * 3 + 1], this.instance.scale![index * 3 + 2]);
                    mat4.scale(perMatrix, perScale, perMatrix);
                }
                if (rotateEnable) {
                    let perAxis = vec3.fromValues(this.instance.rotate![index * 3] + 0, this.instance.rotate![index * 3] + 1, this.instance.rotate![index * 3] + 2);
                    let perAngle = this.instance.rotate![index * 3 + 3];
                    if (perAngle != 0 && (this.instance.rotate![index * 3 + 0] != 0 || this.instance.rotate![index * 3 + 1] != 0 || this.instance.rotate![index * 3 + 2] != 0)) {
                        mat4.axisRotate(perMatrix, perAxis, perAngle, perMatrix);
                    }
                }
                if (positionEnable) {
                    let perPosition = vec3.fromValues(this.instance.position![index * 3 + 0], this.instance.position![index * 3 + 1], this.instance.position![index * 3 + 2]);
                    mat4.setTranslation(perMatrix, perPosition, perMatrix);
                }
                // mat4.scale(perMatrix, this.instance.scale[i], perMatrix);
                // mat4.axisRotate(perMatrix, this.instance.rotate[i].axis, this.instance.rotate[i].angleInRadians, perMatrix);
                // mat4.translate(perMatrix, this.instance.position[i], perMatrix);
                mat4.multiply(this.matrixWorld, perMatrix, perMatrix);     // 先缩放，再旋转，最后平移，然后乘以world matrix ，得到instance的world matrix，在shader中的VS是再次的局部坐标*这个world matrix，得到顶点的world position
                this.matrixWorldBuffer.set(perMatrix, i * 16);
            }

        }
        this.entity_id[0] = this.ID;
        this.stage_id[0] = this.stageID;
    }
}

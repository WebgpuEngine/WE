import { weVec3 } from "../base/coreDefine";
import { BaseCamera } from "./baseCamera";

export class CameraPositionAndInvertVP {

    parent: any;
    device: GPUDevice;

    gpubufferSize: number = 80;

    camerasData: {
        [uuid: string]: {
            camera: BaseCamera;
            cpubuffer: ArrayBuffer;
            cpuBufferView: {
                position: Float32Array;
                invertvp: Float32Array;
            };
            gpuBuffer: GPUBuffer;
        };
    } = {};

    constructor(parent: any, device: GPUDevice) {
        this.parent = parent;
        this.device = device;
    }
    destroy() {
        for (const uuid in this.camerasData) {
            const camera = this.camerasData[uuid];
            camera.gpuBuffer?.destroy();
        }
        this.camerasData = {};
    }
    add(camera: BaseCamera) {
        const cpubuffer = new ArrayBuffer(this.gpubufferSize);
        const cpuBufferView = {
            position: new Float32Array(cpubuffer, 0, 3),
            invertvp: new Float32Array(cpubuffer, 16, 16),
        };
        this.camerasData[camera.UUID] = {
            camera,
            cpubuffer,
            cpuBufferView,
            gpuBuffer: this.device.createBuffer({
                size: this.gpubufferSize,
                usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
            }),
        }
        cpuBufferView.position.set(camera.Position);
        cpuBufferView.invertvp.set(camera.getInverseVP());
    }
    update() {
        for (const uuid in this.camerasData) {
            const perCameraData = this.camerasData[uuid];
            this.device.queue.writeBuffer(perCameraData.gpuBuffer, 0, perCameraData.cpubuffer);
        }
    }
    /** 获取相机的GPU缓冲区 （调用者负责判断有效性，即是否为undefined）
     * @param uuid 相机UUID
     * @returns GPU缓冲区或undefined
    */
    getGPUBufferOfCamera(uuid: string): GPUBuffer | undefined {
        return this.camerasData[uuid]?.gpuBuffer;
    }
}
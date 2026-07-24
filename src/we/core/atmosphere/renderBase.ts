import { commmandType } from "../command/base";
import { E_GBufferNames } from "../gbuffers/base";
import { E_renderPassName } from "../scene/renderManager";
import { Scene } from "../scene/scene";
import { Atmosphere } from "./atmosphere";

export abstract class AtmosphereRenderBase {
    scene: Scene;
    device: GPUDevice;
    parent: Atmosphere;
    bindGroupLayout: GPUBindGroupLayout[] = [];
    bindGroups: GPUBindGroup[] = [];
    /**
     * 渲染命令:创建两种模式的渲染命令（跟进finalTarget.NDC变化）
     * 1、ndc渲染命令；
     * 2、afterDefer渲染命令；
     */
    commands: commmandType[] = [];
    rpd!: GPURenderPassDescriptor;
    pipeline!: GPURenderPipeline;
    constructor(parent: Atmosphere) {
        this.parent = parent;
        this.scene = parent.scene;
        this.device = parent.scene.device;
        this.generateCommands();
    }
    abstract generateCommands(): void;
    getBindGroups(): GPUBindGroup[] {
        return this.bindGroups;
    }

    getRpd(): GPURenderPassDescriptor {
        let colorTexture = this.scene.cameraManager.getGBufferTextureByUUID(this.scene.defaultCamera.UUID, E_GBufferNames.color);
        this.rpd = {
            label: "renderSkyWithLut",
            colorAttachments: [
                {
                    loadOp: "clear",
                    storeOp: "store",
                    view: colorTexture.createView(),
                },
            ],
        };
        return this.rpd;
    }
    update() {
        this.commands.forEach((DC) => {
            if (this.scene.finalTarget.NDC == true) {
                this.scene.renderManager.push({
                    command: DC,
                    kind: E_renderPassName.ndc,
                })
            } else {
                this.scene.renderManager.push({
                    command: DC,
                    kind: E_renderPassName.afterDeferRender,
                })
            }
        })
    }
}
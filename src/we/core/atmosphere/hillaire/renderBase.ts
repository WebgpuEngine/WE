import { commmandType } from "../../command/base";
import { E_GBufferNames } from "../../gbuffers/base";
import { E_renderPassName } from "../../scene/renderManager";
import { Scene } from "../../scene/scene";
import { AtmosphereHillaire } from "./atmosphereHillaire";

export abstract class HillaireRenderBase {
    scene: Scene;
    device: GPUDevice;
    parent: AtmosphereHillaire;
    bindGroupLayout: GPUBindGroupLayout[]=[];
    bindGroups: GPUBindGroup[] = [];
    commands: commmandType[] = [];
    rpd!: GPURenderPassDescriptor;
    pipeline!: GPURenderPipeline;
    constructor(parent: AtmosphereHillaire) {
        this.parent = parent;
        this.scene = parent.scene;
        this.device = parent.scene.device;
        this.generateCommands();
    }
    abstract generateCommands(): void;
    abstract getBindGroups(): GPUBindGroup[];

    getRpd():GPURenderPassDescriptor {
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
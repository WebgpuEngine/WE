import { commmandType } from "../../command/base";
import { E_GBufferNames } from "../../gbuffers/base";
import { E_renderPassName } from "../../scene/renderManager";
import { Scene } from "../../scene/scene";
import { AtmosphereHillaire } from "./atmosphereHillaire";

export abstract class HillaireLutBase {
    scene: Scene;
    device: GPUDevice;
    parent: AtmosphereHillaire;
    bindGroupLayout!: GPUBindGroupLayout;
    bindGroups: GPUBindGroup[] = [];
    commands: commmandType[] = [];
    constructor(parent: AtmosphereHillaire) {
        this.parent = parent;
        this.scene = parent.scene;
        this.device = parent.scene.device;
        this.generateCommands();
        this.commands.forEach((DC) => {
            DC.submit();
        })
    }
    abstract generateCommands(): void;

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
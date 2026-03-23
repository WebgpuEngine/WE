import { BaseCamera } from "../../camera/baseCamera";
import { E_renderPassName } from "../../scene/renderManager";
import { SHT_MeshMorphTargetVS } from "../../shadermanagemnet/mesh/morphTargetVS";
import { E_entityType, IV_BaseEntity } from "../base";
import { MorphTargetEntity } from "./morphTargetEntity";

export class MeshMorphTarget extends MorphTargetEntity {

    constructor(input: IV_BaseEntity) {
        super(input);

        this.kind = E_entityType.mesh;
        if (input.primitive) {
            this._primitive = input.primitive;
        }
        else {
            this._primitive = {
                topology: "triangle-list",
                cullMode: this._cullMode,
            };
        }
    }
    createTransparent(camera: BaseCamera): void {
        throw new Error("Method not implemented.");
    }
    _destroy(): void {
        throw new Error("Method not implemented.");
    }
    override createForwardDC(camera: BaseCamera): void {
        let UUID = camera.UUID;
        let dc = this.generateOpacityDC(UUID, SHT_MeshMorphTargetVS);
        this.cameraDC[UUID][E_renderPassName.forward].push(dc);
    }

}
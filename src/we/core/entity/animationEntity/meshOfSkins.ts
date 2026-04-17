import { DrawCommand } from "../../command/DrawCommand";
import { E_renderPassName } from "../../scene/renderManager";
import { SHT_MeshSkinsVS } from "../../shadermanagemnet/mesh/skinsVS";
import { E_entityType, IV_BaseEntity } from "../base";
import { SkinsEntity } from "./skinsEntity";

export class MeshSkins extends SkinsEntity {

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
    createTransparent(): void {
        throw new Error("Method not implemented.");
    }
    _destroy(): void {
        throw new Error("Method not implemented.");
    }
    override createForwardDC(): void {
        let dc = this.generateOpacityDC( SHT_MeshSkinsVS) as DrawCommand;
        this.renderPassArray[E_renderPassName.forward].push(dc);
    }

}
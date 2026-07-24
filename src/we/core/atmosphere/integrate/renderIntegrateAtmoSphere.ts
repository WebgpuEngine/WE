import { AtmosphereRenderBase } from "../renderBase";
import { AtmosphereIntegrate } from "./atmosphereIntegrate";
import { shader_atmosphere_wlBXWK } from "./baseIntergrate";

export class RenderIntegrateAtmoSphere extends AtmosphereRenderBase {

    declare parent: AtmosphereIntegrate;
    constructor(parent: AtmosphereIntegrate) {
        super(parent);
    }
    generateCommands(): void {
    }

}
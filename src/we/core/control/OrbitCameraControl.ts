import { CamreaControl } from "./cameracControl";


export class OrbitCameraControl extends CamreaControl {
    init() {
        throw new Error("Method not implemented.");
    }
    update(deltaTime: number): boolean {
        throw new Error("Method not implemented.");
    }
    constructor(option: optionCamreaControl) {
        super(option)
    }
}
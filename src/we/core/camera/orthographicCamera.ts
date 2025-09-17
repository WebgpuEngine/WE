import {
    mat4,
} from 'wgpu-matrix';


import { BaseCamera, projectionOptions } from "./baseCamera";

export interface optionOrthProjection extends projectionOptions {
    left: number,
    right: number,
    top: number,
    bottom: number,

}

export class OrthographicCamera extends BaseCamera {

    declare inpuValues: optionOrthProjection;
    constructor(option: optionOrthProjection) {
        super(option);
        this.inpuValues = option;
    }

    updateProjectionMatrix() {
        let aspect = this.scene.aspect;
        // let baseViewW = this.inpuValues.right - this.inpuValues.left;
        let baseViewH = this.inpuValues.top - this.inpuValues.bottom;
        // let centerX = (this.inpuValues.right + this.inpuValues.left) / 2;
        let centerY = (this.inpuValues.top + this.inpuValues.bottom) / 2;

        let top = centerY + baseViewH / aspect / 2;
        let bottom = centerY - baseViewH / aspect / 2;
        // let right = centerX + baseViewW / 2;
        // let left = centerX - baseViewW / 2;
        // let near = this.inpuValues.near;
        // let far = this.inpuValues.far;

        this.projectionMatrix = mat4.ortho(this.inpuValues.left, this.inpuValues.right, bottom, top, this.inpuValues.near, this.inpuValues.far);
        // console.log(this.projectionMatrix)
    }


}
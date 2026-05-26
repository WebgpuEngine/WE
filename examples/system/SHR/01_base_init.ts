import type { IV_Scene } from "../../../src/we/core/scene/base";
import { Scene } from "../../../src/we/core/scene/scene";
import { ShaderRegister } from "../../../src/we/core/SHR/shaderRegister";

declare global {
  interface Window {
    scene: any
    DC: any
  }
}
let input: IV_Scene = {
  canvas: "render",
  backgroudColor: [0, 0, 0, 0],
};
let scene = new Scene(input);
await scene._init();

window.scene = scene;

let shaderRegister = new ShaderRegister();
window.shaderRegister = shaderRegister;
console.log(shaderRegister);
// debugger;
window.reflection =
  [
    "@location(0) position : vec3f ,",
    "@location(1) normal : vec3f ,",
    "@location(2) color : vec3f ,",
    "@location(3) uv : vec2f ,"
  ];

window.refName = ["position", "normal", "color", "uv"];

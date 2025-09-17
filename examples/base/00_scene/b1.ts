import type { IV_Scene } from "../../../src/we/core/scene/base";
import { Scene } from "../../../src/we/core/scene/scene";

declare global {
  interface Window {
    scene: any
    DC: any
  }
}
let input: IV_Scene = {
  canvas: "render",
  color: {
    red: 0.0,
    green: 0.0,
    blue: 0.0,
    alpha: 1.0
  },
  premultipliedAlpha:false

}
let scene = new Scene(input);
await scene._init();

window.scene = scene;

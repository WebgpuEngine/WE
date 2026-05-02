import { PerspectiveCamera } from "../../../../../src/we/core/camera/perspectiveCamera";
import { E_ToneMappingType, IV_Scene } from "../../../../../src/we/core/scene/base";
import { initScene } from "../../../../../src/we/core/scene/fn";
import { createGLTFModel } from "../../../../../src/we/model/gltf/gltf";
import { DirectionalLight } from "../../../../../src/we/core/light/DirectionalLight";
import { AmbientLight } from "../../../../../src/we/core/light/ambientLight";

declare global {
  interface Window {
    scene: any
    DC: any
  }
}
let input: IV_Scene = {
  canvas: "render",
  backgroudColor: [0, 0, 0, 0.1],
  reversedZ: true,
  toneMapping: E_ToneMappingType.acesToSRGB,
  renderMode: "deferRender",
};
let scene = await initScene({
  initConfig: input,
});
window.scene = scene;
let oneDirlight = new DirectionalLight({
  color: [1, 1, 1],
  direction: [-1, 1, 1],
  intensity: 1.,
  shadow: false,
});
await scene.add(oneDirlight);

let ambientLight = new AmbientLight(
  {
    color: [1, 1, 1],
    intensity: 0.3
  }
)
await scene.add(ambientLight);
// let blur = new FXAA({ scene });


let radius = 5;
let Y = 0;
let camera = new PerspectiveCamera({
  fov: (2 * Math.PI) / 5,
  aspect: scene.aspect,
  near: 1,
  far: 1000,
  position: [3, 3, 80],
  lookAt: [0, 0, 0],
  controlType: "orbit",

});
await scene.add(camera);


let gltf = await createGLTFModel({
  scene: scene,
  url: "/models/gltf/model/LittlestTokyo/LittlestTokyo.glb"
}
);
window.gltf = gltf;
window.gltfInstance = await scene.add(gltf, {
  position: [2, 1, 0],
  scale: [0.1, 0.1, 0.1],
  // rotate: [1, 0, 0, Math.PI/2],
});

window.gltfInstance.AnimationGroup[0].play("loop");


import { vec3 } from "wgpu-matrix";
import { PerspectiveCamera } from "../../../../../src/we/core/camera/perspectiveCamera";
import { IV_Scene } from "../../../../../src/we/core/scene/base";
import { initScene } from "../../../../../src/we/core/scene/fn";
import { createGLTFModel } from "../../../../../src/we/model/gltf/gltf";
import { SphereGeometry } from "../../../../../src/we/core/geometry/sphereGeometry";
import { ColorMaterial } from "../../../../../src/we/core/material/standard/colorMaterial";
import { IV_MeshEntity, Mesh } from "../../../../../src/we/core/entity/mesh/mesh";
import { DirectionalLight } from "../../../../../src/we/core/light/DirectionalLight";
import { AmbientLight } from "../../../../../src/we/core/light/ambientLight";
import { FXAA } from "../../../../../src/we/core/postprocess/FXAA";

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
  toneMapping: "linear",
  deferRender: "color",
};
let scene = await initScene({
  initConfig: input,
});
window.scene = scene;
let oneDirlight = new DirectionalLight({
  color: [1, 1, 1],
  direction: [0, 1, 1],
  intensity: 0.3,
  shadow: false,
});
await scene.add(oneDirlight);

let ambientLight = new AmbientLight(
  {
    color: [1, 1, 1],
    intensity: 0.85
  }
)
await scene.add(ambientLight);


let radius = 5;
let Y = 0;
let camera = new PerspectiveCamera({
  fov: (2 * Math.PI) / 5,
  aspect: scene.aspect,
  near: 1,
  far: 1000,
  position: [3, 3, 200],
  lookAt: [0, 0, 0],
  controlType: "orbit",

});
await scene.add(camera);


let gltf = await createGLTFModel({
  scene: scene,
  url: "/models/gltf/model/LittlestTokyo/LittlestTokyo.glb"
  // url: "/models/gltf/model/LittlestTokyo/LittlestTokyo.gltf"
}
);
window.gltf = gltf;
window.gltfInstance = await scene.add(gltf, {
  // position: [0, 0, 0],
  scale: [0.3, 0.3, 0.3],
  // rotate: [1, 0, 0, Math.PI/2],
});

let blur = new FXAA({ scene });


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

declare global {
  interface Window {
    scene: any
    DC: any
  }
}
let input: IV_Scene = {
  canvas: "render",
  backgroudColor: [0, 0, 0, 0.91],
  reversedZ: true,
};
let scene = await initScene({
  initConfig: input,
});
window.scene = scene;
let oneDirlight = new DirectionalLight({
  color: [1, 1, 1],
  direction: [1, 1, 1],
  intensity: 3,

});
await scene.add(oneDirlight);

let ambientLight = new AmbientLight(
  {
    color: [1, 1, 1],
    intensity: 0.3
  }
)
await scene.add(ambientLight);


let radius = 5;
let Y = 0;
let camera = new PerspectiveCamera({
  fov: (2 * Math.PI) / 5,
  aspect: scene.aspect,
  near: 0.01,
  far: 100,
  position: [3, 3, 2],
  lookAt: [0, 0, 0],
  controlType: "orbit",

});
await scene.add(camera);


let gltf = await createGLTFModel({
  scene: scene,
  // url: "/models/gltf/model/LittlestTokyo/LittlestTokyo.glb"
  url: "/models/gltf/model/LittlestTokyo/LittlestTokyo.gltf"
}
);
window.gltf = gltf;
let nodeModel = await scene.add(gltf, {
  // position: [0, 0, 0],
  scale: [3, 3, 3],
  // rotate: [1, 0, 0, Math.PI/2],
});
console.log(nodeModel);

// let geometry = new SphereGeometry(

//   {
//     // radius:1.1,
//     // phiStart:0,
//     // phiLength:Math.PI/2 ,
//     // // thetaStart:0,
//     // // thetaLength:Math.PI,
//     // heightSegments:15,
//     // widthSegments:1,
//   }
// );

// let colorMaterial = new ColorMaterial({
//   color: [0, 0.1, 0.2, 1]
// });

// let inputMesh: IV_MeshEntity = {
//   attributes: {
//     geometry: geometry,
//   },
//   scale: [0.15, 0.15, 0.15],
//   position: [0, 0, -1],
//   material: colorMaterial,
//   wireFrame: {
//     color: [1, 1, 1, 1],
//     enable: true,
//     // wireFrameOnly: true,
//   }
// }
// let mesh = new Mesh(inputMesh);
// await scene.add(mesh);
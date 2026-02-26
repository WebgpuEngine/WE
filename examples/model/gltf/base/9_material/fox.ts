import { vec3 } from "wgpu-matrix";
import { PerspectiveCamera } from "../../../../../src/we/core/camera/perspectiveCamera";
import { IV_Scene } from "../../../../../src/we/core/scene/base";
import { initScene } from "../../../../../src/we/core/scene/fn";
import { createGLTFModel } from "../../../../../src/we/model/gltf/gltf";
import { SphereGeometry } from "../../../../../src/we/core/geometry/sphereGeometry";
import { ColorMaterial } from "../../../../../src/we/core/material/standard/colorMaterial";
import { IV_MeshEntity, Mesh } from "../../../../../src/we/core/entity/mesh/mesh";
import { AmbientLight } from "../../../../../src/we/core/light/ambientLight";
import { DirectionalLight } from "../../../../../src/we/core/light/DirectionalLight";

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
  toneMapping:"linear",
};
let scene = await initScene({
  initConfig: input,
});
window.scene = scene;

let oneDirlight1 = new DirectionalLight({
  color: [1, 1, 1],
  direction: [0, 0, 5],
  intensity: 0.5,

});
await scene.add(oneDirlight1);
let oneDirlight2 = new DirectionalLight({
  color: [1, 1, 1],
  direction: [0, 2, -5],
  intensity: 0.5,

});
await scene.add(oneDirlight2);

let ambientLight = new AmbientLight(
  {
    color: [1, 1, 1],
    intensity: 0.7
  }
)
await scene.add(ambientLight);


let radius = 5;
let Y = 0;
let camera = new PerspectiveCamera({
  fov: (2 * Math.PI) / 5,
  aspect: scene.aspect,
  near: 0.1,
  far: 500,
  position: [0, 10, 20],
  lookAt: [0, 0, 0],
  // update: (scope: any) => {
  //   const now = Date.now() / 1000;
  //   // console.log(scope.lookAt);
  //   scope.Position = vec3.fromValues(Math.sin(now) * radius,Y, Math.cos(now) * radius);
  //   // console.log(scope.position);
  // },
  controlType: "orbit",
});
await scene.add(camera);


let gltf = await createGLTFModel({
  scene: scene,
  url: "/models/gltf/model/Fox/glTF-Binary/Fox.glb"
  // url: "/models/gltf/model/Fox/glTF/Fox.gltf"
}
);
window.gltf = gltf;
console.log(gltf);
scene.add(gltf,
   {
  position: [0, 0, 0],
  scale: [0.1, 0.1, 0.1],
  rotate: [0, 1, 0, Math.PI/2],
}
);
// gltf.printAccessorContent(0)
// gltf.printAccessorContent(1)
// gltf.printAccessorContent(2)

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
//   // scale: [0.15, 0.15, 0.15],
//   position: [0, 0, -1],
//   material: colorMaterial,
//   wireFrame: {
//     color: [1, 1, 1, 1],
//     enable: true,
//     // wireFrameOnly: true,
//   }
// }
// let mesh = new Mesh(inputMesh);
// console.log(mesh);
// await scene.add(mesh);
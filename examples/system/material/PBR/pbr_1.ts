
import { PerspectiveCamera } from "../../../../src/we/core/camera/perspectiveCamera";
import { IV_Scene } from "../../../../src/we/core/scene/base";
import { initScene } from "../../../../src/we/core/scene/fn";
import { BoxGeometry } from "../../../../src/we/core/geometry/boxGeometry";
import { ColorMaterial } from "../../../../src/we/core/material/standard/colorMaterial";
import { IV_MeshEntity, Mesh } from "../../../../src/we/core/entity/mesh/mesh";
import { SphereGeometry } from "../../../../src/we/core/geometry/sphereGeometry";
import { PhongMaterial } from "../../../../src/we/core/material/phong/phongMaterial";
import { DirectionalLight } from "../../../../src/we/core/light/DirectionalLight";
import { IV_PBRMaterial, PBRMaterial } from "../../../../src/we/core/material/PBR/PBRMaterial";
import { AmbientLight } from "../../../../src/we/core/light/ambientLight";

declare global {
  interface Window {
    scene: any
    DC: any
  }
}
let input: IV_Scene = {
  canvas: "render",
  backgroudColor: [0, 0., 0., 0.],
  // reversedZ:true,
};
let scene = await initScene({
  initConfig: input,
});
window.scene = scene;

let radius = 2;
let Y = 0;
let camera = new PerspectiveCamera({
  fov: (2 * Math.PI) / 5,
  aspect: scene.aspect,
  near: 0.01,
  far: 100,
  position: [0, 0, 3],
  lookAt: [0, 0, 0],
  controlType: "arcball",
});
await scene.add(camera);


let onelight= new DirectionalLight({
  color: [1, 1, 1],
  direction: [0, 1, 0],
  intensity: 1,
  
});
await scene.add(onelight);

let ambientLight = new AmbientLight(
  {
    color: [1, 1, 1],
    intensity: 0.06
  }
)
await scene.add(ambientLight);


let geometry = new SphereGeometry({
    widthSegments: 128,
    heightSegments: 128,

});


// let colorMaterial = new ColorMaterial({
//   color: [0, 0.5, 0.5, 1]
// });
let PBROption:IV_PBRMaterial={
  textures: {
    albedo:  [1.0, 0.71, 0.29],
    metallic: 0.91,
    roughness: 0.31,
  }
}
let pbrMaterial = new PBRMaterial(PBROption);

let inputMesh: IV_MeshEntity = {
  attributes: {
    geometry: geometry,
  },
  material: pbrMaterial,
  // wireFrame: {
  //   color: [1, 1, 1, 1],
  //   enable: true,
  //   // wireFrameOnly: true,
  // }
}
let mesh = new Mesh(inputMesh);
console.log(mesh);
await scene.add(mesh);


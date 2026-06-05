import { PerspectiveCamera } from "../../../src/we/core/camera/perspectiveCamera";
import { IV_MeshEntity, Mesh } from "../../../src/we/core/entity/mesh/mesh";
import { SphereGeometry } from "../../../src/we/core/geometry/sphereGeometry";
import { IBL } from "../../../src/we/core/ibl/ibl";
import { AmbientLight } from "../../../src/we/core/light/ambientLight";
import { DirectionalLight } from "../../../src/we/core/light/DirectionalLight";
import { IV_PBRMaterial, PBRMaterial } from "../../../src/we/core/material/PBR/PBRMaterial";
import { IV_Scene } from "../../../src/we/core/scene/base";
import { initScene } from "../../../src/we/core/scene/fn";


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
let ibl = new IBL({
  scene: scene,
  enable: true,
  iblCount: 1,
  iblAABB: [[0, 0, 0, 0, 0, 0]],
  prefilteredCubeMap: ["IBL/IBL_1/IBL_1.png"],
  probeInfo: [
    {
      sh: [
        1.91613, 1.71772, 1.07797,
        -0.0591127, -0.0574315, -0.0346851,
        -3.8612e-05, -2.09015e-05, -1.35017e-05,

        0.439589, -0.431271, -0.0800766,
        -0.0306302, 0.0319348, 0.00328068,
        0.0758103, 0.0710374, 0.0591078,
        
        0.311676, 0.269456, 0.309399,
        -4.15644e-05, 6.26793e-05, 3.12488e-05,
        -0.541544, -0.468526, -0.536088,
      ],
      position: [0, 0, 0],
    },
  ],
});
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


let onelight = new DirectionalLight({
  color: [1, 1, 1],
  direction: [0, 1, 0],
  intensity: 1,

});
await scene.add(onelight);

let ambientLight = new AmbientLight(
  {
    color: [1, 1, 1],
    intensity: 0.0006
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
let PBROption: IV_PBRMaterial = {
  textures: {
    albedo: { value: [1.0, 1.0, 1.0, 1.0] },
    metallic: { value: 0.4 },
    roughness: { value: 0.6 },
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


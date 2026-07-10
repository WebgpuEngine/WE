import { weGetBinaryResourceFromGzip } from "../../../../src/we/core/base/file/getFile";
import { PerspectiveCamera } from "../../../../src/we/core/camera/perspectiveCamera";
import { IV_MeshEntity, Mesh } from "../../../../src/we/core/entity/mesh/mesh";
import { BoxGeometry } from "../../../../src/we/core/geometry/boxGeometry";
import { ColorMaterial } from "../../../../src/we/core/material/standard/colorMaterial";
import { TextureMaterial } from "../../../../src/we/core/material/standard/textureMaterial";
import { IV_Scene } from "../../../../src/we/core/scene/base";
import { initScene } from "../../../../src/we/core/scene/fn";
import { HDRTexture } from "../../../../src/we/core/texture/HDRTexture";
import { Texture2D } from "../../../../src/we/core/texture/texture2D";


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


const dataIrradiance = await weGetBinaryResourceFromGzip('/atmosphere/irradiance_rgba32f64x16.gz');


let colorMaterial = new ColorMaterial({
  color: [0, 0.1, 0.2, 1]
});
let hdrTexture = new Texture2D({
  source: dataIrradiance,
  format: "rgba32float",
  size: { width: 64, height: 16 },
}, scene.device, scene);
await hdrTexture.init();

let textureMaterial = new TextureMaterial({
  texture: hdrTexture,
});


let boxGeometry = new BoxGeometry();

let inputMesh: IV_MeshEntity = {
  attributes: {
    geometry: boxGeometry,
  },
  material: textureMaterial,
  // wireFrame: {
  //   color: [1, 1, 1, 1],
  //   enable: true,
  //   // wireFrameOnly: true,
  // }
}
let mesh = new Mesh(inputMesh);
console.log(mesh);
await scene.add(mesh);


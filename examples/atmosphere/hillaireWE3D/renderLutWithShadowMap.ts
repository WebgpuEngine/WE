import { E_ToneMappingType, eventOfScene, IV_Scene, userDefineEventCall } from "../../../src/we/core/scene/base";
import { initScene } from "../../../src/we/core/scene/fn";
import { Scene } from "../../../src/we/core/scene/scene";
import { E_renderPassName } from "../../../src/we/core/scene/renderManager";
import { AtmosphereHillaire } from "../../../src/we/core/atmosphere/hillaire/atmosphereHillaire";
import { PerspectiveCamera } from "../../../src/we/core/camera/perspectiveCamera";
import { IV_MeshEntity, Mesh } from "../../../src/we/core/entity/mesh/mesh";
import { SphereGeometry } from "../../../src/we/core/geometry/sphereGeometry";
import { AmbientLight } from "../../../src/we/core/light/ambientLight";
import { DirectionalLight } from "../../../src/we/core/light/DirectionalLight";
import { IV_PBRMaterial, PBRMaterial } from "../../../src/we/core/material/PBR/PBRMaterial";
import { weVec3 } from "../../../src/we/core/base/coreDefine";
import { PlaneGeometry } from "../../../src/we/core/geometry/planeGeomertry";
import { PhongMaterial } from "../../../src/we/core/material/phong/phongMaterial";


declare global {
  interface Window {
    scene: any
    DC: any
  }
}
let input: IV_Scene = {
  canvas: "render",
  toneMapping: E_ToneMappingType.ACES,
  backgroudColor: [0.5, 0.5, 0.5, 0.2],
  premultipliedAlpha: false,
  reversedZ: false,
  // modeNDC: true,
};
let scene = await initScene({
  initConfig: input,
  runImmediately: false,
});
window.scene = scene;
let camera = new PerspectiveCamera({
  fov: 45.0 * (Math.PI / 180.0),
  aspect: scene.aspect,
  near: 0.1,
  far: 100000,
  position: [15, 10, 30],//km
  // position: [0, 1, 100],//km
  lookAt: [0.0, 0.4, 1],
  isLookAtGlobal: true,
  controlType: "wasd",
});
await scene.add(camera);


//////////////////////////////////////////////////////////////////////
// light
let dirLight = new DirectionalLight({
  color: [1, 1, 1],
  direction: [0, 1, 0],
  intensity: 1,
});
await scene.add(dirLight);
let ambientLight = new AmbientLight(
  {
    color: [1, 1, 1],
    intensity: 0.06
  }
)
// await scene.add(ambientLight);
//////////////////////////////////////////////////////////////////////
// scene
// ground
let planeGeometry = new PlaneGeometry({
  width: 10,
  height: 10
});
// let groundMaterial = new PhongMaterial({
//   color: [1, 1, 1, 1],
//   roughness: 1,
//   metalness: 0.1,
//   shininess: 32
// });

let pbrGroundMaterial = new PBRMaterial({
  textures: {
    albedo: { value: [.50, .50, .50, 1] },
    metallic: { value: 0.1 },
    roughness: { value: 0.91 },
  }
});
let groundMesh = new Mesh({
  attributes: { geometry: planeGeometry, },
  material: pbrGroundMaterial,
});
let groundEntity = await scene.add({
  entity: groundMesh,
  position: [0, 0, 0],
  rotate: [1, 0, 0, -Math.PI / 2],
  scale: [10, 1, 10],

});
groundEntity.Name = "ground"


// sphere
let geometry = new SphereGeometry({
  widthSegments: 32,
  heightSegments: 32,
});
let PBROption: IV_PBRMaterial = {
  textures: {
    albedo: { value: [1.0, 0.71, 0.29, 1] },
    metallic: { value: 0.91 },
    roughness: { value: 0.31 },
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
await scene.add({
  entity: mesh,
  position: [1, 2, 0],
  scale: [2, 2, 2],
});


////////////////////////////////////////////////////////////
// atmosphere
let atmosphereHillaire = new AtmosphereHillaire(
  scene,
  {
    // FROM_KM_SCALE:  1000,
    mode: "rayMarch"
  },
);
window.atmosphereHillaire = atmosphereHillaire;

let timer = 0;
let oneCall: userDefineEventCall = {
  call: (scope: Scene) => {
    timer += 0.016667;
    let direction: weVec3 = [0, (Math.sin(timer / 2) + 0.8) / 2, -1];
    // let direction: weVec3 = [0, 1, 0];
    atmosphereHillaire.sun.direction = direction;
    dirLight.Direction = direction;
    // atmosphereHillaire.sun.direction = [0,0, -1];
  },
  name: "",
  state: true,
  event: eventOfScene.onBeforeUpdate
}
scene.addUserDefineEvent(oneCall);

scene.run();


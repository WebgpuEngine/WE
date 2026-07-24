import { E_ToneMappingType, eventOfScene, IV_Scene, userDefineEventCall } from "../../../src/we/core/scene/base";
import { initScene } from "../../../src/we/core/scene/fn";
import { Scene } from "../../../src/we/core/scene/scene";
import { E_renderPassName } from "../../../src/we/core/scene/renderManager";
import { AtmosphereHillaire } from "../../../src/we/core/atmosphere/hillaire/atmosphereHillaire";
import { PerspectiveCamera } from "../../../src/we/core/camera/perspectiveCamera";


declare global {
  interface Window {
    scene: any
    DC: any
  }
}
let input: IV_Scene = {
  canvas: "render",
  toneMapping: E_ToneMappingType.linear,
  backgroudColor: [1, 1, 1, 1],
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
  far: 1000,
  position: [0, 1, 100],//km
  lookAt: [0, 0, 1],
  controlType: "wasd",
});
await scene.add(camera);

// console.log("invert projectionMatrix:", mat4.inverse(scene.defaultCamera.projectionMatrix));
// console.log("invert viewMatrix:", scene.defaultCamera.viewMatrix);
let atmosphereHillaire = new AtmosphereHillaire(
  scene,
  {
    // TO_KM_SCALE: 1.0,
    mode: "rayMarch"
  },
  );


////////////////////////////////////////////////////////////
let timer = 0;
let oneCall: userDefineEventCall = {
  call: (scope: Scene) => {
    timer += 0.016667;

  },
  name: "",
  state: true,
  event: eventOfScene.onUpdate
}
scene.addUserDefineEvent(oneCall);

scene.run();


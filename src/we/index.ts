// ============================================================
// WE3D - WebGPU Engine 3D
// npm 包入口文件
// ============================================================

// ---- scene ----
export type { IV_Scene, initSceneConfig, userDefineEventCall } from "./core/scene/base";
export { E_ToneMappingType } from "./core/scene/base";
export { Scene } from "./core/scene/scene";
export { Clock } from "./core/scene/clock";
export { initScene } from "./core/scene/fn";

// ---- organization ----
export { RootGPU } from "./core/organization/root";
export type { IV_NodeSpace, T_worldRelationTransmit } from "./core/organization/nodeSpace";
export { NodeSpace } from "./core/organization/nodeSpace";
export type { NodeObjectJSON, IV_Node } from "./core/organization/nodeObject";
export { NodeObject, newNode } from "./core/organization/nodeObject";

// ---- animation ----
export type { IV_AnimationGroupValue } from "./core/animation/animationGroup";
export { AnimationGroup } from "./core/animation/animationGroup";
export type { I_AnimationPlayParams, I_AnimationSampler, I_AnimationRunTimer } from "./core/animation/base";
export { E_InterpolationModes, E_AnimationType, E_AnimationTargetType, E_PlayState, E_AnimationPlayType } from "./core/animation/base";
export type { IV_AnimationValue } from "./core/animation/BaseAnimation";
export { BaseAnimation } from "./core/animation/BaseAnimation";
export type { IV_Interpolator } from "./core/animation/interpolator";
export { Interpolator } from "./core/animation/interpolator";
export { KeyFrameAnimation } from "./core/animation/keyFrame";
export { MorphTargetAnimation } from "./core/animation/morphTarget";
export { Skeleton } from "./core/animation/skeleton";
export type { IV_SkinAnimationValue } from "./core/animation/skin";
export { SkinAnimation } from "./core/animation/skin";

// ---- base ----
export type { I_Update, weColor3, weColor4, weVec3, weVec4, weMat4, weMat3, TypedArray, weHexColor } from "./core/base/coreDefine";

// ---- camera ----
export type { I_BaseCameraValue } from "./core/camera/baseCamera";
export { BaseCamera } from "./core/camera/baseCamera";
export type { IV_OrthographicCamera } from "./core/camera/orthographicCamera";
export { OrthographicCamera } from "./core/camera/orthographicCamera";
export type { IV_PerspectiveCamera } from "./core/camera/perspectiveCamera";
export { PerspectiveCamera } from "./core/camera/perspectiveCamera";

// ---- command ----
export type { I_drawMode, I_drawModeIndexed, I_viewport, commmandType } from "./core/command/base";
export type { IV_ComputeCommand } from "./core/command/ComputeCommand";
export { ComputeCommand } from "./core/command/ComputeCommand";
export type { optionCopyT2T } from "./core/command/copyCommandT2T";
export { CopyCommandT2T } from "./core/command/copyCommandT2T";
export type { IV_DrawCommand } from "./core/command/DrawCommand";
export { DrawCommand } from "./core/command/DrawCommand";
export type { I_vsAttribute, I_baseGPUBufferBundle, I_vsGPUBufferBundle, I_indexGPUBufferBundle, I_vsAttributeMerge, T_vsAttribute, T_indexAttribute, IV_DC } from "./core/command/DrawCommandGenerator";
export { DrawCommandGenerator } from "./core/command/DrawCommandGenerator";
export type { IV_SimpleDrawCommand } from "./core/command/SimpleDrawCommand";
export { SimpleDrawCommand } from "./core/command/SimpleDrawCommand";

// ---- control ----
export type { cameracCntrolType } from "./core/control/base";
export { ArcballCameraControl } from "./core/control/arcballCameraControl";
export type { IV_CamreaControl } from "./core/control/cameracControl";
export { CamreaControl } from "./core/control/cameracControl";
export { OrbitCameraControl } from "./core/control/OrbitCameraControl";
export { WASDCameraControl } from "./core/control/wasdCameraControl";

// ---- entity ----
export type { IV_BaseEntity } from "./core/entity/base";
export type { IV_MeshEntity } from "./core/entity/mesh/mesh";
export { Mesh } from "./core/entity/mesh/mesh";
export type { IV_LinesEntity } from "./core/entity/mesh/lines";
export { Lines } from "./core/entity/mesh/lines";
export type { IV_PointsEntity, T_PointEmulate } from "./core/entity/mesh/points";
export { Points } from "./core/entity/mesh/points";
export { OneColoeCube } from "./core/entity/mesh/oneColorCube";
export type { IV_Sprite } from "./core/entity/sprite/sprite";
export { Sprite } from "./core/entity/sprite/sprite";
export { LinesMorphTarget } from "./core/entity/animationEntity/linesOfMorphTarget";
export { LinesSkins } from "./core/entity/animationEntity/linesOfSkins";
export { MeshMorphTarget } from "./core/entity/animationEntity/meshOfMorphTarget";
export { MeshSkins } from "./core/entity/animationEntity/meshOfSkins";

// ---- geometry ----
export type { optionBoxGemetry } from "./core/geometry/boxGeometry";
export { BoxGeometry } from "./core/geometry/boxGeometry";
export type { optionCircleGeometry } from "./core/geometry/circleGeometry";
export { CircleGeometry } from "./core/geometry/circleGeometry";
export type { optionConeGeometry } from "./core/geometry/coneGeometry";
export { ConeGeometry } from "./core/geometry/coneGeometry";
export type { optionCylinderGeometry } from "./core/geometry/cylinderGeometry";
export { CylinderGeometry } from "./core/geometry/cylinderGeometry";
export { DodecahedronGeometry } from "./core/geometry/DodecahedronGeometry";
export { IcosahedronGeometry } from "./core/geometry/IcosahedronGeometry";
export type { IV_LatheGeometryGemetry } from "./core/geometry/LatheGeometry";
export { LatheGeometry } from "./core/geometry/LatheGeometry";
export { OctahedronGeometry } from "./core/geometry/OctahedronGeometry";
export { OneColorCube } from "./core/geometry/oneColorCube";
export type { optionPlaneGeometry } from "./core/geometry/planeGeomertry";
export { PlaneGeometry } from "./core/geometry/planeGeomertry";
export type { optionPolyhedronGeometry } from "./core/geometry/polyhedronGeometry";
export { PolyhedronGeometry } from "./core/geometry/polyhedronGeometry";
export type { optionRingGeometry } from "./core/geometry/ringGeometry";
export { RingGeometry } from "./core/geometry/ringGeometry";
export type { optionSphereGeometry } from "./core/geometry/sphereGeometry";
export { SphereGeometry } from "./core/geometry/sphereGeometry";
export { TetrahedronGeometry } from "./core/geometry/terahedronGeometry";
export type { optionTorusGeometry } from "./core/geometry/torusGeometry";
export { TorusGeometry } from "./core/geometry/torusGeometry";

// ---- input ----
export type { I_InputRegisterPriorityLayer } from "./core/input/base";
export { E_InputEvent, E_InputPriority, E_InputControlType } from "./core/input/base";
export { BaseInputControl } from "./core/input/baseInputControl";

// ---- light ----
export type { I_optionBaseLight } from "./core/light/baseLight";
export { E_lightType, BaseLight } from "./core/light/baseLight";
export type { IV_AmbientLight } from "./core/light/ambientLight";
export { AmbientLight } from "./core/light/ambientLight";
export type { IV_DirectionalLight } from "./core/light/DirectionalLight";
export { DirectionalLight } from "./core/light/DirectionalLight";
export type { IV_PointLight } from "./core/light/pointLight";
export { PointLight } from "./core/light/pointLight";
export type { IV_SpotLight } from "./core/light/SpotLight";
export { SpotLight } from "./core/light/SpotLight";

// ---- material ----
export { BaseMaterial } from "./core/material/baseMaterial";
export type { I_ColorMaterial } from "./core/material/standard/colorMaterial";
export { ColorMaterial } from "./core/material/standard/colorMaterial";
export type { IV_CubeTextureMaterial } from "./core/material/standard/cubeTextureMaterial";
export { CubeTextureMaterial } from "./core/material/standard/cubeTextureMaterial";
export type { IV_TextureMaterial } from "./core/material/standard/textureMaterial";
export { TextureMaterial } from "./core/material/standard/textureMaterial";
export type { IV_VertexColorMaterial } from "./core/material/standard/vertexColorMaterial";
export { VertexColorMaterial } from "./core/material/standard/vertexColorMaterial";
export type { IV_VideoMaterial } from "./core/material/standard/videoMaterial";
export { VideoMaterial } from "./core/material/standard/videoMaterial";
export { WireFrameMaterial } from "./core/material/standard/wireFrameMaterial";
export type { IV_PBRMaterial } from "./core/material/PBR/PBRMaterial";
export { PBRMaterial } from "./core/material/PBR/PBRMaterial";
export type { IV_PhongMaterial } from "./core/material/phong/phongMaterial";
export { PhongMaterial } from "./core/material/phong/phongMaterial";

// ---- math ----
export type { Rotation } from "./core/math/baseDefine";
export { WeGenerateID, WeGenerateUUID } from "./core/math/baseFunction";
export type { boundingBox, Box2, Box3 } from "./core/math/Box";
export { computeAABB } from "./core/math/Box";
export type { boundingSphere, Sphere } from "./core/math/sphere";
export { generateSphereFromBox3, computeBoundingSphere } from "./core/math/sphere";

// ---- model ----
export type { I_Model } from "./core/model/BaseModel";
export { BaseModel } from "./core/model/BaseModel";
export { ModelDataLoader } from "./core/model/ModelDataLoader";

// ---- pickup ----
export type { IV_Pickup, T_PickupFunction, I_PickupMouseKeyEvent } from "./core/pickup/base";
export type { I_PickupedMouseKey } from "./core/pickup/pickup";
export { Pickup } from "./core/pickup/pickup";

// ---- postprocess ----
export type { IV_PostProcess } from "./core/postprocess/basePostProcess";
export { BasePostProcess } from "./core/postprocess/basePostProcess";
export type { I_FXAAValues } from "./core/postprocess/FXAA";
export { FXAA } from "./core/postprocess/FXAA";

// ---- texture ----
export type { I_BaseTexture, T_textureSourceType, I_BaseSampler, E_TextureChannel, I_mipmap } from "./core/texture/base";
export { BaseTexture } from "./core/texture/baseTexture";
export type { IV_CubeTexture } from "./core/texture/cubeTexxture";
export { CubeTexture } from "./core/texture/cubeTexxture";
export { DefaultCubeTexture } from "./core/texture/defaultCubeTexture";
export { DefaultTexture } from "./core/texture/defaultTexture";
export { Texture } from "./core/texture/texture";
export type { IV_OptionVideoTexture, T_VIdeoSourceType } from "./core/texture/videoTexture";
export { VideoTexture } from "./core/texture/videoTexture";

// ---- gltf model ----
export { GLTFModel, createGLTFModel } from "./model/gltf/gltf";

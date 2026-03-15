import * as  RAPIER from "@dimforge/rapier3d";

import { initWe } from "./we";
import { Testbed } from "./Testbed";
import * as CollisionGroups from "./demos/collisionGroups";


declare global {
    interface Window {
        scene: any
        DC: any
    }
}
let scene = await initWe();

type RAPIER_API = typeof RAPIER;
// type RAPIER_API = typeof import("@dimforge/rapier3d");

let builders = new Map([
    ["collision groups", CollisionGroups.initWorld],
    // ["character controller", CharacterController.initWorld],
    // ["convex polyhedron", ConvexPolyhedron.initWorld],
    // ["CCD", CCD.initWorld],
    // ["damping", Damping.initWorld],
    // ["fountain", Fountain.initWorld],
    // ["heightfield", Heightfield.initWorld],
    // ["joints", Joints.initWorld],
    // ["keva tower", Keva.initWorld],
    // ["locked rotations", LockedRotations.initWorld],
    // ["pid controller", PidController.initWorld],
    // ["platform", Platform.initWorld],
    // ["pyramid", Pyramid.initWorld],
    // ["triangle mesh", Trimesh.initWorld],
    // ["voxels", Voxels.initWorld],
    // ["GLTF to convexHull", glbToConvexHull.initWorld],
    // ["GLTF to trimesh", glbToTrimesh.initWorld],
]);
let testbed = new Testbed(RAPIER as RAPIER_API, builders, scene);
testbed.run();

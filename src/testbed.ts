import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { InstancedMesh } from "@babylonjs/core/Meshes/instancedMesh";
import { Scene } from "@babylonjs/core/scene";
import {
  AssetsManager,
  Mesh,
  ShadowGenerator,
  TransformNode,
  WebXRInputSource,
} from "@babylonjs/core";
import { Vector3, Color3, Quaternion } from "@babylonjs/core/Maths/math";
import { Animation } from "@babylonjs/core/Animations/animation";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";

//physics
import * as Cannon from "cannon";
import { CannonJSPlugin } from "@babylonjs/core/Physics/Plugins/cannonJSPlugin";
import { PhysicsImpostor } from "@babylonjs/core/Physics/physicsImpostor";
import "@babylonjs/core/Physics/physicsEngineComponent";


import { pfModule } from "./pfModule";
import { Game } from "./index";

export class Testbed implements pfModule {
  game: Game;

  private laser: AbstractMesh | null;
  private target: AbstractMesh | null;
  private door: AbstractMesh | null;

  private root: TransformNode | null;

  private loaded: boolean;


  constructor(game: Game) {
    this.game = game;

    this.root = null;

    this.laser = null;
    this.target = null;
    this.door = null;

    this.loaded = false;
  }

  public loadAssets(): void {
    let assetsManager = new AssetsManager(this.game.scene);
    let worldTask = assetsManager.addMeshTask(
      "world task",
      "",
      "assets/",
      "testbed.glb"
    );

    let self = this;

    worldTask.onSuccess = function (task) {
      task.loadedMeshes.forEach((mesh) => {
        //self.game.shadowGenerator!.getShadowMap()?.renderList?.push(mesh);

        // Instanced meshes don't work with edges
        let instance = <Mesh>mesh;
        instance.edgesShareWithInstances = false;

        if (mesh.name === "__root__") {
          self.root = mesh;
          let scale = 0.5;
          mesh.scaling = new Vector3(scale, scale, scale);
          let offset = new Vector3(0, -1, 0);
          mesh.position.addInPlace(offset);
        }



        // Default mesh stats
        // mesh.material.backFaceCulling = false;
        //mesh.receiveShadows = true;
        mesh.isPickable = false;

        let meshName = mesh.name.toLowerCase();

        // Handle meshes that we need to keep track of here
        switch (meshName) {
          case ("laser"): {
            self.laser = mesh;
            break;
          }
          case ("door"): {
            self.door = mesh;
            break;
          }
          case ("target"): {
            self.target = mesh;
            break;
          }
          default: {

          }
        }

        // Initialize meshes
        // Cubes are pickable, have physics, and mass
        if (meshName.startsWith("cube")) {
          mesh.isPickable = true;
          mesh.physicsImpostor = new PhysicsImpostor(
            mesh,
            PhysicsImpostor.BoxImpostor,
            { mass: 1, ignoreParent: true },
            self.game.scene
          );
          mesh.physicsImpostor.wakeUp();
        }

        // Target does not have physics, but is pickable
        if (meshName === "target") {
          mesh.isPickable = true;
        }

        // Ground meshes
        // Have physics, no mass, so they can interact with the prop objects
        if (meshName.startsWith("ground")) {
          mesh.isPickable = true;
          self.game.groundMeshes.push(mesh);
          mesh.physicsImpostor = new PhysicsImpostor(
            mesh,
            PhysicsImpostor.BoxImpostor,
            { mass: 0, friction: 0.5, restitution: 0.7, ignoreParent: true },
            self.game.scene
          );
          mesh.physicsImpostor.wakeUp();
        }

        // laser  is not pickable, initialize it's animation
        if (meshName === "laser") {
          mesh.isPickable = false;

          const frameRate = 1;

          const laserAnim = new Animation(
            "laserAnimation",
            "position",
            frameRate,
            Animation.ANIMATIONTYPE_VECTOR3, Animation.ANIMATIONLOOPMODE_CYCLE
          );

          const keyFrames = [];
          keyFrames.push({ frame: 0, value: new Vector3(0, 3, 0) });
          keyFrames.push({ frame: 10, value: new Vector3(0, 3, 0) });

          keyFrames.push({ frame: 12, value: new Vector3(0, 3, 6) });
          keyFrames.push({ frame: 24, value: new Vector3(0, 3, 6) });

          keyFrames.push({ frame: 26, value: new Vector3(0, 3, -6) });
          keyFrames.push({ frame: 36, value: new Vector3(0, 3, -6) });

          laserAnim.setKeys(keyFrames);

          mesh.animations.push(laserAnim);

          self.game.scene.beginAnimation(
            mesh,
            0,
            38,
            true
          );
        }
      });

      self.loaded = true;
    };

    worldTask.onError = function (task, message, exception) {
      console.log("Error loading " + task.name + ", " + message + " exception: " + exception);
    };

    assetsManager.load();
  }

  public update(): void {
    if (!this.loaded) {
      return;
    }

    if (this.laser?.intersectsMesh(this.target!, true)) {
      this.door!.visibility = 0;
      this.door?.getChildMeshes().forEach((mesh) => {
        mesh.visibility = 0;
      })
    } else {
      this.door!.visibility = 1;
      this.door?.getChildMeshes().forEach((mesh) => {
        mesh.visibility = 1;
      })
    }
  }

  public onControllerAdded(inputSource: WebXRInputSource): void { }
  public onControllerRemoved(inputSource: WebXRInputSource): void { }

  public processController(): void { }
}
/* CSCI 5619 Final Project, Fall 2020
 * Picture Frame: A Long Distance Virtual Object Interaction Technique
 * Authors: Ian Morrissey, Jacob Walters
 */

import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3, Color3, Quaternion } from "@babylonjs/core/Maths/math";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { WebXRControllerComponent } from "@babylonjs/core/XR/motionController/webXRControllercomponent";
import { WebXRInputSource } from "@babylonjs/core/XR/webXRInputSource";
import { WebXRCamera } from "@babylonjs/core/XR/webXRCamera";
import { WebXRSessionManager } from "@babylonjs/core/XR/webXRSessionManager";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { AssetsManager, TransformNode } from "@babylonjs/core";

// Side effects
import "@babylonjs/core/Helpers/sceneHelpers";
import "@babylonjs/inspector";
import "@babylonjs/loaders/glTF/2.0/glTFLoader";
import "@babylonjs/loaders/OBJ/objFileLoader";

class Game {
  private canvas: HTMLCanvasElement;
  private engine: Engine;
  private scene: Scene;

  private xrCamera: WebXRCamera | null;
  private xrSessionManager: WebXRSessionManager | null;
  private leftController: WebXRInputSource | null;
  private rightController: WebXRInputSource | null;
  private handMeshes: AbstractMesh[];
  private handClones: AbstractMesh[];

  constructor() {
    this.canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
    this.engine = new Engine(this.canvas, true);
    this.scene = new Scene(this.engine);

    this.xrCamera = null;
    this.xrSessionManager = null;
    this.leftController = null;
    this.rightController = null;
    this.handMeshes = [];
    this.handClones = [];
  }

  start(): void {
    this.createScene().then(() => {
      this.engine.runRenderLoop(() => {
        this.update();
        this.scene.render();
      });

      window.addEventListener("resize", () => {
        this.engine.resize();
      });
    });
  }

  private async createScene() {
    let camera = new UniversalCamera(
      "camera1",
      new Vector3(0, 1.6, 0),
      this.scene
    );
    camera.fov = (90 * Math.PI) / 180;
    camera.minZ = 0.1;
    camera.maxZ = 100;
    camera.attachControl(this.canvas, true);

    let pointLight = new PointLight(
      "pointLight",
      new Vector3(0, 2.5, 0),
      this.scene
    );
    pointLight.intensity = 1.0;
    pointLight.diffuse = new Color3(0.25, 0.25, 0.25);

    const environment = this.scene.createDefaultEnvironment({
      createGround: true,
      groundSize: 10,
      skyboxSize: 100,
      skyboxColor: new Color3(0, 0, 0),
    });
    environment!.skybox!.isPickable = false;

    const xrHelper = await this.scene.createDefaultXRExperienceAsync({});
    this.xrCamera = xrHelper.baseExperience.camera;
    this.xrSessionManager = xrHelper.baseExperience.sessionManager;
    xrHelper.teleportation.dispose();
    xrHelper.pointerSelection.dispose();
    xrHelper.input.onControllerAddedObservable.add((inputSource) => {
      if (inputSource.uniqueId.endsWith("right")) {
        this.rightController = inputSource;
        this.handClones.forEach((mesh) => {
          mesh.setParent(inputSource.pointer);
          mesh.scaling = new Vector3(-1, -1, 1);

          mesh.rotation = new Vector3(0, -Math.PI / 2.0, 0);
        });
      } else {
        this.leftController = inputSource;
        this.handMeshes.forEach((mesh) => {
          mesh.setParent(inputSource.pointer);
        });
      }
    });
    xrHelper.input.onControllerRemovedObservable.add((inputSource) => {
      if (inputSource.uniqueId.endsWith("right")) {
      } else {
      }
    });

    // Load meshes and game objects
    this.loadAssets();

    this.scene.debugLayer.show();
  }

  private update(): void {
    this.processControllerInput();
    this.renderHands();
  }

  private processControllerInput(): void {}

  private renderHands() {
    this.handClones.forEach((mesh) => (mesh.visibility = 0));
    this.handMeshes.forEach((mesh) => (mesh.visibility = 0));

    if (!this.rightController || !this.leftController) {
      return;
    }

    const rightTrigger = this.rightController!.motionController?.getComponent(
      "xr-standard-trigger"
    );
    const rightA = this.rightController!.motionController?.getComponent(
      "a-button"
    );
    const rightB = this.rightController!.motionController?.getComponent(
      "b-button"
    );
    const rightStick = this.rightController!.motionController?.getComponent(
      "xr-standard-thumbstick"
    );
    const leftTrigger = this.leftController!.motionController?.getComponent(
      "xr-standard-trigger"
    );
    const leftX = this.leftController!.motionController?.getComponent(
      "x-button"
    );
    const leftY = this.leftController!.motionController?.getComponent(
      "y-button"
    );
    const leftStick = this.leftController!.motionController?.getComponent(
      "xr-standard-thumbstick"
    );

    let rightButtonTouched =
      rightA?.touched || rightB?.touched || rightStick?.touched;
    let rightTriggerTouched = rightTrigger?.touched;

    let leftButtonTouched =
      leftX?.touched || leftY?.touched || leftStick?.touched;
    let leftTriggerTouched = leftTrigger?.touched;

    if (rightButtonTouched && rightTriggerTouched) {
      this.handClones[0].visibility = 1;
    } else if (rightTriggerTouched) {
      this.handClones[1].visibility = 1;
    } else if (rightButtonTouched) {
      this.handClones[2].visibility = 1;
    } else {
      this.handClones[3].visibility = 1;
    }

    if (leftButtonTouched && leftTriggerTouched) {
      this.handMeshes[0].visibility = 1;
    } else if (leftTriggerTouched) {
      this.handMeshes[1].visibility = 1;
    } else if (leftButtonTouched) {
      this.handMeshes[2].visibility = 1;
    } else {
      this.handMeshes[3].visibility = 1;
    }
  }

  private loadAssets(): void {
    let assetsManager = new AssetsManager(this.scene);
    let handTask = assetsManager.addMeshTask(
      "hand task",
      "",
      "assets/",
      "hands.glb"
    );

    let self = this;
    let initMesh = function (mesh: AbstractMesh, i: number) {
      console.log("initiating mesh " + i);
      mesh.visibility = 0;
      let clone = mesh.clone(mesh.name + "clone", mesh.parent);
      self.handMeshes[i] = mesh;
      self.handClones[i] = clone!;
    };

    handTask.onSuccess = function (task) {
      console.log("success");
      task.loadedMeshes.forEach((mesh) => {
        console.log(mesh.name);
        if (mesh.name === "fist") {
          initMesh(mesh, 0);
        } else if (mesh.name === "thumb") {
          initMesh(mesh, 1);
        } else if (mesh.name === "index") {
          initMesh(mesh, 2);
        } else if (mesh.name === "point") {
          initMesh(mesh, 3);
        }
      });
    };
    handTask.onError = function (task) {
      console.log("damn");
    };

    assetsManager.load();
    console.log("loading");
  }
}

let game = new Game();
game.start();

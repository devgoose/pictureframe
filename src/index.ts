/* CSCI 5619 Final Project, Fall 2020
 * Picture Frame: A Long Distance Virtual Object Interaction Technique
 * Authors: Ian Morrissey, Jacob Walters
 */

import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3, Color3, Quaternion } from "@babylonjs/core/Maths/math";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { WebXRInputSource } from "@babylonjs/core/XR/webXRInputSource";
import { WebXRCamera } from "@babylonjs/core/XR/webXRCamera";
import { WebXRSessionManager } from "@babylonjs/core/XR/webXRSessionManager";
import { PointLight } from "@babylonjs/core/Lights/pointLight";

// Side effects
import "@babylonjs/core/Helpers/sceneHelpers";
import "@babylonjs/inspector";
import "@babylonjs/loaders/glTF/2.0/glTFLoader";
import "@babylonjs/loaders/OBJ/objFileLoader";

// Modules
import { pfModule } from "./pfModule";
import { Hands } from "./hands";

class Game {
  private canvas: HTMLCanvasElement;
  private engine: Engine;
  private scene: Scene;

  private xrCamera: WebXRCamera | null;
  private xrSessionManager: WebXRSessionManager | null;
  private leftController: WebXRInputSource | null;
  private rightController: WebXRInputSource | null;
  private handsModule: Hands;

  private modules: pfModule[];

  constructor() {
    this.canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
    this.engine = new Engine(this.canvas, true);
    this.scene = new Scene(this.engine);

    this.xrCamera = null;
    this.xrSessionManager = null;
    this.leftController = null;
    this.rightController = null;
    this.handsModule = new Hands();

    // Define modules with common pfModule interface here
    this.modules = [new Hands()];
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
        this.rightController!.grip!.visibility = 0;
      } else {
        this.leftController = inputSource;
        this.leftController!.grip!.visibility = 0;
      }
      this.modules.forEach((pfModule) => {
        pfModule.onControllerAdded(inputSource);
      });
      this.handsModule.onControllerAdded(inputSource);
    });
    xrHelper.input.onControllerRemovedObservable.add((inputSource) => {
      if (inputSource.uniqueId.endsWith("right")) {
      } else {
      }
      this.modules.forEach((pfModule) => {
        pfModule.onControllerRemoved(inputSource);
      });
    });

    // Load meshes and game objects
    this.modules.forEach((pfModule) => {
      pfModule.loadAssets(this.scene);
    });

    this.scene.debugLayer.show();
  }

  private update(): void {
    this.processControllerInput();
  }

  private processControllerInput(): void {
    this.modules.forEach((pfModule) => {
      pfModule.processControllerInput(
        this.rightController!,
        this.leftController!
      );
    });
  }
}

let game = new Game();
game.start();

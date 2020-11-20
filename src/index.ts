/* CSCI 5619 Final Project, Fall 2020
 * Picture Frame: A Long Distance Virtual Object Interaction Technique
 * Authors: Ian Morrissey, Jacob Walters
 */

import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3, Color3, Color4, Space } from "@babylonjs/core/Maths/math";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { WebXRControllerComponent } from "@babylonjs/core/XR/motionController/webXRControllercomponent";
import { WebXRInputSource } from "@babylonjs/core/XR/webXRInputSource";
import { WebXRCamera } from "@babylonjs/core/XR/webXRCamera";
import { WebXRSessionManager } from "@babylonjs/core/XR/webXRSessionManager";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { Logger } from "@babylonjs/core/Misc/logger";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { LinesMesh } from "@babylonjs/core/Meshes/linesMesh";
import { Ray } from "@babylonjs/core/Culling/ray";
import { Axis } from "@babylonjs/core/Maths/math.axis";
import { Quaternion } from "@babylonjs/core/Maths/math.vector";
import { Animation } from "@babylonjs/core/Animations/animation";
import { Animatable } from "@babylonjs/core/Animations/animatable";
// Side effects
import "@babylonjs/core/Helpers/sceneHelpers";
import "@babylonjs/inspector";
import { AssetsManager, TransformNode } from "@babylonjs/core";

class Game {
  private canvas: HTMLCanvasElement;
  private engine: Engine;
  private scene: Scene;

  private xrCamera: WebXRCamera | null;
  private xrSessionManager: WebXRSessionManager | null;
  private leftController: WebXRInputSource | null;
  private rightController: WebXRInputSource | null;

  constructor() {
    this.canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
    this.engine = new Engine(this.canvas, true);
    this.scene = new Scene(this.engine);

    this.xrCamera = null;
    this.xrSessionManager = null;
    this.leftController = null;
    this.rightController = null;
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
      } else {
        this.leftController = inputSource;
      }
    });
    xrHelper.input.onControllerRemovedObservable.add((inputSource) => {
      if (inputSource.uniqueId.endsWith("right")) {
      } else {
      }
    });
  }

  private update(): void {
    this.processControllerInput();
  }

  private processControllerInput(): void {}
}

let game = new Game();
game.start();

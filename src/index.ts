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
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Mesh, ShadowGenerator } from "@babylonjs/core";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";

// physics
import * as Cannon from "cannon";
import { CannonJSPlugin } from "@babylonjs/core/Physics/Plugins/cannonJSPlugin";
import { PhysicsImpostor } from "@babylonjs/core/Physics/physicsImpostor";

// Side effects
import "@babylonjs/core/Helpers/sceneHelpers";
import "@babylonjs/inspector";
import "@babylonjs/loaders/glTF/2.0/glTFLoader";
import "@babylonjs/loaders/OBJ/objFileLoader";

// Modules
import { pfModule } from "./pfModule";
import { Hands } from "./hands";
import { previewFrame } from "./previewFrame";
import { World } from "./world";
import { Testbed } from "./testbed";
import { PermaFrame } from "./permaFrame";
import { LaserPointer } from "./laserPointer";

export class Game {
  public scene: Scene;
  public xrCamera: WebXRCamera | null;
  public leftController: WebXRInputSource | null;
  public rightController: WebXRInputSource | null;
  public root: TransformNode;
  public frames: PermaFrame[];
  public selectedObject: AbstractMesh | null;
  public shadowGenerator: ShadowGenerator | null;

  public groundMeshes: AbstractMesh[];
  public propMeshes: AbstractMesh[];

  private canvas: HTMLCanvasElement;
  private engine: Engine;
  private xrSessionManager: WebXRSessionManager | null;

  private handsModule: Hands;
  private previewFrameModule: previewFrame;
  //private worldModule: World;
  private testbedModule: Testbed;
  private laserModule: LaserPointer;
  private modules: pfModule[];


  constructor() {
    this.canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
    this.engine = new Engine(this.canvas, true);
    this.scene = new Scene(this.engine);

    this.xrCamera = null;
    this.xrSessionManager = null;
    this.leftController = null;
    this.rightController = null;
    this.handsModule = new Hands(this);
    this.previewFrameModule = new previewFrame(this);
    //this.worldModule = new World(this);
    this.testbedModule = new Testbed(this);
    this.laserModule = new LaserPointer(this);
    this.root = new TransformNode("root", this.scene);
    this.frames = [];
    this.selectedObject = null;
    this.shadowGenerator = null;

    // Define modules with common pfModule interface here
    this.modules = [
      this.handsModule,
      this.previewFrameModule,
      this.testbedModule,
      this.laserModule,
    ];

    this.groundMeshes = [];
    this.propMeshes = [];
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
    let directionalLight = new DirectionalLight(
      "directionalLight",
      new Vector3(0, -1, 1),
      this.scene
    );
    let ambientLight = new HemisphericLight(
      "ambientLight",
      new Vector3(0, 1, 0),
      this.scene
    );
    ambientLight.intensity = 1.0;
    ambientLight.diffuse = new Color3(1, 1, 1);
    directionalLight.intensity = 1.0;
    directionalLight.diffuse = new Color3(1, 1, 1);
    pointLight.intensity = 1.0;
    pointLight.diffuse = new Color3(0.25, 0.25, 0.25);
    this.shadowGenerator = new ShadowGenerator(2048, directionalLight);

    const environment = this.scene.createDefaultEnvironment({
      createGround: false,
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
        this.rightController!.grip!.setEnabled(false);
      } else {
        this.leftController = inputSource;
        this.leftController!.grip!.setEnabled(false);
      }
      this.modules.forEach((pfModule) => {
        pfModule.onControllerAdded(inputSource);
      });
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

    // physics
    this.scene.enablePhysics(
      new Vector3(0, -9.81, 0),
      new CannonJSPlugin(undefined, undefined, Cannon)
    );

    this.scene.debugLayer.show();
  }

  private update(): void {
    this.processControllerInput();
    this.modules.forEach((pfModule) => {
      pfModule.update();
    });
  }

  private processControllerInput(): void {
    this.modules.forEach((pfModule) => {
      pfModule.processController();
    });
  }

  public reset(): void {
    this.frames.forEach((frame) => {
      frame.destroy();
    });
    this.frames = [];
  }

  public addFrame(frame: PermaFrame) {
    this.frames.push(frame);
    this.modules.push(frame);
  }

  public removeFrame(frame: PermaFrame) {
    this.frames.splice(this.frames.indexOf(frame), 1);
    this.modules.splice(this.modules.indexOf(frame), 1);
    frame.destroy();
  }
}

let game = new Game();
game.start();

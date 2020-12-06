import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Scene } from "@babylonjs/core/scene";
import { AssetsManager, WebXRInputSource } from "@babylonjs/core";
import { Vector3, Color3, Quaternion } from "@babylonjs/core/Maths/math";

import { pfModule } from "./pfModule";
import { Game } from "./index";
import { PermaFrame } from "./permaFrame";

export class Hands implements pfModule {
  game: Game;

  private leftHands: AbstractMesh[]; // Left hands
  private rightHands: AbstractMesh[]; // Right hands
  private leftIndex: number;
  private leftGrab: AbstractMesh | null;
  private leftDir: Vector3; // keeps track of direction for deletion

  private rightIndex: number;
  private rightGrab: AbstractMesh | null;
  private rightDir: Vector3; // keeps track of direction for deletion

  constructor(game: Game) {
    this.game = game;
    this.leftHands = [];
    this.rightHands = [];

    this.leftIndex = 0;
    this.leftGrab = null;
    this.leftDir = new Vector3();

    this.rightIndex = 0;
    this.rightGrab = null;
    this.rightDir = new Vector3();
  }

  public loadAssets(): void {
    let assetsManager = new AssetsManager(this.game.scene);
    let handTask = assetsManager.addMeshTask(
      "hand task",
      "",
      "assets/",
      "hands.glb"
    );

    let self = this;
    let initMesh = function (mesh: AbstractMesh, i: number) {
      mesh.visibility = 0;
      let clone = mesh.clone(mesh.name + "clone", mesh.parent);
      self.leftHands[i] = mesh;
      self.rightHands[i] = clone!;
    };

    handTask.onSuccess = function (task) {
      task.loadedMeshes.forEach((mesh) => {
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
      console.log("Error loading " + task.name);
    };

    assetsManager.load();
  }

  public onControllerAdded(inputSource: WebXRInputSource): void {
    if (inputSource.uniqueId.endsWith("right")) {
      this.rightHands.forEach((mesh) => {
        mesh.setParent(inputSource.pointer);
        mesh.scaling = new Vector3(-1, -1, 1);

        mesh.rotation = new Vector3(0, -Math.PI / 2.0, 0);
      });
    } else {
      this.leftHands.forEach((mesh) => {
        mesh.setParent(inputSource.pointer);
      });
    }
  }

  public onControllerRemoved(inputSource: WebXRInputSource): void {}

  public update(): void {
    this.updateLeft(this.leftIndex);
    this.updateRight(this.rightIndex);
  }

  public processController(): void {
    this.rightHands.forEach((mesh) => (mesh.visibility = 0));
    this.leftHands.forEach((mesh) => (mesh.visibility = 0));

    let rightController = this.game.rightController;
    let leftController = this.game.leftController;

    if (!rightController || !leftController) {
      return;
    }

    const rightTrigger = rightController!.motionController?.getComponent(
      "xr-standard-trigger"
    );
    const rightA = rightController!.motionController?.getComponent("a-button");
    const rightB = rightController!.motionController?.getComponent("b-button");
    const rightStick = rightController!.motionController?.getComponent(
      "xr-standard-thumbstick"
    );
    const rightSqueeze = rightController!.motionController?.getComponent(
      "xr-standard-squeeze"
    );
    const leftTrigger = leftController!.motionController?.getComponent(
      "xr-standard-trigger"
    );
    const leftX = leftController!.motionController?.getComponent("x-button");
    const leftY = leftController!.motionController?.getComponent("y-button");
    const leftStick = leftController!.motionController?.getComponent(
      "xr-standard-thumbstick"
    );
    const leftSqueeze = leftController!.motionController?.getComponent(
      "xr-standard-squeeze"
    );

    // First, handle grabbing and releasing
    if (leftSqueeze?.changes.pressed) {
      if (leftSqueeze.pressed) {
        for (let frame of this.game.frames) {
          let mesh = frame.getMesh();
          // Don't grab something with two hands
          if (
            mesh !== this.rightGrab &&
            mesh!.intersectsMesh(this.leftHands[this.leftIndex], true)
          ) {
            this.leftGrab = mesh;
            this.leftDir = leftController.pointer.getDirection(
              new Vector3(0, 0, 1)
            );
            break;
          }
        }
      } else {
        this.leftGrab?.setParent(null);
        this.leftGrab = null;
      }
    }
    if (rightSqueeze?.changes.pressed) {
      if (rightSqueeze.pressed) {
        for (let frame of this.game.frames) {
          let mesh = frame.getMesh();
          // Don't grab something with two hands
          if (
            mesh !== this.leftGrab &&
            mesh!.intersectsMesh(this.rightHands[this.rightIndex], true)
          ) {
            this.rightGrab = mesh;
            this.rightDir = rightController.pointer.getDirection(
              new Vector3(0, 0, 1)
            );
            break;
          }
        }
      } else {
        this.rightGrab?.setParent(null);
        this.rightGrab = null;
      }
    }

    let rightButtonTouched =
      rightA?.touched || rightB?.touched || rightStick?.touched;
    let rightTriggerTouched = rightTrigger?.touched;

    let leftButtonTouched =
      leftX?.touched || leftY?.touched || leftStick?.touched;
    let leftTriggerTouched = leftTrigger?.touched;

    // Update hand models based on input
    if (rightButtonTouched && rightTriggerTouched) {
      this.rightIndex = 0;
    } else if (rightTriggerTouched) {
      this.rightIndex = 1;
    } else if (rightButtonTouched) {
      this.rightIndex = 2;
    } else {
      this.rightIndex = 3;
    }

    if (leftButtonTouched && leftTriggerTouched) {
      this.leftIndex = 0;
    } else if (leftTriggerTouched) {
      this.leftIndex = 1;
    } else if (leftButtonTouched) {
      this.leftIndex = 2;
    } else {
      this.leftIndex = 3;
    }

    // Reset gesture--all buttons and triggers down, removes all frames
    if (
      rightA?.pressed &&
      rightB?.pressed &&
      rightTrigger?.pressed &&
      leftX?.pressed &&
      leftY?.pressed &&
      leftTrigger?.pressed
    ) {
      this.game.reset();
    }
  }

  // Helpers to control switching of hand models
  private updateRight(index: number): void {
    if (!this.rightHands[index]) {
      return;
    }
    this.rightHands[index].visibility = 1;
    this.rightHands[index].showBoundingBox = true;
    if (this.rightGrab) {
      this.rightGrab.setParent(this.game.rightController!.pointer);
    }
  }

  private updateLeft(index: number): void {
    if (!this.leftHands[index]) {
      return;
    }
    this.leftHands[index].visibility = 1;
    this.leftHands[index].showBoundingBox = true;
    if (this.leftGrab) {
      this.leftGrab.setParent(this.game.leftController!.pointer);
    }
  }
}

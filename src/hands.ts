import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { AssetsManager, WebXRInputSource } from "@babylonjs/core";
import { Vector3, Color3 } from "@babylonjs/core/Maths/math";

import { pfModule } from "./pfModule";
import { Game } from "./index";
import { PermaFrame } from "./permaFrame";

export class Hands implements pfModule {
  game: Game;

  private leftHands: AbstractMesh[]; // Left hands
  private rightHands: AbstractMesh[]; // Right hands
  private leftIndex: number;
  private leftGrab: PermaFrame | null;
  private leftDir: Vector3; // keeps track of plane normal for deletion

  private rightIndex: number;
  private rightGrab: PermaFrame | null;
  private rightDir: Vector3; // keeps track of plane normal for deletion

  private zooming: boolean; // keeps track of if we are zooming or not
  private baseDist: number; // initial distance between controllers when starting zoom
  private basePos: Vector3; // initial position of camera
  private zoomFactor: number; // factor of how much to move camera during zoom

  private tolerance: number;

  // Maybe add some state management here so each module doesn't have to check 
  // the inputs, probably doesn't really matter

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

    this.zooming = false;
    this.baseDist = 1;
    this.basePos = new Vector3();
    this.zoomFactor = 10;

    this.tolerance = 0.2; // arbitrary choice for antiparallel check
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

      clone!.isPickable = false;
      mesh!.isPickable = false;

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

  public onControllerRemoved(inputSource: WebXRInputSource): void { }

  public update(): void {
    this.updateLeft(this.leftIndex);
    this.updateRight(this.rightIndex);
    this.updateZoom();
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
    const rightPointer = rightController!.pointer.getDirection(
      new Vector3(0, 0, 1)
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
    const leftPointer = rightController!.pointer.getDirection(
      new Vector3(0, 0, 1)
    );

    // First, handle grabbing and releasing
    if (leftSqueeze?.changes.pressed) {
      if (leftSqueeze.pressed) {
        for (let frame of this.game.frames) {
          // Don't grab something with two hands
          if (
            frame.intersects(this.leftHands[this.leftIndex])
          ) {
            this.leftGrab = frame;
            this.leftDir = frame.getNormal();
            break;
          }
        }
      } else {
        if (this.leftGrab) {
          this.leftGrab?.getMesh()!.setParent(null);

          if (this.antiparallel(this.leftDir, this.leftGrab.getNormal(), this.tolerance)) {
            this.game.removeFrame(this.leftGrab);
          }
          this.leftGrab = null;
        }
      }
    }
    if (rightSqueeze?.changes.pressed) {
      if (rightSqueeze.pressed) {
        for (let frame of this.game.frames) {
          // Don't grab something with two hands
          if (
            frame.intersects(this.rightHands[this.rightIndex])
          ) {
            this.rightGrab = frame;
            this.rightDir = frame.getNormal();;
            break;
          }
        }
      } else {
        if (this.rightGrab) {
          this.rightGrab.getMesh()!.setParent(null);
          if (this.antiparallel(this.rightDir, this.rightGrab.getNormal(), this.tolerance)) {
            this.game.removeFrame(this.rightGrab);
          }
          this.rightGrab = null;
        }
      }
    }

    // Update texture on grabbed objects
    if (this.leftGrab) {
      if (this.antiparallel(this.leftDir, this.leftGrab.getNormal(), this.tolerance)) {
        this.leftGrab.setDeleteTexture(true);
      } else {
        this.leftGrab.setDeleteTexture(false);
      }
    }
    if (this.rightGrab) {
      if (this.antiparallel(this.rightDir, this.rightGrab.getNormal(), this.tolerance)) {
        this.rightGrab.setDeleteTexture(true);
      } else {
        this.rightGrab.setDeleteTexture(false);
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
    this.rightHands[index].showBoundingBox = false;
    if (this.rightGrab && this.rightGrab !== this.leftGrab) {
      this.rightGrab.setParent(this.game.rightController!.pointer);
    }
  }

  private updateLeft(index: number): void {
    if (!this.leftHands[index]) {
      return;
    }
    this.leftHands[index].visibility = 1;
    this.leftHands[index].showBoundingBox = false;
    if (this.leftGrab && this.rightGrab !== this.leftGrab) {
      this.leftGrab.setParent(this.game.leftController!.pointer);
    }
  }

  private updateZoom(): void {
    // Must have both grabs, and they must be the same frame
    // Also need both controllers
    if (!(this.game.leftController &&
      this.game.rightController &&
      this.leftGrab &&
      this.rightGrab &&
      this.leftGrab === this.rightGrab)) {
      this.zooming = false;
      return;
    }

    this.leftGrab.setParent(null);
    this.rightGrab.setParent(null);

    // Initialize zooming state if need to
    if (!this.zooming) {
      this.zooming = true;
      let controllerDist = this.game.leftController.grip!.position.subtract(this.game.rightController.grip!.position);
      this.baseDist = controllerDist.length();
      this.basePos = this.rightGrab.getCamera()!.position.clone();
    }

    // Adjust camera along its viewdir based on difference between
    // controller distance once it started
    // just using the right grab for this, they're the same so it doesn't matter
    let rightToLeft: Vector3 = this.game.leftController.grip!.position.subtract(this.game.rightController.grip!.position);
    let distDiff = rightToLeft.length() - this.baseDist;

    let camera = this.rightGrab.getCamera();
    let viewDir = camera!.getDirection(new Vector3(0, 0, 1));

    // Offset camera by distDiff * zoomFactor
    camera!.position = this.basePos.add(viewDir.scale(distDiff * this.zoomFactor));
  }

  private antiparallel(u: Vector3, v: Vector3, tolerance: number) {
    let dot = Vector3.Dot(u, v);
    if (Math.abs(dot + 1) > tolerance) {
      return false;
    }
    return true;
  }
}

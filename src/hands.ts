import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Scene } from "@babylonjs/core/scene";
import { AssetsManager, WebXRInputSource } from "@babylonjs/core";
import { Vector3, Color3, Quaternion } from "@babylonjs/core/Maths/math";

import { pfModule } from "./pfModule";
import { Game } from "./index";

export class Hands implements pfModule {
  game: Game;

  private handMeshes: AbstractMesh[];
  private handClones: AbstractMesh[];

  constructor(game: Game) {
    this.game = game;
    this.handMeshes = [];
    this.handClones = [];
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
      self.handMeshes[i] = mesh;
      self.handClones[i] = clone!;
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
      this.handClones.forEach((mesh) => {
        mesh.setParent(inputSource.pointer);
        mesh.scaling = new Vector3(-1, -1, 1);

        mesh.rotation = new Vector3(0, -Math.PI / 2.0, 0);
      });
    } else {
      this.handMeshes.forEach((mesh) => {
        mesh.setParent(inputSource.pointer);
      });
    }
  }

  public onControllerRemoved(inputSource: WebXRInputSource): void {}

  public update(): void {}

  public processController(): void {
    this.handClones.forEach((mesh) => (mesh.visibility = 0));
    this.handMeshes.forEach((mesh) => (mesh.visibility = 0));

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
    const leftTrigger = leftController!.motionController?.getComponent(
      "xr-standard-trigger"
    );
    const leftX = leftController!.motionController?.getComponent("x-button");
    const leftY = leftController!.motionController?.getComponent("y-button");
    const leftStick = leftController!.motionController?.getComponent(
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
}

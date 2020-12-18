import { Scene } from "@babylonjs/core/scene";
import { WebXRInputSource } from "@babylonjs/core";
import { LinesMesh } from "@babylonjs/core/Meshes/linesMesh";
import { Vector3, Color3 } from "@babylonjs/core/Maths/math";
import { Ray } from "@babylonjs/core/Culling/ray";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Quaternion } from "@babylonjs/core/Maths/math.vector";



import { pfModule } from "./pfModule";
import { Game } from "./index";

export class LaserPointer implements pfModule {
  game: Game;

  private laserPointer: LinesMesh | null;
  private laserActivated: boolean;
  private maxTeleport: number;
  private teleportPoint: Vector3 | null;

  private stickThreshold: number;
  private stickDeadzone: number;
  private stickNeutral: boolean;
  private turnAngle: number;

  constructor(game: Game) {
    this.game = game;

    this.laserPointer = null;
    this.laserActivated = false;
    this.maxTeleport = 20; // max distance the ray is cast
    this.teleportPoint = null;

    this.stickThreshold = 0.5;
    this.stickDeadzone = 0.2;
    this.stickNeutral = true;
    this.turnAngle = 30;
  }

  public loadAssets(): void {
    this.laserPointer = MeshBuilder.CreateLines("laserPointer",
      { points: [new Vector3(0, 0, 0), new Vector3(0, 0, 1)] },
      this.game.scene);
    this.laserPointer.color = Color3.Red();
    this.laserPointer.visibility = 0;
    this.laserPointer.isPickable = false;
  }

  public onControllerAdded(inputSource: WebXRInputSource): void {
    if (inputSource.uniqueId.endsWith("right")) {
      this.laserPointer!.parent = inputSource.pointer;
    }
  }

  public onControllerRemoved(inputSource: WebXRInputSource): void {
    if (inputSource.uniqueId.endsWith("right")) {
      this.laserPointer!.parent = null;
      this.laserPointer!.visibility = 0;
    }
  }

  public processController(): void {
    const rightController = this.game.rightController;
    if (!rightController) {
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

    let rightButtonTouched =
      rightA?.touched || rightB?.touched || rightStick?.touched || rightA?.pressed;
    let rightTriggerTouched = rightTrigger?.touched || rightTrigger?.pressed;

    // Check to see if they are doing a "pointing" gesture
    if (rightButtonTouched && (!rightTriggerTouched || this.laserActivated)) {
      this.laserActivated = true;
    } else {
      this.laserActivated = false;
      this.laserPointer!.visibility = 0;
    }

    // Handle picking and teleportation
    if (this.laserActivated) {
      let ray = new Ray(
        rightController!.pointer.position,
        rightController!.pointer.forward,
        this.maxTeleport
      );
      let pickInfo = this.game.scene.pickWithRay(ray);

      let teleportPoint = null;
      // First, just update the length of the lazer
      if (pickInfo!.hit && this.game.groundMeshes.includes(pickInfo!.pickedMesh!)) {
        this.laserPointer!.visibility = 1;
        this.laserPointer!.scaling.z = pickInfo!.distance;
        teleportPoint = pickInfo?.pickedPoint;
      }

      // If right trigger pressed while the gesture is activated, teleport
      if (rightTrigger!.pressed && !!teleportPoint) {
        this.teleport(teleportPoint)
      }
    }

    // Handle rotation here too... not really "laser pointer" but locomotive so I'll just stick it here
    {
      let stickVal = rightStick ? rightStick.axes.x : 0;
      if (Math.abs(stickVal) < this.stickDeadzone) {
        this.stickNeutral = true;
      }

      if (Math.abs(stickVal) > this.stickThreshold && this.stickNeutral) {
        // Turn
        this.stickNeutral = false;
        let turnAngle = (Math.abs(stickVal) / stickVal) * this.turnAngle;
        let cameraRotation = Quaternion.FromEulerAngles(0, (turnAngle * Math.PI) / 180, 0);
        this.game.xrCamera!.rotationQuaternion.multiplyInPlace(cameraRotation);
      }
    }

  }

  private teleport(point: Vector3) {
    let baseHeight = this.game.xrCamera!.position.y;
    this.game.xrCamera!.position = point.clone();
    this.game.xrCamera!.position.y += baseHeight;
    this.laserActivated = false;
  }

  public update(): void {

  }
}
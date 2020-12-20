import { Scene } from "@babylonjs/core/scene";
import { Logger, WebXRInputSource } from "@babylonjs/core";
import { Vector3, Color3, Plane } from "@babylonjs/core/Maths/math";
import { Ray } from "@babylonjs/core/Culling/ray";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Quaternion } from "@babylonjs/core/Maths/math.vector";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";



import { pfModule } from "./pfModule";
import { Game } from "./index";

export class LaserPointer implements pfModule {
  game: Game;

  private laserPointer: Mesh | null;
  private laserActivated: boolean;
  private maxTeleport: number;
  private teleportPoint: Vector3 | null;

  private stickThreshold: number;
  private stickDeadzone: number;
  private stickNeutral: boolean;
  private turnAngle: number;

  private laserOffset: Vector3;

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

    // Constant offset so the laser comes out of the finger.
    // This is added to the laser and pick ray's position
    this.laserOffset = new Vector3(0.02, 0.025, 0.09);
  }

  public loadAssets(): void {
    this.laserPointer = MeshBuilder.CreateTube("laserPointer",
      { path: [new Vector3(0, 0, 0), new Vector3(0, 0, 1)], radius: 1 },
      this.game.scene);
    this.laserPointer.position = this.laserOffset; // just puts it coming out of the finger
    this.laserPointer.setEnabled(false);
    this.laserPointer.isPickable = false;

    let mat = new StandardMaterial("laserMaterial", this.game.scene);
    mat.diffuseColor = new Color3(1, 0, 0);

    this.laserPointer.material = mat;
  }

  public onControllerAdded(inputSource: WebXRInputSource): void {
    if (inputSource.uniqueId.endsWith("right")) {
      this.laserPointer!.parent = inputSource.pointer;
    }
  }

  public onControllerRemoved(inputSource: WebXRInputSource): void {
    if (inputSource.uniqueId.endsWith("right")) {
      this.laserPointer!.parent = null;
      this.laserPointer!.setEnabled(false);
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
      this.laserPointer!.setEnabled(false);
    }

    // Handle picking and teleportation
    if (this.laserActivated) {
      let ray = new Ray(
        rightController!.pointer.position.add(this.laserOffset),
        rightController!.pointer.forward,
        this.maxTeleport
      );
      let pickInfo = this.game.scene.pickWithRay(ray);

      let teleportPoint = null;
      // First, just update the length of the lazer
      if (pickInfo!.hit && this.game.groundMeshes.includes(pickInfo!.pickedMesh!)) {
        this.laserPointer!.setEnabled(true);
        this.laserPointer!.scaling = new Vector3(0.003, 0.003, pickInfo!.distance);
        teleportPoint = pickInfo?.pickedPoint;
      }

      if (pickInfo!.hit){
        this.game.frames.forEach((frame)=>{
          if(pickInfo!.pickedMesh! === frame.getBoundary()){
            // The laser has picked a frame's boundary.
            // Need the point that the laser hits the boundary on
            let camPos = frame.getCamera()?.position;
            let hitPos = pickInfo!.pickedPoint?.clone();
            let positionOnBoundary = hitPos?.subtract(frame.getBoundary()!.position);
            let plain = Plane.FromPositionAndNormal(frame.getBoundary()!.position, frame.getNormal());
            // Now we need to turn this into normalized coordinates
            let xy = positionOnBoundary?.projectOnPlane(plain, frame.getBoundary()!.position);

            Logger.Log("pos on boundary: " + positionOnBoundary?.toString() + "\nxy?: "+ xy?.toString());
          }
        });
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
    this.game.xrCamera!.position.y = baseHeight;
    this.laserActivated = false;
  }

  public update(): void {

  }
}
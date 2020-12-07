import { Scene } from "@babylonjs/core/scene";
import { Vector3, Color3, Plane } from "@babylonjs/core/Maths/math";
import { WebXRInputSource } from "@babylonjs/core/XR/webXRInputSource";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Logger } from "@babylonjs/core/Misc/logger";
import { RenderTargetTexture } from "@babylonjs/core/Materials/Textures/renderTargetTexture";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { CustomMaterial } from "@babylonjs/materials/custom/customMaterial";
import { Effect } from "@babylonjs/core";

import { pfModule } from "./pfModule";
import { Game } from "./index";
import { PermaFrame } from "./permaFrame";

export class previewFrame implements pfModule {
  game: Game;

  private tolerance: number; // Tolerance for difference in ortho/parallel checks in frameGesture
  private gestureMade: boolean; // Tracks if gesture was made on previous frame
  private frameMade: boolean;

  private leftCorner: Vector3; // Corner used to create frame mesh
  private rightCorner: Vector3; // Corner used to create frame mesh
  private minwidth: number;
  private minheight: number;

  // Frameinfo to be passed to permanent frame constructor
  private finalwidth: number;
  private finalheight: number;
  private finalVertexData: VertexData;
  private finalFOV: number;
  private finalCenter: Vector3;
  private finalwDir: Vector3;
  private finalhDir: Vector3;
  private finalNormal: Vector3;

  private redMaterial: StandardMaterial | null;
  private greenMaterial: StandardMaterial | null;
  private framePreview: Mesh | null;

  constructor(game: Game) {
    this.game = game;
    this.tolerance = 0.2;
    this.gestureMade = false;
    this.frameMade = false;

    this.leftCorner = new Vector3();
    this.rightCorner = new Vector3();
    this.minwidth = 0.3;
    this.minheight = 0.3;
    this.finalwidth = 0.3;
    this.finalheight = 0.3;
    this.finalVertexData = new VertexData();
    this.finalFOV = 0.8;
    this.finalCenter = new Vector3();
    this.finalwDir = new Vector3();
    this.finalhDir = new Vector3();
    this.finalNormal = new Vector3();

    this.redMaterial = null;
    this.greenMaterial = null;
    this.framePreview = null;
  }

  public loadAssets(scene: Scene): void {
    this.redMaterial = new StandardMaterial("red material", this.game.scene);
    this.redMaterial.emissiveColor = new Color3(1, 0.8, 0.8);
    this.redMaterial.disableLighting = true;
    this.redMaterial.alpha = 0.75;
    this.redMaterial.backFaceCulling = false;

    this.greenMaterial = new StandardMaterial(
      "green material",
      this.game.scene
    );
    this.greenMaterial.emissiveColor = new Color3(0.8, 1, 0.8);
    this.greenMaterial.disableLighting = true;
    this.greenMaterial.alpha = 0.75;
    this.greenMaterial.backFaceCulling = false;

    this.framePreview = new Mesh("custom", scene, null, null, false);
    this.framePreview.visibility = 0;
    this.framePreview.material = this.redMaterial;
  }

  public onControllerAdded(inputSource: WebXRInputSource): void {}

  public onControllerRemoved(inputSource: WebXRInputSource): void {}

  public update(): void {
    let leftController = this.game.leftController;
    let rightController = this.game.rightController;
    if (!rightController || !leftController) {
      return;
    }
    let topLeft;
    let topRight;
    let botLeft;
    let botRight;
    topLeft = this.leftCorner.clone();
    botRight = this.rightCorner.clone();
    // All points should be on this plane by definition.
    // After we have this plane we get the following shape:
    // TL-forward->----------------TR
    // | ...angle                   |
    // |     ...                    |
    // |         ...                |
    // |             cc             |
    // |                            |
    // |                            |
    // |                            |
    // BL--------------------------BR
    let diag = botRight.subtract(topLeft);
    let diagLen = diag.length();
    let diagDir = diag.normalize();

    let wDir;
    let hDir;
    let width;
    let height;

    wDir = this.game.leftController!.pointer.forward.normalize();
    hDir = this.game.leftController!.pointer.up.normalize();

    // Just use y value for determining which is on top
    if (topLeft.y > botRight.y) {
      width = Vector3.Dot(diagDir, wDir) * diagLen;
      height = Vector3.Dot(diagDir, hDir) * diagLen;

      botLeft = topLeft.add(hDir.scale(height));
      topRight = botRight.subtract(hDir.scale(height));
    } else {
      // Need to swap w/h dirs
      let temp = wDir;
      wDir = hDir;
      hDir = temp;
      width = Vector3.Dot(diagDir, wDir) * diagLen;
      height = Vector3.Dot(diagDir, hDir) * diagLen;

      // Left controller is on the "bottom" side now
      botLeft = topLeft.clone();
      topRight = botRight.clone();

      // Calculate the rest of the vertices
      topLeft = botLeft.add(hDir.scale(height));
      botRight = topRight.subtract(hDir.scale(height));

      // must reverse this for rebuilding the perma frame
      hDir = hDir.scale(-1);
    }

    // Logger.Log(
    //   "w: " + width + " + h: " + height + "\nview: " + normal.toString()
    // );

    let normal = Vector3.Cross(
      botLeft.subtract(topLeft),
      topRight.subtract(topLeft)
    ).normalize();

    // This should remain the same regardless of the corner
    // determination method.
    let positions = [
      topLeft.x,
      topLeft.y,
      topLeft.z,
      topRight.x,
      topRight.y,
      topRight.z,
      botLeft.x,
      botLeft.y,
      botLeft.z,
      botRight.x,
      botRight.y,
      botRight.z,
    ];
    let indices = [0, 1, 2, 1, 3, 2];
    let normals = [
      normal.x,
      normal.y,
      normal.z,
      normal.x,
      normal.y,
      normal.z,
      normal.x,
      normal.y,
      normal.z,
      normal.x,
      normal.y,
      normal.z,
    ];
    let uvs = [0, 1, 1, 1, 0, 0, 1, 0];

    let vertexData = new VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.normals = normals;
    vertexData.uvs = uvs;
    vertexData.applyToMesh(this.framePreview!);

    // update material
    //let width = topLeft.subtract(topRight).length();
    if (Math.abs(height) < this.minheight || Math.abs(width) < this.minwidth) {
      this.framePreview!.material = this.redMaterial;
    } else {
      this.framePreview!.material = this.greenMaterial;
      this.finalheight = Math.abs(height);
      this.finalwidth = Math.abs(width);
      this.finalVertexData = vertexData;
      this.finalNormal = normal;
      this.finalhDir = hDir;
      this.finalwDir = wDir;
    }

    // get center of the plane
    let centerPos = topLeft
      .add(topRight.add(botLeft.add(botRight)))
      .scale(0.25);
    this.finalCenter = centerPos;
    let headsetDistance = centerPos
      .subtract(this.game.xrCamera!.position)
      .length();
    // vertical v
    this.finalFOV = 2 * Math.atan(height / (2.0 * headsetDistance));
  }

  public processController(): void {
    let leftController = this.game.leftController;
    let rightController = this.game.rightController;
    if (!rightController || !leftController) {
      return;
    }

    this.leftCorner = leftController.pointer.position;
    this.rightCorner = rightController.pointer.position;

    let rightTrigger = rightController?.motionController?.getComponent(
      "xr-standard-trigger"
    );
    let leftTrigger = leftController?.motionController?.getComponent(
      "xr-standard-trigger"
    );
    // If gesture is made, don't cancel just because
    //  triggers are touched or pressed.
    if (
      this.gestureMade &&
      (rightTrigger!.touched ||
        leftTrigger!.touched ||
        rightTrigger!.pressed ||
        leftTrigger!.pressed)
    ) {
      // Create frame only if triggers are pressed, gesture
      // is made, and is not too small (checking this with material name)
      if (
        this.framePreview!.material!.name !== "red material" &&
        (rightTrigger?.pressed || leftTrigger?.pressed)
      ) {
        this.gestureMade = false;
        this.framePreview!.visibility = 0;

        // Create frame
        this.frameMade = true;
        let perm = new PermaFrame(this.game, {
          height: this.finalheight,
          width: this.finalwidth,
          fov: this.finalFOV,
          center: this.finalCenter,
          vertexData: this.finalVertexData,
          wDir: this.finalwDir,
          hDir: this.finalhDir,
          normal: this.finalNormal,
        });
        this.game.addFrame(perm);
      }
    } else {
      if (this.isFramingGesture(leftController, rightController)) {
        console.log("gesture made");
        this.gestureMade = true;
        this.framePreview!.visibility = 1;
      } else {
        this.gestureMade = false;
        this.framePreview!.visibility = 0;
      }
    }
  }

  private isFramingGesture(
    leftController: WebXRInputSource,
    rightController: WebXRInputSource
  ): boolean {
    const rightTrigger = rightController!.motionController?.getComponent(
      "xr-standard-trigger"
    );
    const rightA = rightController!.motionController?.getComponent("a-button");
    const rightB = rightController!.motionController?.getComponent("b-button");
    const rightGrip = rightController!.motionController?.getComponent(
      "xr-standard-squeeze"
    );
    const rightStick = rightController!.motionController?.getComponent(
      "xr-standard-thumbstick"
    );
    const leftTrigger = leftController!.motionController?.getComponent(
      "xr-standard-trigger"
    );
    const leftGrip = leftController!.motionController?.getComponent(
      "xr-standard-squeeze"
    );
    const leftX = leftController!.motionController?.getComponent("x-button");
    const leftY = leftController!.motionController?.getComponent("y-button");
    const leftStick = leftController!.motionController?.getComponent(
      "xr-standard-thumbstick"
    );

    let rightButtonTouched =
      rightA?.touched || rightB?.touched || rightStick?.touched;
    let rightTriggerTouched = rightTrigger?.touched;
    let rightGripSqueezed = rightGrip?.pressed;

    let leftButtonTouched =
      leftX?.touched || leftY?.touched || leftStick?.touched;
    let leftTriggerTouched = leftTrigger?.touched;
    let leftGripSqueezed = leftGrip?.pressed;
    if (
      rightButtonTouched ||
      rightTriggerTouched ||
      leftButtonTouched ||
      leftTriggerTouched ||
      !rightGripSqueezed ||
      !leftGripSqueezed
    ) {
      return false;
    }

    let center = leftController!
      .grip!.position.add(rightController!.grip!.position)
      .scale(0.5);
    let leftFDir = leftController.pointer
      .getDirection(new Vector3(0, 0, 1))
      .normalize();
    let leftLDir = leftController.pointer
      .getDirection(new Vector3(-1, 0, 0))
      .normalize();
    let rightFDir = rightController.pointer
      .getDirection(new Vector3(0, 0, 1))
      .normalize();
    let rightLDir = rightController.pointer
      .getDirection(new Vector3(-1, 0, 0))
      .normalize();

    let viewDir = this.game.xrCamera
      ?.getDirection(new Vector3(0, 0, 1))
      .normalize();
    let headsetToCenter = center
      .subtract(this.game!.xrCamera!.position)
      .normalize();

    /**
    Gesture criteria:
    - The pointer (forward dir) of both controllers must be orthogonal
      - OR, they must be ANTIparallel (currently it's coded as parallel though?)
    -View direction of the headset must align with:
      -Side vector of both controllers
      -Vector from center of frame to headset
    */
    if (
      !(
        (
          this.orthogonal(leftFDir, rightFDir, this.tolerance) || // pointers have to be orthogonal
          this.parallel(leftFDir, rightFDir, false, this.tolerance)
        ) // or pointers have to be parallel
      ) ||
      !this.parallel(viewDir!, rightLDir, true, this.tolerance * 1.5) ||
      !this.parallel(viewDir!, leftLDir, true, this.tolerance * 1.5) ||
      !this.parallel(viewDir!, headsetToCenter, true, this.tolerance * 1.5)
    ) {
      return false;
    }

    return true;
  }

  // Two helper functions for parallel/ortho checks
  // u and v MUST be normalized
  private parallel(
    u: Vector3,
    v: Vector3,
    antiparallel = true,
    tolerance: number
  ): boolean {
    let dot = Vector3.Dot(u, v);

    if (antiparallel) {
      dot = Math.abs(dot);
    }

    if (Math.abs(dot - 1) > tolerance) {
      return false;
    }
    return true;
  }

  private orthogonal(u: Vector3, v: Vector3, tolerance: number): boolean {
    let dot = Vector3.Dot(u, v);
    if (Math.abs(dot) > tolerance) {
      return false;
    }
    return true;
  }
}

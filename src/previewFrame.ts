import { Scene } from "@babylonjs/core/scene";
import { Vector3, Color3, Plane } from "@babylonjs/core/Maths/math";
import { WebXRInputSource } from "@babylonjs/core/XR/webXRInputSource";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Logger } from "@babylonjs/core/Misc/logger";

import { pfModule } from "./pfModule";
import { Game } from "./index";
import { PermaFrame } from "./permaFrame";
import { RenderTargetTexture } from "@babylonjs/core/Materials/Textures/renderTargetTexture";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { CustomMaterial } from "@babylonjs/materials/custom/customMaterial";
import { Effect } from "@babylonjs/core";

export class previewFrame implements pfModule {
  game: Game;

  private tolerance: number; // Tolerance for difference in ortho/parallel checks in frameGesture
  private gestureMade: boolean; // Tracks if gesture was made on previous frame
  private frameMade: boolean;

  private leftCorner: Vector3; // Corner used to create frame mesh
  private rightCorner: Vector3; // Corner used to create frame mesh
  private minwidth: number;
  private minheight: number;
  private finalwidth: number;
  private finalheight: number;
  private finalVertexData: VertexData;
  private finalFOV: number;
  private finalViewDir: Vector3;

  private redMaterial: StandardMaterial | null;
  private greenMaterial: StandardMaterial | null;
  private planeMaterial: CustomMaterial | null;
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
    this.finalViewDir = new Vector3();

    this.redMaterial = null;
    this.greenMaterial = null;
    this.planeMaterial = null;
    this.framePreview = null;
  }

  public loadAssets(scene: Scene): void {
    this.redMaterial = new StandardMaterial("red material", this.game.scene);
    this.redMaterial.diffuseColor = new Color3(1, 0.8, 0.8);
    this.redMaterial.ambientColor = new Color3(1, 0.8, 0.8);
    this.redMaterial.alpha = 0.75;
    this.redMaterial.backFaceCulling = false;

    this.greenMaterial = new StandardMaterial(
      "green material",
      this.game.scene
    );
    this.greenMaterial.diffuseColor = new Color3(0.8, 1, 0.8);
    this.greenMaterial.ambientColor = new Color3(0.8, 1, 0.8);
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
    let center = topLeft.add(botRight).scale(0.5);
    let viewNormal = center.subtract(this.game.xrCamera!.position).normalize();
    this.finalViewDir = viewNormal.clone();
    let p = Plane.FromPositionAndNormal(center, viewNormal).normalize(); // The frame plane
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
    let diag = (topLeft.subtract(center));
    let diagLen = diag.length();
    let forwardLeft = this.game.leftController!.pointer.forward.normalize();
    let forwardRight = this.game.rightController!.pointer.up.normalize();
    let angle = Vector3.GetAngleBetweenVectors(diag, forwardLeft, viewNormal);
    let width = Math.abs(2*diagLen*Math.cos(angle));
    let height = Math.abs(2*diagLen*Math.sin(angle));
    Logger.Log("w: " + width + " + h: " + height + "\nview: " + viewNormal.toString());
    
    topRight = topLeft.add(forwardLeft.scale(width));
    botLeft = botRight.subtract(forwardLeft.scale(width));

    //topRight = center.add(forwardLeft.scale(width)).add(forwardRight.scale(height));
    //botLeft = botRight.subtract(forwardLeft.scale(width));

    // Y-axis locked version
    /*let height = this.leftCorner.y - this.rightCorner.y;
    if (height > 0) {
      topLeft = this.leftCorner.clone();
      botRight = this.rightCorner.clone();
      botLeft = topLeft.clone();
      topRight = botRight.clone();
      botLeft.y -= height;
      topRight.y += height;
    } else {
      height *= -1;
      topRight = this.rightCorner.clone();
      botLeft = this.leftCorner.clone();
      botRight = topRight.clone();
      topLeft = botLeft.clone();
      botRight.y -= height;
      topLeft.y += height;
    }*/

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
    let normals: number[] = [];
    let uvs = [0, 1, 1, 1, 0, 0, 1, 0];

    let vertexData = new VertexData();
    VertexData.ComputeNormals(positions, indices, normals);
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.normals = normals;
    vertexData.uvs = uvs;
    this.finalVertexData = vertexData;
    vertexData.applyToMesh(this.framePreview!);

    // update material
    //let width = topLeft.subtract(topRight).length();
    if (height < this.minheight || width < this.minwidth) {
      this.framePreview!.material = this.redMaterial;
    } else {
      this.framePreview!.material = this.greenMaterial;
      this.finalheight = height;
      this.finalwidth = width;
    }
    
    // get center of the plane
    let centerPos = topLeft.add(topRight.add(botLeft.add(botRight))).scale(0.25);
    let headsetDistance = centerPos.subtract(this.game.xrCamera!.position).length();
    this.finalFOV = Math.atan((height)/(2*headsetDistance));
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
        let perm = new PermaFrame(this.game, this.finalVertexData, {
          height: this.finalheight,
          width: this.finalwidth,
          fov: this.finalFOV,
          viewDir: this.finalViewDir
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

    if (
      !(
        this.orthogonal(leftFDir, rightFDir, this.tolerance) || // pointers have to be orthogonal
        this.parallel(leftFDir, rightFDir, false, this.tolerance) // or pointers have to be parallel
      ) ||
      !this.parallel(viewDir!, rightLDir, true, this.tolerance*1.5) ||
      !this.parallel(viewDir!, leftLDir, true, this.tolerance*1.5)
    ) {
      return false;
    }

    return true;
  }

  // Two helper functions for parallel/ortho checks
  // u and v MUST be normalized
  private parallel(u: Vector3, v: Vector3, antiparallel = true, tolerance: number): boolean {
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

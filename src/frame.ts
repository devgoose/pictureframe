import { Scene } from "@babylonjs/core/scene";
import { Vector3, Color3 } from "@babylonjs/core/Maths/math";
import { WebXRInputSource } from "@babylonjs/core/XR/webXRInputSource";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";

import { pfModule } from "./pfModule";
import { Game } from "./index";
import { PermaFrame } from "./permaFrame";
import { RenderTargetTexture } from "@babylonjs/core/Materials/Textures/renderTargetTexture";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { CustomMaterial } from "@babylonjs/materials/custom/customMaterial";

export class Frame implements pfModule {
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

  private redMaterial: StandardMaterial | null;
  private greenMaterial: StandardMaterial | null;
  private planeMaterial: CustomMaterial | null;
  private framePreview: Mesh | null;
  //private frame: Mesh | null; // I think we need a permanent frame
  //private camera: UniversalCamera | null; // permanent camera?

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

    this.redMaterial = null;
    this.greenMaterial = null;
    this.planeMaterial = null;
    this.framePreview = null;
    //this.frame = null;
    //this.camera = null;
  }

  public loadAssets(scene: Scene): void {
    this.redMaterial = new StandardMaterial("frame material", this.game.scene);
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
    // Assuming the frame is always placed upright, for now...
    // To be changed later?
    let topLeft;
    let topRight;
    let botLeft;
    let botRight;
    let height = this.leftCorner.y - this.rightCorner.y;
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
    }

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

    let vertexData = new VertexData();
    VertexData.ComputeNormals(positions, indices, normals);
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.normals = normals;
    this.finalVertexData = vertexData;
    vertexData.applyToMesh(this.framePreview!);
  
    // update material
    let width = topLeft.subtract(topRight).length();
    if (height < this.minheight || width < this.minwidth) {
      this.framePreview!.material = this.redMaterial;
    } else {
      this.framePreview!.material = this.greenMaterial;
      this.finalheight = height;
      this.finalwidth = width;
    }
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
    if (
      this.gestureMade &&
      (rightTrigger?.changes.pressed || leftTrigger?.changes.pressed)
    ) {
      this.gestureMade = false;
      this.framePreview!.visibility = 0;

      // Create frame
      this.frameMade = true; 
      this.planeMaterial = this.createPlaneMaterial();
      let perm = new PermaFrame(this.game);
      perm.createPermaFrame(this.planeMaterial, this.finalVertexData);
      this.game.frames.push(perm);

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

  private createPlaneMaterial(): CustomMaterial{
    // this could probably move to the permaFrame class
    // creates and places the camera, and creates the plane texture
    let cam = new UniversalCamera("viewport camera", 
      this.game.xrCamera!.position, this.game.scene
    );
    //cam.cameraDirection = this.game.xrCamera!.getDirection(new Vector3(0, 0, 1));
    cam.minZ = 0.1;
    cam.fov = 0.8; // We can add the fov math here if/when we want to
    //this.camera = cam;

    let viewportTexture = new RenderTargetTexture("render texture", 
      {width: this.finalwidth, height: this.finalheight}, 
      this.game.scene, true
    );
    this.game.scene.customRenderTargets.push(viewportTexture);
    viewportTexture.activeCamera = cam;
    viewportTexture.renderList = this.game.scene.meshes;

    let mat = new CustomMaterial("plane material", this.game.scene);
    mat.emissiveTexture = viewportTexture;
    mat.disableLighting = true;

    return mat;
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
    if (!this.gestureMade){
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
    }
    else{ // this is so we can use the triggers to activate the creation
      if ( // there's probably a clever way to do this
        rightButtonTouched ||
        leftButtonTouched ||
        !rightGripSqueezed ||
        !leftGripSqueezed
      ) {
        return false;
      }
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
    let rightLDir = leftController.pointer
      .getDirection(new Vector3(-1, 0, 0))
      .normalize();

    let viewDir = this.game.xrCamera
      ?.getDirection(new Vector3(0, 0, 1))
      .normalize();

    if (
      Math.abs(Vector3.Dot(leftFDir, rightFDir)) > this.tolerance ||
      Math.abs(Math.abs(Vector3.Dot(leftLDir, viewDir!)) - 1) > this.tolerance ||
      Math.abs(Math.abs(Vector3.Dot(rightLDir, viewDir!)) - 1) > this.tolerance
    ) {
      return false;
    }

    return true;
  }
}

import { Scene } from "@babylonjs/core/scene";
import { Vector3, Color3, Quaternion } from "@babylonjs/core/Maths/math";
import { WebXRInputSource } from "@babylonjs/core/XR/webXRInputSource";
import { WebXRControllerComponent } from "@babylonjs/core/XR/motionController/webXRControllerComponent";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { CustomMaterial } from "@babylonjs/materials/custom/customMaterial";
import { RenderTargetTexture } from "@babylonjs/core/Materials/Textures/renderTargetTexture";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";

import { pfModule } from "./pfModule";
import { Game } from "./index";

export class PermaFrame implements pfModule {
  game: Game;

  private plane: Mesh | null;
  private camera: UniversalCamera | null;
  private viewportTexture: RenderTargetTexture | null;

  private textureResolution: number;
  private width: number;
  private height: number;

  private parent: TransformNode | null; // Keeps track of parent

  constructor(game: Game, vertexData: VertexData, size: any) {
    this.game = game;
    this.plane = null;
    this.camera = null;
    this.viewportTexture = null;

    this.textureResolution = 1000;
    this.width = size.width;
    this.height = size.height;

    this.parent = null;

    this.loadAssets(this.game.scene);

    vertexData.applyToMesh(this.plane!);
  }

  public loadAssets(scene: Scene): void {
    this.plane = new Mesh("permaFrame", scene, null, null, false);
    this.plane.visibility = 1;
    this.plane.showBoundingBox = true;

    // Keeping track of the camera--that way we can change it's position, fov, etc if needed
    this.camera = new UniversalCamera(
      "viewport camera",
      this.game.xrCamera!.position.clone(),
      scene
    );

    // Setting the cameraDirection didn't seem to work?
    // Using plain rotation y-value for now. Otherwise slight head
    // tilts will tilt the texture
    if (this.game.xrCamera!.rotationQuaternion) {
      this.camera.rotation.y = this.game.xrCamera!.rotationQuaternion.toEulerAngles().y;
    } else {
      //this.camera.rotation = this.game.xrCamera!.rotation.clone();
      this.camera.rotation.y = this.game.xrCamera!.rotation.y;
    }
    this.camera.minZ = 0.1;
    this.camera.fov = 0.8; // We can add the fov math here if/when we want to

    let viewportTexture = new RenderTargetTexture(
      "render texture",
      {
        width: Math.round(this.textureResolution * this.width),
        height: Math.round(this.textureResolution * this.height),
      },
      scene
    );
    scene.customRenderTargets.push(viewportTexture);
    viewportTexture.activeCamera = this.camera;
    viewportTexture.renderList = this.game.scene.meshes;

    let mat = new CustomMaterial("plane material", scene);
    mat.backFaceCulling = false;
    mat.emissiveTexture = viewportTexture;
    mat.disableLighting = true;

    this.plane.material = mat;
    this.viewportTexture = viewportTexture;
  }

  public onControllerAdded(inputSource: WebXRInputSource): void {}
  public onControllerRemoved(inputSource: WebXRInputSource): void {}

  public update(): void {}

  // This is where the controller interactions can go
  public processController(): void {}

  public setParent(mesh: AbstractMesh): void {
    this.plane?.setParent(mesh);
  }

  public getMesh(): AbstractMesh | null {
    return this.plane;
  }

  public destroy(): void {
    this.plane?.dispose();
    this.camera?.dispose();
    this.viewportTexture?.dispose();
  }
}

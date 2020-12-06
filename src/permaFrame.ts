import { Scene } from "@babylonjs/core/scene";
import { Vector3, Plane } from "@babylonjs/core/Maths/math";
import { WebXRInputSource } from "@babylonjs/core/XR/webXRInputSource";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { CustomMaterial } from "@babylonjs/materials/custom/customMaterial";
import { RenderTargetTexture } from "@babylonjs/core/Materials/Textures/renderTargetTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";

import { pfModule } from "./pfModule";
import { Game } from "./index";

// Mini object for holding info about the frame
interface FrameInfo {
  height: number;
  width: number;
  fov: number;
  normal: Vector3;
  center: Vector3;
}

export class PermaFrame implements pfModule {
  game: Game;

  private plane: Mesh | null;
  private camera: UniversalCamera | null;
  private viewportTexture: RenderTargetTexture | null;
  private deleteTexture: Texture | null;

  private textureResolution: number;
  private frameInfo: FrameInfo;

  constructor(game: Game, frameInfo: FrameInfo) {
    this.game = game;
    this.plane = null;
    this.camera = null;
    this.viewportTexture = null;
    this.deleteTexture = null;

    this.textureResolution = 1024;
    this.frameInfo = frameInfo;

    this.loadAssets(this.game.scene);
  }

  public loadAssets(scene: Scene): void {
    // Bounding boxes for hand-made meshes kind of suck.
    // Creating a Plane with MeshBuilder from the frameInfo instead
    // Plane is created with center position/width/height/normal
    let p = Plane.FromPositionAndNormal(
      this.frameInfo.center,
      this.frameInfo.normal
    );
    this.plane = MeshBuilder.CreatePlane(
      "permaFrame",
      {
        height: this.frameInfo.height,
        width: this.frameInfo.width,
        sourcePlane: p,
      },
      this.game.scene
    );
    this.plane.position = this.frameInfo.center;

    // Keeping track of the camera--that way we can change it's position, fov, etc if needed
    this.camera = new UniversalCamera(
      "viewport camera",
      this.game.xrCamera!.position.clone(),
      scene
    );

    //this.camera.setTarget(this.camera.position.add(this.viewDir.scale(10000)));
    if (this.game.xrCamera!.rotationQuaternion) {
      this.camera.rotationQuaternion = this.game.xrCamera!.rotationQuaternion.clone();
    } else {
      this.camera.rotation = this.game.xrCamera!.rotation.clone();
    }

    // I think this could be done to
    //this.camera.minZ = this.camera.position.subtract(this.plane.position).length();
    this.camera.minZ = 0.1;

    //this.camera.fov = 0.8; // We can add the fov math here if/when we want to
    this.camera.fov = this.frameInfo.fov;
    // move the camera along its view vector a little bit
    // maybe not until we remove the y axis locking
    //this.camera.position = this.camera.position.addInPlace(this.camera.cameraDirection.scale(1.5));

    let viewportTexture = new RenderTargetTexture(
      "render texture",
      {
        width: Math.round(this.textureResolution * this.frameInfo.width),
        height: Math.round(this.textureResolution * this.frameInfo.height),
      },
      scene
    );
    scene.customRenderTargets.push(viewportTexture);
    viewportTexture.activeCamera = this.camera;
    viewportTexture.renderList = this.game.scene.meshes;

    let deleteTexture = new Texture("assets/delete.jpg", scene);

    let mat = new CustomMaterial("plane material", scene);
    mat.backFaceCulling = false;
    mat.emissiveTexture = viewportTexture;
    mat.disableLighting = true;

    this.plane.material = mat;
    this.viewportTexture = viewportTexture;
    this.deleteTexture = deleteTexture;
    this.plane.visibility = 1;
    this.plane.showBoundingBox = true;
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

  public setDeleteTexture(on: boolean): void {
    let mat = <CustomMaterial>this.plane?.material;
    if (on) {
      mat.emissiveTexture = this.deleteTexture;
    } else {
      mat.emissiveTexture = this.viewportTexture;
    }
  }

  public destroy(): void {
    this.plane?.dispose();
    this.camera?.dispose();
    this.viewportTexture?.dispose();
  }
}

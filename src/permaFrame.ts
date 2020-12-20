import { Scene } from "@babylonjs/core/scene";
import { Vector3, Plane, Matrix } from "@babylonjs/core/Maths/math";
import { WebXRInputSource } from "@babylonjs/core/XR/webXRInputSource";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { CustomMaterial } from "@babylonjs/materials/custom/customMaterial";
import { RenderTargetTexture } from "@babylonjs/core/Materials/Textures/renderTargetTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { VertexData } from "@babylonjs/core";

import { pfModule } from "./pfModule";
import { Game } from "./index";

// Mini object for holding info about the frame
interface FrameInfo {
  height: number;
  width: number;
  fov: number;
  center: Vector3;
  vertexData: VertexData;
  // basis axes for rotation
  wDir: Vector3; // x
  hDir: Vector3; // y
  normal: Vector3; // z
}

export class PermaFrame implements pfModule {
  game: Game;

  private plane: Mesh | null;
  private boundary: Mesh | null;
  private camera: UniversalCamera | null;
  private viewportTexture: RenderTargetTexture | null;
  private deleteTexture: Texture | null;

  private textureResolution: number;
  private frameInfo: FrameInfo;

  constructor(game: Game, frameInfo: FrameInfo) {
    this.game = game;
    this.plane = null;
    this.boundary = null;
    this.camera = null;
    this.viewportTexture = null;
    this.deleteTexture = null;

    this.textureResolution = 1024;
    this.frameInfo = frameInfo;

    this.loadAssets(this.game.scene);

    // Debug
    console.log(this.frameInfo);
  }

  public loadAssets(scene: Scene): void {
    // Create RTT first since we just use all meshes in the scene, otherwise feedback loop

    this.camera = new UniversalCamera(
      "viewport camera",
      this.game.xrCamera!.position.clone(),
      scene
    );

    if (this.game.xrCamera!.rotationQuaternion) {
      this.camera.rotationQuaternion = this.game.xrCamera!.rotationQuaternion.clone();
    } else {
      this.camera.rotation = this.game.xrCamera!.rotation.clone();
    }

    // I think this could be done to
    this.camera.minZ = this.frameInfo.center
      .subtract(this.camera.position)
      .length();

    this.camera.fov = this.frameInfo.fov;

    // Then, create the render texture from the camera
    let viewportTexture = new RenderTargetTexture(
      "render texture",
      {
        width: Math.round(this.textureResolution * this.frameInfo.width),
        height: Math.round(this.textureResolution * this.frameInfo.height),
      },
      scene,
      false,
      false
    );
    scene.customRenderTargets.push(viewportTexture);
    viewportTexture.activeCamera = this.camera;

    // Change this so it doesn't include this mesh
    viewportTexture.renderList = this.game.scene.meshes;

    // First, create the actual frame mesh, and correctly set the UVs
    this.plane = new Mesh("permaFrame", scene, null, null, false);
    this.frameInfo.vertexData.applyToMesh(this.plane!);

    let deleteTexture = new Texture("assets/delete.jpg", scene);

    let mat = new CustomMaterial("plane material", scene);
    mat.backFaceCulling = false;
    mat.emissiveTexture = viewportTexture;
    mat.disableLighting = true;

    this.plane.material = mat;
    this.viewportTexture = viewportTexture;
    this.deleteTexture = deleteTexture;
    this.plane.visibility = 1;
    this.plane.isPickable = false;

    // Bounding boxes for hand-made meshes are bad--but good for textures
    // Using a MeshBuilder plane for the boundary, and VertexData for the actual frame
    this.boundary = MeshBuilder.CreatePlane(
      "frameBoundary",
      {
        height: this.frameInfo.height,
        width: this.frameInfo.width,
      },
      this.game.scene
    );
    this.boundary.rotation = Vector3.RotationFromAxis(
      this.frameInfo.wDir,
      this.frameInfo.hDir.scale(-1),
      this.frameInfo.normal
    );
    this.boundary.position = this.frameInfo.center;
    this.boundary.visibility = 0;
    this.boundary.isPickable = true;
    this.boundary.setParent(this.plane);
  }

  public onControllerAdded(inputSource: WebXRInputSource): void { }
  public onControllerRemoved(inputSource: WebXRInputSource): void { }

  public update(): void { }

  // This is where the controller interactions can go
  public processController(): void { }

  public setParent(mesh: AbstractMesh | null): void {
    this.plane?.setParent(mesh);
  }

  public getMesh(): AbstractMesh | null {
    return this.plane;
  }

  public getBoundary(): AbstractMesh | null {
    return this.boundary;
  }

  public getFrameInfo(): FrameInfo | null {
    return this.frameInfo;
  }

  public getPlane(): AbstractMesh | null {
    return this.plane;
  }

  public getCamera(): UniversalCamera | null {
    return this.camera;
  }

  public getNormal(): Vector3 {
    return this.boundary!.getDirection(new Vector3(0, 0, 1));
  }

  public getWorldTransform(): Matrix {
    return this.plane?.getWorldMatrix()!;
  }

  public intersects(mesh: AbstractMesh): boolean {
    if (!this.boundary) {
      return false;
    }
    return mesh.intersectsMesh(this.boundary, true);
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

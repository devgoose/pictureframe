import { Scene } from "@babylonjs/core/scene";
import { Vector3, Color3 } from "@babylonjs/core/Maths/math";
import { WebXRInputSource } from "@babylonjs/core/XR/webXRInputSource";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";

import { pfModule } from "./pfModule";
import { Game } from "./index";
import { RenderTargetTexture } from "@babylonjs/core/Materials/Textures/renderTargetTexture";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { CustomMaterial } from "@babylonjs/materials/custom/customMaterial";

export class PermaFrame implements pfModule {
  game: Game;

  private plane: Mesh | null;

  constructor(game: Game) {
    this.game = game;
    this.plane = null;
    //this.frames = [];
  }

  public loadAssets(scene: Scene): void {
    this.plane = new Mesh("custom", scene, null, null, false);
    this.plane.visibility = 0;
  }

  public createPermaFrame(mat: CustomMaterial, vertexData: VertexData): void {
    if(this.plane){
      vertexData.applyToMesh(this.plane);
      this.plane.material = mat;
      this.plane.visibility = 1;
    }
  }

  public onControllerAdded(inputSource: WebXRInputSource): void {}
  public onControllerRemoved(inputSource: WebXRInputSource): void {}

  public update(): void {
    
  }

  // This is where the controller interactions can go
  public processController(): void {}


}

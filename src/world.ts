import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Scene } from "@babylonjs/core/scene";
import { AssetsManager, Mesh, ShadowGenerator, TransformNode, WebXRInputSource } from "@babylonjs/core";
import { Vector3, Color3, Quaternion } from "@babylonjs/core/Maths/math";

import { pfModule } from "./pfModule";
import { Game } from "./index";

export class World implements pfModule {
  game: Game;

  //private root: TransformNode;
  constructor(game: Game) {
    this.game = game;
    //this.root = this.game.root;
  }

  public loadAssets(): void {
    let assetsManager = new AssetsManager(this.game.scene);
    let worldTask = assetsManager.addMeshTask(
      "world task",
      "",
      "assets/",
      "castle.obj"
    );

    worldTask.onSuccess = function (task) {
      task.loadedMeshes.forEach((mesh) => {
        // These lines don't work because for some reason "this"
        // references the task as opposed to the class we are in
        // I don't know how to circumnavigate that.
        //mesh.setParent(this.root); 
        //this.game.shadowGen.getShadowMap()?.renderList?.push(mesh);
        let scale = 30;
        mesh.scaling = new Vector3(scale, scale, scale);
        mesh.material!.backFaceCulling = false;
        mesh.receiveShadows = true;
      });
    };

    worldTask.onError = function (task) {
      console.log("Error loading " + task.name);
    };

    assetsManager.load();
  }

  public update(): void {}

  public onControllerAdded(inputSource: WebXRInputSource): void {}
  public onControllerRemoved(inputSource: WebXRInputSource): void {}

  public processController(): void {}
}

import { Scene } from "@babylonjs/core/scene";
import { WebXRInputSource } from "@babylonjs/core";

import { Game } from "./index";

export interface pfModule {
  // Game reference to access controllers/camera/etc.
  // Any member of Game that needs to be accessed should be made public
  game: Game;

  // Only called at the beginning of the scene. If modules are dynamically created,
  // they must call loadAssets() in their constructor or after they are created
  loadAssets(scene: Scene): void;

  // Called for all current modules when a controller is added or removed
  onControllerAdded(inputSource: WebXRInputSource): void;
  onControllerRemoved(inputSource: WebXRInputSource): void;

  // Called every frame
  update(): void;
  processController(): void;
}

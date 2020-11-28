import { Scene } from "@babylonjs/core/scene";
import { WebXRInputSource } from "@babylonjs/core";

import { Game } from "./index";

export interface pfModule {
  // Game reference to access controllers/camera/etc.
  // Any member of Game that needs to be accessed should be made public
  game: Game;

  loadAssets(scene: Scene): void;

  onControllerAdded(inputSource: WebXRInputSource): void;
  onControllerRemoved(inputSource: WebXRInputSource): void;

  update(): void;

  processController(): void;
}

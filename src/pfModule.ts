import { Scene } from "@babylonjs/core/scene";
import { WebXRInput, WebXRInputSource } from "@babylonjs/core";

export interface pfModule {
  loadAssets(scene: Scene): void;

  onControllerAdded(inputSource: WebXRInputSource): void;
  onControllerRemoved(inputSource: WebXRInputSource): void;

  processControllerInput(
    rightController: WebXRInputSource,
    leftController: WebXRInputSource
  ): void;
}

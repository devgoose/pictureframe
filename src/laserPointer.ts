import { Scene } from "@babylonjs/core/scene";
import { Logger, VertexBuffer, WebXRInputSource } from "@babylonjs/core";
import { Vector3, Color3, Plane, Color4 } from "@babylonjs/core/Maths/math";
import { Ray } from "@babylonjs/core/Culling/ray";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Quaternion } from "@babylonjs/core/Maths/math.vector";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";



import { pfModule } from "./pfModule";
import { Game } from "./index";

export class LaserPointer implements pfModule {
  game: Game;

  private laserPointer: Mesh | null;
  private laserActivated: boolean;
  private maxTeleport: number;
  private teleportPoint: Vector3 | null;

  private stickThreshold: number;
  private stickDeadzone: number;
  private stickNeutral: boolean;
  private turnAngle: number;

  private picked: AbstractMesh | null;
  private pickedParent: AbstractMesh | null;

  private laserOffset: Vector3;

  constructor(game: Game) {
    this.game = game;

    this.laserPointer = null;
    this.laserActivated = false;
    this.maxTeleport = 100; // max distance the ray is cast
    this.teleportPoint = null;

    this.stickThreshold = 0.5;
    this.stickDeadzone = 0.2;
    this.stickNeutral = true;
    this.turnAngle = 30;

    this.picked = null;
    this.pickedParent = null;

    // Constant offset so the laser comes out of the finger.
    // This is added to the laser and pick ray's position
    //this.laserOffset = new Vector3(0.02, 0.025, 0.09);
    this.laserOffset = new Vector3(0, 0, 0);
  }

  public loadAssets(): void {
    this.laserPointer = MeshBuilder.CreateTube("laserPointer",
      { path: [new Vector3(0, 0, 0), new Vector3(0, 0, 1)], radius: 1 },
      this.game.scene);
    this.laserPointer.position = this.laserOffset; // just puts it coming out of the finger
    this.laserPointer.setEnabled(false);
    this.laserPointer.isPickable = false;

    let mat = new StandardMaterial("laserMaterial", this.game.scene);
    mat.diffuseColor = new Color3(1, 0, 0);

    this.laserPointer.material = mat;
  }

  public onControllerAdded(inputSource: WebXRInputSource): void {
    if (inputSource.uniqueId.endsWith("right")) {
      this.laserPointer!.parent = inputSource.pointer;
    }
  }

  public onControllerRemoved(inputSource: WebXRInputSource): void {
    if (inputSource.uniqueId.endsWith("right")) {
      this.laserPointer!.parent = null;
      this.laserPointer!.setEnabled(false);
    }
  }

  public processController(): void {
    const rightController = this.game.rightController;
    if (!rightController) {
      return;
    }

    const rightTrigger = rightController!.motionController?.getComponent(
      "xr-standard-trigger"
    );
    const rightA = rightController!.motionController?.getComponent("a-button");
    const rightB = rightController!.motionController?.getComponent("b-button");
    const rightStick = rightController!.motionController?.getComponent(
      "xr-standard-thumbstick"
    );

    let rightButtonTouched =
      rightA?.touched || rightB?.touched || rightStick?.touched || rightA?.pressed;
    let rightTriggerTouched = rightTrigger?.touched || rightTrigger?.pressed;

    // Check to see if they are doing a "pointing" gesture
    if (rightButtonTouched && (!rightTriggerTouched || this.laserActivated)) {
      this.laserActivated = true;
      this.laserPointer!.setEnabled(true);
    } else {
      this.laserActivated = false;
      this.laserPointer!.setEnabled(false);
    }

    // Handle picking and teleportation
    if (this.laserActivated) {
      let ray = new Ray(
        rightController!.pointer.position.add(this.laserOffset),
        rightController!.pointer.forward,
        this.maxTeleport
      );
      let pickInfo = this.game.scene.pickWithRay(ray);

      let teleportPoint = null;
      let pickedMesh = null;
      let pickedFrame = null;

      if (pickInfo!.hit) {
        // If anything is hit, change color and length
        let mat = <StandardMaterial>this.laserPointer!.material!;
        mat.diffuseColor = Color3.Green();
        this.laserPointer!.scaling = new Vector3(0.003, 0.003, pickInfo!.distance);
        console.log("Hit: ", pickInfo?.pickedMesh!.name)

        // Collision with ground meshes, record the teleport point
        if (this.game.groundMeshes.includes(pickInfo!.pickedMesh!)) {
          teleportPoint = pickInfo?.pickedPoint;
        }

        // Collision with pickable objects, parent to laser
        else if (this.game.propMeshes.includes(pickInfo!.pickedMesh!)) {
          pickedMesh = pickInfo!.pickedMesh;
        }

        else {
          // check if it hits a frame
          for (let frame of this.game.frames) {
            if (frame.getBoundary() === pickInfo!.pickedMesh) {
              pickedFrame = frame;
              break;
            }
          }
        }

      } else {
        let mat = <StandardMaterial>this.laserPointer!.material!;
        mat.diffuseColor = Color3.Red();
        this.laserPointer!.scaling = new Vector3(0.003, 0.003, this.maxTeleport);
      }


      // Right trigger activates picking or teleportation
      // I suppose we have no reason to implement basic pointer picking, 
      // because that should only be done through the frame. Also it's extra work
      if (rightTrigger!.changes.pressed) {
        // PRESS trigger
        if (rightTrigger!.pressed) {
          // Handle teleport
          if (!!teleportPoint) {
            this.teleport(teleportPoint)
          }

          // Handle picked frame
          else if (pickedFrame) {
            // The laser has picked a frame's boundary.
            // Need the point that the laser hits the boundary on
            let hitPos = pickInfo!.pickedPoint?.clone();
<<<<<<< HEAD
            let positionOnBoundary = hitPos?.subtract(pickedFrame.getBoundary()!.position);
=======
            let verts = pickedFrame.getPlane()?.getVerticesData(VertexBuffer.PositionKind);
            let upperLeft = new Vector3(verts![0], verts![1], verts![2]);
            let upperRight = new Vector3(verts![3], verts![4], verts![5]);
            let bottomLeft = new Vector3(verts![6], verts![7], verts![8]);
            let bottomRight = new Vector3(verts![9], verts![10], verts![11]);
            let fromTopLeftToHit = hitPos!.subtract(upperLeft);
            let topEdgeLToR = upperRight.subtract(upperLeft).normalize();
            let leftEdgeTToB = bottomLeft.subtract(upperLeft).normalize();
            
            let nX = (Vector3.Dot(fromTopLeftToHit, topEdgeLToR)/pickedFrame.getFrameInfo()!.width - 0.5) * 2;
            let nY = (Vector3.Dot(fromTopLeftToHit, leftEdgeTToB)/pickedFrame.getFrameInfo()!.height - 0.5) * 2;
            // We now have the normalized X and Y coordinates (center origin)
            
            let cam = pickedFrame.getCamera()!;
            let camPos = cam.position;
            let camFOV = cam.fov;
            let camAspectRatio = this.game.scene.getEngine().getAspectRatio(cam);
            let hFOV = 2*Math.atan(camAspectRatio * Math.tan(camFOV/2));
            let viewDir = cam.getDirection(new Vector3(0, 0, 1));
            let newDir = viewDir.clone();
            let rotQ = Quaternion.FromEulerVector(new Vector3(nY * camFOV/2, nX * hFOV/2, 0))
            newDir.rotateByQuaternionToRef(rotQ, newDir);
            // newDir SHOULD be the direction from the camera to the object selected.
            let newRay = new Ray(camPos, newDir);
            let newPickInfo = this.game.scene.pickWithRay(newRay);

            if(newPickInfo?.hit){
              newPickInfo.pickedMesh!.edgesColor = Color4.FromColor3(Color3.Red());
              newPickInfo.pickedMesh!.enableEdgesRendering();
            }
>>>>>>> e8aa3c08976a2f8c60bf8c86b9249c5ccc431a57

          }
        }

        // RELEASE trigger
        else {

        }
      }

    }

    // Handle rotation here too... not really "laser pointer" but locomotive so I'll just stick it here
    {
      let stickVal = rightStick ? rightStick.axes.x : 0;
      if (Math.abs(stickVal) < this.stickDeadzone) {
        this.stickNeutral = true;
      }

      if (Math.abs(stickVal) > this.stickThreshold && this.stickNeutral) {
        // Turn
        this.stickNeutral = false;
        let turnAngle = (Math.abs(stickVal) / stickVal) * this.turnAngle;
        let cameraRotation = Quaternion.FromEulerAngles(0, (turnAngle * Math.PI) / 180, 0);
        this.game.xrCamera!.rotationQuaternion.multiplyInPlace(cameraRotation);
      }
    }

  }


  // These may or may not be helpful--dont have to use

  // Activate physics impostor (if exists)
  // Set parent back to pickedParent
  // Set pickedparent and picked back to null
  private drop(): void {
    // Can't drop if nothing is picked
    if (!this.picked) {
      return;
    }

    if (this.picked.physicsImpostor) {
      this.picked.physicsImpostor.wakeUp();
    }

    this.picked.setParent(this.pickedParent);

    this.picked = null;
    this.pickedParent = null;
  }


  // Deactivate physics impostor
  private pickup(mesh: AbstractMesh): void {
    // Can't pickup if already have something picked
    if (this.picked) {
      return;
    }

    if (mesh.physicsImpostor) {
      mesh.physicsImpostor.sleep();
    }

    this.picked = mesh;
    this.pickedParent = <Mesh>mesh.parent;
  }

  private teleport(point: Vector3) {
    let baseHeight = this.game.xrCamera!.position.y;
    this.game.xrCamera!.position = point.clone();
    this.game.xrCamera!.position.y = baseHeight;
    this.laserActivated = false;
  }

  public update(): void {

  }
}
import { Scene } from "@babylonjs/core/scene";
import { CubeMapToSphericalPolynomialTools, Logger, VertexBuffer, WebXRInputSource } from "@babylonjs/core";
import { Vector3, Color3, Plane, Color4 } from "@babylonjs/core/Maths/math";
import { Ray } from "@babylonjs/core/Culling/ray";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { LinesMesh } from "@babylonjs/core/Meshes/linesMesh";
import { Quaternion } from "@babylonjs/core/Maths/math.vector";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Matrix } from "@babylonjs/core/Maths/math";



import { pfModule } from "./pfModule";
import { Game } from "./index";
import { PermaFrame } from "./permaFrame";

export class LaserPointer implements pfModule {
  game: Game;

  private laserPointer: Mesh | null;
  private laserActivated: boolean;
  private maxTeleport: number;
  private teleportPoint: Vector3 | null;

  private frameLaser: LinesMesh | null;

  // Spring depth manip stuff
  private springLines: LinesMesh | null;
  private initPos: Vector3 | null;       // Holds initial location of controller when something is selected
  private springDeadzone: number;   // Minimum dist from initial distance that the spring can be used
  private initDist: number;         // Set during pickup(), initial distance from controller to the pickedFrame
  private springK: number;          // Spring strength

  private initX: number;
  private initY: number;
  private normX: number;
  private normY: number;
  private selectedInitPos: Vector3;

  private stickThreshold: number;
  private stickDeadzone: number;
  private stickNeutral: boolean;
  private turnAngle: number;

  private pickedParent: AbstractMesh | null;

  private pickedFrame: PermaFrame | null;

  private laserOffset: Vector3;

  constructor(game: Game) {
    this.game = game;

    this.laserPointer = null;
    this.laserActivated = false;
    this.maxTeleport = 100; // max distance the ray is cast
    this.teleportPoint = null;

    // TODO:Make this invisible 
    this.frameLaser = null;

    this.springLines = null;
    this.initPos = null;
    this.springDeadzone = 0.08;
    this.initDist = 0;
    this.springK = -0.1;

    this.initX = 0;
    this.initY = 0;
    this.normX = 0;
    this.normY = 0;
    this.selectedInitPos = new Vector3();

    this.stickThreshold = 0.5;
    this.stickDeadzone = 0.2;
    this.stickNeutral = true;
    this.turnAngle = 30;

    this.pickedParent = null;

    this.pickedFrame = null;

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

    this.frameLaser = Mesh.CreateLines(
      "camLaser",
      [new Vector3(0, 0, 0), new Vector3(0, 0, 20)],
      this.game.scene,
      true);
    this.frameLaser.position = this.laserOffset; // just puts it coming out of the finger
    this.frameLaser.isPickable = false;
    this.frameLaser.color = Color3.Green();
    this.frameLaser.visibility = 0;

    this.springLines = Mesh.CreateLines(
      "springLines",
      [new Vector3(0, 0, 0), new Vector3(0, 0, 1)],
      this.game.scene,
      true
    );
    this.springLines.isPickable = false;
    this.springLines.color = Color3.Green();
    this.springLines.visibility = 0;
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

      if (pickInfo!.hit) {
        // If anything is hit, change color and length
        let mat = <StandardMaterial>this.laserPointer!.material!;
        mat.diffuseColor = Color3.Green();
        this.laserPointer!.scaling = new Vector3(0.003, 0.003, pickInfo!.distance);

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
              this.pickedFrame = frame;
              break;
            }

            this.pickedFrame = null;
          }
        }

      } else {
        this.drop();
        let mat = <StandardMaterial>this.laserPointer!.material!;
        mat.diffuseColor = Color3.Red();
        this.laserPointer!.scaling = new Vector3(0.003, 0.003, this.maxTeleport);
      }

      let nX = 0;
      let nY = 0;

      if (this.pickedFrame) {
        if (pickInfo?.pickedPoint) {
          let hitPos = pickInfo!.pickedPoint?.clone();
          let verts = this.pickedFrame.getPlane()?.getVerticesData(VertexBuffer.PositionKind);
          let upperLeft = new Vector3(verts![0], verts![1], verts![2]);
          let upperRight = new Vector3(verts![3], verts![4], verts![5]);
          let bottomLeft = new Vector3(verts![6], verts![7], verts![8]);

          let transform = this.pickedFrame.getWorldTransform();
          upperLeft = Vector3.TransformCoordinates(upperLeft, transform);
          upperRight = Vector3.TransformCoordinates(upperRight, transform);
          bottomLeft = Vector3.TransformCoordinates(bottomLeft, transform);

          let fromTopLeftToHit = hitPos!.subtract(upperLeft);
          let topEdge = upperRight.subtract(upperLeft);
          let leftEdge = bottomLeft.subtract(upperLeft);

          nX = (Vector3.Dot(fromTopLeftToHit, topEdge.normalize()) /
            this.pickedFrame.getFrameInfo()!.width - 0.5) * 2;
          nY = (Vector3.Dot(fromTopLeftToHit, leftEdge.normalize()) /
            this.pickedFrame.getFrameInfo()!.height - 0.5) * 2;

          this.normX = nX;
          this.normY = nY;

          // We now have the normalized X and Y coordinates (center origin)
          let cam = this.pickedFrame.getCamera()!;
          let camPos = cam.position.clone();
          let camFOV = cam.fov;
          //let camAspectRatio = this.game.scene.getEngine().getAspectRatio(cam);
          let camAspectRatio = upperRight.subtract(upperLeft).length() / bottomLeft.subtract(upperLeft).length();
          let hFOV = 2 * Math.atan(camAspectRatio * Math.tan(camFOV / 2));

          let viewDir = cam.getDirection(new Vector3(0, 0, 1));
          let upDir = cam.getDirection(new Vector3(0, 1, 0));
          let rightDir = cam.getDirection(new Vector3(1, 0, 0));

          // let rotQ = Quaternion.FromEulerVector(new Vector3(nY * camFOV / 2, nX * hFOV / 2, 0))
          // viewDir.rotateByQuaternionToRef(rotQ, viewDir);

          let hRot = Matrix.RotationAxis(upDir, nX * hFOV / 2);
          let vRot = Matrix.RotationAxis(rightDir, nY * camFOV / 2);

          viewDir = Vector3.TransformCoordinates(viewDir, hRot);
          viewDir = Vector3.TransformCoordinates(viewDir, vRot);

          // viewDir SHOULD be the direction from the camera to the object selected.
          let newRay = new Ray(camPos, viewDir);
          let newPickInfo = this.game.scene.pickWithRay(newRay, function (pick) {
            if (!pick.isPickable || pick.name === "frameBoundary" || pick.name.startsWith("Ground")) {
              return false;
            }
            return true;
          });



          if (newPickInfo?.hit) {
            if (newPickInfo.pickedMesh) {
              this.frameLaser = Mesh.CreateLines(
                "camLaser",
                [camPos, camPos.add(viewDir.scale(50))],
                this.game.scene,
                undefined,
                this.frameLaser
              );
              pickedMesh = newPickInfo.pickedMesh;
            }
            else {
              this.frameLaser?.dispose();
              this.frameLaser = null;
              pickedMesh = null;
            }
          }
          else {
            pickedMesh = null;
          }
        }
      }
      else {
        this.drop();
        pickedMesh = null;
      }


      // Right trigger activates picking or teleportation
      // I suppose we have no reason to implement basic pointer picking, 
      // because that should only be done through the frame. Also it's extra work
      if (rightTrigger!.changes.pressed) {
        // PRESS trigger
        if (rightTrigger!.pressed) {
          // Handle teleport
          if (teleportPoint) {
            this.teleport(teleportPoint)
          }
          else if (pickedMesh) {
            this.drop();
            this.pickup(pickedMesh);
            this.initY = nY;
            this.initX = nX;

            let parent = pickedMesh.parent;
            pickedMesh.setParent(null);

            this.selectedInitPos = pickedMesh.position;
            pickedMesh.setParent(parent);
          }
        }

        // RELEASE trigger
        else {
          this.drop();
        }
      }

    }
    else {
      this.drop();
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
    if (!this.game.selectedObject) {
      return;
    }

    console.log("drop");

    if (this.game.selectedObject.physicsImpostor) {
      console.log("waking up");
      this.game.selectedObject.physicsImpostor.wakeUp();
    }

    this.game.selectedObject.setParent(this.pickedParent);
    this.game.selectedObject.disableEdgesRendering();

    this.game.selectedObject = null;
    this.pickedParent = null;

    this.initDist = 0;
    this.initPos = null;
  }


  // Deactivate physics impostor
  private pickup(mesh: AbstractMesh): void {
    // Can't pickup if already have something picked
    if (this.game.selectedObject) {
      return;
    }

    console.log("pickup");


    if (mesh.physicsImpostor) {
      mesh.physicsImpostor.sleep();
    }

    this.game.selectedObject = mesh;
    this.game.selectedObject = mesh;
    this.game.selectedObject.edgesColor = Color4.FromColor3(Color3.Red());
    this.game.selectedObject.enableEdgesRendering()
    this.game.selectedObject.edgesWidth = 2;
    this.pickedParent = <Mesh>mesh.parent;

    // Init spring dist
    if (this.pickedFrame) {
      let frameInfo = this.pickedFrame.getFrameInfo();
      let verts = frameInfo?.vertexData.positions;
      let worldTransform = this.pickedFrame.getWorldTransform();

      let normal = frameInfo?.normal;
      let point = new Vector3(verts![0], verts![1], verts![2]);

      normal = Vector3.TransformCoordinates(normal!, worldTransform);
      point = Vector3.TransformCoordinates(point, worldTransform);

      this.initPos = this.game.rightController?.pointer!.position!.clone()!;
      this.initDist = this.getDistToPlane(normal, point, this.initPos);
    }
  }

  private teleport(point: Vector3) {
    let baseHeight = this.game.xrCamera!.position.y;
    this.game.xrCamera!.position = point.clone();
    this.game.xrCamera!.position.y = baseHeight;
    this.laserActivated = false;
  }

  public update(): void {
    this.updateDepth();
    this.updateTranslation();
    if (this.game.selectedObject) {
      this.game.selectedObject.physicsImpostor?.sleep();
    }
  }

  private updateTranslation() {
    if (!this.game.selectedObject) {
      return;
    }

    let frameInfo = this.pickedFrame!.getFrameInfo();
    let camera = this.pickedFrame!.getCamera()!;

    // Get edge vectors of the frustum plane
    let right = camera.getDirection(new Vector3(1, 0, 0)).normalize();
    let up = camera.getDirection(new Vector3(0, 1, 0)).normalize();
    let viewDir = camera.getDirection(new Vector3(0, 0, 1)).normalize();

    let parent = this.game.selectedObject.parent;
    this.game.selectedObject.setParent(null);

    let camToObject = this.selectedInitPos.subtract(camera.position);

    let d = Vector3.Dot(camToObject, viewDir!);

    let h = 2 * d * Math.tan(frameInfo!.fov / 2);
    let w = h * (frameInfo!.width / frameInfo!.height);


    let objPos = this.selectedInitPos!
      .add(up!.scale((this.normY - this.initY) * -h / 2))
      .add(right!.scale((this.normX - this.initX) * w / 2));


    this.game.selectedObject.position = objPos;

    this.game.selectedObject.setParent(parent);
  }

  private updateDepth(): void {
    if (!this.game.selectedObject) {
      this.springLines!.visibility = 0;
      return;
    }

    this.springLines!.visibility = 1;

    // Make all these vars
    // Keep track of initial distance to the boundary plane, will have to calculate that
    // Have a "distance buffer" so that there is a deadzone
    // If distance is less than or greater than initDistance +- deadzone, then move by some function of dt

    // First, make plane equation from world coordinates and normal of frame
    let frameInfo = this.pickedFrame!.getFrameInfo();
    let verts = frameInfo!.vertexData.positions;
    let worldTransform = this.pickedFrame!.getWorldTransform();

    let normal = frameInfo!.normal;
    let point = new Vector3(verts![0], verts![1], verts![2]);

    normal = Vector3.TransformCoordinates(normal!, worldTransform);
    point = Vector3.TransformCoordinates(point, worldTransform);
    let controllerPos = this.game.rightController?.pointer!.position!;

    let dist = this.getDistToPlane(normal, point, controllerPos);

    this.springLines = Mesh.CreateLines(
      "springLines",
      [this.initPos!, controllerPos],
      this.game.scene,
      undefined,
      this.springLines
    );

    // Spring equation a = -kx
    let x;
    // Spring is too small
    if (Math.abs(dist - this.initDist) < this.springDeadzone) {
      this.springLines.color = Color3.Red();
      x = 0;
    }
    else {
      this.springLines.color = Color3.Green();
      x = dist - this.initDist > 0 ?
        dist - this.springDeadzone - this.initDist :
        dist + this.springDeadzone - this.initDist;
    }

    // Move selected object along frame's camera
    let viewDir = this.pickedFrame!.getCamera()?.getDirection(new Vector3(0, 0, 1));
    let offset = viewDir?.scale(this.springK * x * this.game.getDeltaTime());

    this.selectedInitPos.addInPlace(offset!);
  }

  private getDistToPlane(N: Vector3, Q: Vector3, P: Vector3): number {
    // Getting shortest distance to frame by:
    // https://mathinsight.org/distance_point_plane

    // N: Normal
    // Q: Plane point
    // P: Query point
    let A = N.x;
    let B = N.y;
    let C = N.z;
    let D = (-A * Q.x) - (B * Q.y) - (C * Q.z);
    let x1 = P.x;
    let y1 = P.y;
    let z1 = P.z;

    let numerator = (Math.abs(A * x1 + B * y1 + C * z1 + D));
    let denominator = (Math.sqrt(A * A + B * B + C * C));

    if (denominator !== 0) {
      return numerator / denominator;
    }

    // Just return a big number
    return 10000;
  }
}
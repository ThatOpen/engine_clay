import * as THREE from "three";
import { ClippingPlane, ClippingPlaneType } from "../../../Openings";
import { SimpleWall } from "./simple-wall";

// The wall planes are used to solve corners with other walls
// Each wall has 4 planes. The name implies the position and the direction
// assuming a wall that seen from above goes from left to right, its normal pointing down
// down is exterior, up is interior

export class SimpleWallClippingPlanes {
  list: {
    downDown: ClippingPlane;
    upUp: ClippingPlane;
    downUp: ClippingPlane;
    upDown: ClippingPlane;
  };

  private _wall: SimpleWall;

  constructor(wall: SimpleWall) {
    this._wall = wall;

    const clippingPlanes = wall.model.types.get(
      "clipping-planes",
    ) as ClippingPlaneType;

    if (!clippingPlanes) {
      throw new Error("Clipping plane type missing!");
    }

    this.list = {
      upUp: clippingPlanes.addInstance(),
      downDown: clippingPlanes.addInstance(),
      upDown: clippingPlanes.addInstance(),
      downUp: clippingPlanes.addInstance(),
    };

    this.update();
  }

  get(position: "interior" | "exterior", direction: "interior" | "exterior") {
    if (position === "interior" && direction === "interior") {
      return this.list.upUp;
    }
    if (position === "interior" && direction === "exterior") {
      return this.list.upDown;
    }
    if (position === "exterior" && direction === "interior") {
      return this.list.downUp;
    }
    if (position === "exterior" && direction === "exterior") {
      return this.list.downDown;
    }
    throw new Error("Error getting wall plane!");
  }

  update() {
    const width = this._wall.type.width / 2;

    const temp = new THREE.Object3D();

    const downDirection = this._wall.normal;
    const upDirection = downDirection.clone().multiplyScalar(-1);

    const offsetOffset = upDirection.clone().multiplyScalar(this._wall.offset);

    const downOffset = downDirection.clone().multiplyScalar(width);
    const downPoint = this._wall.startPoint3D.add(downOffset).add(offsetOffset);

    const upOffset = upDirection.clone().multiplyScalar(width);
    const upPoint = this._wall.startPoint3D.add(upOffset).add(offsetOffset);

    const { downDown, upDown, downUp, upUp } = this.list;

    temp.position.copy(this._wall.startPoint3D.add(offsetOffset));
    temp.lookAt(downPoint);

    downDown.position.copy(downPoint);
    downDown.rotation.copy(temp.rotation);
    downDown.update();

    upDown.position.copy(upPoint);
    upDown.rotation.copy(temp.rotation);
    upDown.update();

    temp.lookAt(upPoint);

    upUp.position.copy(upPoint);
    upUp.rotation.copy(temp.rotation);
    upUp.update();

    downUp.position.copy(downPoint);
    downUp.rotation.copy(temp.rotation);
    downUp.update();
  }
}

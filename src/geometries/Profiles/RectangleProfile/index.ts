import * as THREE from "three";
import * as WEBIFC from "web-ifc";
import {Profile} from "../Profile";
import {Model} from "../../../base";


export class RectangleProfile extends Profile {

    data: WEBIFC.IFC4X3.IfcRectangleProfileDef;

    dimension = new THREE.Vector3(1, 1, 0);

    direction = new THREE.Vector3(1, 0, 0);

    position = new THREE.Vector3(0, 0, 0);

    constructor(model: Model) {
        super(model);

        this.data = model.createIfcEntity<typeof WEBIFC.IFC4X3.IfcRectangleProfileDef>(
            WEBIFC.IFCRECTANGLEPROFILEDEF,
            WEBIFC.IFC4X3.IfcProfileTypeEnum.AREA,
            this.model.label("Rectangular profile"),
            this.model.axis2Placement2D(this.position, this.direction),
            this.model.positiveLength(this.dimension.x),
            this.model.positiveLength(this.dimension.y),
        );

        this.model.set(this.data);
    }

    update() {

        this.data.XDim.value = this.dimension.x;
        this.data.YDim.value = this.dimension.y;

        const placement = this.model.get(this.data.Position);

        const location = this.model.get(placement.Location) as WEBIFC.IFC4X3.IfcCartesianPoint;
        location.Coordinates[0].value = this.position.y;
        location.Coordinates[1].value = -this.position.x;
        this.model.set(location);

        const ifcDirection = this.model.get(placement.RefDirection);
        ifcDirection.DirectionRatios[0].value = this.direction.y;
        ifcDirection.DirectionRatios[1].value = -this.direction.x;
        this.model.set(ifcDirection);

        this.model.set(this.data);
    }
}

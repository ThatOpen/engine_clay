
import { IFC4X3 as IFC } from "web-ifc";
import { Element } from "../../../Elements";
import { Model } from "../../../../base";
import { SimpleMemberType } from "..";
import { v4 as uuidv4 } from "uuid";
import { IfcUtils } from "../../../../utils/ifc-utils";
import { Extrusion, RectangleProfile } from "../../../../geometries";
import * as THREE from "three";


export class SimpleMember extends Element {
    attributes: IFC.IfcMember;

    body: Extrusion<RectangleProfile>;

    type: SimpleMemberType

    constructor(model: Model, type: SimpleMemberType) {
        super(model, type)
        this.type = type
        const location = new THREE.Vector3(0,0,1)
        const placement = IfcUtils.localPlacement(location);

        const profile = new RectangleProfile(model);
        profile.dimension.x = 0.127 //2.6 inches in meters
        profile.dimension.y = 0.0635 //5 inches in meters
        profile.position = new THREE.Vector3(0,0,5)
        profile.update();

        this.body = new Extrusion(model, profile);
        const id = this.body.attributes.expressID;
        this.type.geometries.set(id, this.body);
        this.geometries.add(id);


        this.attributes = new IFC.IfcPlate(
            new IFC.IfcGloballyUniqueId(uuidv4()),
            null,
            null,
            null,
            null,
            placement, 
            IfcUtils.productDefinitionShape(model, [this.body.attributes]),
            null,
            type.memberType,
        )

        this.model.set(this.attributes);
    }

}

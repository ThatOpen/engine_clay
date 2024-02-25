import * as WEBIFC from "web-ifc";
import * as THREE from "three";
import {ClayGeometry} from "../Geometry";
import {Model} from "../../base";

export class Brep extends ClayGeometry {

    ifcData: WEBIFC.IFC4X3.IfcFacetedBrep | WEBIFC.IFC4X3.IfcBooleanClippingResult;

    core: WEBIFC.IFC4X3.IfcFacetedBrep;

    mesh: THREE.InstancedMesh;

    baseGeometry: THREE.BufferGeometry;

    constructor(model: Model, geometry: THREE.BufferGeometry) {
        super(model);
        this.mesh = model.newThreeMesh();
        this.baseGeometry = geometry;
        this.core = this.getBrep();
        this.ifcData = this.core;
        this.update();
    }

    update() {
        this.model.set(this.core);
        this.model.setMesh(this.ifcData.expressID, this.mesh);
    }

    private getBrep() {
        const position = this.baseGeometry.getAttribute("position");
        const index = this.baseGeometry.getIndex();

        const ifcClosedShell = this.model.createIfcEntity<typeof WEBIFC.IFC4X3.IfcClosedShell>(
            WEBIFC.IFCCLOSEDSHELL,
            []
        );

        if (position && index) {
            const positions = position.array as Float32Array;
            const indices = index.array as Uint16Array;

            for (let i = 0; i < indices.length; i += 3) {
                const vertex1 = new THREE.Vector3().fromArray(
                    positions,
                    indices[i] * 3,
                );
                const vertex2 = new THREE.Vector3().fromArray(
                    positions,
                    indices[i + 1] * 3,
                );
                const vertex3 = new THREE.Vector3().fromArray(
                    positions,
                    indices[i + 2] * 3,
                );

                const triangle = [vertex1, vertex2, vertex3];
                const ifcFace = this.triangleToIFCFace(triangle);

                ifcClosedShell.CfsFaces.push(ifcFace);
            }
        }

        return this.model.createIfcEntity<typeof WEBIFC.IFC4X3.IfcFacetedBrep>(
            WEBIFC.IFCFACETEDBREP,
            ifcClosedShell
        );
    }

    private triangleToIFCFace(triangle: THREE.Vector3[]) {

        const points = triangle.map(vertex => this.model.cartesianPoint(vertex));

        const polyLoop = this.model.createIfcEntity<typeof WEBIFC.IFC4X3.IfcPolyLoop>(
            WEBIFC.IFCPOLYLOOP,
            points
        );

        const faceBound = this.model.createIfcEntity<typeof WEBIFC.IFC4X3.IfcFaceBound>(
            WEBIFC.IFCFACEBOUND,
            polyLoop,
            this.model.boolean(true)
        );


        return this.model.createIfcEntity<typeof WEBIFC.IFC4X3.IfcFace>(
            WEBIFC.IFCFACE,
            [faceBound]
        );
    }
}

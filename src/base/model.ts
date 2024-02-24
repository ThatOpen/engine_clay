import * as THREE from "three";
import * as WEBIFC from "web-ifc";

type ConstructorArgs<T> = T extends new (...args: infer U) => any ? U : never;

type ConstructorArg<T> = T extends new (arg: infer U) => any ? U : never;

export class Model {

    material = new THREE.MeshLambertMaterial();
    
    materialT = new THREE.MeshLambertMaterial({transparent: true, opacity: 0.2});

    ifcAPI = new WEBIFC.IfcAPI();

    private _modelID?: number;

    private _types = {
        REAL: (value: number) => this.real(value),
        LENGTH: (value: number) => this.length(value),
        POSITIVE_LENGTH: (value: number) => this.positiveLength(value),
    };

    get modelID() {
        if (this._modelID === undefined) {
            throw new Error("Model not initialized! Call the init() method.");
        }
        return this._modelID;
    }

    async init() {
        await this.ifcAPI.Init();
        this._modelID = this.ifcAPI.CreateModel({schema: WEBIFC.Schemas.IFC4X3});
    }

    set(item: WEBIFC.IfcLineObject) {
        this.ifcAPI.WriteLine(this.modelID, item);
    }

    delete(item: WEBIFC.IfcLineObject) {
        this.ifcAPI.DeleteLine(this.modelID, item.expressID);
    }

    get<T extends WEBIFC.IfcLineObject>(item: WEBIFC.Handle<T> | T | null) {
        if (item === null) {
            throw new Error("Item not found!");
        }
        if (item instanceof WEBIFC.Handle) {
            return this.ifcAPI.GetLine(this.modelID, item.value) as T;
        }
        return item;
    }

    setMesh(id: number, mesh: THREE.Mesh) {
        this.ifcAPI.StreamMeshes(this.modelID, [id], (ifcMesh) => {
            mesh.geometry.dispose();
            const {geometryExpressID, flatTransformation} = ifcMesh.geometries.get(0);
            const data = this.ifcAPI.GetGeometry(this.modelID, geometryExpressID);
            mesh.geometry = this.ifcToThreeGeometry(data);
            const matrix = new THREE.Matrix4().fromArray(flatTransformation);
            mesh.position.set(0, 0, 0);
            mesh.rotation.set(0, 0, 0);
            mesh.scale.set(1, 1, 1);
            mesh.updateMatrix();
            mesh.applyMatrix4(matrix);
        });
    }

    newThreeMesh() {
        const geometry = new THREE.BufferGeometry();
        const mesh = new THREE.InstancedMesh(geometry, this.material, 1);
        mesh.frustumCulled = false;
        const identity = new THREE.Matrix4().identity();
        mesh.setMatrixAt(0, identity);
        mesh.instanceMatrix.needsUpdate = true;
        return mesh;
    }

    createIfcEntity<T extends new (...args: any[]) => any>(
        type: number,
        ...args: ConstructorArgs<T>
    ) {
        return this.ifcAPI.CreateIfcEntity(this.modelID, type, ...args) as InstanceType<T>;
    }

    createIfcType<T extends new (...args: any[]) => any>(
        type: number,
        value: ConstructorArg<T>
    ) {
        return this.ifcAPI.CreateIfcType(this.modelID, type, value) as InstanceType<T>;
    }

    radiansToDegrees(radians: number) {
        return radians * (180 / Math.PI);
    }

    degreesToRadians(degree: number) {
        return (degree * Math.PI) / 180;
    }

    getZAxis(xDirection: number[]) {
        const xAxis = new THREE.Vector3(
            xDirection[0],
            xDirection[1],
            xDirection[2],
        );
        const yAxis = new THREE.Vector3(0, 1, 0);
        const zAxis = new THREE.Vector3();
        zAxis.crossVectors(xAxis, yAxis);
        return zAxis.toArray();
    }

    calculatePoints(midPoint: number[], length: number, angle: number) {
        const radians = this.degreesToRadians(angle);
        const halfLength = length / 2;

        const startPoint = [
            midPoint[0] - halfLength * Math.cos(radians),
            midPoint[1] - halfLength * Math.sin(radians),
        ];
        const endPoint = [
            midPoint[0] + halfLength * Math.cos(radians),
            midPoint[1] + halfLength * Math.sin(radians),
        ];
        return [startPoint, endPoint];
    }

    calculateRotationAngleFromDirection(direction: number[]) {
        return Math.atan2(direction[0], direction[1]);
    }

    calculateRotationAngleFromTwoPoints(
        firstPoint: number[],
        secondPoint: number[],
    ) {
        const dx = secondPoint[0] - firstPoint[0];
        const dy = secondPoint[1] - firstPoint[1];
        return Math.atan2(dy, dx);
    }

    rotate(firstPoint: number[], secondPoint: number[], degree: number) {
        const theta = this.degreesToRadians(degree);
        const midPoint = [
            (firstPoint[0] + secondPoint[0]) / 2,
            (firstPoint[1] + secondPoint[1]) / 2,
            (firstPoint[2] + secondPoint[2]) / 2,
        ];

        return [firstPoint, secondPoint].map((point) => {
            const x = point[0] - midPoint[0];
            const y = point[1] - midPoint[1];
            return [
                x * Math.cos(theta) - y * Math.sin(theta) + midPoint[0],
                x * Math.sin(theta) + y * Math.cos(theta) + midPoint[1],
                midPoint[2],
            ];
        });
    }

    calculateEndPoint(
        startPoint: number[],
        direction: number[],
        magnitude: number,
    ) {
        const vectorMagnitude = Math.sqrt(
            direction[0] ** 2 + direction[1] ** 2 + direction[2] ** 2,
        );
        const unitVector = direction.map(
            (component) => component / vectorMagnitude,
        );
        const displacementVector = unitVector.map(
            (component) => component * magnitude,
        );
        return [
            startPoint[0] + displacementVector[0],
            startPoint[1] + displacementVector[1],
            startPoint[2] + displacementVector[2],
        ];
    }

    representationContext() {
        return this.createIfcEntity<typeof WEBIFC.IFC4X3.IfcRepresentationContext>(
            WEBIFC.IFCREPRESENTATIONCONTEXT,
            this.label("Body"),
            this.label("Model"),
        );
    }

    productDefinitionShape(representations: WEBIFC.IFC4X3.IfcRepresentation[]) {
        return this.createIfcEntity<typeof WEBIFC.IFC4X3.IfcProductDefinitionShape>(
            WEBIFC.IFCPRODUCTDEFINITIONSHAPE,
            this.label(""),
            this.label(""),
            representations,
        );
    }

    shapeRepresentation(
        identifier: string,
        type: string,
        representations: WEBIFC.IFC4X3.IfcRepresentationItem[],
    ) {
        return this.createIfcEntity<typeof WEBIFC.IFC4X3.IfcShapeRepresentation>(
            WEBIFC.IFCSHAPEREPRESENTATION,
            this.representationContext(),
            this.label(identifier),
            this.label(type),
            representations,
        );
    }

    localPlacement(location?: WEBIFC.IFC4X3.IfcAxis2Placement3D, relTo?: WEBIFC.IFC4X3.IfcObjectPlacement) {
        if (!location) {
            location = this.axis2Placement3D(new THREE.Vector3());
        }

        if (!relTo) {
            relTo = this.createIfcEntity<typeof WEBIFC.IFC4X3.IfcObjectPlacement>(
                WEBIFC.IFCOBJECTPLACEMENT,
                null
            )
        }

        return this.createIfcEntity<typeof WEBIFC.IFC4X3.IfcLocalPlacement>(
            WEBIFC.IFCLOCALPLACEMENT,
            relTo,
            location
        )
    }

    polyline(points: THREE.Vector3[]) {
        const listOfPoints = points.map((point) => this.cartesianPoint(point));
        return this.createIfcEntity<typeof WEBIFC.IFC4X3.IfcPolyline>(
            WEBIFC.IFCPOLYLINE,
            listOfPoints,
        );
    }

    guid(value: string) {
        return this.createIfcType<typeof WEBIFC.IFC4X3.IfcGloballyUniqueId>(
            WEBIFC.IFCGLOBALLYUNIQUEID,
            value,
        );
    }

    identifier(value: string) {
        return this.createIfcType<typeof WEBIFC.IFC4X3.IfcIdentifier>(
            WEBIFC.IFCIDENTIFIER,
            value,
        );
    }

    real(value: number) {
        return this.createIfcType<typeof WEBIFC.IFC4X3.IfcReal>(
            WEBIFC.IFCREAL,
            value,
        );
    }

    label(text: string) {
        return this.createIfcType<typeof WEBIFC.IFC4X3.IfcLabel>(
            WEBIFC.IFCLABEL,
            text,
        );
    }

    length(value: number) {
        return this.createIfcType<typeof WEBIFC.IFC4X3.IfcLengthMeasure>(
            WEBIFC.IFCLENGTHMEASURE,
            value,
        );
    }

    positiveLength(value: number) {
        return this.createIfcType<typeof WEBIFC.IFC4X3.IfcPositiveLengthMeasure>(
            WEBIFC.IFCPOSITIVELENGTHMEASURE,
            value,
        );
    }

    objectPlacement(
        placementRelTo: WEBIFC.IFC4X3.IfcObjectPlacement | null = null,
    ) {
        return this.createIfcEntity<typeof WEBIFC.IFC4X3.IfcObjectPlacement>(
            WEBIFC.IFCAXIS2PLACEMENT2D,
            placementRelTo,
        );
    }

    direction(values: THREE.Vector3) {
        return this.createIfcEntity<typeof WEBIFC.IFC4X3.IfcDirection>(
            WEBIFC.IFCDIRECTION,
            this.vector(values, "REAL"),
        );
    }

    cartesianPoint(values: THREE.Vector3) {
        return this.createIfcEntity<typeof WEBIFC.IFC4X3.IfcCartesianPoint>(
            WEBIFC.IFCCARTESIANPOINT,
            this.vector(values, "LENGTH"),
        );
    }

    axis2Placement2D(
        location: THREE.Vector3 | WEBIFC.IFC4X3.IfcCartesianPoint,
        direction: THREE.Vector3 | WEBIFC.IFC4X3.IfcDirection | null = null,
    ) {
        if (location instanceof THREE.Vector3) {
            location = this.cartesianPoint(location);
        }
        if (direction instanceof THREE.Vector3) {
            direction = this.direction(direction);
        }
        return this.createIfcEntity<typeof WEBIFC.IFC4X3.IfcAxis2Placement2D>(
            WEBIFC.IFCAXIS2PLACEMENT2D,
            location,
            direction,
        );
    }

    axis2Placement3D(
        location: THREE.Vector3 | WEBIFC.IFC4X3.IfcCartesianPoint,
        axis: THREE.Vector3 | WEBIFC.IFC4X3.IfcDirection | null = null,
        direction: THREE.Vector3 | WEBIFC.IFC4X3.IfcDirection | null = null,
    ) {
        if (location instanceof THREE.Vector3) {
            location = this.cartesianPoint(location);
        }
        if (axis instanceof THREE.Vector3) {
            axis = this.direction(axis);
        }
        if (direction instanceof THREE.Vector3) {
            direction = this.direction(direction);
        }

        return this.createIfcEntity<typeof WEBIFC.IFC4X3.IfcAxis2Placement3D>(
            WEBIFC.IFCAXIS2PLACEMENT3D,
            location,
            axis,
            direction,
        );
    }

    bool(
        firstOperand: WEBIFC.IFC4X3.IfcBooleanOperand,
        secondOperand: WEBIFC.IFC4X3.IfcBooleanOperand,
    ) {
        return this.createIfcEntity<typeof WEBIFC.IFC4X3.IfcBooleanClippingResult>(
            WEBIFC.IFCBOOLEANCLIPPINGRESULT,
            WEBIFC.IFC4X3.IfcBooleanOperator.DIFFERENCE,
            firstOperand,
            secondOperand,
        );
    }

    vector(values: THREE.Vector3, type: keyof typeof this._types) {
        if (!this._types[type]) {
            throw new Error(`Type not found: ${type}`);
        }
        const action = this._types[type];
        const valueArray = values.toArray();
        return valueArray.map((value) => action(value));

    }


    private ifcToThreeGeometry(data: WEBIFC.IfcGeometry) {
        const index = this.ifcAPI.GetIndexArray(
            data.GetIndexData(),
            data.GetIndexDataSize(),
        );

        const vertexData = this.ifcAPI.GetVertexArray(
            data.GetVertexData(),
            data.GetVertexDataSize(),
        );

        const position = new Float32Array(vertexData.length / 2);
        const normal = new Float32Array(vertexData.length / 2);

        for (let i = 0; i < vertexData.length; i += 6) {
            position[i / 2] = vertexData[i];
            position[i / 2 + 1] = vertexData[i + 1];
            position[i / 2 + 2] = vertexData[i + 2];

            normal[i / 2] = vertexData[i + 3];
            normal[i / 2 + 1] = vertexData[i + 4];
            normal[i / 2 + 2] = vertexData[i + 5];
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
        geometry.setAttribute("normal", new THREE.BufferAttribute(normal, 3));
        geometry.setIndex(Array.from(index));
        return geometry;
    }

}

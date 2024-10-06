import * as THREE from "three";
import * as BUI from "@thatopen/ui";
import Stats from "stats.js";
import * as OBC from "@thatopen/components";

import * as WEBIFC from "web-ifc";
import { ParametricGeometries } from "three/examples/jsm/geometries/ParametricGeometries";
import * as CLAY from "../../..";
import plane = ParametricGeometries.plane;

const container = document.getElementById("container")!;

const components = new OBC.Components();

const worlds = components.get(OBC.Worlds);

const world = worlds.create<
  OBC.SimpleScene,
  OBC.SimpleCamera,
  OBC.SimpleRenderer
>();

world.scene = new OBC.SimpleScene(components);
world.renderer = new OBC.SimpleRenderer(components, container);
world.camera = new OBC.SimpleCamera(components);

components.init();
world.scene.setup();
world.scene.three.background = null;

const grids = components.get(OBC.Grids);
grids.create(world);

const axis = new THREE.AxesHelper();
const axisMat = axis.material as THREE.MeshLambertMaterial;
axisMat.depthTest = false;
axisMat.transparent = true;
world.scene.three.add(axis);

const model = new CLAY.Model();
model.wasm = { path: "https://unpkg.com/web-ifc@0.0.59/", absolute: true };
await model.init();

const project = new CLAY.Project(model);
const site = new CLAY.Site(model, project);

const simpleWallType = new CLAY.SimpleWallType(model);

const wall1 = simpleWallType.addInstance();
world.scene.three.add(...wall1.meshes);
wall1.startPoint = new THREE.Vector2(0, 0);
wall1.endPoint = new THREE.Vector2(0, 1);
wall1.update(true);
wall1.meshes[0].setColorAt(0, new THREE.Color(1, 0, 0));
//
// const wall2 = simpleWallType.addInstance();
// world.scene.three.add(...wall2.meshes);
// wall2.startPoint = new THREE.Vector2(0, 0);
// wall2.endPoint = new THREE.Vector2(0, 1);
// wall2.update(true);

site.children.add(wall1.attributes.expressID);
// site.children.add(wall2.attributes.expressID);

// simpleWallType.addCorner({
//   wall1,
//   wall2,
//   to: "interior",
//   cut: "interior",
//   cutDirection: "interior",
//   priority: "start",
// });

simpleWallType.updateCorners();

world.camera.controls.fitToSphere(wall1.meshes[0], false);

// const simpleOpeningType = new CLAY.SimpleOpeningType(model);
// const opening = simpleOpeningType.addInstance();
// // world.scene.three.add(...opening.meshes);
// console.log(simpleOpeningType);
// opening.transformation.position.x += 1;
//
// await wall1.addSubtraction(opening, true);
// wall1.update(true);

const test = new THREE.Mesh(
  new THREE.PlaneGeometry(),
  new THREE.MeshLambertMaterial({
    color: "blue",
    transparent: true,
    opacity: 0.3,
    side: 2,
  }),
);

const wallAxis = new THREE.AxesHelper();
wallAxis.material.depthTest = false;
wallAxis.material.transparent = true;
wall1.transformation.add(wallAxis);
world.scene.three.add(wall1.transformation);

world.scene.three.add(test);
test.position.set(0.5, 0.5, 0.5);
test.lookAt(0, 0, 0);
test.updateMatrix();

const halfSpace = new CLAY.HalfSpace(model);
wall1.body.addSubtraction(halfSpace);

function updatePlane() {
  const delta = 0.000000001;
  const vector = new THREE.Vector3(0, 0, 1);

  const planeRotation = new THREE.Matrix4();
  planeRotation.extractRotation(test.matrix);
  vector.applyMatrix4(planeRotation);

  wall1.transformation.updateMatrix();
  const rotation = new THREE.Matrix4();
  const inverseWall = wall1.transformation.matrix.clone();
  inverseWall.invert();
  rotation.extractRotation(inverseWall);
  vector.applyMatrix4(rotation);

  const position = test.position.clone();
  position.applyMatrix4(inverseWall);

  halfSpace.transformation.position.copy(position);
  halfSpace.direction.copy(vector).normalize();

  halfSpace.update();
  wall1.update(true);
}

updatePlane();

function animate() {
  test.rotation.x += Math.PI / 180;
  test.updateMatrix();
  updatePlane();
  requestAnimationFrame(animate);
}

animate();

// Stats

const stats = new Stats();
stats.showPanel(2);
document.body.append(stats.dom);
stats.dom.style.left = "0px";
stats.dom.style.zIndex = "unset";

world.renderer.onBeforeUpdate.add(() => stats.begin());
world.renderer.onAfterUpdate.add(() => stats.end());

// UI

BUI.Manager.init();

const panel = BUI.Component.create<BUI.PanelSection>(() => {
  return BUI.html`
    <bim-panel label="Simple Walls Tutorial" class="options-menu">
      <bim-panel-section collapsed label="Controls">

      <div style="display: flex; gap: 12px">

        <bim-number-input slider step="0.1" label="Start X" vertical="true" value="${wall1.startPoint.x}" @change="${(
          event: any,
        ) => {
          wall1.startPoint.x = event.target.value;
          wall1.update(true);
          updatePlane();
          simpleWallType.updateCorners();

          // simpleWallType.updateCorners();
        }}"></bim-number-input>

        <bim-number-input slider step="0.1" label="Start Z" vertical="true" value="${wall1.startPoint.y}" @change="${(
          event: any,
        ) => {
          wall1.startPoint.y = event.target.value;
          wall1.update(true);
          updatePlane();
          simpleWallType.updateCorners();

          console.log("hey");

          // simpleWallType.updateCorners();
        }}"></bim-number-input>

      </div>

      <div style="display: flex; gap: 12px">

        <bim-number-input slider step="0.1" label="End X" vertical="true" value="${wall1.endPoint.x}" @change="${(
          event: any,
        ) => {
          wall1.endPoint.x = event.target.value;
          wall1.update(true);
          updatePlane();
          simpleWallType.updateCorners();

          // simpleWallType.updateCorners();
        }}"></bim-number-input>

        <bim-number-input slider step="0.1" label="End Z" vertical="true" value="${wall1.endPoint.y}" @change="${(
          event: any,
        ) => {
          wall1.endPoint.y = event.target.value;
          wall1.update(true);
          updatePlane();
          simpleWallType.updateCorners();

          // simpleWallType.updateCorners();
        }}"></bim-number-input>


      </div>

      <bim-number-input slider step="0.05" label="Elevation" value="${wall1.transformation.position.y}" @change="${(
        event: any,
      ) => {
        wall1.transformation.position.y = event.target.value;
        wall1.update(true);
        updatePlane();
        simpleWallType.updateCorners();
      }}"></bim-number-input>

      <bim-number-input slider step="0.01" label="Offset" value="${wall1.offset}" @change="${(
        event: any,
      ) => {
        wall1.offset = event.target.value;
        wall1.update(true);
        updatePlane();
        simpleWallType.updateCorners();

        // simpleWallType.updateCorners();
      }}"></bim-number-input>

      <bim-number-input slider step="0.05" label="Thickness" value="${simpleWallType.width}" @change="${(
        event: any,
      ) => {
        simpleWallType.width = event.target.value;
        simpleWallType.update(true);
        // simpleWallType.updateCorners();
      }}"></bim-number-input>

      <bim-number-input slider step="0.05" label="Height" value="${wall1.height}" @change="${(
        event: any,
      ) => {
        wall1.height = event.target.value;
        wall1.update(true);
        updatePlane();
        simpleWallType.updateCorners();

        // simpleWallType.updateCorners();
      }}"></bim-number-input>

      </bim-panel-section>
    </bim-panel>
    `;
});

document.body.append(panel);

const button = BUI.Component.create<BUI.PanelSection>(() => {
  return BUI.html`
      <bim-button class="phone-menu-toggler" icon="solar:settings-bold"
        @click="${() => {
          if (panel.classList.contains("options-menu-visible")) {
            panel.classList.remove("options-menu-visible");
          } else {
            panel.classList.add("options-menu-visible");
          }
        }}">
      </bim-button>
    `;
});

document.body.append(button);

window.addEventListener("keydown", async (e) => {
  if (e.code === "KeyP") {
    simpleWallType.attributes = {};
    console.log("hey");
    if (model._modelID === undefined) {
      throw new Error("Malformed model!");
    }
    // TODO: Fix memory leak
    const asdf = model._ifcAPI.SaveModel(model._modelID);

    const a = document.createElement("a");
    const name = "example.ifc";
    a.href = URL.createObjectURL(new File([asdf], name));
    a.download = name;
    a.click();
    a.remove();
  }
});

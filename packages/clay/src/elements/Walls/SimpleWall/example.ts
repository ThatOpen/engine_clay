import * as THREE from "three";
import * as BUI from "@thatopen/ui";
import Stats from "stats.js";
import * as OBC from "@thatopen/components";

import * as CLAY from "../../..";

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

const model = new CLAY.Model();
model.ifcAPI.SetWasmPath("https://unpkg.com/web-ifc@0.0.59/", true);
await model.init();

const simpleWallType = new CLAY.SimpleWallType(model);

const wall = simpleWallType.addInstance();
world.scene.three.add(...wall.meshes);
// wall.startPoint = new THREE.Vector2(1, 1);
// wall.endPoint = new THREE.Vector2(-1, -1);
wall.update(true);

const wall2 = simpleWallType.addInstance();
world.scene.three.add(...wall2.meshes);
wall2.startPoint = new THREE.Vector2(0, 2);
wall2.endPoint = new THREE.Vector2(0, 1);
wall2.extend(wall);
wall2.update(true);

world.camera.controls.fitToSphere(wall.meshes[0], false);

const simpleOpeningType = new CLAY.SimpleOpeningType(model);
const opening = simpleOpeningType.addInstance();
// scene.add(...opening.meshes);
// console.log(simpleOpeningType);

wall.addSubtraction(opening);
wall.update(true);

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
      
        <bim-number-input slider step="0.1" label="Start X" vertical="true" value="${wall.startPoint.x}" @change="${(
          event: any,
        ) => {
          wall.startPoint.x = event.target.value;
          wall.update(true);
          wall2.extend(wall);
        }}"></bim-number-input>
        
        <bim-number-input slider step="0.1" label="Start Y" vertical="true" value="${wall.startPoint.y}" @change="${(
          event: any,
        ) => {
          wall.startPoint.y = event.target.value;
          wall.update(true);
          wall2.extend(wall);
        }}"></bim-number-input>
        
      </div>
      
      <div style="display: flex; gap: 12px">
      
        <bim-number-input slider step="0.1" label="End X" vertical="true" value="${wall.endPoint.x}" @change="${(
          event: any,
        ) => {
          wall.endPoint.x = event.target.value;
          wall.update(true);
          wall2.extend(wall);
        }}"></bim-number-input>
          
        <bim-number-input slider step="0.1" label="End Y" vertical="true" value="${wall.endPoint.y}" @change="${(
          event: any,
        ) => {
          wall.endPoint.y = event.target.value;
          wall.update(true);
          wall2.extend(wall);
        }}"></bim-number-input>
          
        
      </div>
      
      <bim-number-input slider step="0.05" label="Elevation" value="${wall.elevation}" @change="${(
        event: any,
      ) => {
        opening.position.z = event.target.value;
        opening.update();
        wall.elevation = event.target.value;
        wall.update(true);
      }}"></bim-number-input>
      
      <bim-number-input slider step="0.05" label="Thickness" value="${simpleWallType.width}" @change="${(
        event: any,
      ) => {
        simpleWallType.width = event.target.value;
        simpleWallType.update(true);
      }}"></bim-number-input>      
      
      <bim-number-input slider step="0.05" label="Height" value="${wall.height}" @change="${(
        event: any,
      ) => {
        wall.height = event.target.value;
        wall.update(true);
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

// window.addEventListener("keydown", async (e) => {
//   if (e.code === "KeyP") {
//     const directoryHandle = await window.showDirectoryPicker();
//     async function writeIFC() {
//       const buffer = model.ifcAPI.SaveModel(model.modelID);
//
//       console.log(buffer);
//
//       const fileName = "example.ifc";
//       const fileHandle = await directoryHandle.getFileHandle("example.ifc", {
//         create: true,
//       });
//
//       // Create a FileSystemWritableFileStream to write to.
//       const writable = await fileHandle.createWritable();
//       await writable.truncate(0);
//       // Write the contents of the file to the stream.
//       await writable.write(buffer);
//       // Close the file and write the contents to disk.
//       await writable.close();
//     }
//
//     setInterval(() => writeIFC(), 1000);
//   }
// });

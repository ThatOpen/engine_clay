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
const wall1 = simpleWallType.addInstance();
world.scene.three.add(...wall1.meshes);

wall1.startPoint = new THREE.Vector3(1, 1, 0);
wall1.endPoint = new THREE.Vector3(-1, -1, 0);
wall1.update(true);

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

import * as THREE from "three";
import * as OBC from "./openbim-components.js";

/**
 * Simple Three.js scene to avoid code repetition in each example
 */
export class SimpleComponentsScene {
  components;

  constructor(canvas) {
    this.initializeScene(canvas);
  }

  initializeScene(container) {

    const components = new OBC.Components();
    this.components = components;

    components.scene = new OBC.SimpleScene(components);
    components.renderer = new OBC.SimpleRenderer(components, container);
    components.camera = new OBC.SimpleCamera(components);
    components.raycaster = new OBC.SimpleRaycaster(components);

    components.init();

    const scene = components.scene.get();
    scene.background = new THREE.Color(1, 1, 1);

    const grid = new OBC.SimpleGrid(components);
    components.tools.add(grid);

    components.camera.controls.setLookAt(10, 10, 10, 0, 0, 0);

    const directionalLight = new THREE.DirectionalLight();
    directionalLight.position.set(5, 10, 3);
    directionalLight.intensity = 0.5;
    scene.add(directionalLight);

    const ambientLight = new THREE.AmbientLight();
    ambientLight.intensity = 0.5;
    scene.add(ambientLight);
  }
}

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import Stats from "stats.js/src/Stats.js";

/**
 * Simple Three.js scene to avoid code repetition in each example
 */
export class SimpleThreeScene {
  scene;
  size;
  camera;
  canvas;
  renderer;
  controls;
  stats;
  raycaster;
  mouse;
  mouseEvent;

  constructor(canvas) {
    this.initializeScene(canvas);
  }

  initializeScene(canvas) {
    // Creates the Three.js scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x202932);

    // Object to store the size of the viewport
    this.size = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    // Creates the camera (point of view of the user)
    this.camera = new THREE.PerspectiveCamera(
      75,
      this.size.width / this.size.height
    );
    this.camera.position.z = 5;
    this.camera.position.y = 4;
    this.camera.position.x = 2;

    // Creates the lights of the scene
    const lightColor = 0xffffff;
    const ambientLight = new THREE.AmbientLight(lightColor, 0.5);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(lightColor, 1);
    directionalLight.position.set(0, 10, 0);
    directionalLight.target.position.set(-5, 0, 0);
    this.scene.add(directionalLight);
    this.scene.add(directionalLight.target);

    // Sets up the renderer, fetching the canvas of the HTML
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
    });
    this.renderer.setSize(this.size.width, this.size.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Creates grids and axes in the scene
    const grid = new THREE.GridHelper(50, 30);
    this.scene.add(grid);

    const axes = new THREE.AxesHelper();
    axes.material.depthTest = false;
    axes.renderOrder = 1;
    this.scene.add(axes);

    // Creates the orbit controls (to navigate the scene)
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;

    // Track mouse position
    this.mouse = new THREE.Vector2();
    this.mouseEvent = new THREE.Vector2();
    window.addEventListener("mousemove", (event) => {
      this.mouseEvent.x = event.clientX;
      this.mouseEvent.y = event.clientY;
    });

    // Set up raycaster
    this.raycaster = new THREE.Raycaster();
    this.raycaster.params.Points.threshold = 0.2;

    // Stats
    this.stats = new Stats();
    this.stats.showPanel(2);
    document.body.append(this.stats.dom);

    // Animation loop
    const animate = () => {
      this.stats.begin();
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      this.stats.end();
      requestAnimationFrame(animate);
    };

    animate();

    // Adjust the viewport to the size of the browser
    window.addEventListener("resize", () => {
      this.size.width = window.innerWidth;
      this.size.height = window.innerHeight;
      this.camera.aspect = this.size.width / this.size.height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(this.size.width, this.size.height);
    });
  }

  castRay(items) {
    const x = this.mouseEvent.x;
    const y = this.mouseEvent.y;
    const b = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((x - b.left) / (b.right - b.left)) * 2 - 1;
    this.mouse.y = -((y - b.top) / (b.bottom - b.top)) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    return this.raycaster.intersectObjects(items);
  }
}

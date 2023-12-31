import type { ARScene } from "./scene";
import useLogger from './logger';
import * as THREE from "three";
import { THREEx, ARjs } from "@ar-js-org/ar.js-threejs"
import type { ArMarkerControls } from "@ar-js-org/ar.js-threejs/types/ArMarkerControls";
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';  
import { moveObject } from "./game";

THREEx.ArToolkitContext.baseURL = "./";

const log = useLogger();
export const group = new THREE.Group();

export interface AREngineDelegate {
    onRender?(renderer: THREE.Renderer): void;
    onMarkerFound?(marker: ArMarkerControls): void;
}

export const useAREngine = (): AREngine => {
    return AREngine.getSingleton();
}

export class AREngine {
    scene = new THREE.Scene();
    baseNode?: THREE.Object3D;
    delegate?: AREngineDelegate;
    arScene?: ARScene;

    private static instance: AREngine | null = null;

    public static getSingleton(): AREngine {
        if (!AREngine.instance) {
            AREngine.instance = new AREngine();
        }
        return AREngine.instance;
    }

    private constructor() { }

    replaceScene(ar_scene: ARScene) {
        const nodes = ar_scene.makeObjectTree();

        if (this.baseNode) {
            this.scene.remove(this.baseNode);
        }
        this.baseNode = new THREE.Object3D();
        this.baseNode.add(nodes);
        this.scene.add(this.baseNode!);

        this.arScene = ar_scene;
    }
    /*
    async displayGLBModel(url: string, position: THREE.Vector3, rotation: THREE.Euler, scale: THREE.Vector3): Promise<THREE.Object3D> {
        return new Promise((resolve) => {
            const loader = new GLTFLoader();
            loader.load(url, (gltf) => {
                const model = gltf.scene;
                model.position.copy(position);
                model.rotation.copy(rotation);
                model.scale.copy(scale);
                this.scene.add(model);
                resolve(model);
            });
        });
    }
    */
    
/*
    displayGLBModel(url: string, position: THREE.Vector3, rotation: THREE.Euler, scale: THREE.Vector3) {
        const loader = new GLTFLoader();
        loader.load(url, (gltf) => {
            const model = gltf.scene;
            model.position.copy(position);
            model.rotation.copy(rotation);
            model.scale.copy(scale);
            this.scene.add(model);
        });
    }
*/    
    

    async start(video_canvas: string) {
        const ar_base_element = document.getElementById(video_canvas)

        if (!ar_base_element) {
            console.log(`${video_canvas} is not found`);
            return;
        }

        /* RENDERER */
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        ar_base_element.appendChild(renderer.domElement);

        /* Scene */
        const scene = this.scene;
        const camera = new THREE.Camera();
        scene.add(camera);

        const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
        light.position.set(0.5, 1, 0.25);
        scene.add(light);

        //GTLF
        async function loadAndAddModel(url: string, position: THREE.Vector3, rotation: THREE.Euler, scale: THREE.Vector3) {
            try {
                const Model: THREE.Object3D = await new Promise((resolve, reject) => {
                    const loader = new GLTFLoader();
                    loader.load(url, (gltf) => {
                        const model = gltf.scene;
                        model.position.copy(position);
                        model.rotation.copy(rotation);
                        model.scale.copy(scale);
                        group.add(model);
                        resolve(model);
                    }, undefined, reject);
                });
            } catch (error) {
                console.error('Error loading GLB model:', error);
            }
        }
        //groupにaddされる
        loadAndAddModel.call(this, './src/pen.glb', new THREE.Vector3(0, 0.3, 0), new THREE.Euler(0, 0, 0), new THREE.Vector3(2, 2, 2));
        loadAndAddModel.call(this, './src/note.glb', new THREE.Vector3(0, 0.1, 0), new THREE.Euler(0, 0, 0), new THREE.Vector3(2, 2, 2));
        loadAndAddModel.call(this, './src/erasel.glb', new THREE.Vector3(0, 0.2, 0), new THREE.Euler(0, 0, 0), new THREE.Vector3(2, 2, 2));
        loadAndAddModel.call(this, './src/caterpillar.glb', new THREE.Vector3(0, 0, 0), new THREE.Euler(0, 0, 0), new THREE.Vector3(0.1, 0.1, 0.1));
        //表示
        scene.add(group);
        moveObject();

        const arToolkitSource = new THREEx.ArToolkitSource({
            sourceType: 'webcam',
            sourceWidth: window.innerWidth > window.innerHeight ? 640 * 2 : 480 * 2,
            sourceHeight: window.innerWidth > window.innerHeight ? 480 * 2 : 640 * 2,
        })

        const arToolkitContext = new THREEx.ArToolkitContext({
            cameraParametersUrl: THREEx.ArToolkitContext.baseURL + './data/camera_para.dat',
            detectionMode: 'mono',
        })

        const initARContext = () => {
            arToolkitContext.init(() => {
                camera.projectionMatrix.copy(arToolkitContext.getProjectionMatrix());
                arToolkitContext.arController.orientatio = getSourceOrientation();
                window.arToolkitContext = arToolkitContext;
            })

            var arMarkerControls = new THREEx.ArMarkerControls(arToolkitContext, camera, {
                type: 'pattern',
                patternUrl: THREEx.ArToolkitContext.baseURL + './data/hiro.armarker',
                changeMatrixMode: 'cameraTransformMatrix',
                minConfidence: 0.001,
            })

            arMarkerControls.addEventListener("markerFound", () => {
                this.delegate?.onMarkerFound?.(arMarkerControls);
            })

            scene.visible = false
            window.arMarkerControls = arMarkerControls;
        }

        arToolkitSource.init(function onReady() {
            arToolkitSource.domElement.addEventListener('canplay', () => {
                initARContext();
            }) as unknown as HTMLVideoElement;
            window.arToolkitSource = arToolkitSource;
            setTimeout(() => {
                onResize()
            }, 2000);
        }, function onError() { })

        window.addEventListener('resize', function () {
            onResize()
        })

        function onResize() {
            arToolkitSource.onResizeElement()
            arToolkitSource.copyElementSizeTo(renderer.domElement)
            if (window.arToolkitContext.arController !== null) {
                arToolkitSource.copyElementSizeTo(window.arToolkitContext.arController.canvas)
            }
        }

        function getSourceOrientation(): string {
            if (!arToolkitSource) {
                return '';
            }

            if (arToolkitSource.domElement.videoWidth > arToolkitSource.domElement.videoHeight) {
                return 'landscape';
            } else {
                return 'portrait';
            }
        }

        const render = (delta_sec: number) => {
            this.arScene?.animate(delta_sec);
            this.delegate?.onRender?.(renderer);
            renderer.render(scene, camera);
        }

        const update_ar = () => {
            if (!arToolkitContext || !arToolkitSource || !arToolkitSource.ready) {
                return;
            }

            arToolkitContext.update(arToolkitSource.domElement)
            scene.visible = camera.visible
        }

        var lastTimeMsec: number;
        const animate = (nowMsec: number) => {
            requestAnimationFrame(animate);
            lastTimeMsec = lastTimeMsec || nowMsec - 1000 / 60;
            var deltaMsec = Math.min(200, nowMsec - lastTimeMsec);
            lastTimeMsec = nowMsec;

            group.rotation.y += 0.01;

            update_ar();
            render(deltaMsec / 1000);
        }
        requestAnimationFrame(animate);
    }
};


/*
function make_coordinate_arrows(node: THREE.Object3D, len: number) {
    const arrowX = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0), len, 0xff0000);
    node.add(arrowX);

    const arrowY = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), len, 0x00ff00);
    node.add(arrowY);

    const arrowZ = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 0), len, 0x0000ff);
    node.add(arrowZ);
}
*/
// import { IFC4X3 as IFC } from "web-ifc-three";
// import * as WEBIFC from "web-ifc";
// import * as THREE from "three";
// import { ClayGeometry } from "../Geometry";
// import { Model } from "../base";
// import { IfcUtils } from "../utils/ifc-utils";


// class IfcImporter {
//     constructor(model: Model) {
       
//     }

//     async loadIfcFile(file: File): Promise<void> {
//         const data = await this.parseIfcFile(file);

//         this.generateObjects(data);
//     }

   
//     private async parseIfcFile(file: File): Promise<any> {

//         const ifcApi = new WEBIFC.IfcAPI();

//         // initialize the library
//         await ifcApi.Init();


//         const ifcLoader = new WEBIFC.IfcLoader();



//         ifcApi.LoadIfc(filePath);

//         // Set a callback when the WASM is loaded
//         ifcAPI.SetWasmLoadedCallback(() => {
//             // Get all IFC elements
//             const allElements = ifcAPI.GetAllElements();

//             // Extract GUIDs
//             const guids: string[] = [];
//             allElements.forEach(element => {
//                 if (element.guid) {
//                     guids.push(element.guid);
//                 }
//             });

//             resolve(guids);
//         });
//     }


// //        const ifcParser = new THREE.
// // ifcParser.load('example.ifc', (ifcData) => {
// //     // Convert IFC data to THREE.js objects
// //     const threeObjects = convertIFCDataToThreeObjects(ifcData);
// }

    

//     private generateObjects(data: any): void {
        
//         data.forEach((elementData: any) => {
            
//             // Create all of objects separately to edit in the future
//             if (elementData.type === 'wall') {
//                 // const wall = new Wall();
               
//             } else if (elementData.type === 'slab') {
//                 // const slab = new Slab();
                
//             }

//         });
//     }
// }






let scene, camera, renderer, controls;
let mesh, geometry, material;
let imgElement = new Image();
let canvas2D = document.createElement('canvas');
let ctx2D = canvas2D.getContext('2d');

// Inicializar Escena 3D
function init() {
    const container = document.getElementById('canvas-container');
    
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, -60, 110);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Controles de cámara con OrbitControls
    if (typeof THREE.OrbitControls !== 'undefined') {
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
    }

    // Iluminación
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(50, 100, 100);
    scene.add(dirLight);

    const dirLight2 = new THREE.DirectionalLight(0x818cf8, 0.5);
    dirLight2.position.set(-50, -50, -50);
    scene.add(dirLight2);

    // Crear demo inicial
    createDefaultImage();

    window.addEventListener('resize', onWindowResize);
    setupUI();
    animate();
}

// Crear una imagen por defecto para iniciar la vista previa
function createDefaultImage() {
    canvas2D.width = 128;
    canvas2D.height = 128;
    
    const grad = ctx2D.createLinearGradient(0, 0, 128, 128);
    grad.addColorStop(0, '#6366f1');
    grad.addColorStop(1, '#ec4899');
    ctx2D.fillStyle = grad;
    ctx2D.fillRect(0, 0, 128, 128);
    
    ctx2D.fillStyle = '#ffffff';
    ctx2D.beginPath();
    ctx2D.arc(64, 64, 35, 0, Math.PI * 2);
    ctx2D.fill();

    const dataUrl = canvas2D.toDataURL();
    imgElement.src = dataUrl;
    
    const preview = document.getElementById('imagePreview');
    preview.src = dataUrl;
    preview.classList.remove('hidden');

    imgElement.onload = () => generateMesh();
}

// Generar la Malla 3D en base a los píxeles de la imagen
function generateMesh() {
    if (!imgElement.complete || !imgElement.width) return;

    if (mesh) {
        scene.remove(mesh);
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
            if (mesh.material.map) mesh.material.map.dispose();
            mesh.material.dispose();
        }
    }

    const segments = parseInt(document.getElementById('polyGrid').value);
    const depth = parseFloat(document.getElementById('depthRange').value);
    const isInverted = document.getElementById('invertToggle').checked;
    const isFlat = document.getElementById('flatShadingToggle').checked;
    const isWireframe = document.getElementById('wireframeToggle').checked;

    // Mapear imagen en un canvas 2D auxiliar para muestrear brillo
    canvas2D.width = segments + 1;
    canvas2D.height = segments + 1;
    ctx2D.drawImage(imgElement, 0, 0, segments + 1, segments + 1);
    const imgData = ctx2D.getImageData(0, 0, segments + 1, segments + 1).data;

    // Mantener proporción de aspecto original
    const aspect = imgElement.width / imgElement.height;
    const width = 70 * (aspect >= 1 ? 1 : aspect);
    const height = 70 * (aspect <= 1 ? 1 : 1 / aspect);

    geometry = new THREE.PlaneGeometry(width, height, segments, segments);
    
    // Alterar coordenadas Z según la luminosidad de la imagen
    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const r = imgData[i * 4];
        const g = imgData[i * 4 + 1];
        const b = imgData[i * 4 + 2];
        
        // Calcular brillo escala 0.0 - 1.0
        let brightness = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
        if (isInverted) brightness = 1 - brightness;

        pos.setZ(i, brightness * depth);
    }

    geometry.computeVertexNormals();

    // Textura mapeada
    const textureMap = new THREE.CanvasTexture(imgElement);
    
    material = new THREE.MeshStandardMaterial({
        map: textureMap,
        wireframe: isWireframe,
        flatShading: isFlat,
        roughness: 0.5,
        metalness: 0.1,
        side: THREE.DoubleSide
    });

    mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
}

// Exportador OBJ embebido sin depender de librerías de terceros
function exportToOBJ(targetMesh) {
    if (!targetMesh || !targetMesh.geometry) return '';

    const geom = targetMesh.geometry;
    const pos = geom.attributes.position;
    const uv = geom.attributes.uv;
    const normal = geom.attributes.normal;
    const index = geom.index;

    let output = '# Modelo 3D Low Poly generado\n';

    // Vértices (v)
    for (let i = 0; i < pos.count; i++) {
        output += `v ${pos.getX(i).toFixed(4)} ${pos.getY(i).toFixed(4)} ${pos.getZ(i).toFixed(4)}\n`;
    }

    // Coordenadas UV (vt)
    if (uv) {
        for (let i = 0; i < uv.count; i++) {
            output += `vt ${uv.getX(i).toFixed(4)} ${uv.getY(i).toFixed(4)}\n`;
        }
    }

    // Normales (vn)
    if (normal) {
        for (let i = 0; i < normal.count; i++) {
            output += `vn ${normal.getX(i).toFixed(4)} ${normal.getY(i).toFixed(4)} ${normal.getZ(i).toFixed(4)}\n`;
        }
    }

    // Caras (f)
    if (index) {
        for (let i = 0; i < index.count; i += 3) {
            const a = index.getX(i) + 1;
            const b = index.getX(i + 1) + 1;
            const c = index.getX(i + 2) + 1;
            output += `f ${a}/${a}/${a} ${b}/${b}/${b} ${c}/${c}/${c}\n`;
        }
    } else {
        for (let i = 0; i < pos.count; i += 3) {
            const a = i + 1;
            const b = i + 2;
            const c = i + 3;
            output += `f ${a}/${a}/${a} ${b}/${b}/${b} ${c}/${c}/${c}\n`;
        }
    }

    return output;
}

// Descargar archivo .OBJ
function downloadOBJ() {
    if (!mesh) return;

    const objData = exportToOBJ(mesh);
    const blob = new Blob([objData], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'low_poly_mesh.obj';
    link.click();
    URL.revokeObjectURL(link.href);
}

// Configuración de Eventos UI
function setupUI() {
    document.getElementById('imageInput').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                imgElement = new Image();
                imgElement.onload = () => {
                    const preview = document.getElementById('imagePreview');
                    preview.src = event.target.result;
                    preview.classList.remove('hidden');
                    generateMesh();
                };
                imgElement.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    document.getElementById('polyGrid').addEventListener('input', (e) => {
        document.getElementById('polyVal').innerText = `${e.target.value} x ${e.target.value}`;
        generateMesh();
    });

    document.getElementById('depthRange').addEventListener('input', (e) => {
        document.getElementById('depthVal').innerText = e.target.value;
        generateMesh();
    });

    document.getElementById('invertToggle').addEventListener('change', generateMesh);
    document.getElementById('wireframeToggle').addEventListener('change', generateMesh);
    document.getElementById('flatShadingToggle').addEventListener('change', generateMesh);

    document.getElementById('exportBtn').addEventListener('click', downloadOBJ);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    if (controls) controls.update();
    renderer.render(scene, camera);
}

window.onload = init;
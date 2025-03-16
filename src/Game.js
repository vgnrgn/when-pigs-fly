import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import * as CANNON from 'cannon-es';
import { Player } from './components/Player';
import { EnemyPlane } from './components/EnemyPlane';
import { Bird } from './components/Bird';

export class Game {
    constructor() {
        // Create the scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB);
        
        // Setup camera with increased far clipping plane
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 20000); // Increased from 10000 to 20000
        this.camera.position.set(0, 5, -10);
        this.camera.lookAt(0, 0, 0);
        
        // Set up renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        document.getElementById('game-container').appendChild(this.renderer.domElement);
        
        // Create HUD references
        // this.healthElement = document.getElementById('health');
        // this.fuelElement = document.getElementById('fuel');
        // this.scoreElement = document.getElementById('score');
        
        // Timing
        this.clock = new THREE.Clock();
        this.debugMode = true;
        
        // Camera parameters
        this.cameraHeight = 5;
        this.cameraDistance = 12;
        this.cameraSmoothness = 0.2;
        
        // Physics world
        this.world = new CANNON.World();
        this.world.gravity.set(0, -9.82, 0);
        this.world.broadphase = new CANNON.NaiveBroadphase();
        this.world.solver.iterations = 10;
        
        // Game objects
        this.enemies = [];
        this.enemyCount = 40; // Increased from 15 to 40 enemy planes
        this.maxEnemies = 40; // Increased from 15 to 40 enemy planes
        this.birds = [];
        this.maxBirds = 20; // Reduced from 30 to 20
        this.trees = [];
        this.mountains = [];
        this.lakes = [];
        this.effectsToUpdate = [];
        this.maxEffects = 30; // Reduced from 50 to 30 for better performance
        
        // Radar system
        this.radarActive = true;
        this.radarSize = 250; // Increased from 200 to match the new CSS size
        this.radarRange = this.worldRadius; // Radar range matches world radius
        this.radarElement = null;
        this.radarContext = null;
        this.radarBlips = [];
        this.radarUpdateInterval = 0.1; // Update radar every 0.1 seconds
        this.radarTimer = 0;
        
        // Runway dimensions - need to be defined before init
        this.runwayWidth = 20;
        this.runwayLength = 100;
        
        // World boundary settings - increased by another 50% (now 338% of original)
        this.worldRadius = 845; // Increased from 563 by another 50%
        this.worldWrapping = false; // Disable world wrapping in favor of natural boundaries
        this.boundaryWarningRadius = 675; // Increased from 450 by another 50%
        this.boundaryPushRadius = 760; // Increased from 507 by another 50%
        this.boundaryFogRadius = 593; // Increased from 395 by another 50%
        this.boundaryWarningActive = false;
        this.boundaryWarningElement = null;
        this.boundaryWarningSound = null;
        this.boundaryWindSound = null;
        this.useFog = false; // Disable fog
        
        // Game state
        // this.score = 0;
        this.rescuedBirds = 0;
        this.gameOver = false;
        this.paused = false;
        
        // Track key states
        this.keysPressed = {};
        
        // Bind methods
        this.onWindowResize = this.onWindowResize.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);
        
        // Add event listeners
        window.addEventListener('resize', this.onWindowResize, false);
        window.addEventListener('keydown', this.handleKeyDown, false);
        window.addEventListener('keyup', this.handleKeyUp, false);
        
        // Initialize
        this.init();
    }

    async init() {
        try {
            console.log("Starting initialization...");
            
            // Ensure radar container is visible
            const radarContainer = document.getElementById('radar-container');
            if (radarContainer) {
                console.log("Found radar container, ensuring it's visible");
                radarContainer.style.display = 'block';
                radarContainer.style.visibility = 'visible';
                radarContainer.style.opacity = '1';
                radarContainer.style.zIndex = '1000';
            } else {
                console.error("Radar container not found in DOM");
            }
            
            // Check for existing intro screen
            const existingIntroScreen = document.getElementById('intro-screen');
            if (existingIntroScreen) {
                console.log("Found existing intro screen, will use it instead of creating a new one");
                this.useExistingIntroScreen = true;
                
                // Add event listener to the start button
                const startButton = document.getElementById('start-button');
                if (startButton) {
                    startButton.addEventListener('click', () => {
                        // Hide intro screen
                        existingIntroScreen.style.display = 'none';
                        this.gameStarted = true;
                        
                        // Ensure radar is visible
                        if (radarContainer) {
                            radarContainer.style.display = 'block';
                            radarContainer.style.visibility = 'visible';
                            radarContainer.style.opacity = '1';
                            
                            // Force redraw of radar
                            this.initRadar();
                        }
                        
                        // Ensure controls are active
                        window.focus();
                    });
                }
            }
            
            // Set up basic environment
            this.setupEnvironment();
            console.log("Environment setup complete");
            
            // Create game elements
            this.createRunway();
            console.log("Runway created");
            
            // Create player first so we can position camera relative to it
            console.log("Creating player...");
            this.player = new Player(this);
            
            // Position player at beginning of runway
            this.player.position.set(0, 3, this.runwayLength / 2 - 10);
            this.player.rotation.y = Math.PI;
            
            if (this.player.mesh) {
                this.player.mesh.position.copy(this.player.position);
                this.player.mesh.rotation.copy(this.player.rotation);
                console.log("Player created and positioned");
            } else {
                console.error("Player mesh not created properly");
            }
            
            // Add environmental elements
            this.createMountains();
            console.log("Mountains created");
            
            this.createTrees();
            console.log("Trees created");
            
            this.createLakes();
            console.log("Lakes created");
            
            // Initialize physics
            this.initPhysics();
            console.log("Physics initialized");
            
            // Create enemies
            this.createEnemies();
            console.log("Enemies created");
            
            // Initialize radar system
            this.initRadar();
            console.log("Radar initialized");
            
            // Set up window resize handler
            window.addEventListener('resize', this.onWindowResize.bind(this));
            
            // Position camera behind player
            this.updateCamera(0);
            
            // Start animation loop
            console.log("Starting animation loop");
            this.animate();
            
            // Show intro screen
            this.showIntroScreen();
            
            console.log("Initialization complete");
        } catch (error) {
            console.error("Error during initialization:", error);
            alert(`Game initialization error: ${error.message}. Please check console and refresh.`);
        }
    }

    setupEnvironment() {
        console.log("Setting up environment...");
        
        // Set a brighter blue sky color as requested
        this.scene.background = new THREE.Color(0x4a9cff); // Bright blue sky
        
        // Create a simple circular ground that exactly matches the boundary
        this.createCircularGround();
        
        // Create world boundary indicator
        this.createWorldBoundaryIndicator();
        
        // Create clouds in the sky
        this.createClouds();
        
        // Create boundary warning element
        this.createBoundaryWarningElement();
        
        // Load boundary sounds
        this.loadBoundarySounds();
        
        // More realistic lighting system
        // Ambient light for general illumination
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // Increased from 0.5 to 0.6
        this.scene.add(ambientLight);
        
        // Directional light for shadows and highlights
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8); // Increased from 0.7 to 0.8
        directionalLight.position.set(100, 300, 200);
        directionalLight.castShadow = true;
        
        // Improved shadow settings
        directionalLight.shadow.mapSize.width = 1024;
        directionalLight.shadow.mapSize.height = 1024;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 500;
        
        // Increase shadow camera size to cover more area
        const shadowSize = 300;
        directionalLight.shadow.camera.left = -shadowSize;
        directionalLight.shadow.camera.right = shadowSize;
        directionalLight.shadow.camera.top = shadowSize;
        directionalLight.shadow.camera.bottom = -shadowSize;
        
        this.scene.add(directionalLight);
        
        // No fog as requested
    }

    createCircularGround() {
        // Create a circular ground that exactly matches the world boundary
        const segments = 64; // High enough for a smooth circle
        const groundGeometry = new THREE.CircleGeometry(this.worldRadius, segments);
        
        // Simple bright green material with no special effects
        const groundMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x4caf50,  // Bright green
            roughness: 0.8,
            metalness: 0.1,
            side: THREE.DoubleSide,
            flatShading: false,
            depthWrite: true
        });
        
        // Create the ground mesh
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2; // Rotate to be horizontal
        ground.position.y = 0; // At exact y=0 level
        ground.receiveShadow = true;
        
        // Add to scene
        this.scene.add(ground);
        
        // Store ground for reference
        this.ground = ground;
    }

    createClouds() {
        // Create a set of clouds at different positions in the sky
        this.clouds = [];
        const cloudCount = 30; // Number of clouds to create
        
        // Create cloud material - white with transparency
        const cloudMaterial = new THREE.MeshPhongMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.8,
            flatShading: true
        });
        
        for (let i = 0; i < cloudCount; i++) {
            // Create a cloud group
            const cloud = new THREE.Group();
            
            // Random cloud size and position
            const cloudSize = 20 + Math.random() * 30;
            const cloudHeight = 100 + Math.random() * 150;
            
            // Random position within a large area
            const angle = Math.random() * Math.PI * 2;
            const distance = 200 + Math.random() * 800;
            const x = Math.sin(angle) * distance;
            const z = Math.cos(angle) * distance;
            
            // Create 3-7 cloud puffs
            const puffCount = 3 + Math.floor(Math.random() * 5);
            
            for (let j = 0; j < puffCount; j++) {
                // Create a cloud puff (sphere)
                const puffSize = (0.5 + Math.random() * 0.5) * cloudSize;
                const puffGeometry = new THREE.SphereGeometry(puffSize, 7, 7);
                const puff = new THREE.Mesh(puffGeometry, cloudMaterial);
                
                // Position puffs relative to cloud center
                const puffX = (Math.random() - 0.5) * cloudSize;
                const puffY = (Math.random() - 0.5) * cloudSize * 0.3;
                const puffZ = (Math.random() - 0.5) * cloudSize;
                puff.position.set(puffX, puffY, puffZ);
                
                // Add puff to cloud
                cloud.add(puff);
            }
            
            // Position the cloud
            cloud.position.set(x, cloudHeight, z);
            
            // Add cloud to scene
            this.scene.add(cloud);
            
            // Store cloud for animation
            this.clouds.push({
                mesh: cloud,
                speed: 2 + Math.random() * 3, // Random speed
                direction: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.5,
                    0,
                    (Math.random() - 0.5) * 0.5
                ).normalize()
            });
        }
    }

    createRunway() {
        // Create a runway in the center of the scene
        const runwayGeometry = new THREE.PlaneGeometry(this.runwayWidth, this.runwayLength);
        const runwayMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x222222,  // Darker asphalt color
            side: THREE.DoubleSide,
            shininess: 10     // Slight shine for asphalt
        });
        
        this.runway = new THREE.Mesh(runwayGeometry, runwayMaterial);
        this.runway.rotation.x = -Math.PI / 2;
        this.runway.position.y = 0.1;  // Slightly above ground to prevent z-fighting
        this.runway.receiveShadow = true;
        this.scene.add(this.runway);
        
        // Add runway markings
        this.addRunwayMarkings();
        
        // Store runway bounds for object placement logic
        this.runwayBounds = {
            minX: -this.runwayWidth/2 - 10, // Add 10-unit buffer
            maxX: this.runwayWidth/2 + 10,
            minZ: -this.runwayLength/2 - 10,
            maxZ: this.runwayLength/2 + 10
        };
    }

    addRunwayMarkings() {
        // Add white stripes along the runway
        const stripeWidth = 1;
        const stripeLength = 10;
        const stripeMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xf0f0f0,  // Slightly off-white for more realism
            transparent: true,
            opacity: 0.9      // Slight transparency for worn look
        });
        
        // Center line
        const centerLineGeometry = new THREE.PlaneGeometry(stripeWidth, this.runwayLength * 0.8);
        const centerLine = new THREE.Mesh(centerLineGeometry, stripeMaterial);
        centerLine.rotation.x = -Math.PI / 2;
        centerLine.position.y = 0.2; // Increased from 0.05 to eliminate z-fighting
        this.scene.add(centerLine);
        
        // Starting line 
        const startLineGeometry = new THREE.PlaneGeometry(this.runwayWidth, stripeWidth);
        const startLine = new THREE.Mesh(startLineGeometry, stripeMaterial);
        startLine.rotation.x = -Math.PI / 2;
        startLine.position.z = this.runwayLength/2 - 5; // Near the end
        startLine.position.y = 0.2; // Increased from 0.05
        this.scene.add(startLine);
        
        // End line
        const endLine = startLine.clone();
        endLine.position.z = -this.runwayLength/2 + 5; // Near the beginning
        this.scene.add(endLine);
    }

    isNearRunway(x, z, buffer) {
        // Check if a point is near the runway (including buffer zone)
        const halfWidth = this.runwayWidth / 2 + buffer;
        const halfLength = this.runwayLength / 2 + buffer;
        
        // Check main runway
        if (Math.abs(x) < halfWidth && Math.abs(z) < halfLength) {
            return true;
        }
        
        // Check apron area
        if (Math.abs(x) < this.runwayWidth + buffer && 
            z < -this.runwayLength / 2 + buffer && 
            z > -this.runwayLength / 2 - 50 - buffer) {
            return true;
        }
        
        return false;
    }

    createMountains() {
        // Create distant mountains for scenery
        const mountainCount = 18; // Increased for larger arena
        this.mountains = [];
        
        for (let i = 0; i < mountainCount; i++) {
            // Keep trying until we find a valid position
            let x, z, radius, height;
            let positionValid = false;
            let attempts = 0;
            
            while (!positionValid && attempts < 50) {
                // Generate a position far from the runway but within world bounds
                radius = 60 + Math.random() * 50; // Much larger mountains
                height = 150 + Math.random() * 150; // Much taller mountains
                const angle = Math.random() * Math.PI * 2;
                const distance = 180 + Math.random() * 450; // Increased distance range for larger boundary
                
                x = Math.sin(angle) * distance;
                z = Math.cos(angle) * distance;
                
                // Check if position is clear of other mountains
                positionValid = this.isPositionClear(x, z, radius, this.mountains);
                attempts++;
            }
            
            if (!positionValid) continue; // Skip if we couldn't find a valid position
            
            // Create mountain with more realistic features - adjusted height
            const mountain = this.createMountain(radius, height);
            
            // Position the mountain with its base at ground level
            // For a cone, the origin is at the center of the base, so we need to move it up by half its height
            mountain.position.set(x, height/2, z); // Fix: Position y at half height so base is at ground level
            this.scene.add(mountain);
            
            // Store for collision detection
            this.mountains.push({
                position: new THREE.Vector3(x, 0, z), // Keep collision at ground level
                radius: radius
            });
        }
    }
    
    createTrees() {
        // Create trees scattered around the terrain
        const treeCount = 135; // Increased for larger area
        this.trees = [];
        
        for (let i = 0; i < treeCount; i++) {
            // Keep trying until we find a valid position
            let x, z;
            let positionValid = false;
            let attempts = 0;
            
            while (!positionValid && attempts < 50) {
                // Generate a position within the world boundary
                const angle = Math.random() * Math.PI * 2;
                const distance = 90 + Math.random() * (this.worldRadius - 180); // Keep away from center and boundary
                
                x = Math.sin(angle) * distance;
                z = Math.cos(angle) * distance;
                
                // Check if position is clear of runway, mountains and other trees
                positionValid = this.isPositionClear(x, z, 10, [...this.mountains, ...this.trees]);
                attempts++;
            }
            
            if (!positionValid) continue; // Skip if we couldn't find a valid position
            
            // Create a random tree
            const treeType = Math.floor(Math.random() * 3);
            let tree;
            
            switch (treeType) {
                case 0:
                    tree = this.createPineTree();
                    break;
                case 1:
                    tree = this.createOakTree();
                    break;
                default:
                    tree = this.createBushTree();
                    break;
            }
            
            tree.position.set(x, 0, z);
            this.scene.add(tree);
            
            // Store for collision detection
            this.trees.push({
                position: tree.position,
                radius: 10 // Approximate tree radius
            });
        }
    }
    
    createLakes() {
        // Create small lakes scattered around the terrain
        const lakeCount = 18; // Increased for larger area
        this.lakes = [];
        
        for (let i = 0; i < lakeCount; i++) {
            // Keep trying until we find a valid position
            let x, z, radius;
            let positionValid = false;
            let attempts = 0;
            
            while (!positionValid && attempts < 50) {
                // Generate a position within the world boundary
                radius = 30 + Math.random() * 40; // Larger lakes for expanded arena
                const angle = Math.random() * Math.PI * 2;
                const distance = 135 + Math.random() * (this.worldRadius - 270); // Keep away from center and boundary
                
                x = Math.sin(angle) * distance;
                z = Math.cos(angle) * distance;
                
                // Check if position is clear of runway, mountains, trees and other lakes
                positionValid = this.isPositionClear(x, z, radius, [...this.mountains, ...this.trees, ...this.lakes]);
                attempts++;
            }
            
            if (!positionValid) continue; // Skip if we couldn't find a valid position
            
            // Create lake with simplified geometry
            const segments = 32; // Increased for smoother lakes
            const lakeGeometry = new THREE.CircleGeometry(radius, segments);
            const lakeMaterial = new THREE.MeshPhongMaterial({
                color: 0x0077be,
                shininess: 100,
                specular: 0x111111
            });
            
            const lake = new THREE.Mesh(lakeGeometry, lakeMaterial);
            lake.rotation.x = -Math.PI / 2;
            lake.position.set(x, 0.1, z); // Slightly above ground
            this.scene.add(lake);
            
            // Store for collision detection
            this.lakes.push({
                position: lake.position,
                radius: radius
            });
        }
    }

    initPhysics() {
        // Initialize physics world
        this.physicsWorld = new CANNON.World({
            gravity: new CANNON.Vec3(0, -9.82, 0)
        });
        
        // Add ground plane physics
        const groundShape = new CANNON.Plane();
        const groundBody = new CANNON.Body({
            mass: 0, // Static body
            shape: groundShape
        });
        groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
        this.physicsWorld.addBody(groundBody);
    }

    onWindowResize() {
        // Update camera
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        
        // Update renderer
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    updateCamera(delta) {
        if (!this.player || !this.player.position) {
            console.warn("Player not available for camera update");
            return;
        }
        
        // Calculate desired camera position based on player's position and horizontal rotation only
        // Create a direction vector that ignores pitch (x-rotation)
        const playerDirection = new THREE.Vector3(0, 0, 1);
        
        // Only apply the Y-rotation (yaw) but ignore X-rotation (pitch)
        const horizontalRotation = new THREE.Euler(0, this.player.rotation.y, 0);
        playerDirection.applyEuler(horizontalRotation);
        playerDirection.normalize();
        
        // Position camera behind player
        const cameraOffset = playerDirection.clone().multiplyScalar(-this.cameraDistance);
        const targetCameraPosition = this.player.position.clone().add(cameraOffset);
        targetCameraPosition.y += this.cameraHeight;
        
        // Smoothly interpolate camera position
        this.camera.position.lerp(targetCameraPosition, this.cameraSmoothness);
        
        // Make camera look at player with slight height offset
        const lookAtPosition = this.player.position.clone();
        lookAtPosition.y += 2; // Look slightly above player
        this.camera.lookAt(lookAtPosition);
    }

    update(delta) {
        // Always update effects, even if game is over
        this.updateEffects(delta);
        
        // Don't update game state if paused or game over
        if (this.paused || this.gameOver) return;
        
        // Check for victory condition - 100 animals rescued
        if (this.rescuedBirds >= 100) {
            console.log("Victory - 100 animals rescued!");
            this.gameOver = true;
            this.showVictoryScreen("Congratulations! You've rescued 100 animals!");
            return;
        }
        
        // Update player
        if (this.player) {
            this.player.update(delta);
            
            // Update camera to follow player
            this.updateCamera(delta);
            
            // Check if player is out of bounds
            this.checkWorldBounds(this.player);
            
            // Check for collisions with terrain
            this.checkTerrainCollisions();
            
            // Update player HUD - removing health and fuel updates
            // this.healthElement.textContent = `Health: ${Math.round(this.player.health)}%`;
            // this.fuelElement.textContent = `Fuel: ${Math.round(this.player.fuel)}%`;
            
            // Check for game over conditions - removing health check
            if (this.player.position.y < -50) {
                console.log("Game over - player destroyed");
                this.gameOver = true;
                this.createExplosion(this.player.position.x, this.player.position.y, this.player.position.z, 2);
                this.showGameOverScreen("Your plane was destroyed!");
                return;
            }
        }
        
        // Update physics world
        this.world.step(delta);
        
        // Update enemies
        this.updateEnemies(delta);
        
        // Update birds
        this.updateBirds(delta);
        
        // Update clouds
        this.updateClouds(delta);
        
        // Update boundary effects
        this.updateBoundaryEffects(delta);
        
        // Update radar
        this.updateRadar(delta);
    }

    updateClouds(delta) {
        // Skip if no clouds
        if (!this.clouds || this.clouds.length === 0) return;
        
        // Update each cloud position
        for (let i = 0; i < this.clouds.length; i++) {
            const cloud = this.clouds[i];
            
            // Move cloud in its direction
            const movement = cloud.direction.clone().multiplyScalar(cloud.speed * delta);
            cloud.mesh.position.add(movement);
            
            // Check if cloud is too far away (1500 units from center)
            const distanceSquared = 
                cloud.mesh.position.x * cloud.mesh.position.x + 
                cloud.mesh.position.z * cloud.mesh.position.z;
                
            if (distanceSquared > 1500 * 1500) {
                // Reset cloud position to the opposite side
                const angle = Math.atan2(cloud.mesh.position.x, cloud.mesh.position.z);
                const newDistance = 1000;
                cloud.mesh.position.x = -Math.sin(angle) * newDistance;
                cloud.mesh.position.z = -Math.cos(angle) * newDistance;
            }
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        try {
            // Calculate delta time
            const delta = Math.min(this.clock.getDelta(), 0.1);
            
            // If game is over, only update effects and render the scene
            if (this.gameOver) {
                // Still update effects for explosions
                this.updateEffects(delta);
                
                // Still render the scene
                this.renderer.render(this.scene, this.camera);
                return;
            }
            
            // Update game state
            this.update(delta);
            
            // Render scene
            this.renderer.render(this.scene, this.camera);
        } catch (error) {
            console.error("Error in animation loop:", error);
        }
    }

    updateEnemies(delta) {
        // Process enemies with optimized code
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            
            // Skip if enemy is invalid
            if (!enemy || !enemy.position) continue;
            
            // Update enemy
            enemy.update(delta);
            
            // Check if enemy is near world boundary and enforce containment
            this.checkWorldBounds(enemy);
            
            // Ensure enemy mesh position matches physics position
            if (enemy.mesh) {
                enemy.mesh.position.copy(enemy.position);
                
                // Update rotation to match direction
                if (enemy.velocity && enemy.velocity.length() > 0.1) {
                    const direction = enemy.velocity.clone().normalize();
                    enemy.mesh.lookAt(
                        enemy.position.x + direction.x,
                        enemy.position.y + direction.y,
                        enemy.position.z + direction.z
                    );
                }
            }
            
            // Check if enemy is destroyed
            if (enemy.health <= 0) {
                this.handleEnemyDestruction(enemy, i);
                continue;
            }
            
            // Check if player bullets hit this enemy
            this.checkBulletHits(enemy, i);
        }
        
        // Ensure we have exactly the right number of enemies
        // This is a safety check in case some enemies were lost due to errors
        while (this.enemies.length < this.maxEnemies) {
            this.createNewEnemy();
        }
    }

    handleEnemyDestruction(enemy, index) {
        try {
            // Create explosion
            this.createExplosion(enemy.position);
            
            // Play explosion sound
            this.playExplosionSound(enemy.position);
            
            // Release birds - maximum 4 birds per enemy plane
            const birdCount = Math.min(4, Math.floor(Math.random() * 3) + 2); // Random number between 2-4
            
            // Check if we're below the bird limit before adding more
            const availableBirdSlots = Math.max(0, this.maxBirds - this.birds.length);
            const birdsToRelease = Math.min(birdCount, availableBirdSlots);
            
            if (birdsToRelease > 0) {
                this.releaseBirds(enemy.position, birdsToRelease);
            }
            
            // Remove enemy from scene and array
            this.scene.remove(enemy.mesh);
            this.enemies.splice(index, 1);
            
            // Create a new enemy to replace the destroyed one
            this.createNewEnemy();
        } catch (error) {
            console.error("Error in handleEnemyDestruction:", error);
        }
    }

    checkBulletHits(enemy, enemyIndex) {
        // Optimized player bullet hit detection
        if (!this.player || !this.player.bullets || this.player.bullets.length === 0) return;
        
        const enemyPosition = enemy.position;
        const enemyRadius = 8; // Increased from 4 to 8 to make enemies easier to hit
        
        // Use squared distance for performance (avoid square root)
        const enemyRadiusSq = enemyRadius * enemyRadius;
        
        // Check each bullet
        for (let j = this.player.bullets.length - 1; j >= 0; j--) {
            const bullet = this.player.bullets[j];
            
            // Skip invalid bullets
            if (!bullet || !bullet.mesh || !bullet.mesh.position) continue;
            
            // Calculate squared distance (faster than distanceTo)
            const dx = bullet.mesh.position.x - enemyPosition.x;
            const dy = bullet.mesh.position.y - enemyPosition.y;
            const dz = bullet.mesh.position.z - enemyPosition.z;
            const distanceSq = dx*dx + dy*dy + dz*dz;
            
            // Check if bullet hit enemy
            if (distanceSq < enemyRadiusSq) {
                // Hit detected
                this.createHitIndicator(bullet.mesh.position);
                
                // Damage enemy
                enemy.damage(25);
                
                // Remove bullet
                this.scene.remove(bullet.mesh);
                this.player.bullets.splice(j, 1);
                
                // If enemy was destroyed, handle it
                if (enemy.health <= 0) {
                    this.handleEnemyDestruction(enemy, enemyIndex);
                    break;
                }
            }
        }
    }

    updateBirds(delta) {
        try {
            // Skip if no birds
            if (!this.birds || this.birds.length === 0) return;
            
            // Update birds with performance optimizations
            for (let i = this.birds.length - 1; i >= 0; i--) {
                try {
                    const bird = this.birds[i];
                    
                    // Skip invalid birds
                    if (!bird) {
                        this.birds.splice(i, 1);
                        continue;
                    }
                    
                    // Update bird
                    bird.update(delta);
                    
                    // Check if bird has crossed world boundary
                    this.checkWorldBounds(bird);
                    
                    // Remove birds that are too old - lowered from 20 to 15 seconds for better performance
                    if (bird.age > 15) {
                        if (bird.mesh) {
                            this.scene.remove(bird.mesh);
                            
                            // Clean up resources
                            if (bird.cleanup && typeof bird.cleanup === 'function') {
                                bird.cleanup();
                            }
                            
                            // Dispose of geometries and materials
                            if (bird.mesh.children && bird.mesh.children.length > 0) {
                                bird.mesh.children.forEach(child => {
                                    if (child.geometry) child.geometry.dispose();
                                    if (child.material) {
                                        if (Array.isArray(child.material)) {
                                            child.material.forEach(m => m.dispose());
                                        } else {
                                            child.material.dispose();
                                        }
                                    }
                                });
                            }
                        }
                        this.birds.splice(i, 1);
                    }
                    
                    // Check if bird is far away from the playfield
                    else if (bird.position.distanceTo(this.player.position) > 500) {
                        // Too far away, remove it
                        if (bird.mesh) {
                            this.scene.remove(bird.mesh);
                        }
                        this.birds.splice(i, 1);
                    }
                } catch (birdError) {
                    console.error("Error updating individual bird:", birdError);
                    // Remove problematic bird
                    if (i >= 0 && i < this.birds.length) {
                        try {
                            if (this.birds[i] && this.birds[i].mesh) {
                                this.scene.remove(this.birds[i].mesh);
                            }
                            this.birds.splice(i, 1);
                        } catch (cleanupError) {
                            console.error("Error cleaning up bird:", cleanupError);
                        }
                    }
                }
            }
            
            // Limit maximum number of birds - implement a more aggressive limit
            const softLimit = Math.floor(this.maxBirds * 0.8); // Remove birds at 80% of max to prevent reaching limit
            if (this.birds.length > softLimit) {
                // Remove oldest birds
                const birdsToRemove = this.birds.length - softLimit;
                for (let i = 0; i < birdsToRemove && i < this.birds.length; i++) {
                    try {
                        if (this.birds[i] && this.birds[i].mesh) {
                            this.scene.remove(this.birds[i].mesh);
                        }
                    } catch (error) {
                        console.error("Error removing excess bird:", error);
                    }
                }
                this.birds.splice(0, birdsToRemove);
            }
        } catch (error) {
            console.error("Error in updateBirds:", error);
            // Last resort - if everything fails, just clear all birds
            if (this.birds && this.birds.length > 10) {
                try {
                    for (let i = 0; i < this.birds.length; i++) {
                        if (this.birds[i] && this.birds[i].mesh) {
                            this.scene.remove(this.birds[i].mesh);
                        }
                    }
                    this.birds = [];
                } catch (clearError) {
                    console.error("Error clearing all birds:", clearError);
                }
            }
        }
    }

    createEnemies() {
        // Create exactly 40 enemy planes for intense dogfighting
        const initialEnemyCount = this.maxEnemies; // Always create exactly 40 planes
        console.log(`Creating ${initialEnemyCount} initial enemy planes for dogfighting`);
        
        for (let i = 0; i < initialEnemyCount; i++) {
            this.createNewEnemy();
        }
    }

    createNewEnemy() {
        // Create a new enemy plane - always spawn near the runway
        let position;
        
        // Use polar coordinates for even distribution around the runway
        const angle = Math.random() * Math.PI * 2;
        const distance = 50 + Math.random() * 100; // 50-150 units from center (runway)
        
        const x = Math.sin(angle) * distance;
        const z = Math.cos(angle) * distance;
        const y = 30 + Math.random() * 70; // 30-100 units high
        
        position = new THREE.Vector3(x, y, z);
        
        // Ensure the position is within the world boundary
        const distanceFromCenter = Math.sqrt(x * x + z * z);
        if (distanceFromCenter > this.worldRadius * 0.9) {
            // If somehow outside boundary, move it inward
            const directionToCenter = new THREE.Vector3(-x, 0, -z).normalize();
            const safeDistance = this.worldRadius * 0.5; // 50% of world radius
            position.x = directionToCenter.x * safeDistance;
            position.z = directionToCenter.z * safeDistance;
        }
        
        // Create the enemy plane
        const enemy = new EnemyPlane(this, position);
        this.enemies.push(enemy);
    }

    createExplosion(x, y, z, scale = 1) {
        // Create explosion particles
        const particleCount = 50;
        const explosionGeometry = new THREE.SphereGeometry(0.5, 8, 8);
        const explosionMaterial = new THREE.MeshBasicMaterial({
            color: 0xff5500,
            transparent: true,
            opacity: 0.8
        });
        
        const explosion = new THREE.Group();
        explosion.position.set(x, y, z);
        
        // Create particles
        for (let i = 0; i < particleCount; i++) {
            const particle = new THREE.Mesh(explosionGeometry, explosionMaterial.clone());
            
            // Random position within explosion radius
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            const radius = Math.random() * 2 * scale;
            
            particle.position.x = radius * Math.sin(phi) * Math.cos(theta);
            particle.position.y = radius * Math.sin(phi) * Math.sin(theta);
            particle.position.z = radius * Math.cos(phi);
            
            // Random size
            const size = 0.3 + Math.random() * 0.7;
            particle.scale.set(size, size, size);
            
            // Random velocity
            particle.userData.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 10
            );
            
            // Random rotation
            particle.userData.rotationSpeed = new THREE.Vector3(
                Math.random() * 2 - 1,
                Math.random() * 2 - 1,
                Math.random() * 2 - 1
            );
            
            explosion.add(particle);
        }
        
        this.scene.add(explosion);
        
        // Store creation time and duration in the explosion object itself
        explosion.userData.createdAt = performance.now() / 1000;
        explosion.userData.duration = 2; // 2 seconds
        
        // Add to effects for animation
        const explosionEffect = {
            type: 'explosion',
            object: explosion,
            createdAt: performance.now() / 1000,
            duration: 2, // 2 seconds
            update: (delta) => {
                // Update each particle
                explosion.children.forEach(particle => {
                    // Move particle
                    particle.position.x += particle.userData.velocity.x * delta;
                    particle.position.y += particle.userData.velocity.y * delta;
                    particle.position.z += particle.userData.velocity.z * delta;
                    
                    // Slow down
                    particle.userData.velocity.multiplyScalar(0.95);
                    
                    // Rotate particle
                    particle.rotation.x += particle.userData.rotationSpeed.x * delta;
                    particle.rotation.y += particle.userData.rotationSpeed.y * delta;
                    particle.rotation.z += particle.userData.rotationSpeed.z * delta;
                    
                    // Fade out
                    if (particle.material.opacity > 0) {
                        particle.material.opacity -= delta * 0.5;
                    }
                });
                
                // Check if effect should be removed
                const now = performance.now() / 1000;
                const age = now - explosion.userData.createdAt;
                return age < explosion.userData.duration;
            }
        };
        
        // Make sure we're adding to the correct effects array
        if (!this.effectsToUpdate) {
            this.effectsToUpdate = [];
        }
        this.effectsToUpdate.push(explosionEffect);
        
        // Play explosion sound if available
        if (this.explosionSound) {
            this.explosionSound.currentTime = 0;
            this.explosionSound.play();
        }
    }
    
    releaseBirds(position, count) {
        try {
            // Make sure birds array exists
            if (!this.birds) {
                this.birds = [];
            }
            
            console.log(`Releasing ${count} birds at position:`, position);
            
            // Increment animals rescued counter
            this.rescuedBirds += count;
            
            // Update the animals rescued counter display
            this.updateRescueCounter();
            
            // Create birds with slight position variations
            for (let i = 0; i < count; i++) {
                try {
                    // Add small random offset to position so birds don't all spawn in exactly the same spot
                    const offset = new THREE.Vector3(
                        (Math.random() - 0.5) * 2,  // -1 to 1
                        (Math.random() - 0.5) * 2,  // -1 to 1
                        (Math.random() - 0.5) * 2   // -1 to 1
                    );
                    
                    const birdPosition = position.clone().add(offset);
                    const bird = new Bird(this, birdPosition);
                    this.birds.push(bird);
                } catch (birdError) {
                    console.error("Error creating individual bird:", birdError);
                    // Continue with other birds even if one fails
                }
            }
        } catch (error) {
            console.error("Error in releaseBirds:", error);
        }
    }
    
    updateRescueCounter() {
        // Update HUD with animals rescued count
        const rescueCounter = document.getElementById('rescue-counter');
        if (!rescueCounter) {
            const counterElement = document.createElement('div');
            counterElement.id = 'rescue-counter';
            counterElement.style.position = 'absolute';
            counterElement.style.top = '20px';
            counterElement.style.right = '20px';
            counterElement.style.color = 'white';
            counterElement.style.fontFamily = 'Arial, sans-serif';
            counterElement.style.fontSize = '24px';
            counterElement.style.fontWeight = 'bold';
            counterElement.style.textShadow = '2px 2px 4px rgba(0,0,0,0.7)';
            counterElement.style.backgroundColor = 'rgba(0,0,0,0.5)';
            counterElement.style.padding = '10px 15px';
            counterElement.style.borderRadius = '10px';
            counterElement.style.zIndex = '1000';
            document.body.appendChild(counterElement);
        }
        
        // Update the counter text with animation effect
        const counter = document.getElementById('rescue-counter');
        counter.textContent = `Animals Saved: ${this.rescuedBirds}`;
        
        // Add a brief highlight effect when the counter changes
        counter.style.backgroundColor = 'rgba(0,150,0,0.7)';
        counter.style.transform = 'scale(1.1)';
        counter.style.transition = 'all 0.2s ease-out';
        
        // Reset the highlight after a short delay
        setTimeout(() => {
            counter.style.backgroundColor = 'rgba(0,0,0,0.5)';
            counter.style.transform = 'scale(1.0)';
        }, 300);
    }

    // Add this function to create hit effects when bullets hit targets
    createHitIndicator(position) {
        try {
            // Create a sphere for the hit flash
            const material = new THREE.MeshBasicMaterial({
                color: 0xffff00,
                transparent: true,
                opacity: 1
            });
            
            const geometry = new THREE.SphereGeometry(1, 8, 8);
            const flash = new THREE.Mesh(geometry, material);
            flash.position.copy(position);
            this.scene.add(flash);
            
            // Simple animation for the flash
            const lifespan = 0.2;
            const startTime = performance.now() / 1000;
            
            const hitEffect = {
                flash: flash,
                startTime: startTime,
                update: (delta) => {
                    const now = performance.now() / 1000;
                    const age = now - startTime;
                    
                    if (age < lifespan) {
                        // Scale up while fading out
                        const scale = 1 + age * 5;
                        flash.scale.set(scale, scale, scale);
                        flash.material.opacity = 1 - (age / lifespan);
                        return true;
                    } else {
                        // Remove from scene when done
                        this.scene.remove(flash);
                        
                        // Clean up resources
                        if (flash.geometry) flash.geometry.dispose();
                        if (flash.material) flash.material.dispose();
                        
                        return false;
                    }
                }
            };
            
            // Add to effects to update
            this.effectsToUpdate.push(hitEffect);
        } catch (error) {
            console.error("Error creating hit indicator:", error);
        }
    }

    showIntroScreen() {
        // Skip if we're using the existing intro screen
        if (this.useExistingIntroScreen) {
            console.log("Using existing intro screen, skipping creation of new one");
            return;
        }
        
        // Create intro overlay
        const introOverlay = document.createElement('div');
        introOverlay.id = 'intro-overlay';
        introOverlay.style.position = 'absolute';
        introOverlay.style.top = '0';
        introOverlay.style.left = '0';
        introOverlay.style.width = '100%';
        introOverlay.style.height = '100%';
        introOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        introOverlay.style.display = 'flex';
        introOverlay.style.flexDirection = 'column';
        introOverlay.style.justifyContent = 'center';
        introOverlay.style.alignItems = 'center';
        introOverlay.style.color = 'white';
        introOverlay.style.fontFamily = 'Arial, sans-serif';
        introOverlay.style.zIndex = '1000';
        introOverlay.style.textAlign = 'center';
        introOverlay.style.padding = '20px';
        
        // Add title
        const title = document.createElement('h1');
        title.textContent = 'When Pigs Fly';
        title.style.fontSize = '3rem';
        title.style.marginBottom = '20px';
        title.style.color = '#ff9999'; // Pink color for the title
        introOverlay.appendChild(title);
        
        // Add mission text
        const missionText = document.createElement('p');
        missionText.innerHTML = 'In an act of inter-species solidarity, Captain Pig rescues birds who are being smuggled in autonomous planes.';
        missionText.style.fontSize = '1.5rem';
        missionText.style.marginBottom = '30px';
        missionText.style.maxWidth = '800px';
        missionText.style.lineHeight = '1.5';
        introOverlay.appendChild(missionText);
        
        // Add instructions with more detailed controls
        const instructions = document.createElement('div');
        instructions.style.fontSize = '1.2rem';
        instructions.style.marginBottom = '40px';
        instructions.style.maxWidth = '600px';
        instructions.style.textAlign = 'left';
        instructions.innerHTML = `
            <h2 style="text-align: center; margin-bottom: 15px;">Controls:</h2>
            <p><strong>W</strong>: Increase throttle - Hold to accelerate</p>
            <p><strong>S</strong>: Decrease throttle - Hold to slow down</p>
            <p><strong>←/→</strong>: Turn left/right</p>
            <p><strong>↑/↓</strong>: Pitch up/down</p>
            <p><strong>Space</strong>: Fire wing guns</p>
            <p><strong>Goal</strong>: Shoot down autonomous planes to rescue the birds inside!</p>
            <p><strong>Tip</strong>: Maintain altitude by balancing throttle and pitch</p>
        `;
        introOverlay.appendChild(instructions);
        
        // Add start button
        const startButton = document.createElement('button');
        startButton.textContent = 'START MISSION';
        startButton.style.padding = '15px 30px';
        startButton.style.fontSize = '1.5rem';
        startButton.style.backgroundColor = '#4CAF50';
        startButton.style.color = 'white';
        startButton.style.border = 'none';
        startButton.style.borderRadius = '5px';
        startButton.style.cursor = 'pointer';
        startButton.style.transition = 'background-color 0.3s';
        
        startButton.addEventListener('mouseover', () => {
            startButton.style.backgroundColor = '#45a049';
        });
        
        startButton.addEventListener('mouseout', () => {
            startButton.style.backgroundColor = '#4CAF50';
        });
        
        startButton.addEventListener('click', () => {
            // Remove intro overlay and start game
            document.body.removeChild(introOverlay);
            this.gameStarted = true;
            
            // Ensure radar is visible
            const radarContainer = document.getElementById('radar-container');
            if (radarContainer) {
                console.log("Making radar visible after intro screen dismissed");
                radarContainer.style.display = 'block';
                radarContainer.style.visibility = 'visible';
                radarContainer.style.opacity = '1';
                radarContainer.style.zIndex = '1000';
                
                // Force redraw of radar
                this.initRadar();
            } else {
                console.error("Radar container not found after intro screen dismissed");
            }
            
            // Ensure controls are active
            window.focus();
        });
        
        introOverlay.appendChild(startButton);
        
        // Add to document
        document.body.appendChild(introOverlay);
    }

    // Utility function to check if a new object overlaps with existing objects
    isPositionClear(x, z, radius, objectsToCheck) {
        // Check if position is inside or near runway
        if (
            x > this.runwayBounds.minX && x < this.runwayBounds.maxX &&
            z > this.runwayBounds.minZ && z < this.runwayBounds.maxZ
        ) {
            return false; // Too close to runway
        }
        
        // Check against each object in the array
        for (const obj of objectsToCheck) {
            const dx = x - obj.position.x;
            const dz = z - obj.position.z;
            const distanceSquared = dx*dx + dz*dz;
            const minDistanceSquared = (radius + obj.radius) * (radius + obj.radius);
            
            if (distanceSquared < minDistanceSquared) {
                return false; // Overlapping with an existing object
            }
        }
        
        return true; // Position is clear
    }

    createMountain(radius, height) {
        // Create a mountain using a simpler cone geometry
        const mountainGeometry = new THREE.ConeGeometry(radius, height, 16, 1); // Increased segments for smoother appearance
        const mountainMaterial = new THREE.MeshPhongMaterial({
            color: 0x7c7c7c,
            flatShading: true,
            shininess: 0
        });
        
        const mountain = new THREE.Mesh(mountainGeometry, mountainMaterial);
        
        // Add snow cap if the mountain is tall enough - enhanced for bigger mountains
        if (height > 100) {
            const snowCapGeometry = new THREE.ConeGeometry(radius * 0.5, height * 0.3, 16, 1); // Larger snow cap
            const snowCapMaterial = new THREE.MeshPhongMaterial({
                color: 0xffffff,
                shininess: 10
            });
            
            const snowCap = new THREE.Mesh(snowCapGeometry, snowCapMaterial);
            snowCap.position.y = height * 0.35; // Positioned higher
            mountain.add(snowCap);
        }
        
        return mountain;
    }

    createPineTree() {
        // Create a simplified pine tree
        const treeGroup = new THREE.Group();
        
        // Trunk
        const trunkGeometry = new THREE.CylinderGeometry(0.5, 0.8, 5, 8);
        const trunkMaterial = new THREE.MeshPhongMaterial({ color: 0x8B4513 });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.y = 2.5;
        trunk.castShadow = true;
        treeGroup.add(trunk);
        
        // Create 3 layers of foliage - simplified
        const foliageMaterial = new THREE.MeshPhongMaterial({ color: 0x2E8B57 });
        
        // Bottom layer - largest
        const bottomFoliageGeometry = new THREE.ConeGeometry(4, 6, 8);
        const bottomFoliage = new THREE.Mesh(bottomFoliageGeometry, foliageMaterial);
        bottomFoliage.position.y = 5;
        bottomFoliage.castShadow = true;
        treeGroup.add(bottomFoliage);
        
        // Middle layer
        const middleFoliageGeometry = new THREE.ConeGeometry(3, 5, 8);
        const middleFoliage = new THREE.Mesh(middleFoliageGeometry, foliageMaterial);
        middleFoliage.position.y = 8;
        middleFoliage.castShadow = true;
        treeGroup.add(middleFoliage);
        
        // Top layer
        const topFoliageGeometry = new THREE.ConeGeometry(2, 4, 8);
        const topFoliage = new THREE.Mesh(topFoliageGeometry, foliageMaterial);
        topFoliage.position.y = 11;
        topFoliage.castShadow = true;
        treeGroup.add(topFoliage);
        
        return treeGroup;
    }

    createOakTree() {
        // Create a simplified oak tree
        const treeGroup = new THREE.Group();
        
        // Trunk
        const trunkGeometry = new THREE.CylinderGeometry(0.7, 1.2, 6, 8);
        const trunkMaterial = new THREE.MeshPhongMaterial({ color: 0x8B4513 });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.y = 3;
        trunk.castShadow = true;
        treeGroup.add(trunk);
        
        // Foliage - use a sphere for a round crown
        const foliageGeometry = new THREE.SphereGeometry(5, 8, 8);
        const foliageMaterial = new THREE.MeshPhongMaterial({ color: 0x228B22 });
        const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
        foliage.position.y = 8;
        foliage.castShadow = true;
        treeGroup.add(foliage);
        
        return treeGroup;
    }

    createBushTree() {
        // Create a simplified bush-like tree
        const treeGroup = new THREE.Group();
        
        // Trunk - very short
        const trunkGeometry = new THREE.CylinderGeometry(0.4, 0.6, 2, 8);
        const trunkMaterial = new THREE.MeshPhongMaterial({ color: 0x8B4513 });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.y = 1;
        trunk.castShadow = true;
        treeGroup.add(trunk);
        
        // Foliage - use multiple small spheres for a bushy appearance
        const foliageMaterial = new THREE.MeshPhongMaterial({ color: 0x3CB371 });
        
        for (let i = 0; i < 5; i++) {
            const size = 1 + Math.random() * 1.5;
            const foliageGeometry = new THREE.SphereGeometry(size, 8, 8);
            const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
            
            // Position randomly around the trunk
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * 1.5;
            foliage.position.x = Math.sin(angle) * radius;
            foliage.position.z = Math.cos(angle) * radius;
            foliage.position.y = 2 + Math.random() * 2;
            
            foliage.castShadow = true;
            treeGroup.add(foliage);
        }
        
        return treeGroup;
    }

    checkWorldBounds(object) {
        // Skip if object is invalid
        if (!object || !object.position) return false;
        
        // Calculate distance from world center (0,0,0) in the XZ plane only
        const distanceFromCenter = Math.sqrt(
            object.position.x * object.position.x + 
            object.position.z * object.position.z
        );
        
        // For player objects, apply a simple check to prevent going beyond the absolute boundary
        if (object === this.player && distanceFromCenter > this.worldRadius) {
            // Calculate normalized direction vector toward center
            const dirX = -object.position.x / distanceFromCenter;
            const dirZ = -object.position.z / distanceFromCenter;
            
            // Apply immediate position correction to prevent escaping
            const pushbackDistance = 0.05 * this.worldRadius; // 5% of radius
            object.position.x += dirX * pushbackDistance;
            object.position.z += dirZ * pushbackDistance;
            
            // Apply velocity correction if available
            if (object.velocity) {
                // Reflect velocity back toward center
                const dotProduct = object.velocity.x * (-dirX) + object.velocity.z * (-dirZ);
                if (dotProduct > 0) { // If moving outward
                    object.velocity.x = dirX * object.velocity.length() * 0.8;
                    object.velocity.z = dirZ * object.velocity.length() * 0.8;
                }
            }
            
            // Update mesh position
            if (object.mesh) {
                object.mesh.position.copy(object.position);
            }
            
            return true; // Object was corrected
        }
        
        // Enemy planes now handle their own boundary wrapping in their update method
        return false; // No correction needed
    }

    createWorldBoundaryIndicator() {
        // Create a visual indicator of the world boundary
        // Note: We're making this invisible as requested, but keeping the code for future reference
        
        // Create a ring to indicate the world boundary
        const ringGeometry = new THREE.RingGeometry(this.worldRadius - 1, this.worldRadius, 64);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0 // Make completely invisible (was 0.7)
        });
        
        this.boundaryRing = new THREE.Mesh(ringGeometry, ringMaterial);
        this.boundaryRing.rotation.x = -Math.PI / 2;
        this.boundaryRing.position.y = 0.5;
        this.scene.add(this.boundaryRing);
        
        // Add a pulsing animation to the boundary
        this.boundaryPulseDirection = 1;
        this.boundaryPulseSpeed = 0.5;
        this.boundaryPulseMin = 0;  // Minimum opacity (was 0.3)
        this.boundaryPulseMax = 0;  // Maximum opacity (was 0.7)
        this.boundaryRing.material.opacity = this.boundaryPulseMin;
    }

    createBoundaryStormClouds() {
        // Create a ring of storm clouds around the world boundary
        const cloudCount = 24; // Increased for larger boundary
        const cloudRadius = this.worldRadius - 40; // Slightly inside the boundary
        
        // Create cloud material
        const cloudMaterial = new THREE.MeshPhongMaterial({
            color: 0x999999,
            transparent: true,
            opacity: 0.7,
            fog: false // No fog for clouds
        });
        
        // Create clouds around the boundary
        for (let i = 0; i < cloudCount; i++) {
            const angle = (i / cloudCount) * Math.PI * 2;
            const x = Math.sin(angle) * cloudRadius;
            const z = Math.cos(angle) * cloudRadius;
            
            // Random height and size - adjusted for larger boundary
            const y = 80 + Math.random() * 100;
            const size = 45 + Math.random() * 55;
            
            // Create cloud mesh
            const cloudGeometry = new THREE.SphereGeometry(size, 8, 8);
            const cloud = new THREE.Mesh(cloudGeometry, cloudMaterial);
            cloud.position.set(x, y, z);
            
            // Add some random distortion
            cloud.scale.y = 0.3 + Math.random() * 0.2;
            cloud.scale.x = 0.8 + Math.random() * 0.4;
            cloud.scale.z = 0.8 + Math.random() * 0.4;
            cloud.rotation.y = Math.random() * Math.PI;
            
            this.scene.add(cloud);
        }
        
        // No fog as requested
    }

    createBoundaryWarningElement() {
        // Create warning element
        const warningElement = document.createElement('div');
        warningElement.style.position = 'fixed';
        warningElement.style.top = '20%';
        warningElement.style.left = '50%';
        warningElement.style.transform = 'translate(-50%, -50%)';
        warningElement.style.color = 'red';
        warningElement.style.fontWeight = 'bold';
        warningElement.style.fontSize = '24px';
        warningElement.style.textShadow = '2px 2px 4px rgba(0, 0, 0, 0.5)';
        warningElement.style.display = 'none';
        warningElement.style.zIndex = '1000';
        warningElement.style.fontFamily = 'Arial, sans-serif';
        warningElement.style.textAlign = 'center';
        warningElement.style.padding = '10px';
        warningElement.style.borderRadius = '5px';
        warningElement.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
        warningElement.innerText = 'WARNING: APPROACHING BOUNDARY\nTURN BACK NOW';
        
        document.body.appendChild(warningElement);
        this.boundaryWarningElement = warningElement;
    }

    loadBoundarySounds() {
        try {
            // Create audio elements for boundary warnings
            const warningSound = document.createElement('audio');
            
            // Check if file exists before setting source
            const warningSoundPath = 'sounds/boundary_warning.mp3';
            
            // Create a dummy audio element without setting the source yet
            this.boundaryWarningSound = warningSound;
            
            // Similarly for wind sound
            const windSound = document.createElement('audio');
            const windSoundPath = 'sounds/strong_wind.mp3';
            
            // Create a dummy audio element without setting the source
            this.boundaryWindSound = windSound;
            
            // Create dummy play and pause methods that do nothing
            this.boundaryWarningSound.play = () => console.log('Warning sound would play if file existed');
            this.boundaryWarningSound.pause = () => {};
            
            this.boundaryWindSound.play = () => console.log('Wind sound would play if file existed');
            this.boundaryWindSound.pause = () => {};
            
            console.log('Audio elements created with dummy methods');
        } catch (error) {
            console.error('Error setting up boundary sounds:', error);
            // Create dummy objects with play/pause methods that do nothing
            this.boundaryWarningSound = {
                play: () => {},
                pause: () => {}
            };
            this.boundaryWindSound = {
                play: () => {},
                pause: () => {}
            };
        }
    }

    updateBoundaryEffects(delta) {
        // Skip if player not available
        if (!this.player) return;
        
        // Update boundary ring pulse animation (even though it's invisible)
        if (this.boundaryRing) {
            // Keep opacity at 0 since we want it invisible
            this.boundaryRing.material.opacity = 0;
        }
        
        // Calculate distance from center
        const playerPos = this.player.position;
        let distanceFromCenter = Math.sqrt(playerPos.x * playerPos.x + playerPos.z * playerPos.z);
        
        // Safety check: If player somehow gets way beyond the boundary, teleport them back
        if (distanceFromCenter > this.worldRadius * 1.1) {
            // Calculate a safe position inside the boundary
            const safeDistance = this.worldRadius * 0.8;
            const angle = Math.atan2(playerPos.z, playerPos.x);
            
            // Set player to safe position
            this.player.position.x = Math.cos(angle) * safeDistance;
            this.player.position.z = Math.sin(angle) * safeDistance;
            
            // Reset velocity to prevent immediate re-collision
            this.player.velocity.x *= 0.1;
            this.player.velocity.z *= 0.1;
            
            // Force update mesh position
            this.player.mesh.position.copy(this.player.position);
            
            // Recalculate distance after teleport
            const newPlayerPos = this.player.position;
            distanceFromCenter = Math.sqrt(newPlayerPos.x * newPlayerPos.x + newPlayerPos.z * newPlayerPos.z);
        }
        
        // Check if player is near boundary
        if (distanceFromCenter > this.boundaryWarningRadius) {
            // Activate warning if not already active
            if (!this.boundaryWarningActive) {
                this.boundaryWarningActive = true;
                
                // Play warning sound if available
                if (this.boundaryWarningSound) {
                    this.boundaryWarningSound.play();
                }
                
                // Show warning element if available
                if (this.boundaryWarningElement) {
                    this.boundaryWarningElement.visible = true;
                }
                
                // Start wind sound if available
                if (this.boundaryWindSound) {
                    this.boundaryWindSound.play();
                }
            }
            
            // Apply pushback force if beyond push radius
            if (distanceFromCenter > this.boundaryPushRadius) {
                // Calculate direction toward center
                const directionToCenter = new THREE.Vector3(-playerPos.x, 0, -playerPos.z).normalize();
                
                // Calculate push force based on how far beyond the push radius
                // Increase the push factor for stronger boundary enforcement
                const pushFactor = (distanceFromCenter - this.boundaryPushRadius) * 1.5;
                
                // Apply force toward center
                this.player.applyForce(directionToCenter.multiplyScalar(pushFactor));
                
                // Apply immediate position correction if very close to the edge
                if (distanceFromCenter > this.worldRadius * 0.98) {
                    // Calculate a small pushback to prevent crossing the boundary
                    const pushbackDistance = 0.02 * this.worldRadius;
                    this.player.position.x += directionToCenter.x * pushbackDistance;
                    this.player.position.z += directionToCenter.z * pushbackDistance;
                    
                    // Update mesh position
                    this.player.mesh.position.copy(this.player.position);
                    
                    // Apply velocity correction to prevent boundary crossing
                    const dotProduct = this.player.velocity.x * (-directionToCenter.x) + 
                                      this.player.velocity.z * (-directionToCenter.z);
                    
                    if (dotProduct > 0) { // If moving outward
                        // Reflect velocity back toward center with reduced magnitude
                        this.player.velocity.x = directionToCenter.x * this.player.velocity.length() * 0.8;
                        this.player.velocity.z = directionToCenter.z * this.player.velocity.length() * 0.8;
                    }
                }
            }
            
            // Ensure shooting is not disabled near boundary
            if (this.player.controls && this.player.controls.shoot === false && this.keyIsDown(' ')) {
                // Force enable shooting if space is pressed
                this.player.controls.shoot = true;
            }
        } else {
            // Deactivate warning if active
            if (this.boundaryWarningActive) {
                this.boundaryWarningActive = false;
                
                // Stop warning sound if available
                if (this.boundaryWarningSound) {
                    this.boundaryWarningSound.pause();
                }
                
                // Hide warning element if available
                if (this.boundaryWarningElement) {
                    this.boundaryWarningElement.visible = false;
                }
                
                // Stop wind sound if available
                if (this.boundaryWindSound) {
                    this.boundaryWindSound.pause();
                }
            }
        }
    }
    
    // Helper method to check if a key is currently pressed
    keyIsDown(key) {
        return this.keysPressed && this.keysPressed[key];
    }

    addGroundDetails() {
        // Add random patches to the ground for visual interest
        const patchCount = 80; // Reduced from 120 to prevent overdrawing
        this.groundDetails = []; // Store for potential cleanup
        
        for (let i = 0; i < patchCount; i++) {
            // Generate a position within the world boundary
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * (this.worldRadius * 0.9); // Keep well within world boundary
            
            const x = Math.sin(angle) * distance;
            const z = Math.cos(angle) * distance;
            
            // Skip if too close to runway
            const distanceFromRunway = Math.sqrt(x * x + z * z);
            if (distanceFromRunway < 25) continue;
            
            // Create a random ground detail
            const detailType = Math.floor(Math.random() * 3);
            let detail;
            
            // Size variation - smaller patches to reduce flickering
            const size = 3 + Math.random() * 10;
            
            // Create different types of ground details
            if (detailType === 0) {
                // Darker grass patch
                const geometry = new THREE.CircleGeometry(size, 8);
                const material = new THREE.MeshStandardMaterial({
                    color: 0x2e7d32, // Darker green
                    roughness: 0.9,
                    metalness: 0.0,
                    side: THREE.DoubleSide,
                    depthWrite: true,
                    polygonOffset: true,
                    polygonOffsetFactor: 2,
                    polygonOffsetUnits: 1
                });
                detail = new THREE.Mesh(geometry, material);
            } else if (detailType === 1) {
                // Lighter grass patch
                const geometry = new THREE.CircleGeometry(size, 8);
                const material = new THREE.MeshStandardMaterial({
                    color: 0x81c784, // Lighter green
                    roughness: 0.8,
                    metalness: 0.0,
                    side: THREE.DoubleSide,
                    depthWrite: true,
                    polygonOffset: true,
                    polygonOffsetFactor: 2,
                    polygonOffsetUnits: 1
                });
                detail = new THREE.Mesh(geometry, material);
            } else {
                // Brown/dirt patch
                const geometry = new THREE.CircleGeometry(size * 0.7, 8);
                const material = new THREE.MeshStandardMaterial({
                    color: 0x8d6e63, // Brown
                    roughness: 1.0,
                    metalness: 0.0,
                    side: THREE.DoubleSide,
                    depthWrite: true,
                    polygonOffset: true,
                    polygonOffsetFactor: 2,
                    polygonOffsetUnits: 1
                });
                detail = new THREE.Mesh(geometry, material);
            }
            
            // Position the detail - increase y offset to prevent z-fighting
            detail.rotation.x = -Math.PI / 2;
            detail.position.set(x, 0.5, z); // Increased from 0.1 to 0.5
            detail.renderOrder = 2; // Ensure details render after ground
            this.scene.add(detail);
            
            // Store for potential cleanup
            this.groundDetails.push(detail);
        }
    }

    initRadar() {
        // Initialize the radar display
        console.log("Initializing radar...");
        this.radarElement = document.getElementById('radar');
        
        if (!this.radarElement) {
            console.error("Radar element not found");
            return;
        }
        
        console.log("Radar element found:", this.radarElement);
        
        // Make sure the radar container is visible
        const radarContainer = document.getElementById('radar-container');
        if (radarContainer) {
            console.log("Radar container found:", radarContainer);
            radarContainer.style.display = 'block';
            radarContainer.style.visibility = 'visible';
            radarContainer.style.opacity = '1';
        } else {
            console.error("Radar container not found");
        }
        
        // Set canvas size
        this.radarElement.width = this.radarSize;
        this.radarElement.height = this.radarSize;
        
        // Get 2D context for drawing
        this.radarContext = this.radarElement.getContext('2d');
        
        if (!this.radarContext) {
            console.error("Failed to get radar context");
            return;
        }
        
        console.log("Radar context created");
        
        // Clear the radar
        this.radarContext.clearRect(0, 0, this.radarSize, this.radarSize);
        
        // Draw radar background
        this.radarContext.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.radarContext.beginPath();
        this.radarContext.arc(this.radarSize/2, this.radarSize/2, this.radarSize/2, 0, Math.PI * 2);
        this.radarContext.fill();
        
        // Draw radar rings
        this.radarContext.strokeStyle = 'rgba(255, 87, 34, 0.5)';
        this.radarContext.lineWidth = 2;
        
        // Draw three concentric rings
        for (let i = 1; i <= 3; i++) {
            const radius = (this.radarSize/2) * (i/3);
            this.radarContext.beginPath();
            this.radarContext.arc(this.radarSize/2, this.radarSize/2, radius, 0, Math.PI * 2);
            this.radarContext.stroke();
        }
        
        // Draw crosshairs
        this.radarContext.strokeStyle = 'rgba(255, 87, 34, 0.5)';
        this.radarContext.beginPath();
        this.radarContext.moveTo(this.radarSize/2, 0);
        this.radarContext.lineTo(this.radarSize/2, this.radarSize);
        this.radarContext.moveTo(0, this.radarSize/2);
        this.radarContext.lineTo(this.radarSize, this.radarSize/2);
        this.radarContext.stroke();
        
        // Ensure radar is active
        this.radarActive = true;
        
        console.log("Radar initialized with size:", this.radarSize);
    }
    
    updateRadar(delta) {
        // Skip if radar is not active or not initialized
        if (!this.radarActive || !this.radarContext || !this.player) {
            if (!this.radarActive) console.log("Radar not active");
            if (!this.radarContext) console.log("Radar context not available");
            if (!this.player) console.log("Player not available for radar update");
            return;
        }
        
        // Update radar at specified interval - update every frame for debugging
        this.radarTimer += delta;
        if (this.radarTimer < this.radarUpdateInterval) return;
        this.radarTimer = 0;
        
        // Make sure the radar container is visible
        const radarContainer = document.getElementById('radar-container');
        if (radarContainer) {
            radarContainer.style.display = 'block';
            radarContainer.style.visibility = 'visible';
            radarContainer.style.opacity = '1';
        }
        
        // Clear the radar
        this.radarContext.clearRect(0, 0, this.radarSize, this.radarSize);
        
        // Draw radar background
        this.radarContext.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.radarContext.beginPath();
        this.radarContext.arc(this.radarSize/2, this.radarSize/2, this.radarSize/2, 0, Math.PI * 2);
        this.radarContext.fill();
        
        // Draw radar rings
        this.radarContext.strokeStyle = 'rgba(255, 87, 34, 0.5)';
        this.radarContext.lineWidth = 2;
        
        // Draw three concentric rings
        for (let i = 1; i <= 3; i++) {
            const radius = (this.radarSize/2) * (i/3);
            this.radarContext.beginPath();
            this.radarContext.arc(this.radarSize/2, this.radarSize/2, radius, 0, Math.PI * 2);
            this.radarContext.stroke();
        }
        
        // Draw crosshairs
        this.radarContext.strokeStyle = 'rgba(255, 87, 34, 0.5)';
        this.radarContext.beginPath();
        this.radarContext.moveTo(this.radarSize/2, 0);
        this.radarContext.lineTo(this.radarSize/2, this.radarSize);
        this.radarContext.moveTo(0, this.radarSize/2);
        this.radarContext.lineTo(this.radarSize, this.radarSize/2);
        this.radarContext.stroke();
        
        // Get player position and rotation
        const playerPos = this.player.position;
        const playerRotation = this.player.mesh.rotation.y;
        
        // Use a fixed radar range
        const fixedRadarRange = 1000; // Fixed radar range
        
        // Draw enemy blips
        this.radarContext.fillStyle = 'rgba(255, 0, 0, 0.9)';
        
        let enemyCount = 0;
        
        // Draw all enemies
        for (let i = 0; i < this.enemies.length; i++) {
            const enemy = this.enemies[i];
            
            // Skip invalid enemies
            if (!enemy || !enemy.position) continue;
            
            // Calculate relative position to player
            const relX = enemy.position.x - playerPos.x;
            const relZ = enemy.position.z - playerPos.z;
            
            // Calculate distance
            const distance = Math.sqrt(relX * relX + relZ * relZ);
            
            // Skip if outside fixed radar range
            if (distance > fixedRadarRange) continue;
            
            enemyCount++;
            
            // Calculate radar position (rotate based on player heading)
            const angle = Math.atan2(relZ, relX) - playerRotation;
            const radarDistance = (distance / fixedRadarRange) * (this.radarSize / 2);
            
            const radarX = this.radarSize/2 + Math.cos(angle) * radarDistance;
            const radarY = this.radarSize/2 + Math.sin(angle) * radarDistance;
            
            // Draw enemy blip
            this.radarContext.beginPath();
            this.radarContext.arc(radarX, radarY, 4, 0, Math.PI * 2);
            this.radarContext.fill();
            
            // Add glow effect
            const gradient = this.radarContext.createRadialGradient(
                radarX, radarY, 1,
                radarX, radarY, 8
            );
            gradient.addColorStop(0, 'rgba(255, 0, 0, 0.9)');
            gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
            
            this.radarContext.fillStyle = gradient;
            this.radarContext.beginPath();
            this.radarContext.arc(radarX, radarY, 8, 0, Math.PI * 2);
            this.radarContext.fill();
            
            // Reset fill style for next enemy
            this.radarContext.fillStyle = 'rgba(255, 0, 0, 0.9)';
        }
        
        // Draw player position in center
        this.radarContext.fillStyle = 'rgba(76, 175, 80, 1.0)';
        this.radarContext.beginPath();
        this.radarContext.arc(this.radarSize/2, this.radarSize/2, 4, 0, Math.PI * 2);
        this.radarContext.fill();
        
        // Add glow effect to player
        const playerGradient = this.radarContext.createRadialGradient(
            this.radarSize/2, this.radarSize/2, 1,
            this.radarSize/2, this.radarSize/2, 10
        );
        playerGradient.addColorStop(0, 'rgba(76, 175, 80, 0.9)');
        playerGradient.addColorStop(1, 'rgba(76, 175, 80, 0)');
        
        this.radarContext.fillStyle = playerGradient;
        this.radarContext.beginPath();
        this.radarContext.arc(this.radarSize/2, this.radarSize/2, 10, 0, Math.PI * 2);
        this.radarContext.fill();
        
        // Log radar update occasionally
        if (Math.random() < 0.01) {
            console.log(`Radar updated with ${enemyCount} enemies shown out of ${this.enemies.length} total`);
        }
    }

    updateEffects(delta) {
        // Limit the number of active effects
        if (this.effectsToUpdate.length > this.maxEffects) {
            const excessEffects = this.effectsToUpdate.length - this.maxEffects;
            // Remove oldest effects first
            for (let i = 0; i < excessEffects && i < this.effectsToUpdate.length; i++) {
                const effect = this.effectsToUpdate[i];
                if (effect && effect.flash) {
                    this.scene.remove(effect.flash);
                    if (effect.flash.geometry) effect.flash.geometry.dispose();
                    if (effect.flash.material) effect.flash.material.dispose();
                }
            }
            this.effectsToUpdate.splice(0, excessEffects);
        }
        
        // Update effects with improved cleanup
        for (let i = this.effectsToUpdate.length - 1; i >= 0; i--) {
            try {
                const effect = this.effectsToUpdate[i];
                
                if (effect && typeof effect.update === 'function') {
                    const keepAlive = effect.update(delta);
                    
                    if (!keepAlive) {
                        // Ensure cleanup of any remaining resources
                        if (effect.flash) {
                            this.scene.remove(effect.flash);
                            if (effect.flash.geometry) effect.flash.geometry.dispose();
                            if (effect.flash.material) effect.flash.material.dispose();
                        }
                        
                        // Remove from effects array
                        this.effectsToUpdate.splice(i, 1);
                    }
                } else {
                    // Remove invalid effects
                    this.effectsToUpdate.splice(i, 1);
                }
            } catch (effectError) {
                console.error("Error updating effect:", effectError);
                // Remove problematic effect
                const effect = this.effectsToUpdate[i];
                if (effect && effect.flash) {
                    this.scene.remove(effect.flash);
                    if (effect.flash.geometry) effect.flash.geometry.dispose();
                    if (effect.flash.material) effect.flash.material.dispose();
                }
                this.effectsToUpdate.splice(i, 1);
            }
        }
    }

    // Track key states
    handleKeyDown(event) {
        this.keysPressed[event.key] = true;
    }
    
    handleKeyUp(event) {
        this.keysPressed[event.key] = false;
    }

    checkTerrainCollisions() {
        if (!this.player || !this.player.position) return;
        
        const playerPos = this.player.position;
        const collisionRadius = 3; // Collision radius for the player's plane
        
        // Check collision with ground (except runway)
        if (playerPos.y < 5) { // If close to ground level
            // Check if player is over the runway
            const isOverRunway = this.isPositionOverRunway(playerPos.x, playerPos.z);
            
            // If not over runway and very close to ground, it's a crash
            if (!isOverRunway && playerPos.y < 2) {
                console.log("Collision with ground detected!");
                this.createExplosion(playerPos.x, playerPos.y, playerPos.z, 2);
                this.gameOver = true;
                this.showGameOverScreen("You crashed into the ground!");
                return;
            }
        }
        
        // Check collision with mountains
        for (let i = 0; i < this.mountains.length; i++) {
            const mountain = this.mountains[i];
            const mountainPos = mountain.position;
            
            // Calculate horizontal distance
            const dx = playerPos.x - mountainPos.x;
            const dz = playerPos.z - mountainPos.z;
            const horizontalDist = Math.sqrt(dx * dx + dz * dz);
            
            // Calculate mountain height at this distance (conical shape)
            // Mountain radius at base is stored in mountain.radius
            if (horizontalDist < mountain.radius) {
                // Calculate height of mountain at this point (assuming conical shape)
                // Height decreases linearly from center to edge
                const mountainHeightAtPoint = (1 - horizontalDist / mountain.radius) * 150; // Assuming max height of 150
                
                // If player's altitude is less than the mountain height at this point, collision occurred
                if (playerPos.y < mountainHeightAtPoint) {
                    console.log("Collision with mountain detected!");
                    this.createExplosion(playerPos.x, playerPos.y, playerPos.z, 2);
                    this.gameOver = true;
                    this.showGameOverScreen("You crashed into a mountain!");
                    return;
                }
            }
        }
        
        // Check collision with trees
        for (let i = 0; i < this.trees.length; i++) {
            const tree = this.trees[i];
            const treePos = tree.position;
            
            // Calculate distance
            const dx = playerPos.x - treePos.x;
            const dz = playerPos.z - treePos.z;
            const horizontalDist = Math.sqrt(dx * dx + dz * dz);
            
            // Tree collision radius
            const treeRadius = 2;
            
            // Check if player is horizontally close to tree and altitude is low enough
            if (horizontalDist < treeRadius + collisionRadius && playerPos.y < 15) { // Trees are about 15 units tall
                console.log("Collision with tree detected!");
                this.createExplosion(playerPos.x, playerPos.y, playerPos.z, 1.5);
                this.gameOver = true;
                this.showGameOverScreen("You crashed into a tree!");
                return;
            }
        }
    }
    
    isPositionOverRunway(x, z) {
        if (!this.runway) return false;
        
        // Calculate runway bounds
        const halfWidth = this.runwayWidth / 2;
        const halfLength = this.runwayLength / 2;
        
        // Check if position is within runway bounds
        return (
            x >= -halfWidth && 
            x <= halfWidth && 
            z >= -halfLength && 
            z <= halfLength
        );
    }
    
    showGameOverScreen(message) {
        // Create game over overlay
        const gameOverOverlay = document.createElement('div');
        gameOverOverlay.style.position = 'absolute';
        gameOverOverlay.style.top = '0';
        gameOverOverlay.style.left = '0';
        gameOverOverlay.style.width = '100%';
        gameOverOverlay.style.height = '100%';
        gameOverOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        gameOverOverlay.style.display = 'flex';
        gameOverOverlay.style.flexDirection = 'column';
        gameOverOverlay.style.justifyContent = 'center';
        gameOverOverlay.style.alignItems = 'center';
        gameOverOverlay.style.color = 'white';
        gameOverOverlay.style.fontSize = '24px';
        gameOverOverlay.style.zIndex = '1000';
        
        // Create game over message
        const gameOverMessage = document.createElement('h1');
        gameOverMessage.textContent = 'GAME OVER';
        gameOverMessage.style.color = 'red';
        gameOverMessage.style.fontSize = '48px';
        gameOverMessage.style.marginBottom = '20px';
        
        // Create reason message
        const reasonMessage = document.createElement('p');
        reasonMessage.textContent = message;
        reasonMessage.style.marginBottom = '30px';
        
        // Create restart button
        const restartButton = document.createElement('button');
        restartButton.textContent = 'Restart Game';
        restartButton.style.padding = '10px 20px';
        restartButton.style.fontSize = '20px';
        restartButton.style.backgroundColor = '#4CAF50';
        restartButton.style.color = 'white';
        restartButton.style.border = 'none';
        restartButton.style.borderRadius = '5px';
        restartButton.style.cursor = 'pointer';
        
        // Add hover effect
        restartButton.style.transition = 'background-color 0.3s';
        restartButton.addEventListener('mouseover', () => {
            restartButton.style.backgroundColor = '#45a049';
        });
        restartButton.addEventListener('mouseout', () => {
            restartButton.style.backgroundColor = '#4CAF50';
        });
        
        // Add click event to restart the game
        restartButton.addEventListener('click', () => {
            location.reload();
        });
        
        // Add elements to overlay
        gameOverOverlay.appendChild(gameOverMessage);
        gameOverOverlay.appendChild(reasonMessage);
        gameOverOverlay.appendChild(restartButton);
        
        // Add overlay to document
        document.body.appendChild(gameOverOverlay);
    }

    showVictoryScreen(message) {
        // Create victory overlay
        const victoryOverlay = document.createElement('div');
        victoryOverlay.style.position = 'absolute';
        victoryOverlay.style.top = '0';
        victoryOverlay.style.left = '0';
        victoryOverlay.style.width = '100%';
        victoryOverlay.style.height = '100%';
        victoryOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        victoryOverlay.style.display = 'flex';
        victoryOverlay.style.flexDirection = 'column';
        victoryOverlay.style.justifyContent = 'center';
        victoryOverlay.style.alignItems = 'center';
        victoryOverlay.style.color = 'white';
        victoryOverlay.style.fontSize = '24px';
        victoryOverlay.style.zIndex = '1000';
        
        // Create victory message
        const victoryMessage = document.createElement('h1');
        victoryMessage.textContent = 'VICTORY!';
        victoryMessage.style.color = 'gold';
        victoryMessage.style.fontSize = '64px';
        victoryMessage.style.marginBottom = '20px';
        victoryMessage.style.textShadow = '0 0 10px rgba(255, 215, 0, 0.7)';
        
        // Add animation to the victory message
        victoryMessage.style.animation = 'pulse 1.5s infinite';
        const style = document.createElement('style');
        style.textContent = `
            @keyframes pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.1); }
                100% { transform: scale(1); }
            }
            @keyframes confetti {
                0% { transform: translateY(0) rotate(0deg); opacity: 1; }
                100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
        
        // Create congratulations message
        const congratsMessage = document.createElement('p');
        congratsMessage.textContent = message;
        congratsMessage.style.marginBottom = '30px';
        congratsMessage.style.fontSize = '28px';
        
        // Create restart button
        const restartButton = document.createElement('button');
        restartButton.textContent = 'Play Again';
        restartButton.style.padding = '15px 30px';
        restartButton.style.fontSize = '24px';
        restartButton.style.backgroundColor = '#FFD700';
        restartButton.style.color = '#000';
        restartButton.style.border = 'none';
        restartButton.style.borderRadius = '10px';
        restartButton.style.cursor = 'pointer';
        restartButton.style.fontWeight = 'bold';
        restartButton.style.boxShadow = '0 0 15px rgba(255, 215, 0, 0.5)';
        
        // Add hover effect
        restartButton.style.transition = 'all 0.3s';
        restartButton.addEventListener('mouseover', () => {
            restartButton.style.backgroundColor = '#FFC000';
            restartButton.style.transform = 'scale(1.05)';
        });
        restartButton.addEventListener('mouseout', () => {
            restartButton.style.backgroundColor = '#FFD700';
            restartButton.style.transform = 'scale(1)';
        });
        
        // Add click event to restart the game
        restartButton.addEventListener('click', () => {
            location.reload();
        });
        
        // Add elements to overlay
        victoryOverlay.appendChild(victoryMessage);
        victoryOverlay.appendChild(congratsMessage);
        victoryOverlay.appendChild(restartButton);
        
        // Add overlay to document
        document.body.appendChild(victoryOverlay);
        
        // Add confetti effect
        this.createConfetti();
    }

    createConfetti() {
        // Create 100 confetti particles
        for (let i = 0; i < 100; i++) {
            setTimeout(() => {
                const confetti = document.createElement('div');
                confetti.style.position = 'fixed';
                confetti.style.width = `${Math.random() * 10 + 5}px`;
                confetti.style.height = `${Math.random() * 10 + 5}px`;
                confetti.style.backgroundColor = this.getRandomColor();
                confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
                confetti.style.top = '-10px';
                confetti.style.left = `${Math.random() * 100}vw`;
                confetti.style.zIndex = '1001';
                confetti.style.animation = `confetti ${Math.random() * 3 + 2}s linear forwards`;
                
                document.body.appendChild(confetti);
                
                // Remove confetti after animation completes
                setTimeout(() => {
                    document.body.removeChild(confetti);
                }, 5000);
            }, i * 50); // Stagger the confetti creation
        }
    }

    getRandomColor() {
        const colors = [
            '#FF0000', // Red
            '#00FF00', // Green
            '#0000FF', // Blue
            '#FFFF00', // Yellow
            '#FF00FF', // Magenta
            '#00FFFF', // Cyan
            '#FFA500', // Orange
            '#800080', // Purple
            '#FFC0CB', // Pink
            '#00FF7F'  // Spring Green
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    // Add explosion sound function
    playExplosionSound(position) {
        // Create positional audio for explosion
        const listener = this.player.audioListener;
        if (!listener) return;
        
        const explosionSound = new THREE.PositionalAudio(listener);
        const audioLoader = new THREE.AudioLoader();
        
        audioLoader.load('audio/explosion.mp3', (buffer) => {
            explosionSound.setBuffer(buffer);
            explosionSound.setRefDistance(20);
            explosionSound.setVolume(0.7);
            explosionSound.play();
            
            // Create temporary object to hold the sound
            const soundObject = new THREE.Object3D();
            soundObject.position.copy(position);
            soundObject.add(explosionSound);
            this.scene.add(soundObject);
            
            // Remove sound object after playing
            setTimeout(() => {
                this.scene.remove(soundObject);
            }, 3000);
        });
    }
} 
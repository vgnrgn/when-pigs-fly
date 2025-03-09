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
        
        // Setup camera
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 5, -10);
        this.camera.lookAt(0, 0, 0);
        
        // Set up renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        document.body.appendChild(this.renderer.domElement);
        
        // Timing
        this.clock = new THREE.Clock();
        
        // Game objects
        this.enemies = [];
        this.birds = [];
        this.trees = [];
        this.mountains = [];
        this.lakes = [];
        this.effectsToUpdate = [];
        
        // Game state
        this.score = 0;
        this.birdsRescued = 0;
        
        // Runway dimensions
        this.runwayWidth = 20;
        this.runwayLength = 100;
        
        // Start the initialization
        this.init();
    }

    async init() {
        try {
            console.log("Starting initialization...");
            
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
            this.createTrees();
            this.createLakes();
            console.log("Environment elements created");
            
            // Create enemies
            this.createEnemies();
            console.log("Enemies created");
            
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
        
        // Create a ground plane
        const groundGeometry = new THREE.PlaneGeometry(1000, 1000);
        const groundMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x7CFC00, 
            side: THREE.DoubleSide
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);
        
        // Add ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);
        
        // Add directional light (sun)
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(100, 100, 50);
        directionalLight.castShadow = true;
        this.scene.add(directionalLight);
    }

    createRunway() {
        // Create a runway in the center of the scene
        const runwayGeometry = new THREE.PlaneGeometry(this.runwayWidth, this.runwayLength);
        const runwayMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x333333, 
            side: THREE.DoubleSide 
        });
        
        this.runway = new THREE.Mesh(runwayGeometry, runwayMaterial);
        this.runway.rotation.x = -Math.PI / 2;
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
        const stripeMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
        
        // Center line
        const centerLineGeometry = new THREE.PlaneGeometry(stripeWidth, this.runwayLength * 0.8);
        const centerLine = new THREE.Mesh(centerLineGeometry, stripeMaterial);
        centerLine.rotation.x = -Math.PI / 2;
        centerLine.position.y = 0.01; // Slightly above runway to prevent z-fighting
        this.scene.add(centerLine);
        
        // Starting line 
        const startLineGeometry = new THREE.PlaneGeometry(this.runwayWidth, stripeWidth);
        const startLine = new THREE.Mesh(startLineGeometry, stripeMaterial);
        startLine.rotation.x = -Math.PI / 2;
        startLine.position.z = this.runwayLength/2 - 5; // Near the end
        startLine.position.y = 0.01;
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
        const mountainCount = 15;
        this.mountains = [];
        
        for (let i = 0; i < mountainCount; i++) {
            // Keep trying until we find a valid position
            let x, z, radius;
            let positionValid = false;
            let attempts = 0;
            
            while (!positionValid && attempts < 50) {
                // Generate a position far from the runway
                radius = 80 + Math.random() * 60; // Mountain size
                const angle = Math.random() * Math.PI * 2;
                const distance = 300 + Math.random() * 500; // Far from center
                
                x = Math.sin(angle) * distance;
                z = Math.cos(angle) * distance;
                
                // Check if position is clear of other mountains
                positionValid = this.isPositionClear(x, z, radius, this.mountains);
                attempts++;
            }
            
            if (!positionValid) continue; // Skip if we couldn't find a valid position
            
            // Create mountain with simplex noise
            const mountain = this.createMountain(radius, 60 + Math.random() * 80);
            mountain.position.set(x, 0, z);
            this.scene.add(mountain);
            
            // Store for collision detection
            this.mountains.push({
                position: mountain.position,
                radius: radius
            });
        }
    }
    
    createTrees() {
        // Add trees to the scene, avoiding runway and mountains
        const treeCount = 150;
        this.trees = [];
        
        for (let i = 0; i < treeCount; i++) {
            // Keep trying until we find a valid position
            let x, z;
            let positionValid = false;
            let attempts = 0;
            
            while (!positionValid && attempts < 20) {
                // Generate a random position in a reasonable area
                const angle = Math.random() * Math.PI * 2;
                const distance = 100 + Math.random() * 400;
                
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
        // Add several small lakes around the scene, avoiding other objects
        const lakeCount = 10;
        this.lakes = [];
        
        for (let i = 0; i < lakeCount; i++) {
            // Keep trying until we find a valid position
            let x, z, radius;
            let positionValid = false;
            let attempts = 0;
            
            while (!positionValid && attempts < 30) {
                radius = 20 + Math.random() * 40;
                const angle = Math.random() * Math.PI * 2;
                const distance = 150 + Math.random() * 400;
                
                x = Math.sin(angle) * distance;
                z = Math.cos(angle) * distance;
                
                // Check if position is clear of runway, mountains, trees and other lakes
                positionValid = this.isPositionClear(x, z, radius, [
                    ...this.mountains, 
                    ...this.trees,
                    ...this.lakes
                ]);
                
                attempts++;
            }
            
            if (!positionValid) continue; // Skip if we couldn't find a valid position
            
            // Create a lake
            const lakeGeometry = new THREE.CircleGeometry(radius, 24);
            const lakeMaterial = new THREE.MeshPhongMaterial({ 
                color: 0x1E90FF, 
                transparent: true,
                opacity: 0.8,
                shininess: 100,
                side: THREE.DoubleSide
            });
            
            const lake = new THREE.Mesh(lakeGeometry, lakeMaterial);
            lake.rotation.x = -Math.PI / 2;
            lake.position.set(x, 0.2, z); // Slightly above ground
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
            return;
        }
        
        // Simple camera following, always behind player
        const cameraOffset = new THREE.Vector3(0, 5, -10);
        cameraOffset.applyQuaternion(this.player.mesh.quaternion);
        
        // Set camera position
        this.camera.position.copy(this.player.position).add(cameraOffset);
        this.camera.lookAt(this.player.position);
    }

    update(delta) {
        // Update player
        if (this.player) {
            this.player.update(delta);
            
            // Check if player has smoke emitter that needs updating
            if (this.player.smokeEmitter) {
                this.player.smokeEmitter.update(delta);
            }
        }
        
        // Update birds
        for (let i = 0; i < this.birds.length; i++) {
            this.birds[i].update(delta);
            
            // Check for bird rescue
            if (this.player && this.birds[i].checkPlayerProximity(this.player.position)) {
                this.rescueBird(i);
                i--; // Adjust for the removed bird
            }
        }
        
        // Update enemies and check for hit
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            this.enemies[i].update(delta);
            
            // Check if enemy is destroyed
            if (this.enemies[i].health <= 0) {
                this.createExplosion(this.enemies[i].position);
                this.scene.remove(this.enemies[i].mesh);
                
                this.enemies.splice(i, 1);
                
                // Create a new enemy to replace the destroyed one
                this.createNewEnemy();
            }
        }
        
        // Make sure we always have enemies
        if (this.enemies.length < 3) {
            this.createNewEnemy();
        }
        
        // Update player bullets vs enemies
        if (this.player) {
            for (let i = this.player.bullets.length - 1; i >= 0; i--) {
                const bullet = this.player.bullets[i];
                const bulletPosition = bullet.mesh.position;
                
                // Check for enemy hits
                for (let j = this.enemies.length - 1; j >= 0; j--) {
                    const enemy = this.enemies[j];
                    const distance = bulletPosition.distanceTo(enemy.position);
                    
                    if (distance < 4) { // Hit detection radius (increased from 2)
                        // Create hit effect
                        this.createHitIndicator(bulletPosition);
                        
                        // Damage enemy
                        enemy.damage(25); // Each hit deals 25 damage
                        
                        // Remove bullet
                        this.scene.remove(bullet.mesh);
                        this.player.bullets.splice(i, 1);
                        
                        break; // Bullet can only hit one enemy
                    }
                }
            }
        }
        
        // Update effects
        for (let i = this.effectsToUpdate.length - 1; i >= 0; i--) {
            const effect = this.effectsToUpdate[i];
            
            if (effect && typeof effect.update === 'function') {
                const keepAlive = effect.update(delta);
                
                if (!keepAlive) {
                    this.effectsToUpdate.splice(i, 1);
                }
            } else {
                // Remove invalid effects
                this.effectsToUpdate.splice(i, 1);
            }
        }
        
        // Update camera to follow player
        this.updateCamera(delta);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        // Calculate delta time
        const delta = this.clock.getDelta();
        
        // Update player
        if (this.player) {
            this.player.update(delta);
        }
        
        // Update enemies
        this.updateEnemies(delta);
        
        // Update birds
        this.updateBirds(delta);
        
        // Update effects
        this.update(delta);
        
        // Update camera position
        this.updateCamera(delta);
        
        // Render scene
        this.renderer.render(this.scene, this.camera);
    }

    updateEnemies(delta) {
        // Process enemies with optimized code
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            
            // Skip if enemy is invalid
            if (!enemy || !enemy.position) continue;
            
            // Update enemy
            enemy.update(delta);
            
            // Check if enemy is destroyed
            if (enemy.health <= 0) {
                this.handleEnemyDestruction(enemy, i);
                continue;
            }
            
            // Check if player bullets hit this enemy
            this.checkBulletHits(enemy, i);
        }
        
        // Ensure we have enough enemies
        while (this.enemies.length < this.maxEnemies) {
            this.createNewEnemy();
        }
    }

    handleEnemyDestruction(enemy, index) {
        // Create explosion
        this.createExplosion(enemy.position);
        
        // Release birds
        const birdCount = Math.min(3, this.maxBirds - this.birds.length);
        if (birdCount > 0) {
            this.releaseBirds(enemy.position, birdCount);
        }
        
        // Update animals rescued count
        this.animalsRescued += birdCount;
        this.updateRescueCounter();
        
        // Remove enemy plane
        this.scene.remove(enemy.mesh);
        this.enemies.splice(index, 1);
        
        // Create a new enemy to replace the destroyed one
        if (this.enemies.length < this.maxEnemies) {
            this.createNewEnemy();
        }
    }

    checkBulletHits(enemy, enemyIndex) {
        // Optimized player bullet hit detection
        if (!this.player || !this.player.bullets || this.player.bullets.length === 0) return;
        
        const enemyPosition = enemy.position;
        const enemyRadius = 4; // Hit detection radius
        
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
        // Skip if no birds
        if (!this.birds || this.birds.length === 0) return;
        
        // Update birds with performance optimizations
        for (let i = this.birds.length - 1; i >= 0; i--) {
            const bird = this.birds[i];
            
            // Skip invalid birds
            if (!bird) continue;
            
            // Update bird
            bird.update(delta);
            
            // Remove birds that are too old
            if (bird.age > 10) { // 10 seconds lifespan
                this.scene.remove(bird.mesh);
                this.birds.splice(i, 1);
            }
        }
        
        // Limit maximum number of birds
        if (this.birds.length > this.maxBirds) {
            // Remove oldest birds
            const birdsToRemove = this.birds.length - this.maxBirds;
            for (let i = 0; i < birdsToRemove; i++) {
                if (this.birds[i] && this.birds[i].mesh) {
                    this.scene.remove(this.birds[i].mesh);
                }
            }
            this.birds.splice(0, birdsToRemove);
        }
    }

    createEnemies() {
        // Create a few enemy planes
        const enemyCount = Math.min(3, this.maxEnemies);
        
        for (let i = 0; i < enemyCount; i++) {
            this.createNewEnemy();
        }
    }

    createNewEnemy() {
        // Create a new enemy plane
        const angle = Math.random() * Math.PI * 2;
        const distance = 80 + Math.random() * 70; // 80-150 units from center
        
        // Calculate position based on distance and angle
        const x = Math.sin(angle) * distance;
        const z = Math.cos(angle) * distance;
        
        // Set y position a bit higher for better visibility
        const y = 30 + Math.random() * 30; // 30-60 units high
        
        const position = new THREE.Vector3(x, y, z);
        
        // Create the enemy
        try {
            const enemy = new EnemyPlane(this, position);
            this.enemies.push(enemy);
        } catch (error) {
            console.error("Error creating enemy:", error);
        }
    }

    createExplosion(position, scale = 1.0) {
        // Create flash
        const flash = new THREE.PointLight(0xffaa00, 3, 20);
        flash.position.copy(position);
        this.scene.add(flash);
        
        // Create explosion particles
        const particleCount = 30;
        const particles = [];
        
        // Different geometries for more interesting explosion
        const geometries = [
            new THREE.SphereGeometry(0.2 * scale, 4, 4),
            new THREE.BoxGeometry(0.3 * scale, 0.3 * scale, 0.3 * scale),
        ];
        
        // Different materials for the explosion
        const materials = [
            new THREE.MeshBasicMaterial({ color: 0xff5500, transparent: true, opacity: 0.9 }),
            new THREE.MeshBasicMaterial({ color: 0xff9900, transparent: true, opacity: 0.9 }),
            new THREE.MeshBasicMaterial({ color: 0xffdd00, transparent: true, opacity: 0.9 })
        ];
        
        for (let i = 0; i < particleCount; i++) {
            // Select random geometry and material
            const geometry = geometries[Math.floor(Math.random() * geometries.length)];
            const material = materials[Math.floor(Math.random() * materials.length)].clone();
            
            const particle = new THREE.Mesh(geometry, material);
            particle.position.copy(position);
            
            // Add slight random offset
            particle.position.x += (Math.random() - 0.5) * 0.5 * scale;
            particle.position.y += (Math.random() - 0.5) * 0.5 * scale;
            particle.position.z += (Math.random() - 0.5) * 0.5 * scale;
            
            // Random velocity 
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 15 * scale,
                (Math.random() - 0.5) * 15 * scale + 5 * scale, // Bias upward
                (Math.random() - 0.5) * 15 * scale
            );
            
            particles.push({
                mesh: particle,
                velocity: velocity,
                life: 1.0 + Math.random() * 0.5, // 1-1.5 seconds
                rotationSpeed: new THREE.Vector3(
                    Math.random() * 5,
                    Math.random() * 5,
                    Math.random() * 5
                )
            });
            
            this.scene.add(particle);
        }
        
        // Add dark smoke particles
        const smokeCount = 15;
        const smokeGeometry = new THREE.SphereGeometry(0.3 * scale, 6, 6);
        const smokeMaterial = new THREE.MeshBasicMaterial({
            color: 0x222222,
            transparent: true,
            opacity: 0.6
        });
        
        for (let i = 0; i < smokeCount; i++) {
            const smoke = new THREE.Mesh(smokeGeometry, smokeMaterial.clone());
            smoke.position.copy(position);
            
            // Random slower velocity, mainly upward
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 3 * scale,
                2 + Math.random() * 3 * scale,
                (Math.random() - 0.5) * 3 * scale
            );
            
            particles.push({
                mesh: smoke,
                velocity: velocity,
                life: 2.0 + Math.random(), // 2-3 seconds
                isSmoke: true
            });
            
            this.scene.add(smoke);
        }
        
        // Schedule cleanup
        setTimeout(() => {
            this.scene.remove(flash);
        }, 500);
        
        // Add to update list
        const explosionEffect = {
            startTime: performance.now() / 1000,
            particles: particles,
            flash: flash,
            update: (delta) => {
                const now = performance.now() / 1000;
                const age = now - explosionEffect.startTime;
                
                // Fade out flash
                if (flash) {
                    flash.intensity = Math.max(0, 3 * (1 - age));
                }
                
                // Update particles
                for (let i = particles.length - 1; i >= 0; i--) {
                    const particle = particles[i];
                    
                    // Update position
                    particle.mesh.position.add(particle.velocity.clone().multiplyScalar(delta));
                    
                    // Apply gravity and drag
                    particle.velocity.y -= delta * 9.8 * scale;
                    particle.velocity.multiplyScalar(0.98);
                    
                    // Rotate if it's a debris particle, not smoke
                    if (particle.rotationSpeed) {
                        particle.mesh.rotation.x += particle.rotationSpeed.x * delta;
                        particle.mesh.rotation.y += particle.rotationSpeed.y * delta;
                        particle.mesh.rotation.z += particle.rotationSpeed.z * delta;
                    }
                    
                    // Handle smoke differently
                    if (particle.isSmoke) {
                        // Grow smoke
                        particle.mesh.scale.addScalar(delta);
                    }
                    
                    // Reduce life
                    particle.life -= delta;
                    
                    // Fade based on remaining life
                    particle.mesh.material.opacity = particle.isSmoke ? 
                        0.6 * (particle.life / 3) : 
                        0.9 * (particle.life / 1.5);
                    
                    // Remove if expired
                    if (particle.life <= 0) {
                        this.scene.remove(particle.mesh);
                        particles.splice(i, 1);
                    }
                }
                
                // Return true while we still have particles
                return particles.length > 0 || age < 0.5;
            }
        };
        
        this.effectsToUpdate.push(explosionEffect);
        
        // Play explosion sound if available - wrapped in try/catch to avoid errors
        try {
            if (this.explosionSound) {
                const sound = this.explosionSound.clone();
                sound.setVolume(0.5);
                sound.play();
            }
        } catch (error) {
            console.log("Sound not available");
        }
    }
    
    releaseBirds(position, count) {
        // Initialize birds array if it doesn't exist
        if (!this.birds) {
            this.birds = [];
        }
        
        // Create birds
        for (let i = 0; i < count; i++) {
            const bird = new Bird(this, position.clone());
            this.birds.push(bird);
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
            counterElement.style.fontFamily = 'Arial';
            counterElement.style.fontSize = '20px';
            counterElement.style.textShadow = '2px 2px 2px black';
            document.body.appendChild(counterElement);
        }
        
        document.getElementById('rescue-counter').textContent = `Animals Rescued: ${this.animalsRescued}`;
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
        
        // Add instructions
        const instructions = document.createElement('div');
        instructions.style.fontSize = '1.2rem';
        instructions.style.marginBottom = '40px';
        instructions.style.maxWidth = '600px';
        instructions.style.textAlign = 'left';
        instructions.innerHTML = `
            <h2 style="text-align: center; margin-bottom: 15px;">Controls:</h2>
            <p>W: Increase throttle</p>
            <p>S: Decrease throttle</p>
            <p>Arrow Keys: Control direction</p>
            <p>Space: Fire wing guns</p>
            <p>Goal: Shoot down autonomous planes to rescue the birds inside!</p>
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
        // Create a mountain using a cone geometry
        const mountainGeometry = new THREE.ConeGeometry(radius, height, 16); 
        const mountainMaterial = new THREE.MeshPhongMaterial({
            color: 0x4a4a4a,
            flatShading: true,
            shininess: 0
        });
        
        const mountain = new THREE.Mesh(mountainGeometry, mountainMaterial);
        
        // Add snow cap if the mountain is tall enough
        if (height > 100) {
            const snowCapGeometry = new THREE.ConeGeometry(radius * 0.4, height * 0.2, 16);
            const snowCapMaterial = new THREE.MeshPhongMaterial({
                color: 0xffffff,
                shininess: 10
            });
            
            const snowCap = new THREE.Mesh(snowCapGeometry, snowCapMaterial);
            snowCap.position.y = height * 0.4;
            mountain.add(snowCap);
        }
        
        return mountain;
    }

    createPineTree() {
        // Create a pine tree
        const treeGroup = new THREE.Group();
        
        // Trunk
        const trunkGeometry = new THREE.CylinderGeometry(0.5, 0.8, 5, 8);
        const trunkMaterial = new THREE.MeshPhongMaterial({ color: 0x8B4513 });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.y = 2.5;
        treeGroup.add(trunk);
        
        // Add multiple layers of foliage
        const foliageMaterial = new THREE.MeshPhongMaterial({ color: 0x2E8B57 });
        
        // Bottom layer - largest
        const bottomFoliageGeometry = new THREE.ConeGeometry(4, 6, 8);
        const bottomFoliage = new THREE.Mesh(bottomFoliageGeometry, foliageMaterial);
        bottomFoliage.position.y = 5;
        treeGroup.add(bottomFoliage);
        
        // Middle layer
        const middleFoliageGeometry = new THREE.ConeGeometry(3, 5, 8);
        const middleFoliage = new THREE.Mesh(middleFoliageGeometry, foliageMaterial);
        middleFoliage.position.y = 8;
        treeGroup.add(middleFoliage);
        
        // Top layer
        const topFoliageGeometry = new THREE.ConeGeometry(2, 4, 8);
        const topFoliage = new THREE.Mesh(topFoliageGeometry, foliageMaterial);
        topFoliage.position.y = 11;
        treeGroup.add(topFoliage);
        
        return treeGroup;
    }

    createOakTree() {
        // Create an oak-like tree with a wider, rounded foliage
        const treeGroup = new THREE.Group();
        
        // Trunk
        const trunkGeometry = new THREE.CylinderGeometry(0.7, 1.2, 6, 8);
        const trunkMaterial = new THREE.MeshPhongMaterial({ color: 0x8B4513 });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.y = 3;
        treeGroup.add(trunk);
        
        // Foliage - use a sphere for a round crown
        const foliageGeometry = new THREE.SphereGeometry(5, 8, 8);
        const foliageMaterial = new THREE.MeshPhongMaterial({ color: 0x228B22 });
        const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
        foliage.position.y = 8;
        treeGroup.add(foliage);
        
        return treeGroup;
    }

    createBushTree() {
        // Create a small bush-like tree
        const treeGroup = new THREE.Group();
        
        // Trunk - very short
        const trunkGeometry = new THREE.CylinderGeometry(0.4, 0.6, 2, 8);
        const trunkMaterial = new THREE.MeshPhongMaterial({ color: 0x8B4513 });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.y = 1;
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
            
            treeGroup.add(foliage);
        }
        
        return treeGroup;
    }
} 
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import * as CANNON from 'cannon-es';

export class Player {
    constructor(game) {
        console.log("Creating player instance");
        this.game = game;
        this.position = new THREE.Vector3(0, 1.0, 0);
        this.rotation = new THREE.Euler(0, 0, 0);
        this.speed = 0;
        this.maxSpeed = 100 / 3.6; // Increased from 78 km/h to 100 km/h
        this.minSpeed = 5;
        this.throttle = 0;
        this.isGrounded = true;
        
        // Flying physics
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.acceleration = new THREE.Vector3(0, 0, 0);
        this.gravity = new THREE.Vector3(0, -9.81, 0);
        this.drag = 0.002;
        this.lift = 1.2;
        this.thrustPower = 100; // Increased from 78 to 100
        
        // Control sensitivity
        this.pitchRate = 1.0;
        this.rollRate = 1.0;
        this.yawRate = 0.3;
        
        // Auto-stabilization
        this.stabilizationRate = 0.95;
        
        // Rotation constraints
        this.maxPitch = Math.PI / 6;  // 30 degrees
        this.maxRoll = Math.PI / 2;   // 90 degrees
        
        // Weapon properties
        this.bullets = [];
        this.bulletSpeed = 80; // Increased bullet speed from 60 to 80
        this.bulletCooldown = 0.1; // Reduced from 0.2 to 0.1 for faster fire rate
        this.lastShotTime = 0;
        
        // Create controls
        this.controls = {
            throttle: false,
            brake: false,
            left: false,
            right: false,
            up: false,
            down: false,
            shoot: false
        };
        
        // Set up event listeners
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);
        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('keyup', this.handleKeyUp);
        
        // Create the plane mesh
        this.createMesh();
        console.log("Player mesh created");
        
        // Load sounds
        this.loadSounds();
    }
    
    // Add sound loading function
    loadSounds() {
        // Create audio listener
        this.audioListener = new THREE.AudioListener();
        this.game.camera.add(this.audioListener);
        
        // Create engine sound
        this.engineSound = new THREE.Audio(this.audioListener);
        this.game.scene.add(this.engineSound);
        
        // Create shooting sound
        this.shootSound = new THREE.Audio(this.audioListener);
        this.game.scene.add(this.shootSound);
        
        // Load engine sound
        const audioLoader = new THREE.AudioLoader();
        audioLoader.load('audio/plane_engine.mp3', (buffer) => {
            this.engineSound.setBuffer(buffer);
            this.engineSound.setLoop(true);
            this.engineSound.setVolume(0.5);
            this.engineSound.play();
        });
        
        // Load shooting sound
        audioLoader.load('audio/gun_shot.mp3', (buffer) => {
            this.shootSound.setBuffer(buffer);
            this.shootSound.setLoop(false);
            this.shootSound.setVolume(0.3);
        });
    }
    
    createMesh() {
        console.log("Creating player mesh");
        // Create plane mesh - replacing simple box with a more detailed plane
        this.mesh = new THREE.Group(); // Create a group to hold all plane parts
        
        // Main body (fuselage) - cylindrical with tapering
        const fuselageGeometry = new THREE.CylinderGeometry(0.6, 0.4, 3.5, 16);
        fuselageGeometry.rotateX(Math.PI / 2); // Rotate to align from front to back
        const fuselageMaterial = new THREE.MeshPhongMaterial({ color: 0x3366cc });
        const fuselage = new THREE.Mesh(fuselageGeometry, fuselageMaterial);
        this.mesh.add(fuselage);
        
        // Cockpit - glass dome
        const cockpitGeometry = new THREE.SphereGeometry(0.5, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2);
        cockpitGeometry.rotateX(Math.PI);
        cockpitGeometry.scale(1.0, 0.7, 1.2);
        const cockpitMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x8888ff, 
            transparent: true,
            opacity: 0.6,
            shininess: 100 
        });
        const cockpit = new THREE.Mesh(cockpitGeometry, cockpitMaterial);
        cockpit.position.set(0, 0.3, 0.5);
        this.mesh.add(cockpit);
        
        // Wings
        const wingGeometry = new THREE.BoxGeometry(5, 0.1, 1);
        const wingMaterial = new THREE.MeshPhongMaterial({ color: 0x3366cc });
        const wings = new THREE.Mesh(wingGeometry, wingMaterial);
        wings.position.set(0, 0, 0);
        this.mesh.add(wings);
        
        // Tail
        const tailGeometry = new THREE.BoxGeometry(1.5, 0.1, 0.75);
        const tailMaterial = new THREE.MeshPhongMaterial({ color: 0x3366cc });
        const tail = new THREE.Mesh(tailGeometry, tailMaterial);
        tail.position.set(0, 0.2, -1.5);
        this.mesh.add(tail);
        
        // Vertical stabilizer
        const stabilizerGeometry = new THREE.BoxGeometry(0.1, 0.7, 0.75);
        const stabilizerMaterial = new THREE.MeshPhongMaterial({ color: 0x3366cc });
        const stabilizer = new THREE.Mesh(stabilizerGeometry, stabilizerMaterial);
        stabilizer.position.set(0, 0.5, -1.5);
        this.mesh.add(stabilizer);
        
        // Front propeller
        const propellerGeometry = new THREE.BoxGeometry(1, 0.1, 0.05);
        const propellerMaterial = new THREE.MeshPhongMaterial({ color: 0x111111 });
        this.propeller = new THREE.Mesh(propellerGeometry, propellerMaterial);
        this.propeller.position.set(0, 0, 1.8);
        this.mesh.add(this.propeller);
        
        // Add gun mounts to wings
        const gunMountLeftGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8);
        gunMountLeftGeometry.rotateX(Math.PI / 2);
        const gunMountMaterial = new THREE.MeshPhongMaterial({ color: 0x111111 });
        
        // Left gun mount
        const gunMountLeft = new THREE.Mesh(gunMountLeftGeometry, gunMountMaterial);
        gunMountLeft.position.set(-2, -0.1, 0.4);
        this.mesh.add(gunMountLeft);
        
        // Right gun mount
        const gunMountRight = new THREE.Mesh(gunMountLeftGeometry, gunMountMaterial);
        gunMountRight.position.set(2, -0.1, 0.4);
        this.mesh.add(gunMountRight);
        
        console.log("Creating pig driver");
        // Add pig driver
        try {
            this.createPigDriver();
        } catch (error) {
            console.error("Error creating pig driver:", error);
        }
        
        // Position the plane
        this.mesh.position.copy(this.position);
        this.mesh.rotation.copy(this.rotation);
        
        // Add to scene
        this.game.scene.add(this.mesh);
        console.log("Player mesh added to scene");
    }
    
    // Simple control handling
    handleKeyDown(event) {
        switch(event.key) {
            case 'w': this.controls.throttle = true; break;
            case 's': this.controls.brake = true; break;
            case 'a': 
            case 'ArrowLeft': this.controls.left = true; break;
            case 'd':
            case 'ArrowRight': this.controls.right = true; break;
            case 'ArrowUp': this.controls.up = true; break;
            case 'ArrowDown': this.controls.down = true; break;
            case ' ': this.controls.shoot = true; break;
        }
    }
    
    handleKeyUp(event) {
        switch(event.key) {
            case 'w': this.controls.throttle = false; break;
            case 's': this.controls.brake = false; break;
            case 'a':
            case 'ArrowLeft': this.controls.left = false; break;
            case 'd':
            case 'ArrowRight': this.controls.right = false; break;
            case 'ArrowUp': this.controls.up = false; break;
            case 'ArrowDown': this.controls.down = false; break;
            case ' ': this.controls.shoot = false; break;
        }
    }
    
    update(delta) {
        // Reset acceleration
        this.acceleration.set(0, 0, 0);
        
        // Handle throttle control - no fuel dependency
        if (this.controls.throttle) {
            // Always allow throttle to increase
            this.throttle = Math.min(1, this.throttle + delta * 2.0);
        } else if (this.controls.brake) {
            // Braking always works
            this.throttle = Math.max(0, this.throttle - delta * 2.0);
        }
        
        // Calculate forward direction
        const forward = new THREE.Vector3(0, 0, 1);
        forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rotation.y);
        
        // Calculate pitch-adjusted forward direction
        const pitchAxis = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rotation.y);
        forward.applyAxisAngle(pitchAxis, this.rotation.x);
        forward.normalize();
        
        // Add lift based on current pitch and throttle
        if (this.throttle > 0.1) {
            // Base lift to counteract gravity when flying level
            const baseLift = new THREE.Vector3(0, 1, 0).multiplyScalar(9.81 * 0.7 * delta); // Matches reduced gravity
            this.acceleration.add(baseLift);
            
            // Additional lift from pitch
            const pitchEffect = -this.rotation.x * 3.0; // Negative because pitch up is negative in our system
            const pitchLift = new THREE.Vector3(0, pitchEffect * this.throttle * 20 * delta, 0);
            this.acceleration.add(pitchLift);
        }
        
        // Add forward thrust
        const thrustForce = forward.clone().multiplyScalar(this.throttle * this.thrustPower * delta);
        this.acceleration.add(thrustForce);
        
        // Apply reduced gravity
        const gravityForce = this.gravity.clone().multiplyScalar(delta * 0.7); // Reduced gravity
        this.acceleration.add(gravityForce);
        
        // Apply minimal drag
        const dragForce = this.velocity.clone().normalize().multiplyScalar(-this.drag * this.velocity.lengthSq());
        this.acceleration.add(dragForce);
        
        // Update speed
        this.speed = this.velocity.length();
        
        // Mark as flying
        if (this.throttle > 0.5) {
            this.isGrounded = false;
        }
        
        // Update velocity
        this.velocity.add(this.acceleration);
        
        // Limit max speed
        if (this.velocity.length() > this.maxSpeed) {
            this.velocity.normalize().multiplyScalar(this.maxSpeed);
        }
        
        // Ground collision
        if (this.position.y < 1.0 && this.velocity.y < 0) {
            this.position.y = 1.0;
            this.velocity.y = 0;
            this.isGrounded = true;
            
            // Ground friction
            this.velocity.x *= 0.95;
            this.velocity.z *= 0.95;
        }
        
        // Update position
        this.position.add(this.velocity.clone().multiplyScalar(delta));
        
        // Handle rotation - each axis independently
        this.updateRotation(delta);
        
        // Apply position to mesh
        this.mesh.position.copy(this.position);
        
        // Apply quaternion rotation to mesh
        const yawQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.rotation.y);
        const pitchQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.rotation.x * 0.7);
        
        // Enhanced roll with limit
        const maxVisualRoll = Math.PI / 2; // 90 degrees
        const enhancedRoll = this.rotation.z * 1.4; // Stronger roll effect (140%)
        const clampedRoll = Math.max(Math.min(enhancedRoll, maxVisualRoll), -maxVisualRoll);
        const rollQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -clampedRoll);
        
        // Create final rotation in YXZ order
        const finalRotation = new THREE.Quaternion();
        finalRotation.multiplyQuaternions(yawQ, pitchQ);
        finalRotation.multiplyQuaternions(finalRotation, rollQ);
        
        // Apply quaternion to mesh
        this.mesh.quaternion.copy(finalRotation);
        
        // Rotate propeller based on throttle
        if (this.propeller) {
            const propellerSpeed = delta * 15 * (0.5 + this.throttle * 5);
            this.propeller.rotation.x += propellerSpeed;
        }
        
        // Handle shooting
        if (this.controls.shoot) {
            this.shoot();
        }
        
        // Update bullets
        this.updateBullets(delta);
        
        // Update HUD
        this.updateHUD();
    }
    
    // Handle rotation
    updateRotation(delta) {
        const rotationSpeed = delta * 2.0;
        
        // PITCH: Handle pitch with equal response up and down
        if (this.controls.up) {
            this.rotation.x = Math.max(
                this.rotation.x - this.pitchRate * rotationSpeed,
                -this.maxPitch
            );
        }
        if (this.controls.down) {
            this.rotation.x = Math.min(
                this.rotation.x + this.pitchRate * rotationSpeed,
                this.maxPitch
            );
        }
        
        // Auto-stabilize pitch when no input
        if (!this.controls.up && !this.controls.down) {
            this.rotation.x *= 0.95;
        }
        
        // ROLL and YAW: Handle together for coordinated turns
        if (this.controls.left || this.controls.right) {
            const direction = this.controls.left ? 1 : -1;
            
            // Apply roll (Z rotation) - REDUCED ROLL AMOUNT FOR BETTER VISUALS
            const targetRoll = direction * this.maxRoll * 0.6; // Only use 60% of max roll
            const rollDelta = rotationSpeed * this.rollRate * 0.7; // Slower roll rate
            this.rotation.z = THREE.MathUtils.lerp(
                this.rotation.z,
                targetRoll,
                rollDelta
            );
            
            // Add yaw (Y rotation) only if we have enough speed
            if (this.speed > this.minSpeed) {
                // Calculate yaw amount, proportional to speed but with a maximum value
                const yawAmount = Math.min(
                    rotationSpeed * this.yawRate,
                    Math.PI / 8 * delta // Limit yaw change per frame
                );
                
                // Apply yaw - allow full 360 degree turning
                this.rotation.y += direction * yawAmount;
            }
        } else {
            // Auto-level roll when no input - IMPROVED STABILITY
            this.rotation.z *= this.stabilizationRate * 0.9; // Faster auto-level
        }
        
        // Keep yaw angle between -PI and PI
        this.rotation.y = ((this.rotation.y + Math.PI) % (Math.PI * 2)) - Math.PI;
    }
    
    // Update HUD with player status
    updateHUD() {
        // HUD updates removed
    }
    
    // Acceleration and deceleration 
    accelerate() { }
    decelerate() { }
    turn(direction) { }
    pitch(direction) { }
    roll(direction) { }
    
    shoot() {
        const now = performance.now() / 1000;
        
        // Check cooldown
        if (now - this.lastShotTime < this.bulletCooldown) {
            return;
        }
        
        // Play shooting sound
        if (this.shootSound && this.shootSound.isPlaying) {
            this.shootSound.stop();
        }
        if (this.shootSound && this.shootSound.buffer) {
            this.shootSound.play();
        }
        
        // Get the front center position of the plane
        const frontPosition = new THREE.Vector3(0, 0, 2); // Position at the front of the plane
        
        // Get forward direction
        const forward = new THREE.Vector3(0, 0, 1);
        forward.applyQuaternion(this.mesh.quaternion);
        forward.normalize();
        
        // Convert local front position to world position
        frontPosition.applyMatrix4(this.mesh.matrixWorld);
        
        // Create fixed-size bullet with correct orientation
        const bulletLength = 1.8; // Increased length for better visibility with smaller diameter
        const bulletRadius = 0.1; // Reduced from 0.2 to 0.1 for thinner bullets
        const bulletGeometry = new THREE.CylinderGeometry(bulletRadius, bulletRadius, bulletLength, 8);
        const bulletMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xffff00, // Bright yellow
            metalness: 0.6,
            roughness: 0.3,
            emissive: 0xffff00,
            emissiveIntensity: 0.6 // Increased for better visibility with smaller diameter
        });
        
        // Create and position the bullet
        const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
        bullet.position.copy(frontPosition);
        this.game.scene.add(bullet);
        
        // Align bullet with the direction of travel
        const upVector = new THREE.Vector3(0, 1, 0);
        bullet.quaternion.setFromUnitVectors(upVector, forward);
        
        // Calculate proper velocity based on forward direction and fixed bullet speed
        const bulletVelocity = forward.clone().multiplyScalar(this.bulletSpeed);
        
        // Add bullet to tracking array with fixed scale
        this.bullets.push({
            mesh: bullet,
            velocity: bulletVelocity,
            createdAt: now,
            originalScale: new THREE.Vector3(1, 1, 1), // Store original scale
            direction: forward.clone() // Store original direction
        });
        
        // Set last shot time
        this.lastShotTime = now;
    }
    
    updateBullets(delta) {
        // Update bullet positions with optimized code
        for (let i = 0; i < this.bullets.length; i++) {
            const bullet = this.bullets[i];
            if (!bullet.mesh) continue;
            
            // Use direct position update instead of creating a new vector each time
            bullet.mesh.position.x += bullet.velocity.x * delta;
            bullet.mesh.position.y += bullet.velocity.y * delta;
            bullet.mesh.position.z += bullet.velocity.z * delta;
            
            // Ensure bullet maintains its original scale
            if (bullet.originalScale) {
                bullet.mesh.scale.copy(bullet.originalScale);
            }
            
            // Ensure bullet maintains its original direction
            if (bullet.direction) {
                const upVector = new THREE.Vector3(0, 1, 0);
                bullet.mesh.quaternion.setFromUnitVectors(upVector, bullet.direction);
            }
            
            // Check if bullet is near world boundary
            if (this.game.worldRadius) {
                const bulletPos = bullet.mesh.position;
                const distanceFromCenter = Math.sqrt(bulletPos.x * bulletPos.x + bulletPos.z * bulletPos.z);
                
                // If bullet is beyond world boundary, remove it
                if (distanceFromCenter > this.game.worldRadius) {
                    this.game.scene.remove(bullet.mesh);
                    this.bullets.splice(i, 1);
                    i--; // Adjust index since we removed an item
                    continue;
                }
            }
        }
        
        // Remove bullets that are too old
        const now = performance.now() / 1000;
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            if (!bullet.mesh) continue;
            
            // Clean up bullets after 3 seconds (reduced from 5 for better performance)
            const age = now - bullet.createdAt;
            
            if (age > 3) {
                // Remove directly without fading for better performance
                this.game.scene.remove(bullet.mesh);
                this.bullets.splice(i, 1);
            }
        }
        
        // Limit maximum number of bullets for performance
        const MAX_BULLETS = 20; // Reduced from 30 for better performance
        if (this.bullets.length > MAX_BULLETS) {
            // Remove oldest bullets if we have too many
            const bulletsToRemove = this.bullets.length - MAX_BULLETS;
            for (let i = 0; i < bulletsToRemove; i++) {
                if (this.bullets[i] && this.bullets[i].mesh) {
                    this.game.scene.remove(this.bullets[i].mesh);
                }
            }
            this.bullets.splice(0, bulletsToRemove);
        }
    }
    
    damage(amount) {
        // No longer needed
    }
    
    applyForce(force) {
        // Add the force to the player's acceleration
        if (force && force instanceof THREE.Vector3) {
            this.acceleration.add(force);
        }
    }
    
    createPigDriver() {
        // Create pig group
        const pigGroup = new THREE.Group();
        
        // Pig body - pink sphere - BIGGER
        const bodyGeometry = new THREE.SphereGeometry(0.4, 12, 12);
        const pigMaterial = new THREE.MeshPhongMaterial({ 
            color: 0xffcccc, // Light pink
            shininess: 100,  // Make pig shinier
            emissive: 0x331111, // Slight emissive glow
            emissiveIntensity: 0.2
        });
        const body = new THREE.Mesh(bodyGeometry, pigMaterial);
        pigGroup.add(body);
        
        // Pig head - larger pink sphere - BIGGER
        const headGeometry = new THREE.SphereGeometry(0.35, 12, 12);
        const head = new THREE.Mesh(headGeometry, pigMaterial);
        head.position.set(0, 0.35, 0.15);
        pigGroup.add(head);
        
        // Pig snout - BIGGER and more defined
        const snoutGeometry = new THREE.CylinderGeometry(0.15, 0.15, 0.15, 12);
        snoutGeometry.rotateX(Math.PI / 2);
        const snoutMaterial = new THREE.MeshPhongMaterial({ color: 0xff9999, shininess: 100 }); // Darker pink
        const snout = new THREE.Mesh(snoutGeometry, snoutMaterial);
        snout.position.set(0, 0.3, 0.5);
        pigGroup.add(snout);
        
        // Snout nostrils - NEW
        const nostrilGeometry = new THREE.SphereGeometry(0.04, 8, 8);
        const nostrilMaterial = new THREE.MeshPhongMaterial({ color: 0x990000 });
        
        // Left nostril
        const leftNostril = new THREE.Mesh(nostrilGeometry, nostrilMaterial);
        leftNostril.position.set(-0.05, 0.3, 0.6);
        pigGroup.add(leftNostril);
        
        // Right nostril
        const rightNostril = new THREE.Mesh(nostrilGeometry, nostrilMaterial);
        rightNostril.position.set(0.05, 0.3, 0.6);
        pigGroup.add(rightNostril);
        
        // Pig ears - ULTRA prominent, extra tall and more pointy
        const earMaterial = new THREE.MeshPhongMaterial({ 
            color: 0xff9999, // Slightly darker than body for contrast
            shininess: 100,
            emissive: 0x331111,
            emissiveIntensity: 0.3
        });
        
        const earGeometry = new THREE.ConeGeometry(0.1, 0.5, 4); // Even taller and thinner ears
        earGeometry.rotateX(-Math.PI / 6); // Even less tilt for more upright ears
        
        // Left ear - positioned much higher and more visible
        const leftEar = new THREE.Mesh(earGeometry, earMaterial);
        leftEar.position.set(-0.2, 0.7, -0.05); // Higher position and slightly back
        leftEar.rotation.z = -Math.PI / 12; // More straight up
        pigGroup.add(leftEar);
        
        // Right ear - positioned much higher and more visible
        const rightEar = new THREE.Mesh(earGeometry, earMaterial);
        rightEar.position.set(0.2, 0.7, -0.05); // Higher position and slightly back
        rightEar.rotation.z = Math.PI / 12; // More straight up
        pigGroup.add(rightEar);
        
        // Pig eyes (two small dark spheres) - BIGGER
        const eyeGeometry = new THREE.SphereGeometry(0.08, 10, 10);
        const eyeMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x000000, 
            shininess: 150,
            emissive: 0x222222
        });
        
        // Left eye
        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(-0.15, 0.4, 0.4);
        pigGroup.add(leftEye);
        
        // Right eye
        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(0.15, 0.4, 0.4);
        pigGroup.add(rightEye);
        
        // Add white highlights to eyes - NEW
        const highlightGeometry = new THREE.SphereGeometry(0.02, 6, 6);
        const highlightMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
        
        // Left eye highlight
        const leftHighlight = new THREE.Mesh(highlightGeometry, highlightMaterial);
        leftHighlight.position.set(-0.12, 0.42, 0.45);
        pigGroup.add(leftHighlight);
        
        // Right eye highlight
        const rightHighlight = new THREE.Mesh(highlightGeometry, highlightMaterial);
        rightHighlight.position.set(0.12, 0.42, 0.45);
        pigGroup.add(rightHighlight);
        
        // Add pilot cap - NEW
        const capGeometry = new THREE.SphereGeometry(0.37, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2);
        capGeometry.rotateX(Math.PI);
        const capMaterial = new THREE.MeshPhongMaterial({ color: 0x8B4513, shininess: 50 }); // Brown leather
        const cap = new THREE.Mesh(capGeometry, capMaterial);
        cap.position.set(0, 0.45, 0.05);
        cap.scale.set(1, 0.5, 1);
        pigGroup.add(cap);
        
        // Add goggles - NEW
        const gogglesGeometry = new THREE.TorusGeometry(0.1, 0.03, 8, 20);
        const gogglesMaterial = new THREE.MeshPhongMaterial({ color: 0x555555, shininess: 100 });
        
        // Left goggle
        const leftGoggle = new THREE.Mesh(gogglesGeometry, gogglesMaterial);
        leftGoggle.position.set(-0.15, 0.4, 0.4);
        leftGoggle.rotation.y = Math.PI / 2;
        pigGroup.add(leftGoggle);
        
        // Right goggle
        const rightGoggle = new THREE.Mesh(gogglesGeometry, gogglesMaterial);
        rightGoggle.position.set(0.15, 0.4, 0.4);
        rightGoggle.rotation.y = Math.PI / 2;
        pigGroup.add(rightGoggle);
        
        // Add goggles strap
        const strapGeometry = new THREE.BoxGeometry(0.38, 0.02, 0.01);
        const strapMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const strap = new THREE.Mesh(strapGeometry, strapMaterial);
        strap.position.set(0, 0.4, 0.4);
        pigGroup.add(strap);
        
        // Position the pig in the cockpit - more forward facing
        pigGroup.position.set(0, 0.1, 0.6); // Moved forward
        pigGroup.rotation.x = -Math.PI / 10; // More upright
        
        // Make the pig slightly larger overall
        pigGroup.scale.set(1.2, 1.2, 1.2);
        
        // Add pig to the plane
        this.mesh.add(pigGroup);
        this.pigDriver = pigGroup;
    }
    
    dispose() {
        if (this.mesh) {
            this.game.scene.remove(this.mesh);
        }
        
        for (const bullet of this.bullets) {
            this.game.scene.remove(bullet.mesh);
        }
        
        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('keyup', this.handleKeyUp);
    }
}
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import * as CANNON from 'cannon-es';

export class Player {
    constructor(game) {
        console.log("Creating player instance");
        this.game = game;
        this.position = new THREE.Vector3(0, 1.0, 0);
        this.rotation = new THREE.Euler(0, 0, 0);
        this.health = 100;
        this.speed = 0;
        this.maxSpeed = 50 / 3.6; // 50 km/h
        this.minSpeed = 5;
        this.throttle = 0;
        this.fuel = 100;
        this.isGrounded = true;
        
        // Flying physics
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.acceleration = new THREE.Vector3(0, 0, 0);
        this.gravity = new THREE.Vector3(0, -9.81, 0);
        this.drag = 0.002;
        this.lift = 1.2;
        this.thrustPower = 50;
        
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
        this.bulletSpeed = 50;
        this.bulletCooldown = 0.2; // seconds between shots
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
            case 'ArrowLeft': this.controls.left = true; break;
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
            case 'ArrowLeft': this.controls.left = false; break;
            case 'ArrowRight': this.controls.right = false; break;
            case 'ArrowUp': this.controls.up = false; break;
            case 'ArrowDown': this.controls.down = false; break;
            case ' ': this.controls.shoot = false; break;
        }
    }
    
    update(delta) {
        // Update bullet positions
        this.updateBullets(delta);
        
        // Handle controls
        if (this.controls.throttle) {
            this.throttle = Math.min(1.0, this.throttle + 0.01);
        } else {
            this.throttle = Math.max(0.0, this.throttle - 0.01);
        }
        
        // Apply throttle to speed
        const targetSpeed = this.throttle * this.maxSpeed;
        this.speed = THREE.MathUtils.lerp(this.speed, targetSpeed, 0.1);
        
        // Apply thrust along forward direction
        const forward = new THREE.Vector3(0, 0, 1);
        forward.applyQuaternion(this.mesh.quaternion);
        forward.normalize();
        
        // Apply velocity in forward direction
        this.velocity.copy(forward).multiplyScalar(this.speed);
        
        // Adjust pitch based on controls
        if (this.controls.up) {
            this.mesh.rotation.x -= this.pitchRate * delta;
        } else if (this.controls.down) {
            this.mesh.rotation.x += this.pitchRate * delta;
        }
        
        // Adjust roll based on controls
        if (this.controls.left) {
            this.mesh.rotation.z += this.rollRate * delta;
        } else if (this.controls.right) {
            this.mesh.rotation.z -= this.rollRate * delta;
        }
        
        // Auto-stabilize when no roll inputs
        if (!this.controls.left && !this.controls.right) {
            this.mesh.rotation.z *= 0.95;
        }
        
        // Apply movement
        this.mesh.position.add(this.velocity.clone().multiplyScalar(delta));
        this.position.copy(this.mesh.position);
        this.rotation.copy(this.mesh.rotation);
        
        // Spin propeller based on throttle
        if (this.propeller) {
            this.propeller.rotation.z += 10 * this.throttle * delta;
        }
        
        // Shoot if button pressed
        if (this.controls.shoot) {
            this.shoot();
        }
    }
    
    updateHUD(outOfFuel = false) {
        const hud = document.getElementById('hud');
        if (hud) {
            const speedKmh = Math.round(this.speed * 3.6);
            const altitude = Math.round(this.position.y);
            const throttlePercent = Math.round(this.throttle * 100);
            
            hud.innerHTML = `
                <div style="position: absolute; top: 20px; left: 20px; color: white; font-family: Arial; font-size: 16px; text-shadow: 2px 2px 2px black;">
                    <div>Speed: ${speedKmh} km/h</div>
                    <div>Altitude: ${altitude} m</div>
                    <div>Throttle: ${throttlePercent}%</div>
                    <div>Health: ${this.health}%</div>
                    ${this.isGrounded ? '<div style="color: #00ff00;">READY FOR TAKEOFF</div>' : ''}
                    
                    <div style="margin-top: 20px; font-weight: bold;">Flight Controls:</div>
                    <div>W/S: Throttle up/down</div>
                    <div>Arrow Keys: Control direction</div>
                </div>
            `;
        }
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
        
        // Create a simple bullet
        const bulletGeometry = new THREE.SphereGeometry(0.15, 8, 8);
        const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        
        // Create bullet at plane's position
        const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
        bullet.position.copy(this.mesh.position);
        
        // Get forward direction
        const bulletDirection = new THREE.Vector3(0, 0, 1);
        bulletDirection.applyQuaternion(this.mesh.quaternion);
        
        // Set bullet properties
        bullet.velocity = bulletDirection.multiplyScalar(this.bulletSpeed);
        bullet.alive = true;
        bullet.createdAt = now;
        bullet.lifespan = 3; // seconds
        
        // Add to scene and bullets array
        this.game.scene.add(bullet);
        this.bullets.push(bullet);
        
        // Update cooldown
        this.lastShotTime = now;
    }
    
    updateBullets(delta) {
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            
            // Move bullet
            bullet.position.add(bullet.velocity.clone().multiplyScalar(delta));
            
            // Check if bullet is too old
            const now = performance.now() / 1000;
            if (now - bullet.createdAt > bullet.lifespan) {
                this.game.scene.remove(bullet);
                this.bullets.splice(i, 1);
            }
        }
    }
    
    damage(amount) {
        this.health -= amount;
        
        if (this.health <= 0) {
            // TODO: Handle death
        }
    }
    
    createPigDriver() {
        // Create a simple pig
        const pigGroup = new THREE.Group();
        
        // Pig body - pink sphere
        const bodyGeometry = new THREE.SphereGeometry(0.3, 12, 12);
        const pigMaterial = new THREE.MeshBasicMaterial({ color: 0xffcccc });
        const body = new THREE.Mesh(bodyGeometry, pigMaterial);
        pigGroup.add(body);
        
        // Pig head - larger pink sphere
        const headGeometry = new THREE.SphereGeometry(0.25, 12, 12);
        const head = new THREE.Mesh(headGeometry, pigMaterial);
        head.position.set(0, 0.3, 0.1);
        pigGroup.add(head);
        
        // Pig snout
        const snoutGeometry = new THREE.BoxGeometry(0.2, 0.1, 0.1);
        const snoutMaterial = new THREE.MeshBasicMaterial({ color: 0xff9999 });
        const snout = new THREE.Mesh(snoutGeometry, snoutMaterial);
        snout.position.set(0, 0.25, 0.4);
        pigGroup.add(snout);
        
        // Pig ears - simple triangles
        const earGeometry = new THREE.ConeGeometry(0.1, 0.2, 4);
        const earMaterial = new THREE.MeshBasicMaterial({ color: 0xff9999 });
        
        // Left ear
        const leftEar = new THREE.Mesh(earGeometry, earMaterial);
        leftEar.position.set(-0.2, 0.5, 0);
        leftEar.rotation.z = -Math.PI / 6;
        pigGroup.add(leftEar);
        
        // Right ear
        const rightEar = new THREE.Mesh(earGeometry, earMaterial);
        rightEar.position.set(0.2, 0.5, 0);
        rightEar.rotation.z = Math.PI / 6;
        pigGroup.add(rightEar);
        
        // Pig eyes - simple black spheres
        const eyeGeometry = new THREE.SphereGeometry(0.05, 8, 8);
        const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
        
        // Left eye
        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(-0.1, 0.35, 0.3);
        pigGroup.add(leftEye);
        
        // Right eye
        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(0.1, 0.35, 0.3);
        pigGroup.add(rightEye);
        
        // Position in cockpit
        pigGroup.position.set(0, 0.1, 0.5);
        
        // Add to plane
        this.mesh.add(pigGroup);
        this.pigDriver = pigGroup;
    }
    
    dispose() {
        if (this.mesh) {
            this.game.scene.remove(this.mesh);
        }
        
        for (const bullet of this.bullets) {
            this.game.scene.remove(bullet);
        }
        
        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('keyup', this.handleKeyUp);
    }
}
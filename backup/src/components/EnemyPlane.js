import * as THREE from 'three';

export class EnemyPlane {
    constructor(game, position) {
        this.game = game;
        this.position = position.clone();
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.rotation = new THREE.Euler(0, Math.random() * Math.PI * 2, 0);
        this.health = 100;
        
        // Movement parameters - simplified for better performance
        this.speed = 8 + Math.random() * 4; // Slightly reduced max speed
        this.turnRate = 0.15 + Math.random() * 0.15; // Less erratic turning
        this.changeDirectionTime = 5 + Math.random() * 3; // More predictable changes
        this.lastDirectionChange = 0;
        this.targetDirection = new THREE.Vector3(
            Math.random() - 0.5,
            (Math.random() - 0.5) * 0.1, // Less vertical movement
            Math.random() - 0.5
        ).normalize();
        
        // Add runway radius constraint
        this.maxDistanceFromRunway = 200; // Maximum distance from the runway
        
        // Randomly select a color for this enemy plane
        this.planeColor = this.getRandomColor();
        
        this.createMesh();
    }
    
    getRandomColor() {
        // Array of possible enemy plane colors
        const colors = [
            0xcc0000, // Red
            0x00cc00, // Green
            0x0000cc, // Blue
            0xcccc00, // Yellow
            0xcc00cc, // Purple
            0x00cccc, // Cyan
            0xff6600  // Orange
        ];
        
        // Return a random color from the array
        return colors[Math.floor(Math.random() * colors.length)];
    }
    
    createMesh() {
        // Create enemy plane mesh
        this.mesh = new THREE.Group();
        
        // BIGGER: Apply an additional size multiplier (2.0 = 100% larger)
        const sizeMultiplier = 2.0;
        
        // Use lower poly geometries for better performance
        // Main body (fuselage) - cylindrical with tapering - 100% BIGGER
        const fuselageGeometry = new THREE.CylinderGeometry(0.75 * sizeMultiplier, 0.45 * sizeMultiplier, 4.5 * sizeMultiplier, 8);
        fuselageGeometry.rotateX(Math.PI / 2);
        const fuselageMaterial = new THREE.MeshPhongMaterial({ color: this.planeColor });
        const fuselage = new THREE.Mesh(fuselageGeometry, fuselageMaterial);
        this.mesh.add(fuselage);
        
        // Cockpit - 100% BIGGER with reduced segments
        const cockpitGeometry = new THREE.SphereGeometry(0.75 * sizeMultiplier, 6, 6, 0, Math.PI * 2, 0, Math.PI / 2);
        cockpitGeometry.rotateX(Math.PI);
        cockpitGeometry.scale(1.0, 0.7, 1.2);
        const cockpitMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x333333,
            transparent: true,
            opacity: 0.7
        });
        const cockpit = new THREE.Mesh(cockpitGeometry, cockpitMaterial);
        cockpit.position.set(0, 0.3 * sizeMultiplier, 0.75 * sizeMultiplier);
        this.mesh.add(cockpit);
        
        // Wings - 100% BIGGER but simpler
        const wingGeometry = new THREE.BoxGeometry(3.75 * sizeMultiplier, 0.15 * sizeMultiplier, 1.2 * sizeMultiplier);
        const wingMaterial = new THREE.MeshPhongMaterial({ color: this.planeColor });
        const wings = new THREE.Mesh(wingGeometry, wingMaterial);
        wings.position.set(0, 0, 0);
        this.mesh.add(wings);
        
        // Tail - 100% BIGGER
        const tailGeometry = new THREE.BoxGeometry(1.5 * sizeMultiplier, 0.15 * sizeMultiplier, 0.75 * sizeMultiplier);
        const tailMaterial = new THREE.MeshPhongMaterial({ color: this.planeColor });
        const tail = new THREE.Mesh(tailGeometry, tailMaterial);
        tail.position.set(0, 0, -1.8 * sizeMultiplier);
        this.mesh.add(tail);
        
        // Vertical stabilizer - 100% BIGGER
        const stabilizerGeometry = new THREE.BoxGeometry(0.15 * sizeMultiplier, 0.9 * sizeMultiplier, 1.05 * sizeMultiplier);
        const stabilizerMaterial = new THREE.MeshPhongMaterial({ color: this.planeColor });
        const stabilizer = new THREE.Mesh(stabilizerGeometry, stabilizerMaterial);
        stabilizer.position.set(0, 0.45 * sizeMultiplier, -1.8 * sizeMultiplier);
        this.mesh.add(stabilizer);
        
        // Front propeller - 100% BIGGER with fewer segments
        const propellerGeometry = new THREE.BoxGeometry(1.5 * sizeMultiplier, 0.15 * sizeMultiplier, 0.075 * sizeMultiplier);
        const propellerMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });
        this.propeller = new THREE.Mesh(propellerGeometry, propellerMaterial);
        this.propeller.position.set(0, 0, 2.4 * sizeMultiplier);
        this.mesh.add(this.propeller);
        
        // Position the entire plane
        this.mesh.position.copy(this.position);
        this.mesh.rotation.copy(this.rotation);
        
        // Add to scene
        this.game.scene.add(this.mesh);
    }
    
    update(delta) {
        // Update direction occasionally - simplified logic
        const now = performance.now() / 1000;
        if (now - this.lastDirectionChange > this.changeDirectionTime) {
            this.lastDirectionChange = now;
            
            // Update time before next change
            this.changeDirectionTime = 5 + Math.random() * 3;
            
            // Determine if we need to return to runway
            const distanceFromRunway = Math.sqrt(
                this.position.x * this.position.x + 
                this.position.z * this.position.z
            );
            
            if (distanceFromRunway > this.maxDistanceFromRunway * 0.8) {
                // Head back toward runway if getting too far away
                this.targetDirection.set(
                    -this.position.x / distanceFromRunway,
                    (30 - this.position.y) / 100, // Aim for moderate altitude
                    -this.position.z / distanceFromRunway
                ).normalize();
            } else {
                // Otherwise, choose a new random direction
                this.targetDirection.set(
                    Math.random() - 0.5,
                    (Math.random() - 0.5) * 0.1, // Minimal vertical change
                    Math.random() - 0.5
                ).normalize();
                
                // Avoid going too low or too high
                if (this.position.y < 20) {
                    this.targetDirection.y = Math.abs(this.targetDirection.y) * 0.5;
                } else if (this.position.y > 60) {
                    this.targetDirection.y = -Math.abs(this.targetDirection.y) * 0.5;
                }
            }
        }
        
        // Get current direction
        const currentDirection = new THREE.Vector3(0, 0, 1);
        currentDirection.applyEuler(this.rotation);
        
        // Simplify turning calculation - less costly
        const turnAmount = this.turnRate * delta;
        currentDirection.lerp(this.targetDirection, turnAmount);
        
        // Update rotation to face direction - efficient method
        this.rotation.y = Math.atan2(currentDirection.x, currentDirection.z);
        this.rotation.x = -Math.asin(currentDirection.y);
        
        // Move forward - direct calculation without creating new vectors
        this.velocity.x = currentDirection.x * this.speed;
        this.velocity.y = currentDirection.y * this.speed;
        this.velocity.z = currentDirection.z * this.speed;
        
        this.position.x += this.velocity.x * delta;
        this.position.y += this.velocity.y * delta;
        this.position.z += this.velocity.z * delta;
        
        // Keep a minimum altitude
        if (this.position.y < 15) {
            this.position.y = 15;
            this.targetDirection.y = Math.abs(this.targetDirection.y); // Force upward
        }
        
        // Update mesh position and rotation - direct update
        this.mesh.position.copy(this.position);
        this.mesh.rotation.copy(this.rotation);
        
        // Rotate propeller with optimized calculation
        if (this.propeller) {
            this.propeller.rotation.x += delta * 8; // Slightly slower for performance
        }
    }
    
    damage(amount) {
        this.health -= amount;
        
        // Simple visual feedback without creating new materials
        if (this.health > 0) {
            // Flash all materials white temporarily
            this.mesh.traverse(child => {
                if (child.isMesh && child.material) {
                    child.material._originalColor = child.material.color.clone();
                    child.material.color.set(0xffffff);
                }
            });
            
            // Reset after 100ms using a single timeout
            setTimeout(() => {
                this.mesh.traverse(child => {
                    if (child.isMesh && child.material && child.material._originalColor) {
                        child.material.color.copy(child.material._originalColor);
                        delete child.material._originalColor;
                    }
                });
            }, 100);
        }
    }
} 
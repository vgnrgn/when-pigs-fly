import * as THREE from 'three';

export class Bird {
    constructor(game, position) {
        this.game = game;
        this.position = position.clone();
        this.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 10,
            Math.random() * 5 + 5, // Initial upward velocity
            (Math.random() - 0.5) * 10
        );
        this.age = 0;
        
        // Random bird color
        const colors = [
            0x3399ff, // Blue
            0xff9933, // Orange
            0x33cc33, // Green
            0xffff66, // Yellow
            0xff6699  // Pink
        ];
        this.color = colors[Math.floor(Math.random() * colors.length)];
        
        this.createMesh();
    }
    
    createMesh() {
        // Create bird group
        this.mesh = new THREE.Group();
        
        // Bird body
        const bodyGeometry = new THREE.SphereGeometry(0.3, 8, 8);
        const bodyMaterial = new THREE.MeshPhongMaterial({ color: this.color });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        this.mesh.add(body);
        
        // Bird head
        const headGeometry = new THREE.SphereGeometry(0.2, 8, 8);
        const headMaterial = new THREE.MeshPhongMaterial({ color: this.color });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.set(0, 0, 0.3);
        this.mesh.add(head);
        
        // Bird beak
        const beakGeometry = new THREE.ConeGeometry(0.05, 0.2, 8);
        beakGeometry.rotateX(Math.PI / 2);
        const beakMaterial = new THREE.MeshPhongMaterial({ color: 0xffcc00 });
        const beak = new THREE.Mesh(beakGeometry, beakMaterial);
        beak.position.set(0, 0, 0.5);
        this.mesh.add(beak);
        
        // Bird wings - larger and more visible
        this.wingsGroup = new THREE.Group();
        this.mesh.add(this.wingsGroup);
        
        // Wing material
        const wingMaterial = new THREE.MeshPhongMaterial({ color: this.color });
        
        // Left wing - use custom geometry for better shape
        const leftWingShape = new THREE.Shape();
        leftWingShape.moveTo(0, 0);
        leftWingShape.lineTo(-0.8, 0);
        leftWingShape.lineTo(-1.0, -0.4);
        leftWingShape.lineTo(-0.6, -0.5);
        leftWingShape.lineTo(0, -0.2);
        leftWingShape.lineTo(0, 0);
        
        const leftWingGeometry = new THREE.ShapeGeometry(leftWingShape);
        this.leftWing = new THREE.Mesh(leftWingGeometry, wingMaterial);
        this.leftWing.position.set(-0.2, 0, 0);
        this.wingsGroup.add(this.leftWing);
        
        // Right wing - use custom geometry for better shape
        const rightWingShape = new THREE.Shape();
        rightWingShape.moveTo(0, 0);
        rightWingShape.lineTo(0.8, 0);
        rightWingShape.lineTo(1.0, -0.4);
        rightWingShape.lineTo(0.6, -0.5);
        rightWingShape.lineTo(0, -0.2);
        rightWingShape.lineTo(0, 0);
        
        const rightWingGeometry = new THREE.ShapeGeometry(rightWingShape);
        this.rightWing = new THREE.Mesh(rightWingGeometry, wingMaterial);
        this.rightWing.position.set(0.2, 0, 0);
        this.wingsGroup.add(this.rightWing);
        
        // Position bird
        this.mesh.position.copy(this.position);
        
        // Add to scene
        this.game.scene.add(this.mesh);
    }
    
    update(delta) {
        // Update age
        this.age += delta;
        
        // Apply gravity
        this.velocity.y -= 9.81 * delta * 0.5; // Half gravity for more floaty birds
        
        // Update position
        this.position.add(this.velocity.clone().multiplyScalar(delta));
        
        // Flap wings with more pronounced motion
        if (this.leftWing && this.rightWing) {
            const flapSpeed = 15;
            const baseFlapAmount = Math.sin(this.age * flapSpeed) * 0.8; // Increased amplitude
            
            // More dynamic flapping - different rotation axes for more natural motion
            if (baseFlapAmount > 0) {
                // Upstroke is faster
                const upFlapAmount = baseFlapAmount * 1.5;
                this.leftWing.rotation.z = -upFlapAmount;
                this.rightWing.rotation.z = upFlapAmount;
                
                // Add a bit of y-rotation during flap
                this.leftWing.rotation.y = -upFlapAmount * 0.3;
                this.rightWing.rotation.y = upFlapAmount * 0.3;
                
                // Animate wing shape during flapping - scale wings during upstroke
                const scaleY = 1 - upFlapAmount * 0.3;
                this.leftWing.scale.y = scaleY;
                this.rightWing.scale.y = scaleY;
            } else {
                // Downstroke is slower
                const downFlapAmount = baseFlapAmount;
                this.leftWing.rotation.z = -downFlapAmount;
                this.rightWing.rotation.z = downFlapAmount;
                
                // Reverse y-rotation during downstroke
                this.leftWing.rotation.y = -downFlapAmount * 0.1;
                this.rightWing.rotation.y = downFlapAmount * 0.1;
                
                // Reset wing scale on downstroke
                this.leftWing.scale.y = 1;
                this.rightWing.scale.y = 1;
            }
            
            // Slight body movement during flapping
            this.mesh.position.y += Math.sin(this.age * flapSpeed * 2) * 0.02;
        }
        
        // Update mesh position
        this.mesh.position.copy(this.position);
        
        // Point in direction of movement
        if (this.velocity.length() > 0.1) {
            const direction = this.velocity.clone().normalize();
            this.mesh.lookAt(this.mesh.position.clone().add(direction));
            
            // Adjust rotation to make bird face forward
            this.mesh.rotateY(Math.PI / 2);
        }
        
        // Bounce off ground
        if (this.position.y < 2) {
            this.position.y = 2;
            this.velocity.y = Math.abs(this.velocity.y) * 0.6; // Bounce with damping
        }
        
        // Random direction changes
        if (Math.random() < 0.01) {
            this.velocity.x += (Math.random() - 0.5) * 5;
            this.velocity.z += (Math.random() - 0.5) * 5;
            
            // Limit horizontal speed
            const horizontalSpeed = new THREE.Vector2(this.velocity.x, this.velocity.z).length();
            if (horizontalSpeed > 10) {
                this.velocity.x *= 10 / horizontalSpeed;
                this.velocity.z *= 10 / horizontalSpeed;
            }
        }
    }
} 
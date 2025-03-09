import * as THREE from 'three';

export class EnemyPlane {
    constructor(game, position) {
        this.game = game;
        this.position = position.clone();
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.rotation = new THREE.Euler(0, Math.random() * Math.PI * 2, 0);
        this.health = 150;
        
        // Movement parameters - more realistic
        this.speed = 8.32 + Math.random() * 6.24; // Decreased by 20% from previous value (10.4 + random * 7.8)
        this.turnRate = 0.2 + Math.random() * 0.3; // Reduced turn rate for more gradual turns
        this.changeDirectionTime = 3 + Math.random() * 4; // Longer time between direction changes
        this.lastDirectionChange = 0;
        this.targetDirection = new THREE.Vector3(
            Math.random() - 0.5,
            (Math.random() - 0.5) * 0.1, // Less vertical movement
            Math.random() - 0.5
        ).normalize();
        
        // Altitude limits
        this.minAltitude = 15;
        this.maxAltitude = 120;
        this.altitudeWarningThreshold = 110; // Start descending more aggressively when approaching max altitude
        
        // Boundary detection parameters
        this.boundaryDetectionRadius = this.game.worldRadius * 0.7; // Detect boundary at 70% of world radius
        this.nearBoundary = false;
        this.returningToCenter = false;
        
        // Add player targeting behavior
        this.targetingPlayer = Math.random() < 0.5; // 50% chance to target player (reduced from 80%)
        this.targetingTime = 0;
        this.maxTargetingTime = 5 + Math.random() * 5; // Target player for 5-10 seconds
        
        // Add behavior states for more dynamic movement
        this.behaviorState = this.getRandomBehaviorState();
        this.behaviorTimer = 0;
        this.behaviorDuration = 3 + Math.random() * 4; // Duration of current behavior
        
        // Add evasive maneuver parameters
        this.isEvading = false;
        this.evasionDirection = 1; // 1 or -1 for left/right
        this.evasionTimer = 0;
        this.evasionDuration = 0;
        
        // Add diving attack parameters
        this.isDiving = false;
        this.diveTimer = 0;
        this.diveDuration = 0;
        this.diveTarget = null;
        this.postDiveClimb = false;
        
        // Add barrel roll parameters
        this.isRolling = false;
        this.rollTimer = 0;
        this.rollDuration = 0;
        this.rollProgress = 0;
        
        // Add inertia for more realistic movement
        this.currentSpeed = this.speed * 0.5; // Start at half speed
        this.targetSpeed = this.speed;
        this.speedChangeRate = 0.5; // How quickly speed changes
        this.currentTurnRate = 0;
        this.maxTurnRate = this.turnRate;
        this.turnAcceleration = 0.1; // How quickly turning accelerates
        
        // Set plane color to military green
        this.planeColor = 0x4b5320; // Military green
        
        this.createMesh();
    }
    
    getRandomBehaviorState() {
        const states = [
            'patrol',      // Regular patrol pattern
            'aggressive',  // Aggressive pursuit
            'evasive',     // Evasive maneuvers
            'diving',      // Diving attacks
            'formation'    // Formation flying
        ];
        return states[Math.floor(Math.random() * states.length)];
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
        // Check distance from center (runway)
        const distanceFromCenter = Math.sqrt(
            this.position.x * this.position.x + 
            this.position.z * this.position.z
        );
        
        const worldRadius = this.game.worldRadius;
        
        // Handle boundary crossing - wrap around to the opposite side
        if (distanceFromCenter > worldRadius) {
            // Calculate angle from center
            const angle = Math.atan2(this.position.z, this.position.x);
            
            // Calculate new position on the opposite side of the map
            // Place at 20% of radius from center on the opposite side
            const newRadius = worldRadius * 0.2;
            
            // Set new position (opposite side of the map)
            this.position.x = -Math.cos(angle) * newRadius;
            this.position.z = -Math.sin(angle) * newRadius;
            
            // Reverse direction to face the opposite way
            this.targetDirection.x = -this.targetDirection.x;
            this.targetDirection.z = -this.targetDirection.z;
            this.targetDirection.normalize();
            
            // Reset any special states
            this.returningToCenter = false;
            this.isEvading = false;
            this.isDiving = false;
            this.isRolling = false;
            
            // Force update mesh position
            if (this.mesh) {
                this.mesh.position.copy(this.position);
            }
            
            // Recalculate distance after teleport
            const newDistanceFromCenter = Math.sqrt(
                this.position.x * this.position.x + 
                this.position.z * this.position.z
            );
            
            console.log(`Plane wrapped around boundary: ${distanceFromCenter.toFixed(2)} -> ${newDistanceFromCenter.toFixed(2)}`);
        }
        
        // Update direction occasionally
        const now = performance.now() / 1000;
        if (now - this.lastDirectionChange > this.changeDirectionTime) {
            this.lastDirectionChange = now;
            this.changeDirectionTime = 2 + Math.random() * 3; // 2-5 seconds between direction changes
            
            // Change direction randomly
            this.updateRandomDirection();
        }
        
        // Handle special maneuvers
        if (this.isEvading) {
            this.handleEvasiveManeuvers(delta);
        } else if (this.isDiving) {
            this.handleDivingAttack(delta);
        } else if (this.isRolling) {
            this.handleBarrelRoll(delta);
        }
        
        // Get current direction
        const currentDirection = new THREE.Vector3(0, 0, 1);
        currentDirection.applyEuler(this.rotation);
        
        // Apply turn with inertia
        const turnAmount = this.turnRate * delta;
        
        // Apply turn towards target direction
        if (!this.isRolling) { // Don't change direction during barrel roll
            // Calculate dot product to determine how aligned we are with target
            const dot = currentDirection.dot(this.targetDirection);
            
            // If we're not already aligned with target direction
            if (dot < 0.99) {
                // Calculate cross product to determine turn direction
                const cross = new THREE.Vector3().crossVectors(currentDirection, this.targetDirection);
                const turnDirection = Math.sign(cross.y);
                
                // Apply rotation around Y axis with inertia
                this.rotation.y += turnDirection * turnAmount;
                
                // Apply pitch based on target direction's Y component
                const pitchDiff = Math.asin(this.targetDirection.y) - Math.asin(currentDirection.y);
                this.rotation.x += pitchDiff * turnAmount * 0.7;
            }
        }
        
        // Recalculate current direction after rotation changes
        currentDirection.set(0, 0, 1);
        currentDirection.applyEuler(this.rotation);
        
        // Add roll effect based on turning
        const turnIntensity = new THREE.Vector3().crossVectors(
            currentDirection, this.targetDirection
        ).y;
        
        if (!this.isRolling) {
            // Add banking effect during turns
            const targetRoll = -turnIntensity * 0.6;
            // Interpolate current roll toward target roll
            this.rotation.z = this.rotation.z * 0.9 + targetRoll * 0.1;
        }
        
        // Calculate target speed
        let targetSpeed = this.speed;
        if (this.behaviorState === 'aggressive') {
            targetSpeed *= 1.2; // Faster when aggressive
        } else if (this.behaviorState === 'diving' && this.isDiving) {
            targetSpeed *= 1.3; // Faster when diving
        } else if (this.behaviorState === 'evasive' && this.isEvading) {
            targetSpeed *= 1.1; // Slightly faster when evading
        } else if (this.behaviorState === 'patrol') {
            targetSpeed *= 0.9; // Slower when patrolling
        }
        
        // Gradually adjust current speed toward target speed
        if (this.currentSpeed < targetSpeed) {
            this.currentSpeed = Math.min(targetSpeed, this.currentSpeed + this.speedChangeRate * delta);
        } else if (this.currentSpeed > targetSpeed) {
            this.currentSpeed = Math.max(targetSpeed, this.currentSpeed - this.speedChangeRate * delta);
        }
        
        // Move forward with current speed
        this.velocity.x = currentDirection.x * this.currentSpeed;
        this.velocity.y = currentDirection.y * this.currentSpeed;
        this.velocity.z = currentDirection.z * this.currentSpeed;
        
        this.position.x += this.velocity.x * delta;
        this.position.y += this.velocity.y * delta;
        this.position.z += this.velocity.z * delta;
        
        // Keep a minimum altitude except during diving attacks
        if (this.position.y < this.minAltitude && !this.isDiving) {
            this.position.y = this.minAltitude;
            this.targetDirection.y = Math.abs(this.targetDirection.y) * 0.5; // Force upward
        }
        
        // Enforce maximum altitude
        if (this.position.y > this.maxAltitude) {
            this.position.y = this.maxAltitude;
            this.targetDirection.y = -Math.abs(this.targetDirection.y) * 0.5; // Force downward
        }
        
        // When approaching max altitude, start descending
        if (this.position.y > this.altitudeWarningThreshold && !this.isDiving) {
            // Calculate how close we are to the max altitude (0-1 range)
            const altitudeRatio = (this.position.y - this.altitudeWarningThreshold) / 
                                  (this.maxAltitude - this.altitudeWarningThreshold);
            
            // Gradually increase downward force as we approach max altitude
            const downwardForce = -0.2 - (altitudeRatio * 0.3);
            this.targetDirection.y = Math.min(this.targetDirection.y, downwardForce);
        }
        
        // Update mesh position and rotation
        this.mesh.position.copy(this.position);
        this.mesh.rotation.copy(this.rotation);
        
        // Rotate propeller
        if (this.propeller) {
            this.propeller.rotation.x += delta * 15;
        }
        
        // Random chance to start special maneuvers
        if (!this.isEvading && !this.isDiving && !this.isRolling && Math.random() < 0.01) {
            this.startSpecialManeuver();
        }
    }
    
    updateDirection(delta) {
        // Update direction occasionally
        const now = performance.now() / 1000;
        if (now - this.lastDirectionChange > this.changeDirectionTime) {
            this.lastDirectionChange = now;
            
            // Update time before next change - varies by behavior
            if (this.behaviorState === 'aggressive') {
                this.changeDirectionTime = 1 + Math.random() * 2; // More frequent changes
            } else if (this.behaviorState === 'evasive') {
                this.changeDirectionTime = 0.5 + Math.random() * 1; // Very frequent changes
            } else {
                this.changeDirectionTime = 2 + Math.random() * 3; // Normal frequency
            }
            
            // Calculate distance from runway (center)
            const distanceFromRunway = Math.sqrt(
                this.position.x * this.position.x + 
                this.position.z * this.position.z
            );
            
            // Check if we need to return to runway area - start turning back earlier
            if (distanceFromRunway > this.boundaryDetectionRadius * 0.6) { // Changed from 0.7 to 0.6
                // Head back toward runway if getting too far away
                this.returningToCenter = true;
                
                // Add slight randomness to return path to avoid all planes following the exact same path
                const randomOffset = 0.1;
                const offsetX = (Math.random() - 0.5) * randomOffset;
                const offsetZ = (Math.random() - 0.5) * randomOffset;
                
                this.targetDirection.set(
                    -this.position.x / distanceFromRunway + offsetX,
                    (30 - this.position.y) / 100, // Aim for moderate altitude
                    -this.position.z / distanceFromRunway + offsetZ
                ).normalize();
                
                // Stop special maneuvers when returning to runway
                this.isEvading = false;
                this.isDiving = false;
                this.isRolling = false;
                
                // Increase speed to return faster - proportional to distance
                const distanceFactor = Math.min(1, (distanceFromRunway - this.boundaryDetectionRadius * 0.6) / 
                                              (this.boundaryDetectionRadius * 0.3));
                this.targetSpeed = this.speed * (0.904 + distanceFactor * 0.312); // Decreased by 20% from previous value (1.13 + distanceFactor * 0.39)
                
                // Don't completely stop targeting player
                if (Math.random() < 0.3) {
                    this.targetingPlayer = false;
                }
            } else {
                // If we were returning and now we're back in range, reset
                if (this.returningToCenter) {
                    this.returningToCenter = false;
                    this.targetSpeed = this.speed;
                }
                
                // Normal behavior selection
                if (this.behaviorState === 'formation' && this.inFormation) {
                    this.updateFormationFlying();
                } else if (this.targetingPlayer && this.game.player) {
                    this.updatePlayerTargeting();
                } else {
                    this.updateRandomDirection();
                }
            }
        }
    }
    
    updatePlayerTargeting() {
        // Target the player with behavior variations
        const toPlayer = new THREE.Vector3().subVectors(this.game.player.position, this.position);
        const distanceToPlayer = toPlayer.length();
        toPlayer.normalize();
        
        // Add randomness based on behavior
        if (this.behaviorState === 'aggressive') {
            // More direct targeting with less randomness
            toPlayer.x += (Math.random() - 0.5) * 0.1;
            toPlayer.z += (Math.random() - 0.5) * 0.1;
        } else if (this.behaviorState === 'evasive') {
            // More randomness when evasive
            toPlayer.x += (Math.random() - 0.5) * 0.4;
            toPlayer.z += (Math.random() - 0.5) * 0.4;
            
            // Sometimes fly perpendicular to player
            if (Math.random() < 0.3) {
                const perpendicular = new THREE.Vector3(toPlayer.z, 0, -toPlayer.x);
                if (Math.random() < 0.5) perpendicular.negate();
                toPlayer.lerp(perpendicular, 0.7);
            }
        } else {
            // Standard randomness
            toPlayer.x += (Math.random() - 0.5) * 0.2;
            toPlayer.z += (Math.random() - 0.5) * 0.2;
        }
        
        toPlayer.normalize();
        
        // Set vertical component based on behavior
        const heightDiff = this.game.player.position.y - this.position.y;
        
        // Check if player is above our max altitude
        const playerTooHigh = this.game.player.position.y > this.maxAltitude;
        
        // Check if we're approaching max altitude
        const approachingMaxAltitude = this.position.y > this.altitudeWarningThreshold;
        
        if (playerTooHigh) {
            // If player is above our max altitude, don't follow them up
            // Instead, fly horizontally or slightly downward
            toPlayer.y = -0.1;
        } else if (approachingMaxAltitude) {
            // If we're near max altitude, prioritize staying below the limit
            const altitudeRatio = (this.position.y - this.altitudeWarningThreshold) / 
                                 (this.maxAltitude - this.altitudeWarningThreshold);
            
            // Force downward direction based on how close we are to max altitude
            toPlayer.y = -0.2 - (altitudeRatio * 0.3);
        } else if (this.behaviorState === 'aggressive' && distanceToPlayer < 100 && Math.random() < 0.3) {
            // Occasionally dive at player when close and aggressive
            toPlayer.y = heightDiff / 50 - 0.2; // Steeper approach
            
            // Start a diving attack with 30% chance
            if (Math.random() < 0.3) {
                this.startDivingAttack();
            }
        } else if (this.behaviorState === 'patrol') {
            // Patrol tends to stay at higher altitude, but respect max altitude
            const targetY = heightDiff / 100 + 0.05;
            
            // If this would take us too high, adjust downward
            if (this.position.y + targetY * 50 > this.altitudeWarningThreshold) {
                toPlayer.y = Math.min(targetY, 0);
            } else {
                toPlayer.y = targetY;
            }
        } else {
            // Standard height adjustment
            toPlayer.y = heightDiff / 80;
            
            // Ensure we don't target above max altitude
            if (this.position.y + toPlayer.y * 50 > this.altitudeWarningThreshold) {
                toPlayer.y = Math.min(toPlayer.y, 0);
            }
        }
        
        this.targetDirection.copy(toPlayer);
    }
    
    updateRandomDirection() {
        // Simple random direction
        let newDirection = new THREE.Vector3(
            Math.random() - 0.5,
            (Math.random() - 0.5) * 0.1, // Small random vertical component
            Math.random() - 0.5
        );
        
        // Normalize the direction
        newDirection.normalize();
        
        // Set as target direction
        this.targetDirection.copy(newDirection);
        
        // Avoid going too low or too high
        if (this.position.y < this.minAltitude + 5) {
            // Force upward direction when close to minimum altitude
            this.targetDirection.y = Math.abs(this.targetDirection.y) * 0.5;
        } else if (this.position.y > this.altitudeWarningThreshold) {
            // Force downward direction when close to maximum altitude
            // More aggressive descent the closer we are to max altitude
            const altitudeRatio = (this.position.y - this.altitudeWarningThreshold) / 
                                 (this.maxAltitude - this.altitudeWarningThreshold);
            const descentFactor = 0.5 + (altitudeRatio * 0.5); // 0.5 to 1.0 based on altitude
            this.targetDirection.y = -Math.abs(this.targetDirection.y) * descentFactor;
        }
    }
    
    updateFormationFlying() {
        // Find a formation leader if we don't have one
        if (!this.formationLeader) {
            // Find another enemy plane to follow
            for (const enemy of this.game.enemies) {
                if (enemy !== this && 
                    enemy.position.distanceTo(this.position) < 100 &&
                    !enemy.inFormation) {
                    this.formationLeader = enemy;
                    break;
                }
            }
            
            // If no leader found, revert to normal behavior
            if (!this.formationLeader) {
                this.inFormation = false;
                this.behaviorState = 'patrol';
                return;
            }
        }
        
        // Check if leader still exists
        if (!this.game.enemies.includes(this.formationLeader)) {
            this.formationLeader = null;
            this.inFormation = false;
            this.behaviorState = 'patrol';
            return;
        }
        
        // Follow the leader with offset
        const targetPosition = this.formationLeader.position.clone().add(this.formationOffset);
        const toTarget = new THREE.Vector3().subVectors(targetPosition, this.position);
        const distance = toTarget.length();
        
        // If we're close enough, match leader's direction
        if (distance < 20) {
            this.targetDirection.copy(this.formationLeader.targetDirection);
        } else {
            // Otherwise, head toward formation position
            toTarget.normalize();
            this.targetDirection.copy(toTarget);
        }
    }
    
    startSpecialManeuver() {
        const maneuverType = Math.random();
        
        if (maneuverType < 0.4 && this.game.player) {
            // 40% chance for diving attack if player exists
            this.startDivingAttack();
        } else if (maneuverType < 0.7) {
            // 30% chance for evasive maneuvers
            this.startEvasiveManeuvers();
        } else {
            // 30% chance for barrel roll
            this.startBarrelRoll();
        }
    }
    
    startEvasiveManeuvers() {
        this.isEvading = true;
        this.evasionTimer = 0;
        this.evasionDuration = 1 + Math.random() * 2; // 1-3 seconds of evasion
        this.evasionDirection = Math.random() < 0.5 ? 1 : -1; // Random direction
    }
    
    handleEvasiveManeuvers(delta) {
        this.evasionTimer += delta;
        
        if (this.evasionTimer > this.evasionDuration) {
            // End evasive maneuvers
            this.isEvading = false;
            return;
        }
        
        // Create more gradual evasive movement pattern
        // Oscillate direction perpendicular to current heading
        const currentDirection = new THREE.Vector3(0, 0, 1).applyEuler(this.rotation);
        const upVector = new THREE.Vector3(0, 1, 0);
        const sideVector = new THREE.Vector3().crossVectors(currentDirection, upVector).normalize();
        
        // Oscillate side to side - more gradual
        const oscillation = Math.sin(this.evasionTimer * 3) * this.evasionDirection * 0.7;
        
        // Create evasive target direction
        this.targetDirection.copy(currentDirection);
        this.targetDirection.addScaledVector(sideVector, oscillation * 0.6);
        
        // Add some vertical oscillation too - more gradual
        this.targetDirection.y += Math.sin(this.evasionTimer * 2) * 0.15;
        
        // Normalize the result
        this.targetDirection.normalize();
    }
    
    startDivingAttack() {
        // Only start dive if we have a player and are above minimum height
        if (!this.game.player || this.position.y < 30) return;
        
        // Don't dive if player is above our maximum altitude
        if (this.game.player.position.y > this.maxAltitude) return;
        
        this.isDiving = true;
        this.diveTimer = 0;
        this.diveDuration = 2 + Math.random(); // 2-3 seconds of diving
        this.diveTarget = this.game.player.position.clone();
        
        // Add some randomness to dive target
        this.diveTarget.x += (Math.random() - 0.5) * 20;
        this.diveTarget.z += (Math.random() - 0.5) * 20;
        
        // Ensure dive target is not above max altitude
        if (this.diveTarget.y > this.maxAltitude - 10) {
            this.diveTarget.y = this.maxAltitude - 10;
        }
    }
    
    handleDivingAttack(delta) {
        this.diveTimer += delta;
        
        // End dive if we're approaching max altitude
        if (this.position.y > this.altitudeWarningThreshold) {
            this.isDiving = false;
            this.targetDirection.y = -0.3; // Force downward
            return;
        }
        
        if (this.diveTimer > this.diveDuration) {
            // End dive and start climb
            this.isDiving = false;
            this.postDiveClimb = true;
            
            // Set climbing direction - more gradual
            this.targetDirection.set(
                this.targetDirection.x,
                0.2, // Reduced climb angle for more gradual recovery
                this.targetDirection.z
            ).normalize();
            
            // Reset after 3 seconds of climbing (longer for more gradual recovery)
            setTimeout(() => {
                this.postDiveClimb = false;
            }, 3000);
            
            return;
        }
        
        // Calculate dive direction
        const toDiveTarget = new THREE.Vector3().subVectors(this.diveTarget, this.position);
        toDiveTarget.normalize();
        
        // Gradually increase downward angle as dive progresses - more gradual
        const diveProgress = this.diveTimer / this.diveDuration;
        const diveAngle = -0.2 - (diveProgress * 0.3); // Less steep dive
        
        // Create diving target direction
        this.targetDirection.copy(toDiveTarget);
        this.targetDirection.y = diveAngle; // Downward angle
        this.targetDirection.normalize();
    }
    
    startBarrelRoll() {
        this.isRolling = true;
        this.rollTimer = 0;
        this.rollDuration = 1.5; // 1.5 seconds for a full roll
        this.rollProgress = 0;
    }
    
    handleBarrelRoll(delta) {
        this.rollTimer += delta;
        
        if (this.rollTimer > this.rollDuration) {
            // End barrel roll
            this.isRolling = false;
            this.rotation.z = 0; // Reset roll
            return;
        }
        
        // Calculate roll progress (0 to 1)
        this.rollProgress = this.rollTimer / this.rollDuration;
        
        // Apply roll rotation (full 360 degrees) - smoother with sine wave
        this.rotation.z = Math.sin(this.rollProgress * Math.PI * 2) * Math.PI;
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
            
            // Start evasive maneuvers when hit (70% chance)
            if (Math.random() < 0.7) {
                this.startEvasiveManeuvers();
            }
        }
    }
} 
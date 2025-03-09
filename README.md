# When Pigs Fly

A fun 3D flying game where you pilot a plane with a pig as your co-pilot! Engage in dogfights, rescue animals, and navigate through a vibrant world with mountains, trees, and lakes.

## Features

- **Dynamic Flight Physics**: Realistic flight controls with pitch, roll, and yaw
- **Combat System**: Engage enemy planes with a front-mounted machine gun
- **Animal Rescue**: Save animals throughout the world to increase your score
- **Terrain Collision**: Navigate carefully to avoid crashing into mountains, trees, or the ground
- **World Boundaries**: A circular world with storm effects at the boundaries
- **Victory Condition**: Rescue 100 animals to win the game

## Controls

- **W/S**: Pitch down/up
- **A/D**: Roll left/right
- **Q/E**: Yaw left/right
- **Space**: Accelerate
- **Shift**: Decelerate
- **F**: Fire weapon

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/when-pigs-fly.git
   cd when-pigs-fly
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm start
   ```

4. Open your browser and navigate to `http://localhost:3001`

## Game Mechanics

- **Health**: Your plane has health that decreases when hit by enemy fire or when colliding with terrain
- **Fuel**: Monitor your fuel level during flight
- **Altitude**: Enemy planes have a maximum altitude, giving you a tactical advantage when flying high
- **Boundaries**: The world has boundaries marked by storm clouds - flying too far will push you back

## Technologies Used

- Three.js for 3D rendering
- Cannon.js for physics
- Webpack for bundling

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Thanks to all contributors who have helped make this game possible
- Inspired by classic arcade flight games 
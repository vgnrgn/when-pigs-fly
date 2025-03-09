import { Game } from './Game';

document.addEventListener('DOMContentLoaded', () => {
    // Hide loading screen once everything is loaded
    const loadingScreen = document.getElementById('loading-screen');
    
    // Initialize game
    try {
        const game = new Game();
        loadingScreen.style.display = 'none';
    } catch (error) {
        console.error('Error initializing game:', error);
        loadingScreen.textContent = 'Error loading game. Please refresh the page.';
    }
}); 
import { IFollowable } from '../../types/IFollowable';
import { PlayerStore } from '../../stores/PlayerStore';
import { DeviceDetection } from '../../utils/DeviceDetection';
import { PlayerController } from '../PlayerController';

export class PlayerUI {
    private messageElement: HTMLDivElement | null = null;
    private messageTimeout: number | null = null;
    private animationFrameId: number | null = null;
    private floatingNameElement: HTMLDivElement | null = null;
    private floatingNameUpdateInterval: number | null = null;
    private cruiseControlElement: HTMLDivElement | null = null;
    private cruiseControlUpdateInterval: number | null = null;

    constructor(
        private map: mapboxgl.Map,
        private player: IFollowable & PlayerController
    ) {
        this.createMessageElement();
        this.createFloatingNameElement();
        this.createCruiseControlUI();
    }

    private createMessageElement(): void {
        this.messageElement = document.createElement('div');
        this.messageElement.className = 'player-message-bubble';
        this.messageElement.style.position = 'fixed';
        this.messageElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        this.messageElement.style.color = 'white';
        this.messageElement.style.padding = '6px 10px';
        this.messageElement.style.borderRadius = '12px';
        this.messageElement.style.maxWidth = '200px';
        this.messageElement.style.wordBreak = 'break-word';
        this.messageElement.style.textAlign = 'center';
        this.messageElement.style.fontSize = '12px';
        this.messageElement.style.whiteSpace = 'normal';
        this.messageElement.style.pointerEvents = 'none';
        this.messageElement.style.display = 'none';
        this.messageElement.style.zIndex = '1000';
        this.messageElement.style.opacity = '0';
        this.messageElement.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        this.messageElement.style.left = '50%';

        document.body.appendChild(this.messageElement);
    }

    public showMessage(message: string, duration: number = 5000): void {
        if (!this.messageElement) return;

        // Clear any existing timeout
        if (this.messageTimeout !== null) {
            window.clearTimeout(this.messageTimeout);
            this.messageTimeout = null;
        }

        // Clear any existing animation frame
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        // Set message content
        this.messageElement.textContent = message;
        this.messageElement.style.display = 'block';

        // Add a slight upward animation when appearing
        this.messageElement.style.transform += ' translateY(10px)';
        
        // Force a reflow
        this.messageElement.offsetHeight;

        // Start position update loop
        const updateMessageLoop = () => {
            if (this.messageElement && this.messageElement.style.display !== 'none') {
                this.updateMessagePosition();
                this.animationFrameId = requestAnimationFrame(updateMessageLoop);
            }
        };
        this.animationFrameId = requestAnimationFrame(updateMessageLoop);

        // Fade in and float up
        setTimeout(() => {
            if (this.messageElement) {
                this.messageElement.style.opacity = '1';
                this.messageElement.style.transform = this.messageElement.style.transform.replace('translateY(10px)', 'translateY(0)');
            }
        }, 10);

        // Set timeout to hide
        this.messageTimeout = window.setTimeout(() => {
            if (this.messageElement) {
                this.messageElement.style.opacity = '0';
                setTimeout(() => {
                    if (this.messageElement) {
                        this.messageElement.style.display = 'none';
                    }
                    if (this.animationFrameId !== null) {
                        cancelAnimationFrame(this.animationFrameId);
                        this.animationFrameId = null;
                    }
                }, 300);
            }
            this.messageTimeout = null;
        }, duration);
    }

    private updateMessagePosition(): void {
        if (!this.messageElement) return;

        const position = {
            lng: this.player.coordinates[0],
            lat: this.player.coordinates[1],
            altitude: (this.player.elevation || 0) + 5
        };

        const screenCoords = this.map.project([position.lng, position.lat]);

        // Increased height to -150px and slightly larger floating effect
        const floatingOffset = Math.sin(Date.now() / 1000) * 8; // Increased floating range
        this.messageElement.style.transform = `
            translate(-50%, 0) 
            translate(0, ${screenCoords.y - 150 + floatingOffset}px)
        `;
        this.messageElement.style.top = '0';
        this.messageElement.style.left = `${screenCoords.x}px`;
    }

    private createFloatingNameElement(): void {
        this.floatingNameElement = document.createElement('div');
        this.floatingNameElement.className = 'player-floating-name';
        this.floatingNameElement.textContent = PlayerStore.getPlayerName();
        document.body.appendChild(this.floatingNameElement);
        
        // Add styles if they don't exist yet
        if (!document.querySelector('#player-floating-name-style')) {
            const style = document.createElement('style');
            style.id = 'player-floating-name-style';
            style.textContent = `
                .player-floating-name {
                    position: absolute;
                    padding: 2px 8px;
                    background-color: rgba(31, 41, 55, 0.95);
                    color: white;
                    border-radius: 4px;
                    font-size: 14px;
                    pointer-events: none;
                    white-space: nowrap;
                    text-align: center;
                    transform: translate(-50%, 0);
                    z-index: 10;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    text-shadow: 0 0 2px rgba(0, 0, 0, 0.8);
                }
            `;
            document.head.appendChild(style);
        }
        
        this.startFloatingNameUpdateLoop();
    }

    private startFloatingNameUpdateLoop(): void {
        const updateLoop = () => {
            if (this.floatingNameElement) {
                this.updateFloatingNamePosition();
                this.floatingNameUpdateInterval = window.requestAnimationFrame(updateLoop);
            } else {
                this.floatingNameUpdateInterval = null;
            }
        };
        
        this.floatingNameUpdateInterval = window.requestAnimationFrame(updateLoop);
    }

    private updateFloatingNamePosition(): void {
        if (!this.floatingNameElement) return;

        const position = {
            lng: this.player.coordinates[0],
            lat: this.player.coordinates[1]
        };

        const screenCoords = this.map.project([position.lng, position.lat]);

        // Position above the vehicle
        this.floatingNameElement.style.transform = `translate(-50%, 0) translate(0, ${screenCoords.y - 50}px)`;
        this.floatingNameElement.style.top = '0';
        this.floatingNameElement.style.left = `${screenCoords.x}px`;
    }

    private createCruiseControlUI(): void {
        // Only create cruise control UI on desktop
        if (!DeviceDetection.isDesktop()) {
            return;
        }

        this.cruiseControlElement = document.createElement('div');
        this.cruiseControlElement.className = 'cruise-control-panel';
        document.body.appendChild(this.cruiseControlElement);

        // Add styles if they don't exist yet
        if (!document.querySelector('#cruise-control-style')) {
            const style = document.createElement('style');
            style.id = 'cruise-control-style';
            style.textContent = `
                .cruise-control-panel {
                    position: fixed;
                    bottom: 120px;
                    right: 20px;
                    background: rgba(31, 41, 55, 0.85);
                    backdrop-filter: blur(10px);
                    color: white;
                    border-radius: 12px;
                    padding: 12px 16px;
                    font-size: 13px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    text-shadow: 0 0 2px rgba(0, 0, 0, 0.8);
                    min-width: 140px;
                    text-align: center;
                    transition: all 0.3s ease;
                    z-index: 1000;
                    cursor: pointer;
                    pointer-events: auto;
                    font-family: 'Inter', sans-serif;
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
                }
                
                .cruise-control-panel:hover {
                    background: rgba(31, 41, 55, 0.95);
                    border-color: rgba(255, 255, 255, 0.2);
                }
                
                .cruise-control-panel.hidden {
                    opacity: 0.4;
                }
                
                .cruise-control-status {
                    margin-bottom: 10px;
                    font-weight: 600;
                    font-size: 14px;
                    color: #fff;
                    text-shadow: 0 0 10px rgba(255, 255, 255, 0.3);
                }
                
                .cruise-control-buttons {
                    display: flex;
                    gap: 8px;
                    justify-content: center;
                    align-items: center;
                    margin-bottom: 8px;
                }
                
                .cruise-control-btn {
                    background: rgba(59, 130, 246, 0.8);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    color: white;
                    width: 32px;
                    height: 32px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 16px;
                    font-weight: bold;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s ease;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                    line-height: 1;
                }
                
                .cruise-control-btn:hover {
                    background: rgba(59, 130, 246, 1);
                    border-color: rgba(255, 255, 255, 0.3);
                    box-shadow: 0 4px 8px rgba(59, 130, 246, 0.3);
                    transform: translateY(-1px);
                }
                
                .cruise-control-btn:active {
                    transform: translateY(0);
                    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
                }
                
                .cruise-control-btn:disabled {
                    background: rgba(107, 114, 128, 0.5);
                    border-color: rgba(255, 255, 255, 0.1);
                    cursor: not-allowed;
                    transform: none;
                }
                
                .cruise-keybind {
                    font-size: 11px;
                    color: rgba(255, 255, 255, 0.6);
                    margin-top: 4px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
            `;
            document.head.appendChild(style);
        }

        this.startCruiseControlUpdateLoop();
    }

    private startCruiseControlUpdateLoop(): void {
        if (!this.cruiseControlElement) return;

        const updateLoop = () => {
            if (this.cruiseControlElement) {
                this.updateCruiseControlDisplay();
                this.cruiseControlUpdateInterval = window.requestAnimationFrame(updateLoop);
            } else {
                this.cruiseControlUpdateInterval = null;
            }
        };
        
        this.cruiseControlUpdateInterval = window.requestAnimationFrame(updateLoop);
    }

    private updateCruiseControlDisplay(): void {
        if (!this.cruiseControlElement || !DeviceDetection.isDesktop()) return;

        const isAvailable = this.player.isCruiseControlAvailable();
        const cruiseState = this.player.getCruiseControlState();

        if (!isAvailable || !cruiseState) {
            this.cruiseControlElement.style.display = 'none';
            return;
        }

        this.cruiseControlElement.style.display = 'block';

        const { active, targetSpeed } = cruiseState;
        // Use the same speed source as VehicleStatsUI - PlayerStore.getCurrentSpeed()
        const currentDisplaySpeed = PlayerStore.getCurrentSpeed();
        const targetDisplaySpeed = Math.round(targetSpeed);
        
        const statusText = active ? `ON (${targetDisplaySpeed} km/h)` : 'OFF';
        const statusClass = active ? '' : 'hidden';

        this.cruiseControlElement.className = `cruise-control-panel ${statusClass}`;
        
        // Check if we need to rebuild the UI (when active state changes)
        const needsRebuild = !this.cruiseControlElement.dataset.lastActiveState || 
                           this.cruiseControlElement.dataset.lastActiveState !== active.toString();
        
        if (needsRebuild) {
            this.cruiseControlElement.innerHTML = `
                <div class="cruise-control-status">Cruise Control: ${statusText}</div>
                ${active ? `
                    <div class="cruise-control-buttons">
                        <button class="cruise-control-btn" id="cruise-decrease">-</button>
                        <button class="cruise-control-btn" id="cruise-increase">+</button>
                    </div>
                ` : ''}
                <div class="cruise-keybind">Press C or click to toggle</div>
            `;

            // Store the current active state to avoid unnecessary rebuilds
            this.cruiseControlElement.dataset.lastActiveState = active.toString();

            // Add click event listener to the panel itself to toggle cruise control
            this.cruiseControlElement.onclick = (e) => {
                // Don't trigger if clicking on the speed adjustment buttons
                if ((e.target as HTMLElement).classList.contains('cruise-control-btn')) {
                    return;
                }
                
                // Toggle cruise control using the public method
                if (this.player.isCruiseControlAvailable()) {
                    // Simulate the C key press logic by getting current state and toggling
                    const cruiseState = this.player.getCruiseControlState();
                    if (cruiseState) {
                        // Use a keydown event to trigger the existing cruise control toggle logic
                        const event = new KeyboardEvent('keydown', { key: 'c' });
                        document.dispatchEvent(event);
                    }
                }
            };

            // Add event listeners for speed adjustment buttons (only when active)
            if (active) {
                const decreaseBtn = document.getElementById('cruise-decrease');
                const increaseBtn = document.getElementById('cruise-increase');

                if (decreaseBtn) {
                    decreaseBtn.onclick = (e) => {
                        e.stopPropagation(); // Prevent triggering the panel click
                        this.player.adjustCruiseControlSpeed(-5);
                    };
                }
                if (increaseBtn) {
                    increaseBtn.onclick = (e) => {
                        e.stopPropagation(); // Prevent triggering the panel click
                        this.player.adjustCruiseControlSpeed(5);
                    };
                }
            }
        } else if (active) {
            // Just update the status text without rebuilding
            const statusElement = this.cruiseControlElement.querySelector('.cruise-control-status');
            if (statusElement) {
                statusElement.textContent = `Cruise Control: ON (${targetDisplaySpeed} km/h)`;
            }
        }
    }

    public destroy(): void {
        if (this.messageTimeout !== null) {
            clearTimeout(this.messageTimeout);
            this.messageTimeout = null;
        }
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        if (this.messageElement) {
            document.body.removeChild(this.messageElement);
            this.messageElement = null;
        }

        if (this.floatingNameUpdateInterval) {
            cancelAnimationFrame(this.floatingNameUpdateInterval);
            this.floatingNameUpdateInterval = null;
        }
        if (this.floatingNameElement) {
            document.body.removeChild(this.floatingNameElement);
            this.floatingNameElement = null;
        }

        if (this.cruiseControlUpdateInterval) {
            cancelAnimationFrame(this.cruiseControlUpdateInterval);
            this.cruiseControlUpdateInterval = null;
        }
        if (this.cruiseControlElement) {
            document.body.removeChild(this.cruiseControlElement);
            this.cruiseControlElement = null;
        }
    }
} 
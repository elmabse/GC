/**
 * GALACTIC COMMAND (RTS / ACTION)
 * -------------------------------
 * Vanilla JS, HTML5 Canvas.
 *
 * Steuerung:
 *   W/A/S/D  Schiff steuern
 *   E        gesteuertes Schiff wechseln (alle anderen folgen dem neuen Hauptschiff)
 *   M        Hologramm-Karte
 *   C        3 Sekunden halten: Planeten erobern (im Orbit, Truppentransporter in der Flotte nötig)
 *   P        Planeten-Manager: Schiffe einem Planeten als Garnison zuweisen
 *   L        Fighter/Transporter landen bzw. starten (im Orbit)
 */

// ==========================================
// 1. KONFIGURATION & DATEN
// ==========================================

const GAME_STATES = { MENU: 0, FACTION_SELECT: 1, GAME: 2 };

// Schwierigkeit: beeinflusst NUR die Anzahl der Schiffe pro Piratenflotte (und die Credit-Einnahmen)
const DIFFICULTY = {
    EASY:    { id: 'EASY',    name: 'Leicht', fleetSizeMin: 1, fleetSizeMax: 2, credits: 1.5 },
    NORMAL:  { id: 'NORMAL',  name: 'Normal', fleetSizeMin: 2, fleetSizeMax: 3, credits: 1.0 },
    HARD:    { id: 'HARD',    name: 'Schwer', fleetSizeMin: 3, fleetSizeMax: 5, credits: 0.8 },
    EXTREME: { id: 'EXTREME', name: 'Extrem', fleetSizeMin: 4, fleetSizeMax: 7, credits: 0.5 }
};

const PLANET_CONFIG = {
    chunkSize: 2000,
    orbitPadding: 200,        // Orbit-Radius = Planetengröße + orbitPadding
    captureTime: 3,           // Sekunden, die [C] gehalten werden muss
    incomeAmount: 225,        // Credits pro Intervall und Planet
    incomeInterval: 5000,     // ms
    pirateCaptureTime: 10,    // Sekunden, bis Piraten einen unverteidigten Planeten übernehmen
    pirateRecoverRate: 20,    // Fortschritt (% pro Sekunde), der abgebaut wird, wenn die Piraten weg sind
    defenseRadiusPad: 500,    // Garnisonsschiffe greifen Piraten innerhalb (Größe + Wert) um den Planeten an
    orbitSpeed: 0.15          // Umlaufgeschwindigkeit der Garnison (rad/s)
};

const OWNER = { NONE: 'none', PLAYER: 'player', PIRATE: 'pirate' };
const OWNER_COLORS = { none: '#888888', player: '#00ff66', pirate: '#ff3333' };

const PIRATE_CONFIG = {
    maxFleets: 3,                           // maximal gleichzeitige Piratenflotten (alle Schwierigkeiten)
    firstSpawnDelays: [4000, 20000, 40000], // ms bis zum ersten Spawn pro Flotten-Slot
    respawnDelay: 120000,                   // ms bis eine zerstörte Flotte neu spawnt (2 Minuten)
    despawnDistance: 7000,                  // Flotten, die komplett weiter weg sind, verschwinden
    despawnRespawnDelay: 5000,              // ms bis Ersatz-Spawn nach Despawn durch Entfernung
    maxFleetSize: 12,                       // absolute Obergrenze pro Flotte
    planetAggroRange: 5000,                 // Piraten fliegen auf Spielerplaneten in dieser Reichweite zu
    planetSpawnChance: 0.5,                 // Chance, dass eine neue Flotte bei einem Spielerplaneten statt beim Spieler spawnt
    spawnRadiusMin: 1200,
    spawnRadiusMax: 2000,
    palette: { '1': '#8b0000', '2': '#ff4500', '3': '#444444', '4': '#ffaa00' }
};

// Basiswerte der Piratenschiffe (werden mit der Distanz zum Ursprung skaliert)
const PIRATE_STATS = {
    destroyer: { hp: 800, dmg: 70 },
    cruiser:   { hp: 400,  dmg: 35 },
    fighter:   { hp: 70,   dmg: 12 }
};

// Selbstreparatur aller Schiffe (HP pro Sekunde)
const SHIP_REGEN_PER_SEC = 5;

// Verhalten der Hauptflotte und der Planeten-Garnisonen
const FLEET_CONFIG = {
    aggroMemory: 4,        // Sekunden, die ein Angreifer als Bedrohung gilt (nach Zielwahl bzw. Treffer)
    swarmMinRadius: 60,    // Mindestabstand der Schwarm-Wegpunkte zum Hauptschiff (plus Schiffsgrößen)
    swarmSpread: 240,      // zusätzliche zufällige Streuung der Wegpunkte
    wanderTimeMin: 3,      // Sekunden, bis ein Schiff einen neuen Wegpunkt wählt
    wanderTimeMax: 8,
    leashFromMain: 1400,   // Hauptflotte jagt Angreifer nicht weiter als so weit vom Hauptschiff weg
    garrisonLeashPad: 900  // Garnison jagt Angreifer nicht weiter als (Planetengröße + Wert) vom Planeten weg
};

const SHIP_TYPES = {
    destroyer: { id: 'destroyer', name: 'Star Destroyer', size: 5, turnSpeed: 1, maxSpeed: 200, range: 600, cooldown: 1000 },
    cruiser:   { id: 'cruiser', name: 'Cruiser', size: 3.5, turnSpeed: 2, maxSpeed: 250, range: 450, cooldown: 600 },
    transport: { id: 'transport', name: 'Transport', size: 2.5, turnSpeed: 2.5, maxSpeed: 180, range: 0, cooldown: 9999 },
    fighter:   { id: 'fighter', name: 'Fighter', size: 1.5, turnSpeed: 4, maxSpeed: 300, range: 300, cooldown: 300 }
};

const FACTIONS = {
    clones: { id: 'clones', name: 'Grand Army', palette: { '1': '#eeeeee', '2': '#8b0000', '3': '#444444', '4': '#00ffff' } },
    separatists: { id: 'separatists', name: 'Droid Swarm', palette: { '1': '#d2b48c', '2': '#4682b4', '3': '#222222', '4': '#ff4500' } },
    empire: { id: 'empire', name: 'Galactic Empire', palette: { '1': '#999999', '2': '#555555', '3': '#111111', '4': '#ff3333' } },
    rebels: { id: 'rebels', name: 'Rebel Alliance', palette: { '1': '#f5f5dc', '2': '#ff8c00', '3': '#888888', '4': '#ff9999' } }
};

const SHIP_STATS = {
    clones_destroyer: { hp: 1700, dmg: 120, cost: 1200 }, clones_cruiser: { hp: 500, dmg: 40, cost: 600 }, clones_transport: { hp: 600, dmg: 0, cost: 350 }, clones_fighter: { hp: 80, dmg: 10, cost: 120 },
    separatists_destroyer: { hp: 1100, dmg: 90, cost: 900 }, separatists_cruiser: { hp: 350, dmg: 35, cost: 450 }, separatists_transport: { hp: 400, dmg: 0, cost: 200 }, separatists_fighter: { hp: 50, dmg: 15, cost: 70 },
    empire_destroyer: { hp: 1500, dmg: 100, cost: 1500 }, empire_cruiser: { hp: 600, dmg: 45, cost: 650 }, empire_transport: { hp: 700, dmg: 0, cost: 300 }, empire_fighter: { hp: 60, dmg: 12, cost: 100 },
    rebels_destroyer: { hp: 1300, dmg: 70, cost: 1000 }, rebels_cruiser: { hp: 450, dmg: 40, cost: 550 }, rebels_transport: { hp: 500, dmg: 0, cost: 250 }, rebels_fighter: { hp: 100, dmg: 20, cost: 150 }
};

const SPRITES = {
    emblem_clones: ["..111111..",".11333311.","1133..3311","133.11.331","13.1111.31","13.1111.31","133.11.331","1133..3311",".11333311.","..111111.."],
    emblem_separatists: ["...1111...","..1....1..",".1..22..1.","1..2112..1","1.21..12.1","1.21..12.1","1..2112..1",".1..22..1.","..1....1..","...1111..."],
    emblem_empire: ["...1111...","..133331..",".13111131.","131.11.131","1311..1131","1311..1131","131.11.131",".13111131.","..133331..","...1111..."],
    emblem_rebels: ["...1111...","..11..11..",".11.22.11.",".1.2112.1.","11.2..2.11","112....211","1122..2211","1112222111",".11.22.11.","...1111..."],

    clones_destroyer: ["....2....","...121...","..11211..",".1112111.","111121111","111222111","113333311","133111331","111111111",".4.4.4.4."],
    clones_cruiser: ["...1...","..121..",".11211.","1112111","1133311","1111111",".4.4.4."],
    clones_transport: ["..111..",".11211.","1312131","1312131","1111111",".4...4."],
    clones_fighter: [".1.","212","131","4.4"],

    separatists_destroyer: ["...333...","..31113..",".3112113.","311111113","311...113","312...213","311...113","311333113","111111111","44.....44"],
    separatists_cruiser: ["..313..",".31113.","3112113","31...13","312.213","3111113","44...44"],
    separatists_transport: [".3333.","311113","312213","312213","311113",".4..4."],
    separatists_fighter: ["3.3","121","111","4.4"],

    empire_destroyer: ["....3....","...313...","..31113..",".3112113.","311111113","311111113","333323333","311111113","333333333",".4..4..4."],
    empire_cruiser: ["...3...","..313..",".31113.","3312133","3111113","3333333",".4.4.4."],
    empire_transport: [".333.","31113","31213","31113","33333",".4.4."],
    empire_fighter: ["2.2","212","232","242"],

    rebels_destroyer: ["...111...","..11111..",".1122211.","111111111","333111333","313111313","313111313","311121113","111111111","44.4.4.44"],
    rebels_cruiser: ["..111..",".11111.","1112111","3311133","3111113","1111111","44.4.44"],
    rebels_transport: [".111.","12211","12211","11111","31113","4...4"],
    rebels_fighter: ["313","121","313","4.4"],

    pirate_destroyer: ["...111...","..13131..",".1131311.","131111131","131313131","333111333","111111111","331111133","111131111","44.4.4.44"],
    pirate_cruiser: ["..131..",".11111.","3113113","1311131","3113113","1111111","4.4.4.4"],
    pirate_fighter: ["313","111","333","4.4"]
};

// ==========================================
// 2. ENGINE & CORE STATE
// ==========================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });

let V_WIDTH = window.innerWidth;
let V_HEIGHT = window.innerHeight;

let state = GAME_STATES.MENU;
let selFaction = 'empire';
let selDiff = DIFFICULTY.NORMAL;

// Input State
let keys = {};              // gedrückt gehaltene Tasten
let justPressed = {};       // Tasten, die in diesem Frame neu gedrückt wurden
let mouse = { x: 0, y: 0, isDown: false, clicked: false };
let touch = { active: false, joyX: 0, joyY: 0, id: null, startX: 0, startY: 0, captureOn: false };
let isMapOpen = false;
let isManagerOpen = false;   // Planeten-Manager
let managerSel = null;       // im Manager gewählter Planet
let managerScroll = 0;
let gameTime = 0;            // Spielzeit in Sekunden (für Umlaufbahnen)
let playerPlanetList = [];   // alle Planeten im Besitz des Spielers (wird jeden Frame aktualisiert)

// Game State
let cam = { x: 0, y: 0 };
let playerCredits = 1500;
let lastTime = 0;

let ships = [];
let projectiles = [];
let particles = [];
let planets = new Map(); // chunkKey -> planetObj

let mainShip = null;     // das aktuell gesteuerte Schiff (alle anderen Spielerschiffe folgen ihm)
let nextShipId = 0;
let nextFleetId = 1;
let pirateSlots = [];    // pro Slot: { fleetId, timer }

// Sprite Cache für Performance
const spriteCache = {};

function initSprite(key, spriteData, palette, scale) {
    let cacheKey = key + "_" + scale;
    if (spriteCache[cacheKey]) return spriteCache[cacheKey];

    let c = document.createElement('canvas');
    let w = spriteData[0].length;
    let h = spriteData.length;
    c.width = w * scale; c.height = h * scale;
    let cx = c.getContext('2d');

    for (let r = 0; r < h; r++) {
        for (let col = 0; col < w; col++) {
            let char = spriteData[r][col];
            if (char !== '.') {
                cx.fillStyle = palette[char];
                cx.fillRect(col * scale, r * scale, scale, scale);
            }
        }
    }
    spriteCache[cacheKey] = { img: c, w: c.width, h: c.height };
    return spriteCache[cacheKey];
}

// Seeded Random für Map-Generierung
function seededRandom(x, y) {
    let n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453123;
    return n - Math.floor(n);
}

function randInt(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
}

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    V_WIDTH = canvas.width;
    V_HEIGHT = canvas.height;
    ctx.imageSmoothingEnabled = false;
}
window.addEventListener('resize', resize);

// Input Listeners
window.addEventListener('keydown', e => {
    let k = e.key.toLowerCase();
    keys[k] = true;
    if (e.repeat) return;
    justPressed[k] = true;
    if (state === GAME_STATES.GAME) {
        if (k === 'm') { isMapOpen = !isMapOpen; isManagerOpen = false; }
        if (k === 'p') toggleManager();
        if (k === 'escape') { isMapOpen = false; isManagerOpen = false; }
        if (k === 'e') switchControlledShip();
    }
});
window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);
window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
window.addEventListener('mousedown', e => { mouse.isDown = true; mouse.clicked = true; mouse.x = e.clientX; mouse.y = e.clientY; });
window.addEventListener('mouseup', e => { mouse.isDown = false; });
window.addEventListener('wheel', e => { if (isManagerOpen) managerScroll += Math.sign(e.deltaY) * 2; }, { passive: true });

// Touch Handling (Virtual Joystick & Buttons)
window.addEventListener('touchstart', e => {
    e.preventDefault(); // verhindert doppelte, vom Browser simulierte Maus-Klicks
    touch.active = true;
    for (let i = 0; i < e.changedTouches.length; i++) {
        let t = e.changedTouches[i];
        if (t.clientX < window.innerWidth / 2 && touch.id === null && state === GAME_STATES.GAME) {
            touch.id = t.identifier;
            touch.startX = t.clientX;
            touch.startY = t.clientY;
            touch.joyX = 0; touch.joyY = 0;
        } else {
            mouse.x = t.clientX; mouse.y = t.clientY; mouse.clicked = true;
        }
    }
}, { passive: false });

window.addEventListener('touchmove', e => {
    e.preventDefault(); // Prevent scrolling
    for (let i = 0; i < e.touches.length; i++) {
        let t = e.touches[i];
        if (t.identifier === touch.id) {
            let dx = t.clientX - touch.startX;
            let dy = t.clientY - touch.startY;
            let dist = Math.min(Math.hypot(dx, dy), 50);
            let ang = Math.atan2(dy, dx);
            touch.joyX = Math.cos(ang) * dist;
            touch.joyY = Math.sin(ang) * dist;
        }
    }
}, { passive: false });

window.addEventListener('touchend', e => {
    for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === touch.id) {
            touch.id = null; touch.joyX = 0; touch.joyY = 0;
        }
    }
});


// ==========================================
// 3. GAME CLASSES
// ==========================================

class Ship {
    constructor(x, y, type, faction, isMain = false, isPirate = false, hpMult = 1, dmgMult = 1) {
        this.id = nextShipId++;
        this.x = x; this.y = y;
        this.vx = 0; this.vy = 0;
        this.angle = -Math.PI / 2;
        this.typeStr = type;
        this.type = SHIP_TYPES[type];
        this.faction = faction;
        this.isMain = isMain;
        this.isPirate = isPirate;
        this.fleetId = null;     // nur für Piraten: zu welcher Flotte gehört das Schiff
        this.landed = false;

        let baseStats = isPirate ? PIRATE_STATS[type] : SHIP_STATS[`${faction}_${type}`];

        this.hp = baseStats.hp * hpMult;
        this.maxHp = this.hp;
        this.dmg = baseStats.dmg * dmgMult;

        this.lastShot = 0;
        this.spawnAnim = 0; // 0 to 1
        this.spawnType = 'none'; // hyper, hangar

        this.spriteKey = isPirate ? `pirate_${type}` : `${faction}_${type}`;
        this.palette = isPirate ? PIRATE_CONFIG.palette : FACTIONS[faction].palette;

        // Garnison: Planet, dem das Schiff zugewiesen ist (null = gehört zur Hauptflotte)
        this.assignedPlanet = null;

        // Zufallsverhalten (Schwarm / Orbit): jedes Schiff hat sein eigenes Tempo und eigene Wegpunkte
        this.wanderSpeed = 0.7 + Math.random() * 0.6;
        this.swarmWp = null;
        this.orbitWp = null;

        // Kampf: aktuelle Bedrohung (Hauptflotte/Garnison) und Aggressions-Gedächtnis
        this.engageTarget = null;
        this.attackTarget = null;   // Piraten: wen greife ich gerade an
        this.attackTime = -999;
        this.lastAttacker = null;   // wer hat mich zuletzt getroffen
        this.lastHitTime = -999;
    }

    update(dt) {
        if (this.hp <= 0) return;

        // Selbstreparatur (auch gelandete Schiffe)
        this.hp = Math.min(this.maxHp, this.hp + SHIP_REGEN_PER_SEC * dt);

        if (this.landed) return;

        // Verliert die Garnison ihren Planeten, kehrt sie zur Hauptflotte zurück
        if (this.assignedPlanet && this.assignedPlanet.owner !== OWNER.PLAYER) this.assignedPlanet = null;

        // Spawn Animationen
        if (this.spawnType === 'hyper' && this.spawnAnim < 1) {
            this.spawnAnim += dt * 1.5;
            if (this.spawnAnim > 1) this.spawnAnim = 1;
            return;
        }
        if (this.spawnType === 'hangar' && this.spawnAnim < 1) {
            this.spawnAnim += dt * 2.0;
            this.x += Math.cos(this.angle) * 100 * dt;
            this.y += Math.sin(this.angle) * 100 * dt;
            if (this.spawnAnim > 1) this.spawnAnim = 1;
            return;
        }

        let targetAngle = this.angle;
        let thrust = 0;

        if (this.isMain) {
            // Player Input
            if (touch.id !== null) {
                if (Math.abs(touch.joyX) > 5 || Math.abs(touch.joyY) > 5) {
                    targetAngle = Math.atan2(touch.joyY, touch.joyX);
                    thrust = (Math.hypot(touch.joyX, touch.joyY) / 50) * this.type.maxSpeed;
                }
            } else {
                if (keys['a']) targetAngle -= this.type.turnSpeed * dt;
                if (keys['d']) targetAngle += this.type.turnSpeed * dt;
                if (keys['w']) thrust = this.type.maxSpeed;
                if (keys['s']) thrust = -this.type.maxSpeed * 0.5;
            }
            this.angle = targetAngle;
            this.vx += Math.cos(this.angle) * thrust * dt;
            this.vy += Math.sin(this.angle) * thrust * dt;

        } else if (this.isPirate) {
            // Pirate AI: 1) nächstes Spielerschiff in Reichweite angreifen, 2) sonst auf einen Spielerplaneten zufliegen
            let target = null, best = 1500;
            for (let s of ships) {
                if (s.isPirate || s.landed || s.hp <= 0) continue;
                let d = Math.hypot(s.x - this.x, s.y - this.y);
                if (d < best) { best = d; target = s; }
            }
            if (target) {
                this.attackTarget = target;
                this.attackTime = gameTime;
                this.turnToward(Math.atan2(target.y - this.y, target.x - this.x), dt, 1);
                if (best > this.type.range * 0.8) this.thrustForward(dt, this.type.maxSpeed * 0.8);
            } else {
                let planet = findPlanetTargetForPirate(this);
                if (planet) {
                    let d = Math.hypot(planet.x - this.x, planet.y - this.y);
                    if (d > planet.size + PLANET_CONFIG.orbitPadding * 0.5) {
                        this.turnToward(Math.atan2(planet.y - this.y, planet.x - this.x), dt, 1);
                        this.thrustForward(dt, this.type.maxSpeed * 0.8);
                    }
                }
            }
        } else if (this.assignedPlanet) {
            // Garnison: Planet umkreisen und verteidigen
            this.garrisonAI(dt);
        } else {
            // Hauptflotte: lose um das Hauptschiff schwärmen, Angreifer des Hauptschiffs bekämpfen
            this.fleetAI(dt);
        }

        // Separation (Boids-like to prevent overlap)
        if (!this.isMain) {
            for (let other of ships) {
                if (other === this || other.landed) continue;
                let dx = this.x - other.x;
                let dy = this.y - other.y;
                let dist = Math.hypot(dx, dy);
                let minDist = (this.type.size + other.type.size) * 12;
                if (dist < minDist && dist > 0.1) {
                    let force = (minDist - dist) * 2 * dt;
                    this.vx += (dx / dist) * force;
                    this.vy += (dy / dist) * force;
                }
            }
        }

        // Apply Velocity & Friction (framerate-unabhängig)
        let friction = Math.pow(0.95, dt * 60);
        this.vx *= friction; this.vy *= friction;
        this.x += this.vx * dt; this.y += this.vy * dt;

        // Auto-Attack (only if not transport)
        if (this.typeStr !== 'transport') {
            this.lastShot -= dt * 1000;
            if (this.lastShot <= 0) {
                let target = this.getFireTarget();
                if (target) {
                    this.lastShot = this.type.cooldown;
                    if (this.isPirate) { this.attackTarget = target; this.attackTime = gameTime; }
                    // Fire Projectile
                    let px = this.x + Math.cos(this.angle) * this.type.size * 5;
                    let py = this.y + Math.sin(this.angle) * this.type.size * 5;
                    let dx = target.x - this.x; let dy = target.y - this.y;
                    let ang = Math.atan2(dy, dx);
                    projectiles.push({
                        x: px, y: py,
                        vx: Math.cos(ang) * 600, vy: Math.sin(ang) * 600,
                        life: 2.0, dmg: this.dmg,
                        owner: this,
                        isPirate: this.isPirate,
                        color: this.palette['4']
                    });
                }
            }
        }
    }

    turnToward(targetAngle, dt, mult = 1) {
        let diff = targetAngle - this.angle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        this.angle += Math.sign(diff) * Math.min(Math.abs(diff), this.type.turnSpeed * mult * dt);
    }

    thrustForward(dt, amount) {
        this.vx += Math.cos(this.angle) * amount * dt;
        this.vy += Math.sin(this.angle) * amount * dt;
    }

    // Hauptflotte: Schiffe schwärmen ungleichmäßig auf zufälligen Routen um das Hauptschiff
    fleetAI(dt) {
        let main = mainShip;

        // 1) Greift jemand das Hauptschiff (oder dieses Schiff) an? Dann kämpfen.
        this.engageTarget = this.findFleetThreat();
        if (this.engageTarget) {
            let t = this.engageTarget;
            let dx = t.x - this.x, dy = t.y - this.y;
            let dist = Math.hypot(dx, dy);
            this.turnToward(Math.atan2(dy, dx), dt, 1.5);
            if (dist > this.type.range * 0.7) this.thrustForward(dt, this.type.maxSpeed * 0.9);
            return;
        }

        // 2) Sonst: zufälligen Wegpunkt in der Nähe des Hauptschiffs ansteuern (überwiegend dahinter)
        if (!this.swarmWp || gameTime >= this.swarmWp.until) {
            let minR = FLEET_CONFIG.swarmMinRadius + (main.type.size + this.type.size) * 5;
            this.swarmWp = {
                rel: Math.PI + (Math.random() - 0.5) * 2 * Math.PI * 0.85,
                r: minR + Math.random() * FLEET_CONFIG.swarmSpread,
                until: gameTime + FLEET_CONFIG.wanderTimeMin + Math.random() * (FLEET_CONFIG.wanderTimeMax - FLEET_CONFIG.wanderTimeMin)
            };
        }
        let a = main.angle + this.swarmWp.rel;
        let tx = main.x + Math.cos(a) * this.swarmWp.r;
        let ty = main.y + Math.sin(a) * this.swarmWp.r;
        let dx = tx - this.x, dy = ty - this.y;
        let dist = Math.hypot(dx, dy);

        if (dist > 25) {
            this.turnToward(Math.atan2(dy, dx), dt, 1.3);
            // Weit zurückgefallen: aufholen. Nah dran: gemütlich, mit eigenem Tempo.
            let thrust = dist > 300
                ? Math.min(dist * 2, this.type.maxSpeed * 1.2)
                : Math.min(dist * 1.2, this.type.maxSpeed * 0.55 * this.wanderSpeed);
            this.thrustForward(dt, thrust);
        } else {
            this.turnToward(main.angle, dt, 0.8); // angekommen: ausrichten und treiben lassen
        }
    }

    // Bedrohung für die Hauptflotte: Piraten, die das Hauptschiff oder dieses Schiff angreifen
    findFleetThreat() {
        if (this.type.range <= 0) return null;
        let best = null, bestD = Infinity;
        for (let e of ships) {
            if (!e.isPirate || e.hp <= 0) continue;
            if (!isAggressingOn(e, mainShip) && !isAggressingOn(e, this)) continue;
            let d = Math.hypot(e.x - this.x, e.y - this.y);
            if (d < bestD) { bestD = d; best = e; }
        }
        if (best && Math.hypot(best.x - mainShip.x, best.y - mainShip.y) > FLEET_CONFIG.leashFromMain) return null;
        return best;
    }

    // Garnison: hält sich ungleichmäßig im Orbit auf und kämpft nur bei Bedrohung
    garrisonAI(dt) {
        let p = this.assignedPlanet;

        // 1) Gegner im Orbit oder Angreifer dieses Schiffs -> bekämpfen
        this.engageTarget = this.findGarrisonThreat(p);
        if (this.engageTarget) {
            let t = this.engageTarget;
            let dx = t.x - this.x, dy = t.y - this.y;
            let dist = Math.hypot(dx, dy);
            this.turnToward(Math.atan2(dy, dx), dt, 1.5);
            if (dist > this.type.range * 0.7) this.thrustForward(dt, this.type.maxSpeed);
            return;
        }

        // 2) Sonst: zufällige Wegpunkte im Orbit-Bereich, die langsam um den Planeten driften
        if (!this.orbitWp || this.orbitWp.planet !== p || gameTime >= this.orbitWp.until) {
            let inner = p.size + 40;
            let outer = p.size + PLANET_CONFIG.orbitPadding - 30;
            this.orbitWp = {
                planet: p,
                a: Math.random() * Math.PI * 2,
                r: inner + Math.random() * (outer - inner),
                drift: (Math.random() < 0.5 ? -1 : 1) * (0.02 + Math.random() * 0.1),
                until: gameTime + 4 + Math.random() * 8
            };
        }
        let wp = this.orbitWp;
        wp.a += wp.drift * dt;
        let tx = p.x + Math.cos(wp.a) * wp.r;
        let ty = p.y + Math.sin(wp.a) * wp.r;
        let dx = tx - this.x, dy = ty - this.y;
        let dist = Math.hypot(dx, dy);

        if (dist > 20) {
            this.turnToward(Math.atan2(dy, dx), dt, 1.2);
            this.thrustForward(dt, Math.min(dist * 1.2, this.type.maxSpeed * 0.5 * this.wanderSpeed));
        } else {
            this.turnToward(wp.a + Math.sign(wp.drift) * Math.PI / 2, dt, 0.6); // Flugrichtung entlang der Umlaufbahn
        }
    }

    // Bedrohung für die Garnison: Piraten im Orbit des Planeten oder Piraten, die dieses Schiff angreifen
    findGarrisonThreat(p) {
        if (this.type.range <= 0) return null;
        let best = null, bestD = Infinity;
        for (let e of ships) {
            if (!e.isPirate || e.hp <= 0) continue;
            if (!isInOrbit(e, p) && !isAggressingOn(e, this)) continue;
            if (Math.hypot(e.x - p.x, e.y - p.y) > p.size + FLEET_CONFIG.garrisonLeashPad) continue;
            let d = Math.hypot(e.x - this.x, e.y - this.y);
            if (d < bestD) { bestD = d; best = e; }
        }
        return best;
    }

    // Wen darf dieses Schiff beschießen?
    getFireTarget() {
        // Gesteuertes Schiff und Piraten feuern auf das nächste Ziel in Reichweite
        if (this.isMain || this.isPirate) return this.findTarget();
        // Hauptflotte und Garnison feuern nur auf ihre aktuelle Bedrohung
        let t = this.engageTarget;
        if (t && t.hp > 0 && Math.hypot(t.x - this.x, t.y - this.y) <= this.type.range) return t;
        return null;
    }

    findTarget() {
        let bestDist = this.type.range;
        let best = null;
        for (let s of ships) {
            if (s.landed || s.hp <= 0 || s.isPirate === this.isPirate) continue;
            let dist = Math.hypot(s.x - this.x, s.y - this.y);
            if (dist < bestDist) { bestDist = dist; best = s; }
        }
        return best;
    }

    draw(ctx) {
        if (this.landed || this.hp <= 0) return;

        let sprite = initSprite(this.spriteKey, SPRITES[this.spriteKey], this.palette, this.type.size);

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle + Math.PI / 2); // Sprites point Up (Math.PI/2 offset)

        // Spawn Effects
        if (this.spawnType === 'hyper' && this.spawnAnim < 1) {
            ctx.scale(1, 5 - this.spawnAnim * 4);
            ctx.globalAlpha = this.spawnAnim;
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#fff';
        } else if (this.spawnType === 'hangar' && this.spawnAnim < 1) {
            ctx.scale(this.spawnAnim, this.spawnAnim);
            ctx.globalAlpha = this.spawnAnim;
        }

        ctx.drawImage(sprite.img, -sprite.w / 2, -sprite.h / 2);
        ctx.restore();

        // Main Ship Marker (wandert mit dem gesteuerten Schiff)
        if (this.isMain && !isMapOpen) {
            ctx.fillStyle = '#0f0';
            ctx.font = '10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('MAIN', this.x, this.y - sprite.h / 2 - 10);
        }

        // HP Bar
        if (this.hp < this.maxHp) {
            ctx.fillStyle = '#f00';
            ctx.fillRect(this.x - 15, this.y + sprite.h / 2 + 5, 30, 3);
            ctx.fillStyle = '#0f0';
            ctx.fillRect(this.x - 15, this.y + sprite.h / 2 + 5, 30 * (this.hp / this.maxHp), 3);
        }
    }
}

// Greift `enemy` das Schiff `ship` gerade an? (Zielwahl oder Treffer in den letzten Sekunden)
function isAggressingOn(enemy, ship) {
    if (!ship) return false;
    if (enemy.attackTarget === ship && gameTime - enemy.attackTime < FLEET_CONFIG.aggroMemory) return true;
    if (ship.lastAttacker === enemy && gameTime - ship.lastHitTime < FLEET_CONFIG.aggroMemory) return true;
    return false;
}

// ==========================================
// 4. SCHIFFSWECHSEL & FORMATION
// ==========================================

function isSwitchable(s) {
    return !s.isPirate && !s.landed && s.hp > 0 && !(s.spawnType !== 'none' && s.spawnAnim < 1);
}

function setControlledShip(ship) {
    if (mainShip) mainShip.isMain = false;
    mainShip = ship;
    ship.isMain = true;
    ship.assignedPlanet = null; // übernommene Schiffe verlassen ihre Garnison
}

// E: nächstes eigenes Schiff übernehmen (in der Reihenfolge, in der sie gekauft wurden)
function switchControlledShip() {
    if (!mainShip) return;
    let candidates = ships.filter(isSwitchable).sort((a, b) => a.id - b.id);
    if (candidates.length < 2) return;
    let idx = candidates.indexOf(mainShip);
    setControlledShip(candidates[(idx + 1) % candidates.length]);
}

// Wenn das gesteuerte Schiff zerstört wird: größtes verbleibendes Schiff übernehmen
function pickReplacementMain() {
    return ships
        .filter(s => !s.isPirate && s.hp > 0)
        .sort((a, b) => (b.type.size - a.type.size) || (a.id - b.id))[0] || null;
}

// ==========================================
// 5. WORLD GENERATION & LOGIC
// ==========================================

function getPlanetChunk(x, y) {
    let cx = Math.floor(x / PLANET_CONFIG.chunkSize);
    let cy = Math.floor(y / PLANET_CONFIG.chunkSize);
    let key = `${cx},${cy}`;

    if (!planets.has(key)) {
        let rand = seededRandom(cx, cy);
        if (rand > 0.6) { // 40% chance for a planet
            let r2 = seededRandom(cx + 1, cy);
            let r3 = seededRandom(cx, cy + 1);
            let size = 60 + Math.floor(r2 * 80);
            let px = cx * PLANET_CONFIG.chunkSize + r2 * PLANET_CONFIG.chunkSize;
            let py = cy * PLANET_CONFIG.chunkSize + r3 * PLANET_CONFIG.chunkSize;
            let hue = Math.floor(seededRandom(cx + 2, cy) * 360);

            planets.set(key, {
                cx: cx, cy: cy, name: makePlanetName(cx, cy),
                x: px, y: py, size: size, hue: hue,
                owner: OWNER.NONE,
                captureProgress: 0,   // Eroberung durch den Spieler (0-100)
                pirateProgress: 0,    // Übernahme durch Piraten (0-100)
                attackers: 0, defenders: 0,
                inOrbit: false,
                lastIncome: 0
            });
        } else {
            planets.set(key, null); // Empty chunk
        }
    }
    return planets.get(key);
}

// Erzeugt eine Piratenflotte in zufälliger Zusammensetzung und Formation
function spawnPirateFleet() {
    let main = mainShip;
    let fleetId = nextFleetId++;

    // Ankerpunkt: der Spieler oder (mit Wahrscheinlichkeit) einer seiner Planeten
    let anchor = main;
    if (playerPlanetList.length > 0 && Math.random() < PIRATE_CONFIG.planetSpawnChance) {
        anchor = playerPlanetList[Math.floor(Math.random() * playerPlanetList.length)];
    }

    let dist = PIRATE_CONFIG.spawnRadiusMin + Math.random() * (PIRATE_CONFIG.spawnRadiusMax - PIRATE_CONFIG.spawnRadiusMin);
    let ang = Math.random() * Math.PI * 2;
    let cx = anchor.x + Math.cos(ang) * dist;
    let cy = anchor.y + Math.sin(ang) * dist;

    // Stärke und Größe wachsen mit der Entfernung zum Ursprung (0,0)
    let originDist = Math.hypot(cx, cy);
    let strength = 1 + originDist / 5000;

    // Anzahl der Schiffe: Schwierigkeit + Distanzbonus (begrenzt)
    let count = randInt(selDiff.fleetSizeMin, selDiff.fleetSizeMax) + Math.floor(originDist / 4000);
    count = Math.min(count, PIRATE_CONFIG.maxFleetSize);

    let destroyerChance = Math.min(0.35, 0.08 + originDist / 30000);

    // Zufällige Formation
    let pattern = ['cluster', 'line', 'wedge', 'ring'][Math.floor(Math.random() * 4)];
    let facing = Math.random() * Math.PI * 2;
    let spacing = 110;
    let ringRadius = Math.max(150, count * spacing / (Math.PI * 2));

    for (let i = 0; i < count; i++) {
        let r = Math.random();
        let type = r < destroyerChance ? 'destroyer' : (r < destroyerChance + 0.35 ? 'cruiser' : 'fighter');

        let ox = 0, oy = 0;
        if (pattern === 'line') {
            ox = (i - (count - 1) / 2) * spacing;
        } else if (pattern === 'wedge') {
            let row = Math.floor((i + 1) / 2);
            let side = (i % 2 === 0) ? -1 : 1;
            ox = side * row * spacing * 0.8;
            oy = row * spacing * 0.8;
        } else if (pattern === 'ring') {
            let a = (i / count) * Math.PI * 2;
            ox = Math.cos(a) * ringRadius;
            oy = Math.sin(a) * ringRadius;
        } else { // cluster
            let a = Math.random() * Math.PI * 2;
            let rad = Math.random() * spacing * 1.5;
            ox = Math.cos(a) * rad;
            oy = Math.sin(a) * rad;
        }

        let x = cx + ox * Math.cos(facing) - oy * Math.sin(facing);
        let y = cy + ox * Math.sin(facing) + oy * Math.cos(facing);

        let pShip = new Ship(x, y, type, 'pirate', false, true, strength, strength);
        pShip.fleetId = fleetId;
        pShip.angle = Math.atan2(anchor.y - y, anchor.x - x);
        ships.push(pShip);
    }
    return fleetId;
}

// Verwaltet die (maximal 3) Piraten-Slots: Respawn erst 2 Minuten nach Zerstörung
function updatePirates(dt) {
    let main = mainShip;
    for (let slot of pirateSlots) {
        if (slot.fleetId !== null) {
            let members = ships.filter(s => s.isPirate && s.fleetId === slot.fleetId);
            if (members.length === 0) {
                // Flotte zerstört -> lange Pause
                slot.fleetId = null;
                slot.timer = PIRATE_CONFIG.respawnDelay;
            } else if (members.every(s => isFarFromPlayerAssets(s))) {
                // Flotte weit weg von Spieler und Planeten -> entfernen, schnell Ersatz
                ships = ships.filter(s => !members.includes(s));
                slot.fleetId = null;
                slot.timer = PIRATE_CONFIG.despawnRespawnDelay;
            }
        } else {
            slot.timer -= dt * 1000;
            if (slot.timer <= 0) slot.fleetId = spawnPirateFleet();
        }
    }
}

// ----- Planeten-Helfer -----

function makePlanetName(cx, cy) {
    const syl = ['Kor', 'Tal', 'Vex', 'Nar', 'Zul', 'Ith', 'Dro', 'Mer', 'Sav', 'Lun', 'Tor', 'Bel'];
    let a = syl[Math.floor(seededRandom(cx + 11, cy + 3) * syl.length)];
    let b = syl[Math.floor(seededRandom(cx + 5, cy + 17) * syl.length)].toLowerCase();
    return `${a}${b}-${Math.abs(cx * 7 + cy * 3) % 90 + 10}`;
}

function getPlanetsByOwner(owner) {
    let list = [];
    planets.forEach(p => { if (p && p.owner === owner) list.push(p); });
    return list;
}

function isInOrbit(ship, p) {
    return Math.hypot(ship.x - p.x, ship.y - p.y) < p.size + PLANET_CONFIG.orbitPadding;
}

function findPlanetTargetForPirate(ship) {
    let best = null, bestD = PIRATE_CONFIG.planetAggroRange;
    for (let p of playerPlanetList) {
        let d = Math.hypot(p.x - ship.x, p.y - ship.y);
        if (d < bestD) { bestD = d; best = p; }
    }
    return best;
}

// Ist ein Piratenschiff weit weg vom Spieler UND von allen Spielerplaneten?
function isFarFromPlayerAssets(s) {
    let lim = PIRATE_CONFIG.despawnDistance;
    if (Math.hypot(s.x - mainShip.x, s.y - mainShip.y) <= lim) return false;
    return playerPlanetList.every(p => Math.hypot(s.x - p.x, s.y - p.y) > lim);
}

function updateWorld(dt) {
    let main = mainShip;

    // Planeten in Spielernähe (Chunks um das gesteuerte Schiff)
    let activePlanets = [];
    for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
            let p = getPlanetChunk(main.x + i * PLANET_CONFIG.chunkSize, main.y + j * PLANET_CONFIG.chunkSize);
            if (p) activePlanets.push(p);
        }
    }

    let playerShips = ships.filter(s => !s.isPirate && s.hp > 0);
    // Garnisonsschiffe landen/starten nicht mit der Hauptflotte
    let landers = playerShips.filter(s => (s.typeStr === 'transport' || s.typeStr === 'fighter') && !s.isMain && !s.assignedPlanet);
    let capturing = keys['c'] || touch.captureOn;

    // --- Eroberung durch den Spieler ([C] 3 Sekunden halten) ---
    for (let p of activePlanets) {
        p.inOrbit = isInOrbit(main, p);

        if (p.inOrbit && p.owner !== OWNER.PLAYER) {
            // Ein Truppentransporter muss verfügbar sein: in der Hauptflotte oder bereits im Orbit dieses Planeten
            let hasTransport = playerShips.some(s => s.typeStr === 'transport' && !s.landed && (!s.assignedPlanet || isInOrbit(s, p)));
            if (capturing && hasTransport) {
                p.captureProgress += dt * (100 / PLANET_CONFIG.captureTime);
                if (p.captureProgress >= 100) {
                    p.captureProgress = 0;
                    p.owner = OWNER.PLAYER;
                    p.pirateProgress = 0;
                    p.lastIncome = 0;
                    touch.captureOn = false;
                }
            } else {
                p.captureProgress = 0; // Taste losgelassen -> Fortschritt verfällt
            }
        } else {
            p.captureProgress = 0;
        }

        if (p.inOrbit && justPressed['l'] && landers.length > 0) {
            // Alle gemeinsam landen bzw. starten
            let anyLanded = landers.some(s => s.landed);
            landers.forEach(s => { s.landed = !anyLanded; });
            justPressed['l'] = false;
        }
    }
    if (!activePlanets.some(p => p.inOrbit)) touch.captureOn = false;

    // --- Eigene Planeten: Piratenangriffe und Einnahmen (unabhängig von der Spielerposition) ---
    for (let p of playerPlanetList) {
        let attackers = 0, defenders = 0;
        for (let s of ships) {
            if (s.hp <= 0 || s.landed || !isInOrbit(s, p)) continue;
            if (s.isPirate) attackers++; else defenders++;
        }
        p.attackers = attackers;
        p.defenders = defenders;

        // Piraten übernehmen den Planeten nur, wenn kein Spielerschiff mehr im Orbit ist
        if (attackers > 0 && defenders === 0) {
            p.pirateProgress += dt * (100 / PLANET_CONFIG.pirateCaptureTime);
            if (p.pirateProgress >= 100) {
                p.pirateProgress = 0;
                p.captureProgress = 0;
                p.owner = OWNER.PIRATE;
                continue;
            }
        } else {
            p.pirateProgress = Math.max(0, p.pirateProgress - dt * PLANET_CONFIG.pirateRecoverRate);
        }

        // Einnahmen
        p.lastIncome += dt * 1000;
        if (p.lastIncome >= PLANET_CONFIG.incomeInterval) {
            p.lastIncome -= PLANET_CONFIG.incomeInterval;
            playerCredits += PLANET_CONFIG.incomeAmount;
        }
    }

    playerPlanetList = getPlanetsByOwner(OWNER.PLAYER);
}

function spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        let ang = Math.random() * Math.PI * 2;
        let spd = Math.random() * 150 + 50;
        particles.push({
            x: x, y: y,
            vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
            life: 0.5 + Math.random() * 0.5,
            color: color
        });
    }
}

// ==========================================
// 6. RENDERING
// ==========================================

function drawPlanets(ctx, cx, cy) {
    for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
            let p = getPlanetChunk(cx + i * PLANET_CONFIG.chunkSize, cy + j * PLANET_CONFIG.chunkSize);
            if (!p) continue;

            // Draw Planet (simple circle)
            ctx.fillStyle = `hsl(${p.hue}, 50%, 40%)`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();

            // Draw features
            ctx.fillStyle = `hsl(${p.hue}, 40%, 30%)`;
            ctx.beginPath(); ctx.arc(p.x - p.size * 0.2, p.y - p.size * 0.2, p.size * 0.4, 0, Math.PI * 2); ctx.fill();

            // Besitzer-Ring (grün = Spieler, rot = Piraten)
            if (p.owner !== OWNER.NONE) {
                ctx.strokeStyle = OWNER_COLORS[p.owner];
                ctx.lineWidth = 3;
                ctx.beginPath(); ctx.arc(p.x, p.y, p.size + 8, 0, Math.PI * 2); ctx.stroke();
            }

            // Name
            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            ctx.font = '12px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(p.name, p.x, p.y + 4);

            // Angriffsanzeige der Piraten
            if (p.owner === OWNER.PLAYER && (p.attackers > 0 || p.pirateProgress > 0)) {
                ctx.fillStyle = '#ff3333';
                ctx.font = 'bold 14px monospace';
                ctx.fillText(p.attackers > 0 ? "PLANET UNTER ANGRIFF!" : "Piraten ziehen sich zurück", p.x, p.y - p.size - 60);
                ctx.fillStyle = '#555'; ctx.fillRect(p.x - 50, p.y - p.size - 52, 100, 8);
                ctx.fillStyle = '#f33'; ctx.fillRect(p.x - 50, p.y - p.size - 52, p.pirateProgress, 8);
            }

            if (p.inOrbit) {
                ctx.strokeStyle = OWNER_COLORS[p.owner] === OWNER_COLORS.none ? '#0ff' : OWNER_COLORS[p.owner];
                ctx.lineWidth = 2;
                ctx.beginPath(); ctx.arc(p.x, p.y, p.size + PLANET_CONFIG.orbitPadding, 0, Math.PI * 2); ctx.stroke();

                ctx.fillStyle = '#fff';
                ctx.font = '14px monospace';
                ctx.textAlign = 'center';
                if (p.owner !== OWNER.PLAYER) {
                    let verb = p.owner === OWNER.PIRATE ? "Piratenplanet" : "Orbit erreicht";
                    ctx.fillText(`${verb} - [C] ${PLANET_CONFIG.captureTime}s halten zum Erobern`, p.x, p.y - p.size - 30);
                    if (p.captureProgress > 0) {
                        ctx.fillStyle = '#555'; ctx.fillRect(p.x - 50, p.y - p.size - 15, 100, 10);
                        ctx.fillStyle = '#0f0'; ctx.fillRect(p.x - 50, p.y - p.size - 15, p.captureProgress, 10);
                    }
                } else {
                    ctx.fillText(`Planet gesichert (+${PLANET_CONFIG.incomeAmount} / ${PLANET_CONFIG.incomeInterval / 1000}s)`, p.x, p.y - p.size - 30);
                }
                ctx.fillStyle = '#fff';
                ctx.fillText("[L] Landen/Starten", p.x, p.y + p.size + 40);
            }
        }
    }
}

function drawHUD() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.textAlign = 'left';

    // Credits
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`$ CREDITS: ${Math.floor(playerCredits)}`, 20, 30);

    // Einnahmen aus Planeten
    let income = playerPlanetList.length * PLANET_CONFIG.incomeAmount;
    ctx.fillStyle = income > 0 ? '#00ff66' : '#777';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(`Einnahmen: +${income} / ${PLANET_CONFIG.incomeInterval / 1000}s  (${playerPlanetList.length} Planeten)`, 20, 52);

    // Hints & Status
    ctx.fillStyle = '#0ff';
    ctx.font = '14px monospace';
    ctx.fillText("[M] Map  [E] Schiff wechseln  [P] Planeten", 20, 74);

    let fleetCount = ships.filter(s => !s.isPirate && s.hp > 0).length;
    let garrisonCount = ships.filter(s => !s.isPirate && s.hp > 0 && s.assignedPlanet).length;
    ctx.fillStyle = '#0f0';
    ctx.fillText(`Steuerung: ${mainShip.type.name}  HP ${Math.ceil(mainShip.hp)}/${Math.ceil(mainShip.maxHp)}`, 20, 94);
    ctx.fillStyle = '#aaa';
    ctx.fillText(`Flotte: ${fleetCount} Schiffe (${garrisonCount} als Garnison)`, 20, 114);

    // Warnung bei Piratenangriff auf Planeten
    let underAttack = playerPlanetList.filter(p => p.attackers > 0 || p.pirateProgress > 0);
    if (underAttack.length > 0) {
        ctx.fillStyle = (Math.floor(Date.now() / 400) % 2 === 0) ? '#ff3333' : '#ff9999';
        ctx.font = 'bold 14px monospace';
        ctx.fillText(`! ${underAttack.map(p => p.name).join(', ')} unter Angriff`, 20, 134);
    }

    // Buy Menu
    let bx = V_WIDTH - 250;
    let by = 20;

    ctx.fillStyle = 'rgba(10,10,30,0.8)';
    ctx.fillRect(bx - 10, by - 10, 240, 300);
    ctx.fillStyle = '#fff';
    ctx.font = '16px monospace';
    ctx.fillText("FLOTTE VERSTÄRKEN", bx, by + 10);

    let y = by + 40;
    for (let typeKey of ['destroyer', 'cruiser', 'transport', 'fighter']) {
        let cost = SHIP_STATS[`${selFaction}_${typeKey}`].cost;
        let canAfford = playerCredits >= cost;

        // Button Logic
        let btnHover = mouse.x > bx && mouse.x < bx + 220 && mouse.y > y && mouse.y < y + 50;
        if (canAfford && btnHover && mouse.clicked) {
            playerCredits -= cost;
            mouse.clicked = false;

            let main = mainShip;
            let newShip = new Ship(main.x, main.y, typeKey, selFaction);

            if (typeKey === 'fighter') {
                newShip.spawnType = 'hangar';
                // Spawn left or right
                newShip.angle = main.angle + (Math.random() > 0.5 ? Math.PI / 2 : -Math.PI / 2);
            } else {
                newShip.spawnType = 'hyper';
                newShip.x -= Math.cos(main.angle) * 300;
                newShip.y -= Math.sin(main.angle) * 300;
                newShip.angle = main.angle;
            }
            ships.push(newShip);
        }

        ctx.fillStyle = btnHover && canAfford ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.5)';
        ctx.fillRect(bx, y, 220, 50);
        ctx.strokeStyle = canAfford ? '#0f0' : '#555';
        ctx.lineWidth = 1;
        ctx.strokeRect(bx, y, 220, 50);

        // Preview
        let sKey = `${selFaction}_${typeKey}`;
        let spr = initSprite(sKey, SPRITES[sKey], FACTIONS[selFaction].palette, 2);
        ctx.drawImage(spr.img, bx + 10, y + 25 - spr.h / 2);

        ctx.textAlign = 'left';
        ctx.font = '16px monospace';
        ctx.fillStyle = canAfford ? '#fff' : '#555';
        ctx.fillText(SHIP_TYPES[typeKey].name, bx + 60, y + 20);
        ctx.fillStyle = canAfford ? '#ffd700' : '#555';
        ctx.fillText(`$ ${cost}`, bx + 60, y + 40);

        y += 60;
    }

    drawTouchButtons();
}

// Touch-UI: Joystick und Aktionsbuttons (werden auch über der Karte angezeigt)
function drawTouchButtons() {
    if (!(('ontouchstart' in window) || navigator.maxTouchPoints > 0)) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    if (touch.id !== null) {
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(touch.startX, touch.startY, 50, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath(); ctx.arc(touch.startX + touch.joyX, touch.startY + touch.joyY, 20, 0, Math.PI * 2); ctx.fill();
    }

    let bx = V_WIDTH - 50;
    let by = V_HEIGHT - 50;

    let drawBtn = (label, ox, oy, action, active) => {
        let cx = bx + ox, cy = by + oy;
        if (mouse.clicked && Math.hypot(mouse.x - cx, mouse.y - cy) < 30) {
            action();
            mouse.clicked = false;
        }
        ctx.fillStyle = active ? 'rgba(0,255,0,0.5)' : 'rgba(255,255,255,0.2)';
        ctx.beginPath(); ctx.arc(cx, cy, 28, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = '12px monospace';
        ctx.fillText(label, cx, cy + 4);
    };

    drawBtn('SWAP', 0, 0, () => switchControlledShip(), false);
    drawBtn('LAND', -65, 0, () => { justPressed['l'] = true; }, false);
    drawBtn('CAP', 0, -65, () => { touch.captureOn = !touch.captureOn; }, touch.captureOn);
    drawBtn('MAP', -65, -65, () => { isMapOpen = !isMapOpen; isManagerOpen = false; }, isMapOpen);
    drawBtn('PLAN', -130, 0, () => toggleManager(), isManagerOpen);
}

function drawHologramMap() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(0, 20, 40, 0.85)';
    ctx.fillRect(0, 0, V_WIDTH, V_HEIGHT);

    // Scanlines
    ctx.fillStyle = 'rgba(0, 255, 255, 0.05)';
    for (let i = 0; i < V_HEIGHT; i += 4) ctx.fillRect(0, i, V_WIDTH, 1);

    ctx.translate(V_WIDTH / 2, V_HEIGHT / 2);
    let mapScale = 0.05;
    let main = mainShip;

    // Grid
    ctx.strokeStyle = 'rgba(0, 150, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = -2000; i <= 2000; i += 500) {
        ctx.moveTo(i, -2000); ctx.lineTo(i, 2000);
        ctx.moveTo(-2000, i); ctx.lineTo(2000, i);
    }
    ctx.stroke();

    // Planets
    planets.forEach(p => {
        if (!p) return;
        let dx = (p.x - main.x) * mapScale;
        let dy = (p.y - main.y) * mapScale;
        if (Math.abs(dx) > V_WIDTH / 2 || Math.abs(dy) > V_HEIGHT / 2) return;

        let r = Math.max(3, p.size * mapScale);
        ctx.fillStyle = OWNER_COLORS[p.owner];
        ctx.beginPath(); ctx.arc(dx, dy, r, 0, Math.PI * 2); ctx.fill();

        // Blinkender Ring bei Piratenangriff
        if (p.owner === OWNER.PLAYER && (p.attackers > 0 || p.pirateProgress > 0)) {
            ctx.strokeStyle = (Math.floor(Date.now() / 300) % 2 === 0) ? '#ff3333' : '#ffaaaa';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(dx, dy, r + 6, 0, Math.PI * 2); ctx.stroke();
        }

        ctx.fillStyle = OWNER_COLORS[p.owner];
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(p.name, dx, dy - r - 4);
    });

    // Ships
    ships.forEach(s => {
        if (s.landed) return;
        let dx = (s.x - main.x) * mapScale;
        let dy = (s.y - main.y) * mapScale;
        if (Math.abs(dx) > V_WIDTH / 2 || Math.abs(dy) > V_HEIGHT / 2) return;

        if (s.isMain) {
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(dx, dy, 4, 0, Math.PI * 2); ctx.fill();
            // Ping circle
            ctx.strokeStyle = `rgba(0,255,255, ${Math.sin(Date.now() * 0.005) * 0.5 + 0.5})`;
            ctx.beginPath(); ctx.arc(dx, dy, 15, 0, Math.PI * 2); ctx.stroke();
        } else if (s.isPirate) {
            ctx.fillStyle = '#f00';
            ctx.fillRect(dx - 1, dy - 1, 3, 3);
        } else {
            ctx.fillStyle = '#0ff';
            ctx.fillRect(dx - 1, dy - 1, 2, 2);
        }
    });

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0ff';
    ctx.font = '16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`SECTOR MAP | POS: X:${Math.floor(main.x)} Y:${Math.floor(main.y)}`, V_WIDTH / 2, 30);

    // Legende
    let legend = [['Neutral', OWNER_COLORS.none], ['Dein Planet', OWNER_COLORS.player], ['Piratenplanet', OWNER_COLORS.pirate]];
    let lx = V_WIDTH / 2 - 190;
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    legend.forEach(([label, color]) => {
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(lx, V_HEIGHT - 28, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#cff';
        ctx.fillText(label, lx + 12, V_HEIGHT - 24);
        lx += 130;
    });
}

// ==========================================
// 7. MAIN GAME LOOP
// ==========================================

// ==========================================
// PLANETEN-MANAGER (Taste P)
// ==========================================

function toggleManager() {
    isManagerOpen = !isManagerOpen;
    if (isManagerOpen) { isMapOpen = false; managerScroll = 0; }
}

// Einfacher UI-Button für Overlays; verbraucht den Klick
function uiButton(text, x, y, w, h, active, enabled = true) {
    let hover = enabled && mouse.x > x && mouse.x < x + w && mouse.y > y && mouse.y < y + h;
    ctx.fillStyle = !enabled ? 'rgba(40,40,40,0.5)' : active ? 'rgba(0,200,100,0.35)' : hover ? 'rgba(255,255,255,0.2)' : 'rgba(50,50,80,0.6)';
    ctx.strokeStyle = !enabled ? '#444' : active ? '#0f6' : '#0aa';
    ctx.lineWidth = 1;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = enabled ? '#fff' : '#666';
    ctx.font = '13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(text, x + w / 2, y + h / 2 + 4);
    let clicked = hover && mouse.clicked;
    if (clicked) mouse.clicked = false;
    return clicked;
}

function drawManager() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.textBaseline = 'alphabetic';

    ctx.fillStyle = 'rgba(0, 10, 25, 0.88)';
    ctx.fillRect(0, 0, V_WIDTH, V_HEIGHT);

    let pw = Math.min(V_WIDTH - 20, 1100);
    let ph = Math.min(V_HEIGHT - 20, 720);
    let px = Math.floor((V_WIDTH - pw) / 2);
    let py = Math.floor((V_HEIGHT - ph) / 2);

    ctx.fillStyle = 'rgba(10, 25, 50, 0.95)';
    ctx.strokeStyle = '#0ff';
    ctx.lineWidth = 2;
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeRect(px, py, pw, ph);

    ctx.fillStyle = '#0ff';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('PLANETEN-MANAGER', px + 20, py + 32);

    if (uiButton('SCHLIESSEN [P]', px + pw - 190, py + 10, 170, 32, false)) {
        isManagerOpen = false;
        return;
    }

    let owned = playerPlanetList;
    if (!managerSel || managerSel.owner !== OWNER.PLAYER) managerSel = owned[0] || null;

    // ----- Linke Spalte: eigene Planeten -----
    let lx = px + 20, ly = py + 70, lw = 300, rowH = 58;
    ctx.fillStyle = '#aaa';
    ctx.font = '13px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`MEINE PLANETEN (${owned.length})`, lx, ly - 10);

    if (owned.length === 0) {
        ctx.fillStyle = '#888';
        ctx.fillText('Noch keine Planeten.', lx, ly + 10);
        ctx.fillText('Im Orbit [C] 3s halten, mit', lx, ly + 30);
        ctx.fillText('einem Truppentransporter.', lx, ly + 48);
        return;
    }

    owned.forEach((p, i) => {
        let ry = ly + i * (rowH + 6);
        if (ry + rowH > py + ph - 20) return;
        let garrison = ships.filter(s => s.assignedPlanet === p && s.hp > 0).length;
        let selected = p === managerSel;
        let attacked = p.attackers > 0 || p.pirateProgress > 0;
        let hover = mouse.x > lx && mouse.x < lx + lw && mouse.y > ry && mouse.y < ry + rowH;

        ctx.fillStyle = selected ? 'rgba(0,200,100,0.25)' : hover ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.4)';
        ctx.strokeStyle = attacked ? '#f33' : (selected ? '#0f6' : '#0aa');
        ctx.lineWidth = 1;
        ctx.fillRect(lx, ry, lw, rowH);
        ctx.strokeRect(lx, ry, lw, rowH);

        ctx.fillStyle = `hsl(${p.hue}, 50%, 40%)`;
        ctx.beginPath(); ctx.arc(lx + 26, ry + rowH / 2, Math.max(10, Math.min(20, p.size * 0.15)), 0, Math.PI * 2); ctx.fill();

        ctx.textAlign = 'left';
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px monospace';
        ctx.fillText(p.name, lx + 56, ry + 24);
        ctx.font = '12px monospace';
        ctx.fillStyle = '#aaa';
        ctx.fillText(`Garnison: ${garrison}`, lx + 56, ry + 44);
        if (attacked) {
            ctx.fillStyle = '#f55';
            ctx.fillText('ANGRIFF!', lx + lw - 80, ry + 44);
        }

        if (hover && mouse.clicked) {
            managerSel = p;
            managerScroll = 0;
            mouse.clicked = false;
        }
    });

    // ----- Rechte Spalte: Schiffe zuweisen -----
    let rx = px + 340, rw = pw - 360, ry0 = py + 70;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#0ff';
    ctx.font = 'bold 15px monospace';
    ctx.fillText(`SCHIFFE -> ${managerSel.name}`, rx, ry0 - 10);
    ctx.fillStyle = '#888';
    ctx.font = '11px monospace';
    ctx.fillText('Klick = zuweisen / abziehen', rx, ry0 + 6);

    let fleet = ships
        .filter(s => !s.isPirate && s.hp > 0 && s !== mainShip)
        .sort((a, b) => (b.type.size - a.type.size) || (a.id - b.id));

    let cols = rw > 560 ? 2 : 1;
    let colW = Math.floor((rw - (cols - 1) * 10) / cols);
    let itemH = 40, gap = 4;
    let listTop = ry0 + 16;
    let listBottom = py + ph - 70;
    let rowsVisible = Math.max(1, Math.floor((listBottom - listTop) / (itemH + gap)));
    let perPage = rowsVisible * cols;
    let maxScroll = Math.max(0, Math.ceil(fleet.length / cols) - rowsVisible) * cols;
    managerScroll = Math.max(0, Math.min(managerScroll, maxScroll));
    managerScroll -= managerScroll % cols;

    if (uiButton('▲', px + pw - 100, ry0 - 30, 36, 24, false, managerScroll > 0)) managerScroll -= cols * 3;
    if (uiButton('▼', px + pw - 58, ry0 - 30, 36, 24, false, managerScroll < maxScroll)) managerScroll += cols * 3;

    if (fleet.length === 0) {
        ctx.fillStyle = '#888';
        ctx.font = '13px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('Keine weiteren Schiffe. Kaufe Schiffe im Buy-Menü.', rx, listTop + 20);
    }

    for (let k = 0; k < perPage; k++) {
        let s = fleet[managerScroll + k];
        if (!s) break;
        let x = rx + (k % cols) * (colW + 10);
        let y = listTop + Math.floor(k / cols) * (itemH + gap);
        let here = s.assignedPlanet === managerSel;
        let elsewhere = !!s.assignedPlanet && !here;
        let hover = mouse.x > x && mouse.x < x + colW && mouse.y > y && mouse.y < y + itemH;

        ctx.fillStyle = here ? 'rgba(0,200,100,0.25)' : hover ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.4)';
        ctx.strokeStyle = here ? '#0f6' : elsewhere ? '#fa0' : '#456';
        ctx.lineWidth = 1;
        ctx.fillRect(x, y, colW, itemH);
        ctx.strokeRect(x, y, colW, itemH);

        let spr = initSprite(s.spriteKey, SPRITES[s.spriteKey], s.palette, 2);
        ctx.drawImage(spr.img, x + 8, y + itemH / 2 - spr.h / 2);

        ctx.textAlign = 'left';
        ctx.fillStyle = '#fff';
        ctx.font = '13px monospace';
        ctx.fillText(s.type.name, x + 48, y + 17);
        ctx.font = '11px monospace';
        ctx.fillStyle = here ? '#0f6' : elsewhere ? '#fa0' : '#aaa';
        ctx.fillText(here ? 'Garnison hier' : elsewhere ? `Garnison: ${s.assignedPlanet.name}` : 'Hauptflotte', x + 48, y + 33);
        ctx.fillStyle = '#aaa';
        ctx.textAlign = 'right';
        ctx.fillText(`HP ${Math.ceil(s.hp)}/${Math.ceil(s.maxHp)}`, x + colW - 8, y + 17);

        if (hover && mouse.clicked) {
            mouse.clicked = false;
            if (here) {
                s.assignedPlanet = null;
            } else {
                s.assignedPlanet = managerSel;
                s.landed = false;
            }
        }
    }

    // ----- Sammelaktionen -----
    let by2 = py + ph - 52;
    if (uiButton('Alle freien Schiffe zuweisen', rx, by2, 260, 34, false)) {
        fleet.forEach(s => { if (!s.assignedPlanet) { s.assignedPlanet = managerSel; s.landed = false; } });
    }
    if (uiButton('Alle abziehen', rx + 270, by2, 150, 34, false)) {
        fleet.forEach(s => { if (s.assignedPlanet === managerSel) s.assignedPlanet = null; });
    }
}

// ==========================================
// MAIN UPDATE
// ==========================================

function updateGame(dt) {
    if (isMapOpen || isManagerOpen) {
        // Only slow update
        dt *= 0.1;
    }

    gameTime += dt;
    playerPlanetList = getPlanetsByOwner(OWNER.PLAYER);

    // Entities Update
    for (let i = ships.length - 1; i >= 0; i--) {
        let s = ships[i];
        s.update(dt);
        if (s.hp <= 0) {
            spawnParticles(s.x, s.y, s.palette['2'], s.type.size * 10);
            if (s.isPirate) playerCredits += s.type.size * 20 * selDiff.credits;
            ships.splice(i, 1);

            if (s === mainShip) {
                s.isMain = false;
                let replacement = pickReplacementMain();
                if (replacement) {
                    replacement.landed = false;
                    setControlledShip(replacement);
                } else {
                    // Game Over: kein eigenes Schiff mehr übrig
                    mainShip = null;
                    isMapOpen = false;
                    isManagerOpen = false;
                    state = GAME_STATES.FACTION_SELECT;
                    return;
                }
            }
        }
    }

    // Projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
        let p = projectiles[i];
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.life -= dt;

        let hit = false;
        for (let s of ships) {
            if (s.landed || s.hp <= 0 || s.isPirate === p.isPirate) continue;
            let dist = Math.hypot(s.x - p.x, s.y - p.y);
            if (dist < s.type.size * 6) { // hitbox approx
                s.hp -= p.dmg;
                s.lastAttacker = p.owner;
                s.lastHitTime = gameTime;
                hit = true;
                spawnParticles(p.x, p.y, p.color, 5);
                break;
            }
        }

        if (hit || p.life <= 0) projectiles.splice(i, 1);
    }

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.life -= dt;
        if (p.life <= 0) particles.splice(i, 1);
    }

    updatePirates(dt);
    updateWorld(dt);

    // Camera follow
    cam.x += (mainShip.x - V_WIDTH / 2 - cam.x) * 5 * dt;
    cam.y += (mainShip.y - V_HEIGHT / 2 - cam.y) * 5 * dt;
}

function drawGame() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#030308';
    ctx.fillRect(0, 0, V_WIDTH, V_HEIGHT);

    if (isMapOpen) {
        drawHologramMap();
        drawTouchButtons();
        return;
    }

    // Parallax Stars
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 200; i++) {
        let sx = ((i * 137.5) - cam.x * (0.1 + (i % 5) * 0.05)) % V_WIDTH;
        let sy = ((i * 243.1) - cam.y * (0.1 + (i % 5) * 0.05)) % V_HEIGHT;
        if (sx < 0) sx += V_WIDTH;
        if (sy < 0) sy += V_HEIGHT;
        ctx.globalAlpha = 0.2 + (i % 5) * 0.15;
        ctx.fillRect(sx, sy, i % 3 === 0 ? 2 : 1, i % 3 === 0 ? 2 : 1);
    }
    ctx.globalAlpha = 1;

    ctx.translate(-Math.floor(cam.x), -Math.floor(cam.y));

    // World & Entities
    drawPlanets(ctx, mainShip.x, mainShip.y);

    projectiles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    });

    particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillRect(p.x, p.y, 3, 3);
    });
    ctx.globalAlpha = 1;

    // Draw ships (sorted by size so big ships are below)
    let sortedShips = [...ships].sort((a, b) => b.type.size - a.type.size);
    sortedShips.forEach(s => s.draw(ctx));

    if (isManagerOpen) drawManager(); else drawHUD();
}

// ==========================================
// 8. MENUS (Start & Faction Select)
// ==========================================

function drawButton(text, x, y, w, h, isActive) {
    let hover = mouse.x > x && mouse.x < x + w && mouse.y > y && mouse.y < y + h;
    ctx.fillStyle = isActive ? 'rgba(0,150,255,0.5)' : (hover ? 'rgba(255,255,255,0.2)' : 'rgba(50,50,80,0.5)');
    ctx.strokeStyle = isActive ? '#0ff' : '#888';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 5); ctx.fill(); ctx.stroke();

    ctx.fillStyle = isActive ? '#fff' : '#ddd';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + w / 2, y + h / 2);

    return hover && mouse.clicked;
}

function updateMenu() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#030308';
    ctx.fillRect(0, 0, V_WIDTH, V_HEIGHT);

    // Parallax Menu Stars
    let t = Date.now() * 0.05;
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 150; i++) {
        let sx = ((i * 123) + t * (0.5 + i % 3)) % V_WIDTH;
        let sy = ((i * 321) + t * (0.2 + i % 2)) % V_HEIGHT;
        ctx.fillRect(sx, sy, 2, 2);
    }

    if (state === GAME_STATES.MENU) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 60px monospace';
        ctx.textAlign = 'center';
        ctx.fillText("GALACTIC COMMAND", V_WIDTH / 2, V_HEIGHT / 2 - 50);

        ctx.font = '24px monospace';
        ctx.fillStyle = (Math.floor(Date.now() / 500) % 2 === 0) ? '#0ff' : '#fff';
        ctx.fillText("KLICKE UM ZU STARTEN", V_WIDTH / 2, V_HEIGHT / 2 + 50);

        if (mouse.clicked || touch.active) {
            state = GAME_STATES.FACTION_SELECT;
            mouse.clicked = false;
        }
    }
    else if (state === GAME_STATES.FACTION_SELECT) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 40px monospace';
        ctx.textAlign = 'center';
        ctx.fillText("FRAKTION & SCHWIERIGKEIT WÄHLEN", V_WIDTH / 2, 50);

        // Factions
        let fy = 120;
        for (let fKey in FACTIONS) {
            let f = FACTIONS[fKey];
            if (drawButton(f.name, 50, fy, 250, 60, selFaction === fKey)) selFaction = fKey;

            // Draw Emblem
            let spr = initSprite('emblem_' + fKey, SPRITES['emblem_' + fKey], f.palette, 3);
            ctx.drawImage(spr.img, 65, fy + 30 - spr.h / 2);

            fy += 75;
        }

        // Difficulty
        let dy = 120;
        for (let dKey in DIFFICULTY) {
            let d = DIFFICULTY[dKey];
            if (drawButton(d.name, V_WIDTH - 200, dy, 150, 50, selDiff.id === d.id)) selDiff = d;
            dy += 65;
        }

        // Selected difficulty info
        ctx.fillStyle = '#aaa';
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`Piratenflotten: ${selDiff.fleetSizeMin}-${selDiff.fleetSizeMax} Schiffe`, V_WIDTH - 125, dy + 10);

        // Selected Info Panel
        let pX = 350;
        let pY = 120;
        ctx.fillStyle = 'rgba(20,20,40,0.8)';
        ctx.strokeStyle = FACTIONS[selFaction].palette['2'];
        ctx.beginPath(); ctx.roundRect(pX, pY, V_WIDTH - 600, 400, 10); ctx.fill(); ctx.stroke();

        ctx.fillStyle = FACTIONS[selFaction].palette['1'];
        ctx.font = 'bold 30px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(FACTIONS[selFaction].name, pX + 30, pY + 40);

        // Ships Preview
        let sx = pX + 50;
        for (let tKey of ['destroyer', 'cruiser', 'transport', 'fighter']) {
            let spr = initSprite(`${selFaction}_${tKey}`, SPRITES[`${selFaction}_${tKey}`], FACTIONS[selFaction].palette, SHIP_TYPES[tKey].size * 1.5);
            ctx.drawImage(spr.img, sx - spr.w / 2, pY + 130 - spr.h / 2);

            ctx.fillStyle = '#fff'; ctx.font = '16px monospace'; ctx.textAlign = 'center';
            ctx.fillText(SHIP_TYPES[tKey].name, sx, pY + 200);

            let stats = SHIP_STATS[`${selFaction}_${tKey}`];
            ctx.fillStyle = '#aaa'; ctx.font = '12px monospace';
            ctx.fillText(`HP: ${stats.hp}`, sx, pY + 220);
            ctx.fillText(`DMG: ${stats.dmg}`, sx, pY + 235);
            ctx.fillText(`SPD: ${SHIP_TYPES[tKey].maxSpeed}`, sx, pY + 250);
            ctx.fillText(`KOST: $${stats.cost}`, sx, pY + 265);

            sx += (V_WIDTH - 600) / 4;
        }

        // Start Game
        if (drawButton("SPIEL STARTEN", V_WIDTH / 2 - 150, V_HEIGHT - 100, 300, 60, false)) {
            startGame();
        }
    }
}

function startGame() {
    ships = [];
    projectiles = [];
    particles = [];
    planets.clear();
    playerCredits = 1500;
    nextShipId = 0;
    nextFleetId = 1;
    isMapOpen = false;
    isManagerOpen = false;
    managerSel = null;
    managerScroll = 0;
    gameTime = 0;
    playerPlanetList = [];
    touch.captureOn = false;
    mainShip = null;

    // Create Main Ship
    let first = new Ship(0, 0, 'destroyer', selFaction, true);
    ships.push(first);
    setControlledShip(first);

    // Piraten-Slots: maximal 3 Flotten gleichzeitig, gestaffelter erster Spawn
    pirateSlots = PIRATE_CONFIG.firstSpawnDelays
        .slice(0, PIRATE_CONFIG.maxFleets)
        .map(delay => ({ fleetId: null, timer: delay }));

    cam.x = -V_WIDTH / 2; cam.y = -V_HEIGHT / 2;
    state = GAME_STATES.GAME;
    mouse.clicked = false;
}

// ==========================================
// 9. KERN-LOOP
// ==========================================

function loop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    let dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    // Max dt to prevent physics glitches if tab is inactive
    if (dt > 0.1) dt = 0.1;

    if (state === GAME_STATES.GAME) {
        updateGame(dt);
        if (state === GAME_STATES.GAME) drawGame();
    } else {
        updateMenu();
    }

    mouse.clicked = false; // Reset click per frame
    justPressed = {};      // Reset "neu gedrückt" per frame
    requestAnimationFrame(loop);
}

resize();
requestAnimationFrame(loop);
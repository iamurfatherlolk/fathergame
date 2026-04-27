// ============================================================
// FPS GAME - 遊戲邏輯
// 無限背包 + 真實後座力
// ============================================================

import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { Sky } from 'three/addons/objects/Sky.js';

// ============================================================
// 槍械系統 (GunSystem) - 武器系統核心
// ============================================================
class GunSystem {
    constructor(scene, camera, playerController) {
        this.scene = scene;
        this.camera = camera;
        this.playerController = playerController;
        this.buildings = [];
        
        // ===== 無限背包系統 =====
        this.maxWeaponSlots = 99;
        this.weapons = {};
        this.gunModels = {};
        this.currentSlot = 1;
        for (let i = 1; i <= this.maxWeaponSlots; i++) {
            this.weapons[i] = null;
            this.gunModels[i] = null;
        }
        // =====================
        
        this.canShoot = true;
        this.isAiming = false;
        this.isFiring = false;
        this.fireInterval = null;
        this.bulletHoles = [];
        this.maxBulletHoles = 100;
        this.droppedWeapons = [];
        this.createBulletHoleTexture();
        
        // ===== 武器設定 =====
        this.gunConfigs = {
            pistol: { name: '手槍', damage: 25, fireRate: 0.25, ammo: 12, maxAmmo: 12, recoil: 0.12, hipSpread: 0.06, aimSpread: 0.012, aimFOV: 60, modelColor: 0x333333, auto: false },
            rifle: { name: '步槍', damage: 35, fireRate: 0.1, ammo: 30, maxAmmo: 30, recoil: 0.18, hipSpread: 0.05, aimSpread: 0.008, aimFOV: 50, modelColor: 0x2a5a2a, auto: true },
            shotgun: { name: '散彈槍', damage: 18, fireRate: 0.9, ammo: 6, maxAmmo: 6, recoil: 0.5, hipSpread: 0.18, aimSpread: 0.08, aimFOV: 65, modelColor: 0x4a3a2a, pellets: 8, auto: false },
            smg: { name: '衝鋒槍', damage: 20, fireRate: 0.05, ammo: 25, maxAmmo: 25, recoil: 0.08, hipSpread: 0.08, aimSpread: 0.025, aimFOV: 55, modelColor: 0x222244, auto: true },
            sniper: { name: '狙擊槍', damage: 100, fireRate: 1.2, ammo: 5, maxAmmo: 5, recoil: 0.6, hipSpread: 0.015, aimSpread: 0.0008, aimFOV: 40, modelColor: 0x1a1a1a, auto: false },
            launcher: { name: '榴彈發射器', damage: 200, fireRate: 2.5, ammo: 2, maxAmmo: 2, recoil: 0.8, hipSpread: 0, aimSpread: 0, aimFOV: 70, modelColor: 0x3a3a1a, auto: false }
        };
        
        this.spawns = [];
        this.weaponNameEl = document.getElementById('weapon-name');
        this.ammoDisplayEl = document.getElementById('ammo-display');
        this.pickupPromptEl = document.getElementById('pickup-prompt');
        this.muzzleFlashEl = document.getElementById('muzzle-flash');
        this.slotElements = { 1: document.getElementById('slot-1'), 2: document.getElementById('slot-2'), 3: document.getElementById('slot-3'), 4: document.getElementById('slot-4'), 5: document.getElementById('slot-5'), 6: document.getElementById('slot-6') };
        this.baseFOV = 75;
        this.targetFOV = 75;
        this.createSpawns();
        this.setupInput();
        this.updateWeaponUI();
        console.log('GunSystem initialized - 無限背包已啟用');
    }
    
    createBulletHoleTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, 128, 128);
        ctx.beginPath();
        ctx.arc(64, 64, 50, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(20, 15, 10, 0.9)';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(64, 64, 45, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(40, 30, 25, 0.95)';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(64, 64, 35, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(5, 3, 2, 1)';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(64, 64, 20, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 1)';
        ctx.fill();
        this.bulletHoleTexture = new THREE.CanvasTexture(canvas);
        this.bulletHoleTexture.wrapS = THREE.RepeatWrapping;
        this.bulletHoleTexture.wrapT = THREE.RepeatWrapping;
    }
    
    createSpawns() {
        const spawnConfigs = [
            { x: 5, z: 5, type: 'pistol' },
            { x: -5, z: 5, type: 'rifle' },
            { x: 8, z: -5, type: 'shotgun' },
            { x: -8, z: -5, type: 'smg' },
            { x: 0, z: 10, type: 'sniper' },
            { x: 0, z: -10, type: 'launcher' }
        ];
        spawnConfigs.forEach((config, index) => {
            this.createWeaponSpawn(config.type, config.x, config.z, index);
        });
    }
    
    createWeaponModel(type) {
        const config = this.gunConfigs[type];
        const group = new THREE.Group();
        const gunMat = new THREE.MeshStandardMaterial({ color: config.modelColor, roughness: 0.4, metalness: 0.8 });
        const accentMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3, metalness: 0.9 });
        
        if (type === 'pistol') {
            group.add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.2), gunMat));
            const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.15), accentMat);
            barrel.position.set(0, 0.01, -0.17);
            group.add(barrel);
            const handle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.06), gunMat);
            handle.position.set(0, -0.09, 0.04);
            handle.rotation.x = -0.3;
            group.add(handle);
        } else if (type === 'rifle') {
            group.add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.4), gunMat));
            const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.35), accentMat);
            barrel.position.set(0, 0.01, -0.37);
            group.add(barrel);
            const stock = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.15), gunMat);
            stock.position.set(0, -0.01, 0.27);
            group.add(stock);
        } else if (type === 'shotgun') {
            group.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.5), gunMat));
            const stock = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.2), gunMat);
            stock.position.set(0, -0.03, 0.32);
            group.add(stock);
        } else if (type === 'smg') {
            group.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.25), gunMat));
            const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.2), accentMat);
            barrel.position.set(0, 0.01, -0.22);
            group.add(barrel);
        } else if (type === 'sniper') {
            group.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.5), gunMat));
            const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.45), accentMat);
            barrel.position.set(0, 0.01, -0.47);
            group.add(barrel);
            const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 8), accentMat);
            scope.rotation.x = Math.PI / 2;
            scope.position.set(0, 0.06, -0.1);
            group.add(scope);
        } else if (type === 'launcher') {
            group.add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.35), gunMat));
            const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8), accentMat);
            barrel.rotation.x = Math.PI / 2;
            barrel.position.set(0, 0.02, -0.32);
            group.add(barrel);
        }
        return group;
    }
    
    createWeaponSpawn(type, x, z, spawnIndex) {
        const group = new THREE.Group();
        const platformGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.06, 16);
        const platformMat = new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.5 });
        const platform = new THREE.Mesh(platformGeo, platformMat);
        platform.position.y = 0.03;
        group.add(platform);
        const ringGeo = new THREE.TorusGeometry(0.4, 0.025, 8, 32);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.7 });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.35;
        group.add(ring);
        const weapon = this.createWeaponModel(type);
        weapon.position.y = 0.6;
        weapon.rotation.y = Math.PI / 4;
        group.add(weapon);
        group.position.set(x, 0, z);
        this.scene.add(group);
        this.spawns.push({ type, group, ring, weapon, platform, position: { x, z }, index: spawnIndex, isActive: true, respawnTime: 0 });
    }
    
    setupInput() {
        document.addEventListener('mousedown', (e) => {
            if (e.button === 0 && document.pointerLockElement) this.startFiring();
        });
        document.addEventListener('mouseup', (e) => {
            if (e.button === 0) this.stopFiring();
        });
        document.addEventListener('mousedown', (e) => {
            if (e.button === 2 && this.getCurrentWeapon()) {
                this.isAiming = true;
                document.body.classList.add('aiming');
                this.targetFOV = this.getCurrentWeapon().config.aimFOV;
            }
        });
        document.addEventListener('mouseup', (e) => {
            if (e.button === 2) {
                this.isAiming = false;
                document.body.classList.remove('aiming');
                this.targetFOV = this.baseFOV;
            }
        });
        document.addEventListener('contextmenu', (e) => e.preventDefault());
        document.addEventListener('wheel', (e) => {
            if (e.deltaY > 0) this.switchToNextSlot();
            else this.switchToPrevSlot();
        });
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Tab') {
                e.preventDefault();
                this.toggleInventory();
            }
            if (e.code === 'Digit1') this.switchToSlot(1);
            if (e.code === 'Digit2') this.switchToSlot(2);
            if (e.code === 'Digit3') this.switchToSlot(3);
            if (e.code === 'Digit4') this.switchToSlot(4);
            if (e.code === 'Digit5') this.switchToSlot(5);
            if (e.code === 'Digit6') this.switchToSlot(6);
            if (e.code === 'KeyE') this.tryPickup();
            if (e.code === 'KeyR' && this.getCurrentWeapon()) {
                this.getCurrentWeapon().config.ammo = this.getCurrentWeapon().config.maxAmmo;
                this.updateWeaponUI();
            }
            if (e.code === 'KeyQ' && this.getCurrentWeapon()) this.dropCurrentWeapon();
        });
        this.setupInventoryUI();
    }
    
    setupInventoryUI() {
        const invSlots = document.querySelectorAll('.inv-slot');
        const btnEquip = document.getElementById('btn-equip');
        const btnDrop = document.getElementById('btn-drop');
        this.selectedInventorySlot = null;
        invSlots.forEach(slot => {
            slot.addEventListener('click', () => {
                const slotNum = parseInt(slot.dataset.slot);
                this.selectInventorySlot(slotNum);
            });
        });
        btnEquip?.addEventListener('click', () => {
            if (this.selectedInventorySlot !== null) {
                this.switchToSlot(this.selectedInventorySlot);
                this.closeInventory();
            }
        });
        btnDrop?.addEventListener('click', () => {
            if (this.selectedInventorySlot !== null) {
                this.dropWeaponFromSlot(this.selectedInventorySlot);
                this.closeInventory();
            }
        });
    }
    
    toggleInventory() {
        const overlay = document.getElementById('inventory-overlay');
        if (overlay.classList.contains('open')) this.closeInventory();
        else this.openInventory();
    }
    
    openInventory() {
        const overlay = document.getElementById('inventory-overlay');
        overlay.classList.add('open');
        this.updateInventoryUI();
        if (document.pointerLockElement) document.exitPointerLock();
    }
    
    closeInventory() {
        const overlay = document.getElementById('inventory-overlay');
        overlay.classList.remove('open');
        this.selectedInventorySlot = null;
    }
    
    updateInventoryUI() {
        const invSlots = document.querySelectorAll('.inv-slot');
        invSlots.forEach((slot, index) => {
            const slotNum = index + 1;
            const weapon = this.weapons[slotNum];
            const content = slot.querySelector('.inv-slot-content');
            const info = slot.querySelector('.inv-slot-info');
            if (weapon) {
                content.textContent = weapon.config.name;
                info.textContent = `${weapon.config.ammo}/${weapon.config.maxAmmo}`;
                slot.classList.remove('empty');
            } else {
                content.textContent = '-';
                info.textContent = '';
                slot.classList.add('empty');
            }
            slot.classList.toggle('selected', slotNum === this.selectedInventorySlot);
        });
    }
    
    selectInventorySlot(slotNum) {
        this.selectedInventorySlot = slotNum;
        this.updateInventoryUI();
    }
    
    startFiring() {
        if (!this.getCurrentWeapon()) return;
        this.isFiring = true;
        this.shoot();
        const weapon = this.getCurrentWeapon();
        if (weapon?.config.auto) {
            this.fireInterval = setInterval(() => {
                if (this.isFiring && this.getCurrentWeapon()) this.shoot();
            }, weapon.config.fireRate * 1000);
        }
    }
    
    stopFiring() {
        this.isFiring = false;
        if (this.fireInterval) {
            clearInterval(this.fireInterval);
            this.fireInterval = null;
        }
    }
    
    getCurrentWeapon() { return this.weapons[this.currentSlot]; }
    
    switchToSlot(slot) {
        if (slot < 1 || slot > this.maxWeaponSlots || !this.weapons[slot]) return;
        this.stopFiring();
        this.currentSlot = slot;
        this.updateWeaponModel();
        this.updateWeaponUI();
    }
    
    switchToNextSlot() {
        for (let i = 1; i <= this.maxWeaponSlots; i++) {
            const nextSlot = ((this.currentSlot + i - 1) % this.maxWeaponSlots) + 1;
            if (this.weapons[nextSlot]) { this.switchToSlot(nextSlot); break; }
        }
    }
    
    switchToPrevSlot() {
        for (let i = 1; i <= this.maxWeaponSlots; i++) {
            const prevSlot = ((this.currentSlot - i - 1 + this.maxWeaponSlots) % this.maxWeaponSlots) + 1;
            if (this.weapons[prevSlot]) { this.switchToSlot(prevSlot); break; }
        }
    }
    
    updateWeaponModel() {
        for (let i = 1; i <= this.maxWeaponSlots; i++) {
            if (this.gunModels[i]) { this.camera.remove(this.gunModels[i]); this.gunModels[i] = null; }
        }
        const weapon = this.getCurrentWeapon();
        if (weapon) {
            const model = this.createWeaponModel(weapon.type);
            this.camera.add(model);
            model.position.set(0.25, -0.2, -0.45);
            model.rotation.set(0, Math.PI, 0);
            this.gunModels[this.currentSlot] = model;
        }
    }
    
    tryPickup() {
        const playerPos = this.camera.position;
        for (let i = this.droppedWeapons.length - 1; i >= 0; i--) {
            const dropped = this.droppedWeapons[i];
            const dist = Math.sqrt(Math.pow(playerPos.x - dropped.position.x, 2) + Math.pow(playerPos.z - dropped.position.z, 2));
            if (dist < 3.5) { this.pickupDroppedWeapon(i); return; }
        }
        for (const spawn of this.spawns) {
            if (!spawn.group.parent || !spawn.isActive) continue;
            const dist = Math.sqrt(Math.pow(playerPos.x - spawn.position.x, 2) + Math.pow(playerPos.z - spawn.position.z, 2));
            if (dist < 3.5) {
                let emptySlot = null;
                for (let i = 1; i <= this.maxWeaponSlots; i++) { if (!this.weapons[i]) { emptySlot = i; break; } }
                this.pickupWeapon(spawn, emptySlot || this.currentSlot);
                return;
            }
        }
    }
    
    pickupDroppedWeapon(droppedIndex) {
        const dropped = this.droppedWeapons[droppedIndex];
        const config = this.gunConfigs[dropped.type];
        this.scene.remove(dropped.mesh);
        let emptySlot = null;
        for (let i = 1; i <= this.maxWeaponSlots; i++) { if (!this.weapons[i]) { emptySlot = i; break; } }
        const slot = emptySlot || this.currentSlot;
        if (this.gunModels[slot]) this.camera.remove(this.gunModels[slot]);
        this.weapons[slot] = { type: dropped.type, config: { ...config, ammo: dropped.ammo } };
        this.droppedWeapons.splice(droppedIndex, 1);
        if (slot === this.currentSlot) this.updateWeaponModel();
        this.updateWeaponUI();
    }
    
    pickupWeapon(spawn, slot) {
        const type = spawn.type;
        const config = this.gunConfigs[type];
        spawn.isActive = false;
        spawn.respawnTime = 30;
        spawn.weapon.visible = false;
        spawn.platform.material.opacity = 0.15;
        spawn.ring.material.opacity = 0.2;
        if (this.gunModels[slot]) this.camera.remove(this.gunModels[slot]);
        this.weapons[slot] = { type, config: { ...config } };
        if (slot === this.currentSlot) this.updateWeaponModel();
        this.updateWeaponUI();
    }
    
    dropCurrentWeapon() {
        const weapon = this.getCurrentWeapon();
        if (!weapon) return;
        const dropPos = this.camera.position.clone();
        const direction = new THREE.Vector3();
        this.camera.getWorldDirection(direction);
        dropPos.add(direction.multiplyScalar(1.5));
        dropPos.y = 0.5;
        const weaponMesh = this.createWeaponModel(weapon.type);
        weaponMesh.scale.set(1.5, 1.5, 1.5);
        weaponMesh.position.copy(dropPos);
        weaponMesh.rotation.y = Math.PI / 4;
        this.scene.add(weaponMesh);
        this.droppedWeapons.push({ type: weapon.type, position: dropPos.clone(), mesh: weaponMesh, ammo: weapon.config.ammo });
        if (this.gunModels[this.currentSlot]) { this.camera.remove(this.gunModels[this.currentSlot]); this.gunModels[this.currentSlot] = null; }
        this.weapons[this.currentSlot] = null;
        for (let i = 1; i <= this.maxWeaponSlots; i++) { if (this.weapons[i]) { this.switchToSlot(i); break; } }
        this.updateWeaponUI();
    }
    
    dropWeaponFromSlot(slotNum) {
        const weapon = this.weapons[slotNum];
        if (!weapon) return;
        const dropPos = this.camera.position.clone();
        const direction = new THREE.Vector3();
        this.camera.getWorldDirection(direction);
        dropPos.add(direction.multiplyScalar(1.5));
        dropPos.y = 0.5;
        const weaponMesh = this.createWeaponModel(weapon.type);
        weaponMesh.scale.set(1.5, 1.5, 1.5);
        weaponMesh.position.copy(dropPos);
        weaponMesh.rotation.y = Math.PI / 4;
        this.scene.add(weaponMesh);
        this.droppedWeapons.push({ type: weapon.type, position: dropPos.clone(), mesh: weaponMesh, ammo: weapon.config.ammo });
        if (slotNum === this.currentSlot && this.gunModels[slotNum]) { this.camera.remove(this.gunModels[slotNum]); this.gunModels[slotNum] = null; }
        this.weapons[slotNum] = null;
        if (slotNum === this.currentSlot) {
            for (let i = 1; i <= this.maxWeaponSlots; i++) { if (this.weapons[i]) { this.switchToSlot(i); break; } }
        }
        this.updateWeaponUI();
    }
    
    updateWeaponUI() {
        for (let i = 1; i <= 6; i++) {
            const slotEl = this.slotElements[i];
            if (!slotEl) continue;
            const weapon = this.weapons[i];
            const nameEl = slotEl.querySelector('.slot-name');
            if (weapon) { nameEl.textContent = weapon.config.name; slotEl.classList.remove('empty'); }
            else { nameEl.textContent = '-'; slotEl.classList.add('empty'); }
            slotEl.classList.toggle('active', i === this.currentSlot);
        }
        const weapon = this.getCurrentWeapon();
        if (weapon) {
            this.weaponNameEl.textContent = weapon.config.name;
            this.ammoDisplayEl.innerHTML = `<span class="current">${weapon.config.ammo}</span> <span class="max">/ ${weapon.config.maxAmmo}</span>`;
            this.pickupPromptEl.classList.remove('visible');
        } else {
            this.weaponNameEl.textContent = '無武器';
            this.ammoDisplayEl.innerHTML = '<span class="current">--</span> <span class="max">/ --</span>';
        }
        this.checkNearbySpawn();
    }
    
    checkNearbySpawn() {
        const playerPos = this.camera.position;
        for (const dropped of this.droppedWeapons) {
            const dist = Math.sqrt(Math.pow(playerPos.x - dropped.position.x, 2) + Math.pow(playerPos.z - dropped.position.z, 2));
            if (dist < 3.5) {
                this.pickupPromptEl.textContent = `[E] 拾取 ${this.gunConfigs[dropped.type].name}`;
                this.pickupPromptEl.classList.add('visible');
                return;
            }
        }
        for (const spawn of this.spawns) {
            if (!spawn.group.parent) continue;
            const dist = Math.sqrt(Math.pow(playerPos.x - spawn.position.x, 2) + Math.pow(playerPos.z - spawn.position.z, 2));
            if (dist < 3.5) {
                if (spawn.isActive) {
                    this.pickupPromptEl.textContent = `[E] 拾取 ${this.gunConfigs[spawn.type].name}`;
                } else {
                    this.pickupPromptEl.textContent = `⏱️ ${this.gunConfigs[spawn.type].name} 冷卻中`;
                }
                this.pickupPromptEl.classList.add('visible');
                return;
            }
        }
        this.pickupPromptEl.classList.remove('visible');
    }
    
    shoot() {
        const weapon = this.getCurrentWeapon();
        if (!weapon || !this.canShoot || weapon.config.ammo <= 0) return;
        weapon.config.ammo--;
        this.canShoot = false;
        this.muzzleFlashEl.classList.add('flash');
        setTimeout(() => this.muzzleFlashEl.classList.remove('flash'), 50);
        
        // ===== 後座力應用 =====
        const baseRecoil = weapon.config.recoil;
        if (this.playerController) {
            this.playerController.recoilBuildup = Math.min((this.playerController.recoilBuildup || 0) + baseRecoil * 0.5, baseRecoil * 3);
            this.playerController.muzzleClimb = Math.min((this.playerController.muzzleClimb || 0) + baseRecoil * 0.8, baseRecoil * 4);
            this.playerController.recoilX = (Math.random() - 0.5) * baseRecoil * 1.5;
        }
        // ====================
        
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
        const currentSpread = this.isAiming ? weapon.config.aimSpread : weapon.config.hipSpread;
        raycaster.ray.direction.x += (Math.random() - 0.5) * currentSpread;
        raycaster.ray.direction.y += (Math.random() - 0.5) * currentSpread;
        raycaster.ray.direction.normalize();
        
        if (this.targetSystem) {
            for (const target of this.targetSystem.targets) {
                if (target.isDestroyed) continue;
                const hits = raycaster.intersectObject(target.mesh);
                if (hits.length > 0) { this.targetSystem.takeDamage(weapon.config.damage, target.index); break; }
            }
        }
        
        // 檢查殭屍命中
        if (this.zombieSystem) {
            const hitZombieIndex = this.zombieSystem.checkBulletHit(raycaster);
            if (hitZombieIndex >= 0) {
                this.zombieSystem.killZombie(hitZombieIndex, this.playerController?.game || window.game);
            }
        }
        
        setTimeout(() => { this.canShoot = true; }, weapon.config.fireRate * 1000);
        this.updateWeaponUI();
    }
    
    updateSpawnRespawn(delta) {
        for (const spawn of this.spawns) {
            if (!spawn.isActive && spawn.respawnTime > 0) {
                spawn.respawnTime -= delta;
                if (spawn.respawnTime <= 0) {
                    spawn.isActive = true;
                    spawn.weapon.visible = true;
                    spawn.platform.material.opacity = 0.5;
                    spawn.ring.material.opacity = 0.7;
                }
            }
        }
    }
    
    update(delta) {
        const time = performance.now() * 0.001;
        for (const spawn of this.spawns) {
            if (spawn.group.parent && spawn.weapon.visible) {
                spawn.weapon.position.y = 0.6 + Math.sin(time * 2) * 0.08;
                spawn.weapon.rotation.y += 0.01;
            }
        }
        for (const dropped of this.droppedWeapons) {
            if (dropped.mesh) {
                dropped.mesh.position.y = 0.5 + Math.sin(time * 3) * 0.05;
                dropped.mesh.rotation.y += 0.02;
            }
        }
        this.updateSpawnRespawn(delta);
        this.checkNearbySpawn();
        
        // FOV 動畫
        if (Math.abs(this.camera.fov - this.targetFOV) > 0.5) {
            this.camera.fov += (this.targetFOV - this.camera.fov) * 0.2;
            this.camera.updateProjectionMatrix();
        }
        
        // 武器晃動
        const weapon = this.getCurrentWeapon();
        if (weapon) {
            const model = this.gunModels[this.currentSlot];
            if (model) {
                const recoilY = this.playerController?.muzzleClimb || 0;
                model.position.y = -0.2 - recoilY * 0.1 + Math.sin(time * 2) * 0.003;
                model.position.x = 0.25 + Math.sin(time * 3) * 0.002;
            }
        }
    }
}

// ============================================================
// 玩家控制器
// ============================================================
class PlayerController {
    constructor(camera, colliders = []) {
        this.camera = camera;
        this.colliders = colliders;
        this.velocity = new THREE.Vector3();
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.isSprinting = false;
        this.isOnGround = true;
        this.isCrouching = false;
        this.moveSpeed = 10;
        this.sprintMultiplier = 2;
        this.jumpForce = 12;
        this.gravity = -30;
        this.standHeight = 1.7;
        this.crouchHeight = 0.9;
        this.currentHeight = this.standHeight;
        this.groundLevel = 0;
        this.playerRadius = 0.5;
        
        // 後座力
        this.recoilBuildup = 0;
        this.muzzleClimb = 0;
        this.recoilX = 0;
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        document.addEventListener('keyup', (e) => this.onKeyUp(e));
    }
    
    onKeyDown(event) {
        switch (event.code) {
            case 'KeyW': case 'ArrowUp': this.moveForward = true; break;
            case 'KeyS': case 'ArrowDown': this.moveBackward = true; break;
            case 'KeyA': case 'ArrowLeft': this.moveLeft = true; break;
            case 'KeyD': case 'ArrowRight': this.moveRight = true; break;
            case 'ShiftLeft': case 'ShiftRight': if (!this.isCrouching) this.isSprinting = true; break;
            case 'Space': if (this.isOnGround && !this.isCrouching) { this.velocity.y = this.jumpForce; this.isOnGround = false; } break;
            case 'KeyC': if (this.isOnGround) { this.isCrouching = true; this.isSprinting = false; } break;
        }
    }
    
    onKeyUp(event) {
        switch (event.code) {
            case 'KeyW': case 'ArrowUp': this.moveForward = false; break;
            case 'KeyS': case 'ArrowDown': this.moveBackward = false; break;
            case 'KeyA': case 'ArrowLeft': this.moveLeft = false; break;
            case 'KeyD': case 'ArrowRight': this.moveRight = false; break;
            case 'ShiftLeft': case 'ShiftRight': this.isSprinting = false; break;
            case 'KeyC': this.isCrouching = false; break;
        }
    }
    
    checkCollision(x, z) {
        for (const col of this.colliders) {
            if (x >= col.minX - this.playerRadius && x <= col.maxX + this.playerRadius &&
                z >= col.minZ - this.playerRadius && z <= col.maxZ + this.playerRadius) return true;
        }
        return false;
    }
    
    update(delta, controls) {
        const targetHeight = this.isCrouching ? this.crouchHeight : this.standHeight;
        this.currentHeight += (targetHeight - this.currentHeight) * 10 * delta;
        
        const direction = new THREE.Vector3();
        controls.getDirection(direction);
        direction.y = 0;
        direction.normalize();
        
        const right = new THREE.Vector3();
        right.crossVectors(direction, new THREE.Vector3(0, 1, 0));
        
        let speed = this.moveSpeed * (this.isSprinting ? this.sprintMultiplier : 1) * (this.isCrouching ? 0.5 : 1);
        
        let newX = this.camera.position.x;
        let newZ = this.camera.position.z;
        
        if (this.moveForward) { newX += direction.x * speed * delta; newZ += direction.z * speed * delta; }
        if (this.moveBackward) { newX -= direction.x * speed * delta; newZ -= direction.z * speed * delta; }
        if (this.moveRight) { newX += right.x * speed * delta; newZ += right.z * speed * delta; }
        if (this.moveLeft) { newX -= right.x * speed * delta; newZ -= right.z * speed * delta; }
        
        if (!this.checkCollision(newX, this.camera.position.z)) this.camera.position.x = newX;
        if (!this.checkCollision(this.camera.position.x, newZ)) this.camera.position.z = newZ;
        
        this.velocity.y += this.gravity * delta;
        this.camera.position.y += this.velocity.y * delta;
        
        const groundY = this.groundLevel + this.currentHeight;
        if (this.camera.position.y <= groundY) {
            this.camera.position.y = groundY;
            this.velocity.y = 0;
            this.isOnGround = true;
        } else {
            this.isOnGround = false;
        }
        
        // 後座力恢復
        if (this.muzzleClimb > 0) this.muzzleClimb *= 0.92;
        if (this.recoilBuildup > 0) this.recoilBuildup *= 0.95;
        this.recoilX *= 0.88;
    }
}

// ============================================================
// 場景管理
// ============================================================
class SceneManager {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
        this.camera.position.set(0, 1.7, 5);
        this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(1);
        this.renderer.shadowMap.enabled = false;
        document.getElementById('canvas-container').appendChild(this.renderer.domElement);
        window.addEventListener('resize', () => this.onResize());
    }
    
    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    render() { this.renderer.render(this.scene, this.camera); }
}

// ============================================================
// 燈光
// ============================================================
class LightingManager {
    constructor(scene) {
        this.scene = scene;
        this.ambientLight = new THREE.AmbientLight(0xb4c7dc, 0.8);
        this.scene.add(this.ambientLight);
        this.directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
        this.directionalLight.position.set(100, 150, 100);
        this.scene.add(this.directionalLight);
    }
}

// ============================================================
// 天空
// ============================================================
class SkyManager {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.sky = new Sky();
        this.sky.scale.setScalar(10000);
        this.scene.add(this.sky);
        this.configureSky();
    }
    
    configureSky() {
        const uniforms = this.sky.material.uniforms;
        uniforms['turbidity'].value = 3;
        uniforms['rayleigh'].value = 0.5;
        uniforms['mieCoefficient'].value = 0.005;
        uniforms['mieDirectionalG'].value = 0.8;
        this.updateSunPosition(100, 150, 100);
    }
    
    updateSunPosition(x, y, z) {
        const phi = THREE.MathUtils.degToRad(90 - y);
        const theta = THREE.MathUtils.degToRad(x);
        const sunPos = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
        this.sky.material.uniforms['sunPosition'].value.copy(sunPos);
    }
}

// ============================================================
// 地面
// ============================================================
class GroundManager {
    constructor(scene) {
        this.scene = scene;
        const geo = new THREE.PlaneGeometry(2000, 2000);
        const mat = new THREE.MeshLambertMaterial({ color: 0x3d5c3d });
        this.ground = new THREE.Mesh(geo, mat);
        this.ground.rotation.x = -Math.PI / 2;
        this.scene.add(this.ground);
    }
}

// ============================================================
// 目標系統
// ============================================================
class TargetSystem {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.targets = [];
        this.healthContainer = document.getElementById('target-health');
        this.healthFill = document.getElementById('target-health-fill');
        this.healthName = document.getElementById('target-name');
        this.createTargets();
    }
    
    createTargets() {
        const configs = [
            { x: 10, z: 0, name: '木箱', health: 50, color: 0x8B4513, scale: 1.5 },
            { x: -10, z: 0, name: '金屬桶', health: 100, color: 0x708090, scale: 1.2 },
            { x: 0, z: -15, name: '油桶', health: 75, color: 0xCD5C5C, scale: 1.0 },
            { x: 15, z: 15, name: '貨箱', health: 60, color: 0xDAA520, scale: 1.8 },
            { x: -15, z: 15, name: '鐵箱', health: 150, color: 0x4A4A4A, scale: 1.3 },
        ];
        configs.forEach((config, index) => this.createTarget(config, index));
    }
    
    createTarget(config, index) {
        const geo = new THREE.BoxGeometry(config.scale, config.scale, config.scale);
        const mat = new THREE.MeshLambertMaterial({ color: config.color });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(config.x, config.scale / 2, config.z);
        this.scene.add(mesh);
        
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, 128, 32);
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(4, 4, 120, 24);
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const healthBar = new THREE.Sprite(spriteMat);
        healthBar.scale.set(1.5, 0.4, 1);
        healthBar.position.set(0, config.scale + 0.8, 0);
        mesh.add(healthBar);
        
        this.targets.push({
            mesh, healthBar, healthBarCtx: ctx, healthBarTexture: texture,
            name: config.name, maxHealth: config.health, health: config.health,
            originalColor: config.color, index, isDestroyed: false, respawnTime: 0
        });
        mesh.userData.targetIndex = index;
    }
    
    takeDamage(damage, targetIndex) {
        const target = this.targets[targetIndex];
        if (!target || target.isDestroyed) return;
        target.health -= damage;
        target.mesh.material.color.setHex(0xff0000);
        setTimeout(() => { if (!target.isDestroyed) target.mesh.material.color.setHex(target.originalColor); }, 100);
        this.updateHealthBar(target);
        if (target.health <= 0) this.destroyTarget(target);
    }
    
    updateHealthBar(target) {
        const percent = Math.max(0, target.health / target.maxHealth);
        target.healthBarCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        target.healthBarCtx.fillRect(0, 0, 128, 32);
        let color = '#00ff00';
        if (percent <= 0.3) color = '#ff0000';
        else if (percent <= 0.6) color = '#ff6600';
        target.healthBarCtx.fillStyle = color;
        target.healthBarCtx.fillRect(4, 4, 120 * percent, 24);
        target.healthBarTexture.needsUpdate = true;
    }
    
    destroyTarget(target) {
        target.isDestroyed = true;
        target.respawnTime = 10;
        target.healthBar.visible = false;
        target.mesh.visible = false;
    }
    
    respawnTarget(target) {
        target.isDestroyed = false;
        target.health = target.maxHealth;
        target.mesh.visible = true;
        target.healthBar.visible = true;
        target.mesh.material.color.setHex(target.originalColor);
        this.updateHealthBar(target);
    }
    
    update(delta) {
        const time = performance.now() * 0.001;
        for (const target of this.targets) {
            if (!target.isDestroyed && target.mesh.visible) {
                target.mesh.position.y = target.mesh.geometry.parameters.height / 2 + Math.sin(time * 2) * 0.05;
            }
            if (target.isDestroyed && target.respawnTime > 0) {
                target.respawnTime -= delta;
                if (target.respawnTime <= 0) this.respawnTarget(target);
            }
        }
        
        // 瞄準指示器
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
        let nearest = null;
        let nearestDist = Infinity;
        for (const target of this.targets) {
            if (target.isDestroyed) continue;
            const hits = raycaster.intersectObject(target.mesh);
            if (hits.length > 0 && hits[0].distance < nearestDist) {
                nearestDist = hits[0].distance;
                nearest = target;
            }
        }
        if (nearest) {
            this.healthContainer.classList.add('visible');
            this.healthName.textContent = nearest.name;
            const percent = (nearest.health / nearest.maxHealth) * 100;
            this.healthFill.style.width = percent + '%';
            this.healthFill.classList.remove('low', 'critical');
            if (percent <= 30) this.healthFill.classList.add('critical');
            else if (percent <= 60) this.healthFill.classList.add('low');
        } else {
            this.healthContainer.classList.remove('visible');
        }
    }
}

// ============================================================
// 殭屍系統
// ============================================================
class ZombieSystem {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.zombies = [];
        
        // 殭屍生成設定
        this.spawnTimer = 0;
        this.spawnInterval = 2; // 每2秒生成一隻
        this.zombieSpeed = 4; // 殭屍移動速度 (比玩家慢)
        this.damage = 10; // 每次碰撞扣血量
        this.zombieRadius = 0.8; // 殭屍碰撞半徑
        this.playerRadius = 0.8; // 玩家碰撞半徑
        
        // 生成範圍 (從畫面邊界外生成)
        this.spawnDistance = 50; // 距離玩家至少50單位
    }
    
    spawnZombie() {
        // 隨機選擇生成邊界: 0=上, 1=下, 2=左, 3=右
        const side = Math.floor(Math.random() * 4);
        const playerPos = this.camera.position;
        let x, z;
        
        const offset = 30; // 生成位置偏離玩家的距離
        
        console.log('[Zombie] Spawning at side:', side, 'playerPos:', playerPos.x, playerPos.z);
        
        switch(side) {
            case 0: // 上 (正Z)
                x = playerPos.x + (Math.random() - 0.5) * 40;
                z = playerPos.z + offset;
                break;
            case 1: // 下 (負Z)
                x = playerPos.x + (Math.random() - 0.5) * 40;
                z = playerPos.z - offset;
                break;
            case 2: // 左 (負X)
                x = playerPos.x - offset;
                z = playerPos.z + (Math.random() - 0.5) * 40;
                break;
            case 3: // 右 (正X)
                x = playerPos.x + offset;
                z = playerPos.z + (Math.random() - 0.5) * 40;
                break;
        }
        
        console.log('[Zombie] Final position:', x, 0.9, z);
        
        // 建立殭屍模型 (綠色方塊)
        const geo = new THREE.BoxGeometry(1, 1.8, 1);
        const mat = new THREE.MeshLambertMaterial({ color: 0x2d5a2d });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, 0.9, z);
        this.scene.add(mesh);
        
        // 添加眼睛 (紅色)
        const eyeGeo = new THREE.SphereGeometry(0.15, 8, 8);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.2, 0.3, 0.4);
        mesh.add(leftEye);
        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.2, 0.3, 0.4);
        mesh.add(rightEye);
        
        this.zombies.push({
            mesh,
            health: 50,
            isDead: false
        });
    }
    
    update(delta, game) {
        if (game.isGameOver) return;
        
        // 生成計時器
        this.spawnTimer += delta;
        
        // 調試日志
        console.log('[Zombie Update] Timer:', this.spawnTimer.toFixed(2), 'Interval:', this.spawnInterval, 'Zombies:', this.zombies.length);
        
        if (this.spawnTimer >= this.spawnInterval) {
            this.spawnTimer = 0;
            this.spawnZombie();
        }
        
        const playerPos = this.camera.position;
        
        // 更新每隻殭屍
        for (let i = this.zombies.length - 1; i >= 0; i--) {
            const zombie = this.zombies[i];
            if (zombie.isDead) continue;
            
            // 計算朝向玩家的方向
            const direction = new THREE.Vector3();
            direction.x = playerPos.x - zombie.mesh.position.x;
            direction.z = playerPos.z - zombie.mesh.position.z;
            direction.normalize();
            
            // 移動殭屍
            zombie.mesh.position.x += direction.x * this.zombieSpeed * delta;
            zombie.mesh.position.z += direction.z * this.zombieSpeed * delta;
            
            // 讓殭屍面向玩家
            zombie.mesh.lookAt(playerPos.x, 0.9, playerPos.z);
            
            // 檢查與玩家的碰撞
            const dist = Math.sqrt(
                Math.pow(playerPos.x - zombie.mesh.position.x, 2) +
                Math.pow(playerPos.z - zombie.mesh.position.z, 2)
            );
            
            if (dist < this.zombieRadius + this.playerRadius) {
                // 碰撞發生，扣除玩家血量
                if (!game.isInvincible) {
                    game.takeDamage(this.damage);
                }
            }
            
            // 移除距離太遠的殭屍 (超過200單位)
            const distFromPlayer = Math.sqrt(
                Math.pow(playerPos.x - zombie.mesh.position.x, 2) +
                Math.pow(playerPos.z - zombie.mesh.position.z, 2)
            );
            if (distFromPlayer > 200) {
                this.removeZombie(i);
            }
        }
    }
    
    killZombie(index, game) {
        if (index < 0 || index >= this.zombies.length) return;
        const zombie = this.zombies[index];
        if (zombie.isDead) return;
        
        zombie.isDead = true;
        
        // 增加金錢
        game.money += 10;
        game.updateUI();
        
        // 移除殭屍模型
        this.removeZombie(index);
    }
    
    removeZombie(index) {
        if (index < 0 || index >= this.zombies.length) return;
        const zombie = this.zombies[index];
        if (zombie.mesh) {
            this.scene.remove(zombie.mesh);
        }
        this.zombies.splice(index, 1);
    }
    
    checkBulletHit(raycaster) {
        // 檢查子彈是否擊中殭屍
        for (let i = 0; i < this.zombies.length; i++) {
            const zombie = this.zombies[i];
            if (zombie.isDead) continue;
            
            const hits = raycaster.intersectObject(zombie.mesh);
            if (hits.length > 0) {
                return i; // 返回擊中的殭屍索引
            }
        }
        return -1;
    }
}

// ============================================================
// 控制管理
// ============================================================
class ControlsManager {
    constructor(controls, overlay) {
        this.controls = controls;
        this.overlay = overlay;
        document.getElementById('click-prompt').addEventListener('click', () => { document.body.requestPointerLock(); });
        document.addEventListener('pointerlockchange', () => {
            document.body.classList.toggle('locked', document.pointerLockElement === document.body);
            this.overlay.classList.toggle('hidden', document.pointerLockElement === document.body);
        });
    }
}

// ============================================================
// 遊戲循環
// ============================================================
class GameLoop {
    constructor(sceneManager, playerController, controls, gunSystem, targetSystem, game) {
        this.sceneManager = sceneManager;
        this.playerController = playerController;
        this.controls = controls;
        this.gunSystem = gunSystem;
        this.targetSystem = targetSystem;
        this.game = game;
        this.clock = new THREE.Clock();
        this.fpsElement = document.getElementById('fps');
        this.frameCount = 0;
        this.lastFpsUpdate = 0;
    }
    
    start() { this.animate(); }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        const time = performance.now();
        const delta = this.clock.getDelta();
        
        // 如果遊戲結束，停止更新但繼續渲染
        if (this.game && this.game.isGameOver) {
            this.sceneManager.render();
            return;
        }
        
        if (this.playerController) this.playerController.update(delta, this.controls);
        if (this.gunSystem) this.gunSystem.update(delta);
        if (this.targetSystem) this.targetSystem.update(delta);
        
        // 更新殭屍系統
        if (this.game && this.game.zombieSystem) {
            this.game.zombieSystem.update(delta, this.game);
        }
        
        // 更新無敵時間和閃爍效果
        if (this.game) {
            if (this.game.isInvincible) {
                this.game.invincibleTimer -= delta;
                if (this.game.invincibleTimer <= 0) {
                    this.game.isInvincible = false;
                    this.game.isFlashing = false;
                    // 恢復相機可見性
                    this.sceneManager.camera.visible = true;
                } else {
                    // 閃爍效果
                    this.game.flashTimer += delta;
                    if (this.game.flashTimer >= this.game.flashInterval) {
                        this.game.flashTimer = 0;
                        this.sceneManager.camera.visible = !this.sceneManager.camera.visible;
                    }
                }
            }
        }
        
        this.sceneManager.render();
        this.frameCount++;
        if (time - this.lastFpsUpdate >= 1000) {
            this.fpsElement.textContent = `${this.frameCount} FPS`;
            this.frameCount = 0;
            this.lastFpsUpdate = time;
        }
    }
}

// ============================================================
// 遊戲主類別
// ============================================================
class Game {
    constructor() {
        this.colliders = [];
        this.buildings = [];
        
        // 玩家血量系統
        this.playerHP = 100;
        this.maxHP = 100;
        this.money = 0;
        this.isInvincible = false;
        this.invincibleTimer = 0;
        this.invincibleDuration = 1.5; // 1.5秒無敵時間
        this.isGameOver = false;
        
        // 閃爍效果計時器
        this.flashTimer = 0;
        this.flashInterval = 0.1;
        this.isFlashing = false;
        
        this.init();
    }
    
    async init() {
        this.sceneManager = new SceneManager();
        window.game = this;
        this.lightingManager = new LightingManager(this.sceneManager.scene);
        this.skyManager = new SkyManager(this.sceneManager.scene, this.sceneManager.camera);
        this.groundManager = new GroundManager(this.sceneManager.scene);
        this.loadBuildings();
        this.targetSystem = new TargetSystem(this.sceneManager.scene, this.sceneManager.camera);
        this.controls = new PointerLockControls(this.sceneManager.camera, document.body);
        this.playerController = new PlayerController(this.sceneManager.camera, this.colliders);
        this.gunSystem = new GunSystem(this.sceneManager.scene, this.sceneManager.camera, this.playerController);
        this.gunSystem.buildings = this.buildings;
        this.gunSystem.targetSystem = this.targetSystem;
        
        // 初始化殭屍系統
        this.zombieSystem = new ZombieSystem(this.sceneManager.scene, this.sceneManager.camera);
        this.gunSystem.zombieSystem = this.zombieSystem;
        
        this.controlsManager = new ControlsManager(this.controls, document.getElementById('start-overlay'));
        this.gameLoop = new GameLoop(this.sceneManager, this.playerController, this.controls, this.gunSystem, this.targetSystem, this);
        this.gameLoop.start();
        
        // 初始化UI
        this.updateUI();
        
        // 設定遊戲結束畫面點擊重新開始
        document.getElementById('game-over-screen').addEventListener('click', () => {
            this.restartGame();
        });
    }
    
    // 扣血處理
    takeDamage(amount) {
        this.playerHP -= amount;
        if (this.playerHP < 0) this.playerHP = 0;
        
        // 啟動無敵時間
        this.isInvincible = true;
        this.invincibleTimer = this.invincibleDuration;
        this.isFlashing = true;
        
        this.updateUI();
        
        // 檢查死亡
        if (this.playerHP <= 0) {
            this.gameOver();
        }
    }
    
    // 更新UI顯示
    updateUI() {
        const hpDisplay = document.getElementById('hp-display');
        const moneyDisplay = document.getElementById('money-display');
        
        hpDisplay.textContent = `HP: ${this.playerHP}`;
        moneyDisplay.textContent = `Money: $${this.money}`;
        
        // 血量顏色變化
        hpDisplay.classList.remove('low', 'critical');
        if (this.playerHP <= 30) {
            hpDisplay.classList.add('critical');
        } else if (this.playerHP <= 60) {
            hpDisplay.classList.add('low');
        }
    }
    
    // 遊戲結束
    gameOver() {
        this.isGameOver = true;
        
        // 顯示遊戲結束畫面
        const gameOverScreen = document.getElementById('game-over-screen');
        const finalMoney = document.getElementById('final-money');
        finalMoney.textContent = `$${this.money}`;
        gameOverScreen.classList.remove('hidden');
        
        // 解除指標鎖定
        if (document.pointerLockElement) {
            document.exitPointerLock();
        }
    }
    
    // 重新開始遊戲
    restartGame() {
        // 重置玩家數值
        this.playerHP = 100;
        this.money = 0;
        this.isInvincible = false;
        this.invincibleTimer = 0;
        this.isGameOver = false;
        this.isFlashing = false;
        
        // 清除所有殭屍
        for (let i = this.zombieSystem.zombies.length - 1; i >= 0; i--) {
            this.zombieSystem.removeZombie(i);
        }
        this.zombieSystem.zombies = [];
        this.zombieSystem.spawnTimer = 0;
        
        // 重置玩家位置
        this.sceneManager.camera.position.set(0, 1.7, 5);
        
        // 隱藏遊戲結束畫面
        document.getElementById('game-over-screen').classList.add('hidden');
        
        // 更新UI
        this.updateUI();
        
        // 重新鎖定指標
        document.body.requestPointerLock();
    }
    
    loadBuildings() {
        const mat = new THREE.MeshLambertMaterial({ color: 0x5a5a5a });
        const configs = [
            { pos: { x: -15, z: 0 }, size: { w: 10, h: 30, d: 10 } },
            { pos: { x: -25, z: -20 }, size: { w: 12, h: 40, d: 12 } },
            { pos: { x: -20, z: 30 }, size: { w: 10, h: 25, d: 10 } },
            { pos: { x: 15, z: 0 }, size: { w: 10, h: 35, d: 10 } },
            { pos: { x: 25, z: -15 }, size: { w: 12, h: 45, d: 12 } },
            { pos: { x: 20, z: 25 }, size: { w: 10, h: 28, d: 10 } },
        ];
        configs.forEach((config) => {
            const geo = new THREE.BoxGeometry(config.size.w, config.size.h, config.size.d);
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(config.pos.x, config.size.h / 2, config.pos.z);
            this.sceneManager.scene.add(mesh);
            this.buildings.push(mesh);
            this.colliders.push({
                minX: config.pos.x - config.size.w / 2, maxX: config.pos.x + config.size.w / 2,
                minZ: config.pos.z - config.size.d / 2, maxZ: config.pos.z + config.size.d / 2
            });
        });
    }
}

// 啟動遊戲
const game = new Game();

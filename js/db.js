// Database layer using IndexedDB for Hit Track Pro
const DB = (() => {
    const DB_NAME = 'hittrackpro';
    const DB_VERSION = 1;
    let idb = null;

    async function init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('teams')) {
                    db.createObjectStore('teams', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('players')) {
                    const ps = db.createObjectStore('players', { keyPath: 'id' });
                    ps.createIndex('teamId', 'teamId', { unique: false });
                }
                if (!db.objectStoreNames.contains('hits')) {
                    const hs = db.createObjectStore('hits', { keyPath: 'id' });
                    hs.createIndex('teamId', 'teamId', { unique: false });
                    hs.createIndex('playerId', 'playerId', { unique: false });
                }
            };

            request.onsuccess = (e) => {
                idb = e.target.result;
                resolve();
            };

            request.onerror = (e) => reject(e.target.error);
        });
    }

    function tx(stores, mode = 'readonly') {
        const t = idb.transaction(stores, mode);
        return t;
    }

    function getAll(storeName) {
        return new Promise((resolve, reject) => {
            const t = tx(storeName);
            const req = t.objectStore(storeName).getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    function put(storeName, value) {
        return new Promise((resolve, reject) => {
            const t = tx(storeName, 'readwrite');
            const req = t.objectStore(storeName).put(value);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    function del(storeName, key) {
        return new Promise((resolve, reject) => {
            const t = tx(storeName, 'readwrite');
            const req = t.objectStore(storeName).delete(key);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    function clearStore(storeName) {
        return new Promise((resolve, reject) => {
            const t = tx(storeName, 'readwrite');
            const req = t.objectStore(storeName).clear();
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    // Teams
    async function getTeams() {
        return await getAll('teams');
    }

    async function addTeam(name) {
        const team = { id: crypto.randomUUID(), name: name.trim().substring(0, 60) };
        await put('teams', team);
        return team;
    }

    async function renameTeam(id, newName) {
        const teams = await getTeams();
        const team = teams.find(t => t.id === id);
        if (team) {
            team.name = newName.trim().substring(0, 60);
            await put('teams', team);
        }
    }

    async function deleteTeam(id) {
        await del('teams', id);
        const players = await getPlayersByTeam(id);
        for (const p of players) {
            await del('players', p.id);
        }
        const hits = await getHitsByTeam(id);
        for (const h of hits) {
            await del('hits', h.id);
        }
    }

    // Players
    async function getPlayers() {
        return await getAll('players');
    }

    async function getPlayersByTeam(teamId) {
        const all = await getAll('players');
        return all.filter(p => p.teamId === teamId).sort((a, b) => a.lineupOrder - b.lineupOrder);
    }

    async function addPlayer(teamId, number, name) {
        const existing = await getPlayersByTeam(teamId);
        const player = {
            id: crypto.randomUUID(),
            teamId,
            number: number.trim().substring(0, 3),
            name: (name || '').trim().substring(0, 60),
            lineupOrder: existing.length + 1
        };
        await put('players', player);
        return player;
    }

    async function removePlayer(id) {
        await del('players', id);
        const hits = await getAll('hits');
        for (const h of hits) {
            if (h.playerId === id) await del('hits', h.id);
        }
    }

    async function updatePlayer(player) {
        await put('players', player);
    }

    // Hits
    async function getHits() {
        return await getAll('hits');
    }

    async function getHitsByTeam(teamId) {
        const all = await getAll('hits');
        return all.filter(h => h.teamId === teamId);
    }

    async function getHitsByPlayer(playerId) {
        const all = await getAll('hits');
        return all.filter(h => h.playerId === playerId);
    }

    async function addHit(playerId, teamId, locationX, locationY, hitType, pitchType, pitchLocation) {
        const hit = {
            id: crypto.randomUUID(),
            playerId,
            teamId,
            locationX,
            locationY,
            hitType,
            pitchType: pitchType || null,
            pitchLocation: pitchLocation || null,
            timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
        };
        await put('hits', hit);
        return hit;
    }

    async function removeHit(id) {
        await del('hits', id);
    }

    async function clearHitsByTeam(teamId) {
        const hits = await getHitsByTeam(teamId);
        for (const h of hits) await del('hits', h.id);
    }

    async function clearAllHits() {
        await clearStore('hits');
    }

    // Stats
    async function getHitTypeStats(hits) {
        const stats = {
            'Fly Ball': 0,
            'Line Drive': 0,
            'Pop Up': 0,
            'Grounder': 0
        };
        for (const h of hits) {
            if (stats[h.hitType] !== undefined) stats[h.hitType]++;
        }
        return stats;
    }

    async function getPitchStats(hits) {
        const map = {};
        for (const h of hits) {
            if (h.pitchType && h.pitchLocation) {
                const key = `${h.pitchType} - ${h.pitchLocation}`;
                map[key] = (map[key] || 0) + 1;
            }
        }
        return Object.entries(map)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
    }

    function stripMs(ts) {
        return ts ? ts.replace(/\.\d{3}Z$/, 'Z') : ts;
    }

    // Export (iOS-compatible format)
    async function exportAll() {
        return {
            version: '1.0',
            exportType: 'all',
            exportDate: stripMs(new Date().toISOString()),
            teams: await getTeams(),
            players: await getPlayers(),
            hits: (await getHits()).map(h => ({ ...h, timestamp: stripMs(h.timestamp) }))
        };
    }

    async function exportTeam(teamId) {
        const teams = await getTeams();
        const team = teams.find(t => t.id === teamId);
        if (!team) throw new Error('Team not found');
        const players = await getPlayersByTeam(teamId);
        const hits = (await getHitsByTeam(teamId)).map(h => ({ ...h, timestamp: stripMs(h.timestamp) }));
        return {
            version: '1.0',
            exportType: 'team',
            exportDate: stripMs(new Date().toISOString()),
            teams: [team],
            players,
            hits
        };
    }

    async function exportPlayer(playerId) {
        const allPlayers = await getPlayers();
        const player = allPlayers.find(p => p.id === playerId);
        if (!player) throw new Error('Player not found');
        const teams = await getTeams();
        const team = teams.find(t => t.id === player.teamId);
        const hits = (await getHitsByPlayer(playerId)).map(h => ({ ...h, timestamp: stripMs(h.timestamp) }));
        return {
            version: '1.0',
            exportType: 'player',
            exportDate: stripMs(new Date().toISOString()),
            teams: team ? [team] : [],
            players: [player],
            hits
        };
    }

    // Import
    const VALID_HIT_TYPES = ['Fly Ball', 'Line Drive', 'Pop Up', 'Grounder'];
    const VALID_PITCH_TYPES = ['Fastball', 'Change Up', 'Curve', 'Rise', 'Drop', null];
    const VALID_PITCH_LOCATIONS = ['High', 'Low', 'Inside', 'Outside', 'Middle', null];

    async function importData(data) {
        if (!data || typeof data !== 'object') throw new Error('Invalid data');
        if (!Array.isArray(data.teams)) throw new Error('Invalid teams');
        if (!Array.isArray(data.players)) throw new Error('Invalid players');
        if (!Array.isArray(data.hits)) throw new Error('Invalid hits');
        if (data.hits.length > 50000) throw new Error('File too large: too many hits');
        if (data.teams.length > 1000) throw new Error('File too large: too many teams');
        if (data.players.length > 10000) throw new Error('File too large: too many players');

        let counts = { teams: 0, players: 0, hits: 0 };
        const teamMap = {};
        const playerMap = {};

        for (const t of data.teams) {
            if (!t || typeof t.name !== 'string' || !t.name.trim()) continue;
            const newId = crypto.randomUUID();
            if (t.id) teamMap[String(t.id)] = newId;
            await put('teams', { id: newId, name: String(t.name).trim().substring(0, 60) });
            counts.teams++;
        }

        for (const p of data.players) {
            if (!p || typeof p.number !== 'string' && typeof p.number !== 'number') continue;
            const newId = crypto.randomUUID();
            if (p.id) playerMap[String(p.id)] = newId;
            await put('players', {
                id: newId,
                teamId: teamMap[String(p.teamId)] || String(p.teamId || ''),
                number: String(p.number).trim().substring(0, 3),
                name: String(p.name || '').trim().substring(0, 60),
                lineupOrder: Number(p.lineupOrder) || 0
            });
            counts.players++;
        }

        for (const h of data.hits) {
            if (!h) continue;
            const hitType = String(h.hitType || '');
            if (!VALID_HIT_TYPES.includes(hitType)) continue;
            const locX = Number(h.locationX);
            const locY = Number(h.locationY);
            if (isNaN(locX) || isNaN(locY) || locX < 0 || locX > 1 || locY < 0 || locY > 1) continue;
            const pitchType = h.pitchType ? String(h.pitchType).substring(0, 30) : null;
            if (pitchType && !VALID_PITCH_TYPES.includes(pitchType)) continue;
            const pitchLoc = h.pitchLocation ? String(h.pitchLocation).substring(0, 30) : null;
            if (pitchLoc && !VALID_PITCH_LOCATIONS.includes(pitchLoc)) continue;
            await put('hits', {
                id: crypto.randomUUID(),
                playerId: playerMap[String(h.playerId)] || String(h.playerId || ''),
                teamId: teamMap[String(h.teamId)] || String(h.teamId || ''),
                locationX: locX,
                locationY: locY,
                hitType: hitType,
                pitchType: pitchType,
                pitchLocation: pitchLoc,
                timestamp: typeof h.timestamp === 'string' ? h.timestamp.substring(0, 30) : new Date().toISOString()
            });
            counts.hits++;
        }

        return counts;
    }

    async function resetAll() {
        await clearStore('teams');
        await clearStore('players');
        await clearStore('hits');
        localStorage.removeItem('hittrackpro_setup');
        localStorage.removeItem('hittrackpro_selectedTeam');
    }

    async function hasData() {
        const teams = await getTeams();
        return teams.length > 0;
    }

    return {
        init, getTeams, addTeam, renameTeam, deleteTeam,
        getPlayers, getPlayersByTeam, addPlayer, removePlayer, updatePlayer,
        getHits, getHitsByTeam, getHitsByPlayer, addHit, removeHit,
        clearHitsByTeam, clearAllHits,
        getHitTypeStats, getPitchStats,
        exportAll, exportTeam, exportPlayer, importData, resetAll, hasData
    };
})();

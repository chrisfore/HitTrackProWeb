// Hit Track Pro - Web App
(async () => {
    await DB.init();

    // State
    let selectedTeamId = localStorage.getItem('hittrackpro_selectedTeam');
    let lastHitId = null;
    let pitchFilter = null; // { pitchType, pitchLocation } or null

    // DOM refs
    const setupScreen = document.getElementById('setup-screen');
    const mainApp = document.getElementById('main-app');
    const fieldCanvas = document.getElementById('field-canvas');
    const fieldCtx = fieldCanvas.getContext('2d');
    const resultsCanvas = document.getElementById('results-canvas');
    const resultsCtx = resultsCanvas.getContext('2d');
    const toast = document.getElementById('toast');

    // Hit type colors
    const hitColors = {
        'Fly Ball': '#007aff',
        'Line Drive': '#ff3b30',
        'Pop Up': '#af52de',
        'Grounder': '#ff9500'
    };

    // Init
    if (localStorage.getItem('hittrackpro_dark') === 'true') {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.getElementById('dark-mode-toggle').checked = true;
    }

    if (localStorage.getItem('hittrackpro_setup') && await DB.hasData()) {
        mainApp.style.display = 'block';
        await refreshAll();
    } else {
        setupScreen.style.display = 'block';
    }

    // Setup
    document.getElementById('setup-start').addEventListener('click', async () => {
        const name = document.getElementById('setup-team-name').value.trim() || 'My Team';
        const team = await DB.addTeam(name);
        selectedTeamId = team.id;
        localStorage.setItem('hittrackpro_setup', 'true');
        localStorage.setItem('hittrackpro_selectedTeam', team.id);
        setupScreen.style.display = 'none';
        mainApp.style.display = 'block';
        await refreshAll();
    });

    // Tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', async () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab + '-tab').classList.add('active');
            if (tab.dataset.tab === 'results') await refreshResults();
            if (tab.dataset.tab === 'settings') await refreshSettings();
            if (tab.dataset.tab === 'track') await refreshTrack();
        });
    });

    // Dark mode
    document.getElementById('dark-mode-toggle').addEventListener('change', (e) => {
        if (e.target.checked) {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('hittrackpro_dark', 'true');
        } else {
            document.documentElement.removeAttribute('data-theme');
            localStorage.setItem('hittrackpro_dark', 'false');
        }
        drawField(fieldCtx, fieldCanvas);
        drawField(resultsCtx, resultsCanvas);
    });

    // --- FIELD DRAWING ---
    function drawField(ctx, canvas, hits = [], highlightFilter = null) {
        const w = canvas.width;
        const h = canvas.height;
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

        // Background
        ctx.fillStyle = isDark ? '#1a3d16' : '#2d5a27';
        ctx.fillRect(0, 0, w, h);

        // Draw outfield arc
        const homeX = w / 2;
        const homeY = h - 30;
        const radius = w * 0.85;

        ctx.beginPath();
        ctx.arc(homeX, homeY, radius, Math.PI * 1.25, Math.PI * 1.75);
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Foul lines
        ctx.beginPath();
        ctx.moveTo(homeX, homeY);
        const leftEnd = getPointOnArc(homeX, homeY, radius, Math.PI * 1.25);
        ctx.lineTo(leftEnd.x, leftEnd.y);
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(homeX, homeY);
        const rightEnd = getPointOnArc(homeX, homeY, radius, Math.PI * 1.75);
        ctx.lineTo(rightEnd.x, rightEnd.y);
        ctx.stroke();

        // Infield diamond
        const baseSize = w * 0.18;
        const bases = [
            { x: homeX, y: homeY },
            { x: homeX + baseSize, y: homeY - baseSize },
            { x: homeX, y: homeY - baseSize * 2 },
            { x: homeX - baseSize, y: homeY - baseSize }
        ];

        ctx.beginPath();
        ctx.moveTo(bases[0].x, bases[0].y);
        for (let i = 1; i < bases.length; i++) ctx.lineTo(bases[i].x, bases[i].y);
        ctx.closePath();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Base markers
        for (const b of bases) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(b.x - 4, b.y - 4, 8, 8);
        }

        // Home plate (pentagon)
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(homeX, homeY + 5);
        ctx.lineTo(homeX - 6, homeY);
        ctx.lineTo(homeX - 4, homeY - 6);
        ctx.lineTo(homeX + 4, homeY - 6);
        ctx.lineTo(homeX + 6, homeY);
        ctx.closePath();
        ctx.fill();

        // Draw hits
        for (const hit of hits) {
            if (highlightFilter) {
                if (hit.pitchType !== highlightFilter.pitchType ||
                    hit.pitchLocation !== highlightFilter.pitchLocation) {
                    // Draw faded
                    ctx.globalAlpha = 0.15;
                }
            }
            const x = hit.locationX * w;
            const y = hit.locationY * h;
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, Math.PI * 2);
            ctx.fillStyle = hitColors[hit.hitType] || '#ffffff';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.6)';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.globalAlpha = 1;
        }
    }

    function getPointOnArc(cx, cy, r, angle) {
        return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
    }

    // --- TRACK TAB ---
    async function refreshTrack() {
        const teams = await DB.getTeams();
        const teamSelect = document.getElementById('track-team-select');
        teamSelect.innerHTML = teams.map(t =>
            `<option value="${t.id}" ${t.id === selectedTeamId ? 'selected' : ''}>${escapeHtml(t.name)}</option>`
        ).join('');

        if (teams.length > 0 && !selectedTeamId) {
            selectedTeamId = teams[0].id;
            localStorage.setItem('hittrackpro_selectedTeam', selectedTeamId);
        }

        await refreshTrackPlayers();
        await refreshTrackField();
        await refreshPitchStats();
    }

    document.getElementById('track-team-select').addEventListener('change', async (e) => {
        selectedTeamId = e.target.value;
        localStorage.setItem('hittrackpro_selectedTeam', selectedTeamId);
        pitchFilter = null;
        await refreshTrackPlayers();
        await refreshTrackField();
        await refreshPitchStats();
    });

    async function refreshTrackPlayers() {
        const playerSelect = document.getElementById('track-player-select');
        if (!selectedTeamId) {
            playerSelect.innerHTML = '<option value="">No team selected</option>';
            return;
        }
        const players = await DB.getPlayersByTeam(selectedTeamId);
        playerSelect.innerHTML = '<option value="">Select player</option>' +
            players.map(p => `<option value="${p.id}">${escapeHtml(displayName(p))}</option>`).join('');
    }

    async function refreshTrackField() {
        if (!selectedTeamId) {
            drawField(fieldCtx, fieldCanvas);
            return;
        }
        const hits = await DB.getHitsByTeam(selectedTeamId);
        drawField(fieldCtx, fieldCanvas, hits, pitchFilter);
    }

    async function refreshPitchStats() {
        const container = document.getElementById('pitch-stats-list');
        if (!selectedTeamId) {
            container.innerHTML = '<div class="empty-state"><p>No team selected</p></div>';
            return;
        }
        const hits = await DB.getHitsByTeam(selectedTeamId);
        const stats = await DB.getPitchStats(hits);

        if (stats.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No pitch data yet</p></div>';
            return;
        }

        container.innerHTML = stats.map(([label, count]) => {
            const [pt, pl] = label.split(' - ');
            const isActive = pitchFilter && pitchFilter.pitchType === pt && pitchFilter.pitchLocation === pl;
            return `<div class="pitch-stat-item ${isActive ? 'active' : ''}" data-pt="${escapeAttr(pt)}" data-pl="${escapeAttr(pl)}">
                <span>${escapeHtml(label)}</span>
                <span class="pitch-stat-count">${count}</span>
            </div>`;
        }).join('');

        container.querySelectorAll('.pitch-stat-item').forEach(el => {
            el.addEventListener('click', async () => {
                const pt = el.dataset.pt;
                const pl = el.dataset.pl;
                if (pitchFilter && pitchFilter.pitchType === pt && pitchFilter.pitchLocation === pl) {
                    pitchFilter = null;
                } else {
                    pitchFilter = { pitchType: pt, pitchLocation: pl };
                }
                await refreshTrackField();
                await refreshPitchStats();
            });
        });
    }

    // Field click to record hit
    fieldCanvas.addEventListener('click', async (e) => {
        const playerId = document.getElementById('track-player-select').value;
        if (!playerId) {
            showToast('Select a player first');
            return;
        }
        if (!selectedTeamId) {
            showToast('Select a team first');
            return;
        }

        const rect = fieldCanvas.getBoundingClientRect();
        const scaleX = fieldCanvas.width / rect.width;
        const scaleY = fieldCanvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX / fieldCanvas.width;
        const y = (e.clientY - rect.top) * scaleY / fieldCanvas.height;

        showHitModal(playerId, selectedTeamId, x, y);
    });

    // Hit modal
    let hitModalState = { playerId: null, teamId: null, x: 0, y: 0, hitType: null, pitchType: null, pitchLocation: null };

    function showHitModal(playerId, teamId, x, y) {
        hitModalState = { playerId, teamId, x, y, hitType: null, pitchType: null, pitchLocation: null };
        const modal = document.getElementById('hit-modal');
        modal.style.display = 'flex';

        // Reset buttons
        modal.querySelectorAll('.hit-type-btn, .option-btn').forEach(b => b.classList.remove('selected'));
        document.getElementById('hit-save').disabled = true;

        // Hit type buttons
        modal.querySelectorAll('.hit-type-btn').forEach(btn => {
            const clone = btn.cloneNode(true);
            btn.parentNode.replaceChild(clone, btn);
            clone.addEventListener('click', () => {
                modal.querySelectorAll('.hit-type-btn').forEach(b => b.classList.remove('selected'));
                clone.classList.add('selected');
                hitModalState.hitType = clone.dataset.type;
                document.getElementById('hit-save').disabled = false;
                // Auto-save if all three selected
                if (hitModalState.hitType && hitModalState.pitchType && hitModalState.pitchLocation) {
                    saveHit();
                }
            });
        });

        // Pitch type buttons
        modal.querySelectorAll('[data-pitch]').forEach(btn => {
            const clone = btn.cloneNode(true);
            btn.parentNode.replaceChild(clone, btn);
            clone.addEventListener('click', () => {
                modal.querySelectorAll('[data-pitch]').forEach(b => b.classList.remove('selected'));
                clone.classList.add('selected');
                hitModalState.pitchType = clone.dataset.pitch;
                if (hitModalState.hitType && hitModalState.pitchType && hitModalState.pitchLocation) {
                    saveHit();
                }
            });
        });

        // Pitch location buttons
        modal.querySelectorAll('[data-loc]').forEach(btn => {
            const clone = btn.cloneNode(true);
            btn.parentNode.replaceChild(clone, btn);
            clone.addEventListener('click', () => {
                modal.querySelectorAll('[data-loc]').forEach(b => b.classList.remove('selected'));
                clone.classList.add('selected');
                hitModalState.pitchLocation = clone.dataset.loc;
                if (hitModalState.hitType && hitModalState.pitchType && hitModalState.pitchLocation) {
                    saveHit();
                }
            });
        });
    }

    async function saveHit() {
        const { playerId, teamId, x, y, hitType, pitchType, pitchLocation } = hitModalState;
        if (!hitType) return;

        const hit = await DB.addHit(playerId, teamId, x, y, hitType, pitchType, pitchLocation);
        lastHitId = hit.id;
        document.getElementById('undo-hit').style.display = 'block';
        document.getElementById('hit-modal').style.display = 'none';

        await refreshTrackField();
        await refreshPitchStats();
        showToast('Hit recorded');
    }

    document.getElementById('hit-save').addEventListener('click', saveHit);

    function closeHitModal() {
        document.getElementById('hit-modal').style.display = 'none';
    }

    document.getElementById('hit-cancel').addEventListener('click', closeHitModal);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.getElementById('hit-modal').style.display === 'flex') closeHitModal();
    });

    document.getElementById('undo-hit').addEventListener('click', async () => {
        if (lastHitId) {
            await DB.removeHit(lastHitId);
            lastHitId = null;
            document.getElementById('undo-hit').style.display = 'none';
            await refreshTrackField();
            await refreshPitchStats();
            showToast('Hit undone');
        }
    });

    // --- RESULTS TAB ---
    const dateFilterToggle = document.getElementById('date-filter-toggle');
    const dateRangeRow = document.getElementById('date-range-row');

    dateFilterToggle.addEventListener('change', () => {
        dateRangeRow.style.display = dateFilterToggle.checked ? 'flex' : 'none';
        refreshResults();
    });

    document.getElementById('date-from').addEventListener('change', refreshResults);
    document.getElementById('date-to').addEventListener('change', refreshResults);
    document.getElementById('results-team-filter').addEventListener('change', async (e) => {
        await refreshResultsPlayers();
        await refreshResults();
    });
    document.getElementById('results-player-filter').addEventListener('change', refreshResults);

    async function refreshResultsTeamFilter() {
        const teams = await DB.getTeams();
        const select = document.getElementById('results-team-filter');
        const current = select.value;
        select.innerHTML = '<option value="">All Teams</option>' +
            teams.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
        select.value = current;
    }

    async function refreshResultsPlayers() {
        const teamId = document.getElementById('results-team-filter').value;
        const select = document.getElementById('results-player-filter');
        const current = select.value;

        if (teamId) {
            const players = await DB.getPlayersByTeam(teamId);
            select.innerHTML = '<option value="">All Players</option>' +
                players.map(p => `<option value="${p.id}">${escapeHtml(displayName(p))}</option>`).join('');
        } else {
            const players = await DB.getPlayers();
            select.innerHTML = '<option value="">All Players</option>' +
                players.map(p => `<option value="${p.id}">${escapeHtml(displayName(p))}</option>`).join('');
        }
        select.value = current;
    }

    async function refreshResults() {
        await refreshResultsTeamFilter();
        await refreshResultsPlayers();

        const teamId = document.getElementById('results-team-filter').value;
        const playerId = document.getElementById('results-player-filter').value;
        const dateFrom = dateFilterToggle.checked ? document.getElementById('date-from').value : null;
        const dateTo = dateFilterToggle.checked ? document.getElementById('date-to').value : null;

        let hits;
        if (playerId) {
            hits = await DB.getHitsByPlayer(playerId);
        } else if (teamId) {
            hits = await DB.getHitsByTeam(teamId);
        } else {
            hits = await DB.getHits();
        }

        // Apply date filter
        if (dateFrom) {
            const from = new Date(dateFrom);
            hits = hits.filter(h => new Date(h.timestamp) >= from);
        }
        if (dateTo) {
            const to = new Date(dateTo);
            to.setHours(23, 59, 59, 999);
            hits = hits.filter(h => new Date(h.timestamp) <= to);
        }

        // Draw spray chart
        drawField(resultsCtx, resultsCanvas, hits);

        // Hit type stats
        const hitTypeStats = await DB.getHitTypeStats(hits);
        document.getElementById('hit-type-stats').innerHTML = `
            <div class="stat-card">
                <h4>Hit Types (${hits.length} total)</h4>
                ${Object.entries(hitTypeStats).map(([type, count]) => `
                    <div class="stat-row">
                        <span class="label-with-dot"><span class="dot ${typeToClass(type)}"></span>${type}</span>
                        <span class="count">${count}</span>
                    </div>
                `).join('')}
            </div>`;

        // Pitch breakdown
        const pitchStats = await DB.getPitchStats(hits);
        document.getElementById('pitch-breakdown').innerHTML = pitchStats.length > 0 ? `
            <div class="stat-card">
                <h4>Pitch Breakdown</h4>
                ${pitchStats.map(([label, count]) => `
                    <div class="stat-row">
                        <span>${escapeHtml(label)}</span>
                        <span class="count">${count}</span>
                    </div>
                `).join('')}
            </div>` : '';

        // Hits by player (if showing team or all)
        if (!playerId) {
            const allPlayers = await DB.getPlayers();
            const playerHitCounts = {};
            for (const h of hits) {
                playerHitCounts[h.playerId] = (playerHitCounts[h.playerId] || 0) + 1;
            }

            const playerStats = allPlayers
                .filter(p => playerHitCounts[p.id])
                .map(p => ({ ...p, hitCount: playerHitCounts[p.id] }))
                .sort((a, b) => b.hitCount - a.hitCount);

            document.getElementById('hits-by-player').innerHTML = playerStats.length > 0 ? `
                <div class="stat-card">
                    <h4>Hits by Player</h4>
                    ${playerStats.map(p => `
                        <div class="player-stat-row" data-player-id="${p.id}">
                            <span>${escapeHtml(displayName(p))}</span>
                            <span class="count">${p.hitCount}</span>
                        </div>
                    `).join('')}
                </div>` : '';

            // Click player to filter
            document.querySelectorAll('.player-stat-row').forEach(row => {
                row.addEventListener('click', () => {
                    document.getElementById('results-player-filter').value = row.dataset.playerId;
                    refreshResults();
                });
            });
        } else {
            document.getElementById('hits-by-player').innerHTML = '';
        }
    }

    // PDF Export
    document.getElementById('export-pdf').addEventListener('click', async () => {
        const teamId = document.getElementById('results-team-filter').value;
        const playerId = document.getElementById('results-player-filter').value;
        const pdfDateFrom = dateFilterToggle.checked ? document.getElementById('date-from').value : null;
        const pdfDateTo = dateFilterToggle.checked ? document.getElementById('date-to').value : null;

        let hits;
        if (playerId) hits = await DB.getHitsByPlayer(playerId);
        else if (teamId) hits = await DB.getHitsByTeam(teamId);
        else hits = await DB.getHits();

        // Apply date filter to PDF export
        if (pdfDateFrom) {
            const from = new Date(pdfDateFrom);
            hits = hits.filter(h => new Date(h.timestamp) >= from);
        }
        if (pdfDateTo) {
            const to = new Date(pdfDateTo);
            to.setHours(23, 59, 59, 999);
            hits = hits.filter(h => new Date(h.timestamp) <= to);
        }

        if (hits.length === 0) { showToast('No data to export'); return; }

        const hitTypeStats = await DB.getHitTypeStats(hits);
        const pitchStats = await DB.getPitchStats(hits);

        // Get title
        let title = 'All Data';
        if (playerId) {
            const players = await DB.getPlayers();
            const p = players.find(pl => pl.id === playerId);
            if (p) title = displayName(p);
        } else if (teamId) {
            const teams = await DB.getTeams();
            const t = teams.find(tm => tm.id === teamId);
            if (t) title = t.name;
        }

        // Build a canvas for the spray chart to include in print
        const printCanvas = document.createElement('canvas');
        printCanvas.width = 300;
        printCanvas.height = 300;
        const printCtx = printCanvas.getContext('2d');
        drawField(printCtx, printCanvas, hits);
        const chartImage = printCanvas.toDataURL('image/png');

        const html = `<html><head><style>
            body { font-family: -apple-system, sans-serif; padding: 20px; color: #1d1d1f; }
            h1 { font-size: 18px; margin-bottom: 4px; }
            .subtitle { color: #6e6e73; font-size: 12px; margin-bottom: 16px; }
            .chart { text-align: center; margin-bottom: 16px; }
            .chart img { border-radius: 8px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 16px; }
            th { background: #f5f5f7; text-align: left; padding: 8px; font-weight: 600; border-bottom: 2px solid #d2d2d7; }
            td { padding: 6px 8px; border-bottom: 1px solid #e5e5ea; }
            h2 { font-size: 14px; margin: 12px 0 8px; }
        </style></head><body>
            <h1>${escapeHtml(title)} - Hit Report</h1>
            <div class="subtitle">Generated ${new Date().toLocaleDateString()}</div>
            <div class="chart"><img src="${chartImage}" width="300" height="300"></div>
            <h2>Hit Types</h2>
            <table><tr><th>Type</th><th>Count</th></tr>
            ${Object.entries(hitTypeStats).map(([type, count]) =>
                `<tr><td>${escapeHtml(type)}</td><td>${count}</td></tr>`
            ).join('')}
            <tr><td><strong>Total</strong></td><td><strong>${hits.length}</strong></td></tr>
            </table>
            ${pitchStats.length > 0 ? `
                <h2>Pitch Breakdown</h2>
                <table><tr><th>Pitch</th><th>Count</th></tr>
                ${pitchStats.map(([label, count]) => `<tr><td>${escapeHtml(label)}</td><td>${count}</td></tr>`).join('')}
                </table>
            ` : ''}
        </body></html>`;

        const printWindow = window.open('', '_blank');
        if (!printWindow) { showToast('Pop-up blocked — please allow pop-ups'); return; }
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        printWindow.onafterprint = () => printWindow.close();
        printWindow.print();
    });

    // --- SETTINGS TAB ---
    async function refreshSettings() {
        const teams = await DB.getTeams();
        const settingsTeam = document.getElementById('settings-team-select');
        settingsTeam.innerHTML = teams.map(t =>
            `<option value="${t.id}" ${t.id === selectedTeamId ? 'selected' : ''}>${escapeHtml(t.name)}</option>`
        ).join('');

        await refreshLineup();
    }

    document.getElementById('settings-team-select').addEventListener('change', async (e) => {
        selectedTeamId = e.target.value;
        localStorage.setItem('hittrackpro_selectedTeam', selectedTeamId);
        await refreshLineup();
        await refreshTrack();
    });

    async function refreshLineup() {
        const container = document.getElementById('lineup-list');
        if (!selectedTeamId) {
            container.innerHTML = '<div class="empty-state"><p>No team selected</p></div>';
            return;
        }

        const players = await DB.getPlayersByTeam(selectedTeamId);
        const hits = await DB.getHitsByTeam(selectedTeamId);

        if (players.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No players added yet</p></div>';
            return;
        }

        container.innerHTML = players.map(p => {
            const hitCount = hits.filter(h => h.playerId === p.id).length;
            return `<div class="lineup-item">
                <div>
                    <span class="player-info">${escapeHtml(displayName(p))}</span>
                    <span class="hit-count">${hitCount} hits</span>
                </div>
                <div class="lineup-item-actions">
                    <button class="icon-btn danger" data-action="remove-player" data-id="${p.id}" data-name="${escapeAttr(displayName(p))}">Remove</button>
                </div>
            </div>`;
        }).join('');

        container.querySelectorAll('[data-action="remove-player"]').forEach(btn => {
            btn.addEventListener('click', () => {
                showConfirm(`Remove ${btn.dataset.name} and all their hits?`, async () => {
                    await DB.removePlayer(btn.dataset.id);
                    await refreshLineup();
                    await refreshTrack();
                    showToast('Player removed');
                });
            });
        });
    }

    // Add player
    document.getElementById('add-player').addEventListener('click', async () => {
        const number = document.getElementById('new-player-number').value.trim();
        const name = document.getElementById('new-player-name').value.trim();
        if (!number) { showToast('Jersey number is required'); return; }
        if (!selectedTeamId) { showToast('Select a team first'); return; }

        await DB.addPlayer(selectedTeamId, number, name);
        document.getElementById('new-player-number').value = '';
        document.getElementById('new-player-name').value = '';
        await refreshLineup();
        await refreshTrack();
        showToast('Player added');
    });

    // Enter key for add player
    ['new-player-number', 'new-player-name'].forEach(id => {
        document.getElementById(id).addEventListener('keydown', (e) => {
            if (e.key === 'Enter') document.getElementById('add-player').click();
        });
    });

    // Team actions
    document.getElementById('rename-team').addEventListener('click', async () => {
        if (!selectedTeamId) return;
        const teams = await DB.getTeams();
        const team = teams.find(t => t.id === selectedTeamId);
        if (!team) return;
        showRenameModal('Rename Team', team.name, async (newName) => {
            await DB.renameTeam(selectedTeamId, newName);
            await refreshSettings();
            await refreshTrack();
            showToast('Team renamed');
        });
    });

    document.getElementById('delete-team').addEventListener('click', async () => {
        if (!selectedTeamId) return;
        showConfirm('Delete this team and all its players and hits?', async () => {
            await DB.deleteTeam(selectedTeamId);
            const teams = await DB.getTeams();
            selectedTeamId = teams.length > 0 ? teams[0].id : null;
            localStorage.setItem('hittrackpro_selectedTeam', selectedTeamId || '');
            await refreshSettings();
            await refreshTrack();
            showToast('Team deleted');
        });
    });

    document.getElementById('create-team').addEventListener('click', () => {
        const modal = document.getElementById('team-modal');
        const input = document.getElementById('team-name-input');
        input.value = '';
        modal.style.display = 'flex';
        input.focus();

        const okBtn = document.getElementById('team-create-ok');
        const cancelBtn = document.getElementById('team-cancel');

        const cleanup = () => {
            modal.style.display = 'none';
            okBtn.replaceWith(okBtn.cloneNode(true));
            cancelBtn.replaceWith(cancelBtn.cloneNode(true));
        };

        document.getElementById('team-create-ok').addEventListener('click', async () => {
            const name = input.value.trim();
            if (!name) { cleanup(); return; }
            const team = await DB.addTeam(name);
            selectedTeamId = team.id;
            localStorage.setItem('hittrackpro_selectedTeam', team.id);
            cleanup();
            await refreshSettings();
            await refreshTrack();
            showToast('Team created');
        });

        document.getElementById('team-cancel').addEventListener('click', cleanup);

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') document.getElementById('team-create-ok').click();
        });
    });

    // Data management
    document.getElementById('export-data').addEventListener('click', async () => {
        const data = await DB.exportAll();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `HitTrackPro_${new Date().toISOString().slice(0,10)}.hitdata`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Data exported');
    });

    document.getElementById('import-data').addEventListener('click', () => {
        document.getElementById('import-file').click();
    });

    document.getElementById('import-file').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) { showToast('File too large (10MB max)'); e.target.value = ''; return; }
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            const counts = await DB.importData(data);
            const teams = await DB.getTeams();
            if (teams.length > 0 && !selectedTeamId) {
                selectedTeamId = teams[0].id;
                localStorage.setItem('hittrackpro_selectedTeam', selectedTeamId);
            }
            await refreshAll();
            showToast(`Imported ${counts.teams} teams, ${counts.players} players, ${counts.hits} hits`);
        } catch (err) {
            showToast('Import failed: invalid file');
        }
        e.target.value = '';
    });

    document.getElementById('clear-hits').addEventListener('click', () => {
        showConfirm('Clear ALL hit data? Players and teams will be kept.', async () => {
            await DB.clearAllHits();
            await refreshAll();
            showToast('All hits cleared');
        });
    });

    document.getElementById('reset-all').addEventListener('click', () => {
        showConfirm('Reset ALL data? This cannot be undone.', async () => {
            await DB.resetAll();
            selectedTeamId = null;
            lastHitId = null;
            mainApp.style.display = 'none';
            setupScreen.style.display = 'block';
            showToast('All data reset');
        });
    });

    // --- Modals ---
    function showConfirm(message, onConfirm) {
        const modal = document.getElementById('confirm-modal');
        document.getElementById('confirm-message').textContent = message;
        modal.style.display = 'flex';

        const okBtn = document.getElementById('confirm-ok');
        const cancelBtn = document.getElementById('confirm-cancel');
        const ac = new AbortController();

        const cleanup = () => {
            modal.style.display = 'none';
            ac.abort();
            okBtn.replaceWith(okBtn.cloneNode(true));
            cancelBtn.replaceWith(cancelBtn.cloneNode(true));
        };

        document.getElementById('confirm-ok').addEventListener('click', () => { cleanup(); onConfirm(); });
        document.getElementById('confirm-cancel').addEventListener('click', cleanup);
        document.addEventListener('keydown', e => { if (e.key === 'Escape') cleanup(); }, { signal: ac.signal });
    }

    function showRenameModal(title, currentValue, onSave) {
        const modal = document.getElementById('rename-modal');
        const input = document.getElementById('rename-input');
        document.getElementById('rename-title').textContent = title;
        input.value = currentValue;
        modal.style.display = 'flex';
        input.focus();
        input.select();

        const okBtn = document.getElementById('rename-ok');
        const cancelBtn = document.getElementById('rename-cancel');
        const ac = new AbortController();

        const cleanup = () => {
            modal.style.display = 'none';
            ac.abort();
            okBtn.replaceWith(okBtn.cloneNode(true));
            cancelBtn.replaceWith(cancelBtn.cloneNode(true));
        };

        document.getElementById('rename-ok').addEventListener('click', () => {
            const val = input.value.trim();
            if (!val) { cleanup(); return; }
            cleanup();
            onSave(val);
        });

        document.getElementById('rename-cancel').addEventListener('click', cleanup);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') document.getElementById('rename-ok').click();
            if (e.key === 'Escape') cleanup();
        }, { signal: ac.signal });
    }

    // --- Utilities ---
    async function refreshAll() {
        await refreshTrack();
        await refreshResults();
        await refreshSettings();
    }

    function displayName(player) {
        return player.name ? `#${player.number} ${player.name}` : `#${player.number}`;
    }

    function typeToClass(hitType) {
        return hitType.toLowerCase().replace(/\s+/g, '-');
    }

    function showToast(msg) {
        toast.textContent = msg;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2000);
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function escapeAttr(str) {
        return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
})();

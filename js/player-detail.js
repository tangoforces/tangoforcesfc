const POSITION_ICONS = {
    Forward:    'fa-bolt',
    Midfielder: 'fa-crosshairs',
    Defender:   'fa-shield-halved',
    Goalkeeper: 'fa-hands',
};

const POSITION_PILL_CLASS = {
    Forward:    'pill-forward',
    Midfielder: 'pill-midfielder',
    Defender:   'pill-defender',
    Goalkeeper: 'pill-goalkeeper',
};

const CARD_POS_CLASS = {
    Forward:    'pos-forward',
    Midfielder: 'pos-midfielder',
    Defender:   'pos-defender',
    Goalkeeper: 'pos-goalkeeper',
};

function findPlayerById(id) {
    if (!id) {
        return null;
    }

    // First, try the 'selectedPlayer' from localStorage for speed.
    // This is set when a user clicks a card on the roster page.
    const selectedPlayerJson = localStorage.getItem('selectedPlayer');
    if (selectedPlayerJson) {
        const selectedPlayer = JSON.parse(selectedPlayerJson);
        if (selectedPlayer && String(selectedPlayer.id) === String(id)) {
            return selectedPlayer;
        }
    }
    // As a reliable fallback, use the same function as the roster page to get the full, merged player list.
    const allPlayers = getMergedPlayers();
    const player = allPlayers.find(p => String(p.id) === String(id));
    if (player) return player;
    return null;
}

function buildStatBlocks(player) {
    const pos = player.position || 'Forward';

    if (pos === 'Goalkeeper') {
        return `
            <div class="detail-stat"><strong>${player.cleansheets ?? 0}</strong><span>Clean Sheets</span></div>
            <div class="detail-stat"><strong>${player.SavePercentage ?? 0}%</strong><span>Save %</span></div>
        `;
    }

    let html = `
        <div class="detail-stat"><strong>${player.goals ?? 0}</strong><span>Goals</span></div>
        <div class="detail-stat"><strong>${player.assists ?? 0}</strong><span>Assists</span></div>
    `;

    if (pos === 'Defender' && player.cleansheets != null) {
        html += `<div class="detail-stat"><strong>${player.cleansheets}</strong><span>Clean Sheets</span></div>`;
    }

    return html;
}

async function buildPlayerAnalytics(player) {
    try {
        const response = await fetch('data/matches.json');
        if (!response.ok) return '';

        const matches = await response.json();
        const playerKey = String(player.name || '').trim().toLowerCase();
        const nicknameKey = String(player.nickname || '').trim().toLowerCase();

        const relevantEvents = matches
            .filter(match => match && match.status === 'completed' && Array.isArray(match.events))
            .flatMap(match => match.events.map(event => ({ ...event, matchDate: match.date || match.week || 'Recent' })))
            .filter(event => {
                const scorer = String(event.player || '').trim().toLowerCase();
                const assist = String(event.assist || '').trim().toLowerCase();
                return scorer === playerKey || scorer === nicknameKey || assist === playerKey || assist === nicknameKey;
            })
            .slice(0, 6);

        if (!relevantEvents.length) {
            return `
                <div class="analytics-grid">
                    <div class="mini-stat"><strong>0</strong><span>Goals</span></div>
                    <div class="mini-stat"><strong>0</strong><span>Assists</span></div>
                    <div class="mini-stat"><strong>0</strong><span>Recent Impact</span></div>
                </div>
            `;
        }

        const goals = relevantEvents.filter(event => event.type === 'goal' && (String(event.player || '').trim().toLowerCase() === playerKey || String(event.player || '').trim().toLowerCase() === nicknameKey)).length;
        const assists = relevantEvents.filter(event => event.type === 'goal' && event.assist && (String(event.assist || '').trim().toLowerCase() === playerKey || String(event.assist || '').trim().toLowerCase() === nicknameKey)).length;

        return `
            <div class="analytics-grid">
                <div class="mini-stat"><strong>${goals}</strong><span>Goals</span></div>
                <div class="mini-stat"><strong>${assists}</strong><span>Assists</span></div>
                <div class="mini-stat"><strong>${relevantEvents.length}</strong><span>Recent Impact</span></div>
            </div>
            <div class="analytics-note">Recent contribution summary from completed matches.</div>
        `;
    } catch (error) {
        console.warn('[Player Detail] Analytics failed:', error);
        return '';
    }
}

function renderPlayer(player) {
    const root = document.getElementById('playerDetailRoot');
    if (!root) return;

    const pos = player.position || 'Forward';
    const posClass = CARD_POS_CLASS[pos] || 'pos-forward';
    const pillCls = POSITION_PILL_CLASS[pos] || 'pill-forward';
    const icon = POSITION_ICONS[pos] || 'fa-futbol';

    const photoHTML = player.playerImage
        ? `<img src="${player.playerImage}" alt="${player.name}"
               onerror="this.onerror=null; this.src='images/player.png';">`
        : `<div class="detail-photo-placeholder">👤</div>`;

    document.title = `${player.name} — Tango FC`;

    root.innerHTML = `
        <article class="detail-card ${posClass}">
            <div class="detail-photo-wrap">
                ${photoHTML}
                <span class="detail-jersey">#${player.number ?? '—'}</span>
            </div>
            <div class="detail-info">
                <h2 class="detail-name">${player.name}</h2>
                ${player.nickname ? `<p class="detail-nickname">"${player.nickname}"</p>` : ''}
                <div class="detail-meta">
                    <span class="detail-pill ${pillCls}">
                        <i class="fa-solid ${icon}"></i> ${pos}
                    </span>
                    ${player.isNewSigning ? '<span class="new-signing-tag"><i class="fa-solid fa-star"></i> New Signing</span>' : ''}
                </div>
                <div class="detail-stats-grid">
                    ${buildStatBlocks(player)}
                </div>
                <div class="analytics-panel">
                    <h3>Recent Impact</h3>
                    <div id="playerAnalyticsContainer">Loading analytics…</div>
                </div>
            </div>
        </article>
    `;

    buildPlayerAnalytics(player).then(html => {
        const analyticsContainer = document.getElementById('playerAnalyticsContainer');
        if (analyticsContainer) {
            analyticsContainer.innerHTML = html || '<div class="analytics-note">No recent match impact recorded yet.</div>';
        }
    });
}

function renderNotFound() {
    const root = document.getElementById('playerDetailRoot');
    if (!root) return;

    root.innerHTML = `
        <div class="empty-state">
            <i class="fa-solid fa-user-slash" style="font-size:2.5rem;opacity:0.4;"></i>
            <p>Player not found. Visit the roster to browse the squad.</p>
            <a href="roster.html" class="btn-back-roster">
                <i class="fa-solid fa-users"></i> View Roster
            </a>
        </div>
    `;
}

document.addEventListener('DOMContentLoaded', () => {
    const id = new URLSearchParams(window.location.search).get('id');
    const player = findPlayerById(id);

    if (player) {
        renderPlayer(player);
    } else {
        renderNotFound();
    }
});

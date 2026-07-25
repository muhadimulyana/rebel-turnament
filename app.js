const API = {
  baseUrl: "http://localhost:8080/api/tournament",
  matches: "/matchs",
  standings: "/klasemen",
  players: "/players",
};

const emptyState = () => document.getElementById("empty-state").content.cloneNode(true);
const initials = (name) => name.replace(/[^\p{L}\p{N}]/gu, "").slice(0, 2).toUpperCase() || "PU";
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
let teamIcons = new Map();
let loadedData = {};

async function getJson(path) {
  const response = await fetch(`${API.baseUrl}${path}`);
  if (!response.ok) throw new Error(`Tidak dapat memuat ${path}`);
  const payload = await response.json();
  if (!payload.success || !Array.isArray(payload.data)) throw new Error("Format respons API tidak valid.");
  return payload.data;
}

function showMatches(matches, selectedDay) {
  const grid = document.getElementById("matches-grid");
  grid.replaceChildren();
  const filtered = matches.filter((match) => match.day === selectedDay);
  if (!filtered.length) return grid.append(emptyState());

  filtered.forEach((match) => {
    const score1 = match.hasil?.score_tim_1;
    const score2 = match.hasil?.score_tim_2;
    const completed = score1 !== null && score1 !== undefined && score2 !== null && score2 !== undefined;
    const result = completed
      ? `<strong>${score1} — ${score2}</strong>`
      : "Belum dimulai";
    grid.insertAdjacentHTML("beforeend", `
      <article class="match-card">
        <div class="match-meta"><span class="match-number">MATCH ${match.match}</span><span>${formatDate(match.date)} · ${escapeHtml(match.time)}</span></div>
        <div class="teams">
          ${teamMarkup(match.team_1)}
          <span class="versus">VS</span>
          ${teamMarkup(match.team_2)}
        </div>
        <div class="match-result">${result}</div>
      </article>`);
  });
}

function teamMarkup(team) {
  return `<div class="team"><div class="team-icon">${escapeHtml(teamIcons.get(team) || initials(team))}</div>${escapeHtml(team)}</div>`;
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short" }).format(new Date(`${dateString}T12:00:00`));
}

function showStandings(standings) {
  const body = document.getElementById("standings-body");
  body.replaceChildren();
  [...standings]
    .sort((a, b) => b.game_win - a.game_win || b.diff_point - a.diff_point)
    .forEach((team, index) => body.insertAdjacentHTML("beforeend", `
      <tr>
        <td>${index + 1}</td>
        <td><div class="team-cell"><span class="mini-icon">${escapeHtml(team.icon || initials(team.team))}</span>${escapeHtml(team.team)}</div></td>
        <td>${team.match}</td><td>${team.game_win}</td><td>${team.game_lose}</td>
        <td class="${team.diff_point > 0 ? "positive" : ""}">${team.diff_point > 0 ? "+" : ""}${team.diff_point}</td>
      </tr>`));
}

function playerStats(players) {
  return players.map((player) => {
    const appearances = Array.isArray(player.appearance) ? player.appearance : [];
    return {
      name: player.player,
      team: player.team,
      mvp: appearances.filter((appearance) => appearance.is_mvp).length,
      kills: appearances.reduce((sum, appearance) => sum + Number(appearance.kills || 0), 0),
      assists: appearances.reduce((sum, appearance) => sum + Number(appearance.assist || 0), 0),
    };
  });
}

function showLeaders(players, stat, containerId, label) {
  const container = document.getElementById(containerId);
  container.replaceChildren();
  const ranked = [...playerStats(players)].sort((a, b) => b[stat] - a[stat]).slice(0, 6);
  if (!ranked.some((player) => player[stat] > 0)) return container.append(emptyState());
  ranked.forEach((player, index) => container.insertAdjacentHTML("beforeend", `
    <article class="leader-card">
      <span class="rank">#${index + 1}</span>
      <div class="avatar">${initials(player.name)}</div>
      <div class="player-info"><h3>${escapeHtml(player.name)}</h3><p><span class="leader-team-icon">${escapeHtml(teamIcons.get(player.team) || "")}</span>${escapeHtml(player.team)}</p></div>
      <div class="stat">${player[stat]}<span>${label}</span></div>
    </article>`));
}

function setDayFilter(matches) {
  const filter = document.getElementById("day-filter");
  const days = [...new Set(matches.map((match) => match.day))];
  let selectedDay = days[0];
  days.forEach((day) => {
    const button = document.createElement("button");
    button.className = `day-button${day === selectedDay ? " active" : ""}`;
    button.textContent = `Hari ${day}`;
    button.addEventListener("click", () => {
      selectedDay = day;
      filter.querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button));
      showMatches(matches, selectedDay);
    });
    filter.append(button);
  });
  showMatches(matches, selectedDay);
}

function setNavigation() {
  document.querySelectorAll(".nav-link").forEach((link) => link.addEventListener("click", (event) => {
    event.preventDefault();
    const sectionId = link.dataset.section;
    document.querySelectorAll(".nav-link").forEach((item) => item.classList.toggle("active", item === link));
    document.querySelectorAll(".content-section").forEach((section) => section.classList.toggle("active-section", section.id === sectionId));
    history.replaceState(null, "", `#${sectionId}`);
  }));
}

function setAdminPanel() {
  const dialog = document.getElementById("admin-dialog");
  const loginPanel = document.getElementById("login-panel");
  const updatePanel = document.getElementById("update-panel");
  const loginMessage = document.getElementById("login-message");
  const matchForm = document.getElementById("match-form");
  const playerForm = document.getElementById("player-form");
  document.getElementById("admin-trigger").addEventListener("click", () => dialog.showModal());
  document.getElementById("dialog-close").addEventListener("click", () => dialog.close());
  document.getElementById("login-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    if (username !== "admin" || password !== "Loco88-55") {
      loginMessage.textContent = "Username atau password tidak valid.";
      return;
    }
    loginMessage.textContent = "";
    loginPanel.hidden = true;
    updatePanel.hidden = false;
    populateAdminForms();
    switchAdminForm("match-form");
  });
  document.querySelectorAll(".admin-tab").forEach((tab) => tab.addEventListener("click", () => {
    switchAdminForm(tab.dataset.form);
  }));
  document.getElementById("match-id").addEventListener("change", showSelectedMatch);
  document.getElementById("player-match-id").addEventListener("change", renderMatchPlayers);
  matchForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const match = findMatch(document.getElementById("match-id").value);
    const scoreOne = Number(document.getElementById("team-one-score").value);
    const scoreTwo = Number(document.getElementById("team-two-score").value);
    if (!match || !Number.isInteger(scoreOne) || !Number.isInteger(scoreTwo) || scoreOne < 0 || scoreTwo < 0) {
      setMessage("match-message", "Pilih pertandingan dan isi skor dengan angka bulat minimal 0.");
      return;
    }
    if (scoreOne === scoreTwo) {
      setMessage("match-message", "Skor tidak boleh sama karena pemenang harus ditentukan.");
      return;
    }
    await updateMatchScore(match, scoreOne, scoreTwo);
  });
  playerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const match = findMatch(document.getElementById("player-match-id").value);
    const rows = [...document.querySelectorAll(".player-stat-row")];
    if (!match || !rows.length) {
      setMessage("player-message", "Pilih match untuk menampilkan pemain.");
      return;
    }
    const statistics = rows.map((row) => ({
      player: loadedData.players[Number(row.dataset.playerIndex)].player,
      kills: Number(row.querySelector('[name="kills"]').value),
      assist: Number(row.querySelector('[name="assists"]').value),
      is_mvp: row.querySelector('[name="mvp"]').checked,
    }));
    if (statistics.some((stat) => !Number.isInteger(stat.kills) || !Number.isInteger(stat.assist) || stat.kills < 0 || stat.assist < 0)) {
      setMessage("player-message", "Semua kill dan assist harus berupa angka bulat minimal 0.");
      return;
    }
    if (statistics.filter((stat) => stat.is_mvp).length > 1) {
      setMessage("player-message", "Pilih maksimal satu pemain MVP untuk setiap match.");
      return;
    }
    await updatePlayerStatistics(match.match, statistics);
  });
}

function switchAdminForm(formId) {
  const matchForm = document.getElementById("match-form");
  const playerForm = document.getElementById("player-form");
  const showingMatchForm = formId === "match-form";
  matchForm.hidden = !showingMatchForm;
  playerForm.hidden = showingMatchForm;
  matchForm.setAttribute("aria-hidden", String(!showingMatchForm));
  playerForm.setAttribute("aria-hidden", String(showingMatchForm));
  document.querySelectorAll(".admin-tab").forEach((tab) => {
    const active = tab.dataset.form === formId;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });
}

function findMatch(value) {
  return loadedData.matches?.find((match) => match.match === Number(value));
}

function populateAdminForms() {
  const matches = loadedData.matches || [];
  const matchOptions = matches.map((match) => `<option value="${match.match}">Match ${match.match} · ${escapeHtml(match.team_1)} vs ${escapeHtml(match.team_2)}</option>`).join("");
  document.getElementById("match-id").innerHTML = `<option value="">Pilih pertandingan</option>${matchOptions}`;
  document.getElementById("player-match-id").innerHTML = `<option value="">Pilih match</option>${matchOptions}`;
  showSelectedMatch();
  renderMatchPlayers();
}

function showSelectedMatch() {
  const match = findMatch(document.getElementById("match-id").value);
  const teamText = document.getElementById("match-teams");
  const teamOneLabel = document.getElementById("team-one-label");
  const teamTwoLabel = document.getElementById("team-two-label");
  if (!match) {
    teamText.textContent = "Pilih pertandingan untuk melihat tim.";
    teamOneLabel.firstChild.textContent = "Skor Tim 1";
    teamTwoLabel.firstChild.textContent = "Skor Tim 2";
    return;
  }
  teamText.textContent = `${teamIcons.get(match.team_1) || ""} ${match.team_1} vs ${teamIcons.get(match.team_2) || ""} ${match.team_2}`;
  teamOneLabel.firstChild.textContent = `Skor ${match.team_1}`;
  teamTwoLabel.firstChild.textContent = `Skor ${match.team_2}`;
  document.getElementById("team-one-score").value = match.hasil?.score_tim_1 ?? "";
  document.getElementById("team-two-score").value = match.hasil?.score_tim_2 ?? "";
}

function renderMatchPlayers() {
  const list = document.getElementById("player-stat-list");
  const submit = document.getElementById("player-submit");
  const match = findMatch(document.getElementById("player-match-id").value);
  list.replaceChildren();
  submit.disabled = true;
  if (!match) {
    list.insertAdjacentHTML("beforeend", '<p class="match-teams">Pilih match untuk menampilkan pemain yang bertanding.</p>');
    return;
  }
  const players = (loadedData.players || [])
    .map((player, index) => ({ player, index }))
    .filter(({ player }) => player.team === match.team_1 || player.team === match.team_2);
  if (!players.length) {
    list.insertAdjacentHTML("beforeend", '<p class="match-teams">Pemain untuk kedua tim belum tersedia.</p>');
    return;
  }
  players.forEach(({ player, index }) => {
    const appearance = (player.appearance || []).find((item) => item.match === match.match) || {};
    list.insertAdjacentHTML("beforeend", `
      <div class="player-stat-row" data-player-index="${index}">
        <span class="player-stat-name">${escapeHtml(teamIcons.get(player.team) || "")} ${escapeHtml(player.player)}</span>
        <label>Kill<input name="kills" type="number" min="0" step="1" inputmode="numeric" required value="${Number(appearance.kills || 0)}" /></label>
        <label>Assist<input name="assists" type="number" min="0" step="1" inputmode="numeric" required value="${Number(appearance.assist || 0)}" /></label>
        <label class="mvp-toggle"><input name="mvp" type="checkbox" ${appearance.is_mvp ? "checked" : ""} /> MVP</label>
      </div>`);
  });
  submit.disabled = false;
}

function setMessage(id, text, success = false) {
  const message = document.getElementById(id);
  message.textContent = text;
  message.classList.toggle("success", success);
}

async function updateMatchScore(match, scoreOne, scoreTwo) {
  setMessage("match-message", "Mengirim pembaruan...");
  try {
    const response = await fetch(`${API.baseUrl}${API.matches}/${match.match}/score`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        score_tim_1: scoreOne,
        score_tim_2: scoreTwo,
        winner: scoreOne > scoreTwo ? match.team_1 : match.team_2,
      }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) throw new Error(payload.message || "Permintaan update ditolak oleh API.");
    setMessage("match-message", "Skor berhasil diperbarui. Klasemen akan disegarkan oleh API.", true);
    await loadData();
    populateAdminForms();
  } catch (error) {
    setMessage("match-message", error.message);
  }
}

async function updatePlayerStatistics(match, statistics) {
  setMessage("player-message", "Mengirim pembaruan statistik...");
  try {
    const responses = await Promise.all(statistics.map(async (statistic) => {
      const response = await fetch(`${API.baseUrl}${API.players}/${encodeURIComponent(statistic.player)}/appearance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match, ...statistic }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.message || `Gagal memperbarui ${statistic.player}.`);
    }));
    setMessage("player-message", `${responses.length} statistik player berhasil diperbarui.`, true);
    await loadData();
    populateAdminForms();
  } catch (error) {
    setMessage("player-message", error.message);
  }
}

async function loadData() {
  try {
    const [matches, standings, players] = await Promise.all([getJson(API.matches), getJson(API.standings), getJson(API.players)]);
    loadedData = { matches, standings, players };
    teamIcons = new Map(standings.map((team) => [team.team, team.icon]));
    document.getElementById("match-count").textContent = `${matches.length} Match`;
    document.getElementById("team-count").textContent = `${standings.length} Tim`;
    document.getElementById("day-filter").replaceChildren();
    setDayFilter(matches);
    showStandings(standings);
    showLeaders(players, "mvp", "mvp-grid", "KALI MVP");
    showLeaders(players, "kills", "kills-grid", "TOTAL KILL");
    showLeaders(players, "assists", "assists-grid", "TOTAL ASSIST");
  } catch (error) {
    console.error(error);
    document.getElementById("matches-grid").append(emptyState());
    ["mvp-grid", "kills-grid", "assists-grid"].forEach((id) => document.getElementById(id).append(emptyState()));
  }
}

function initialize() {
  setNavigation();
  setAdminPanel();
  loadData();
}

initialize();

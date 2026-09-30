// ========================================
// CONFIGURAÇÕES
// ========================================

const API_URL = "http://127.0.0.1:3000";

const CLIENT_ID = "b61ba07b4747492db2fa94bea00cfbce";
const REDIRECT_URI = "http://127.0.0.1:5500/Home/home.html";
const SCOPES = [
    "streaming",
    "user-read-email",
    "user-read-private",
    "user-modify-playback-state",
    "user-read-playback-state"
].join(" ");


// ========================================
// ELEMENTOS DO HTML
// ========================================

const campoPesquisa = document.getElementById("campoPesquisa");
const botaoPesquisa = document.getElementById("botaoPesquisa");
const resultadosPesquisa = document.getElementById("resultadosPesquisa");
const botaoEntrar = document.getElementById("botaoEntrar");

// embed (alternativa quando não está logado)
const playerContainer = document.getElementById("playerContainer");
const playerSpotify = document.getElementById("playerSpotify");
const fecharPlayer = document.getElementById("fecharPlayer");

// barra do player (Web Playback SDK)
const barraPlayer = document.getElementById("barraPlayer");
const playerCapa = document.getElementById("playerCapa");
const playerNome = document.getElementById("playerNome");
const playerArtista = document.getElementById("playerArtista");
const btnPlayPause = document.getElementById("btnPlayPause");
const btnAnterior = document.getElementById("btnAnterior");
const btnProxima = document.getElementById("btnProxima");


// ========================================
// EXIBIÇÃO DOS RESULTADOS
// ========================================

function criarItem(nome, artista, imagem, id) {
    const item = document.createElement("div");
    item.classList.add("resultado-musica");

    if (imagem) {
        const img = document.createElement("img");
        img.src = imagem;
        img.alt = nome;
        item.appendChild(img);
    }

    const info = document.createElement("div");
    info.classList.add("info-musica");

    const spanNome = document.createElement("span");
    spanNome.classList.add("nome-musica");
    spanNome.textContent = nome;
    info.appendChild(spanNome);

    if (artista) {
        const spanArtista = document.createElement("span");
        spanArtista.classList.add("nome-artista");
        spanArtista.textContent = artista;
        info.appendChild(spanArtista);
    }

    item.appendChild(info);

    if (id) {
        item.addEventListener("click", () => tocarMusica(id));
    }

    return item;
}

function mostrarMensagem(titulo, subtitulo = "") {
    resultadosPesquisa.replaceChildren(criarItem(titulo, subtitulo, "", null));
    resultadosPesquisa.style.display = "block";
}

function mostrarResultados(musicas) {
    if (!musicas.length) {
        mostrarMensagem("Nenhuma música encontrada");
        return;
    }

    resultadosPesquisa.replaceChildren(
        ...musicas.map(m => criarItem(m.nome, m.artistas, m.imagem, m.id))
    );
    resultadosPesquisa.style.display = "block";
}


// ========================================
// PESQUISA (via seu servidor)
// ========================================

let controlador; // cancela a busca anterior

async function pesquisarSpotify(texto) {
    if (controlador) controlador.abort();
    controlador = new AbortController();

    try {
        const resposta = await fetch(
            `${API_URL}/api/buscar?q=${encodeURIComponent(texto)}`,
            { signal: controlador.signal }
        );

        if (resposta.status === 429) {
            mostrarMensagem("Muitas pesquisas", "Aguarde alguns instantes.");
            return;
        }

        if (!resposta.ok) {
            mostrarMensagem("Não foi possível pesquisar", "Tente novamente.");
            return;
        }

        mostrarResultados(await resposta.json());

    } catch (erro) {
        if (erro.name === "AbortError") return;
        console.error("Erro ao pesquisar:", erro);
        mostrarMensagem("Servidor indisponível", "Tente novamente mais tarde.");
    }
}


// ========================================
// EVENTOS DA PESQUISA
// ========================================

botaoPesquisa.addEventListener("click", () => {
    const texto = campoPesquisa.value.trim();
    if (texto) pesquisarSpotify(texto);
});

campoPesquisa.addEventListener("keydown", e => {
    if (e.key === "Enter") botaoPesquisa.click();
});

// Pesquisa enquanto digita, com debounce
let temporizador;
campoPesquisa.addEventListener("input", () => {
    clearTimeout(temporizador);
    const texto = campoPesquisa.value.trim();

    if (texto.length < 2) {
        resultadosPesquisa.style.display = "none";
        return;
    }

    temporizador = setTimeout(() => pesquisarSpotify(texto), 400);
});

// Fecha ao clicar fora
document.addEventListener("click", e => {
    if (!e.target.closest(".pesquisar")) {
        resultadosPesquisa.style.display = "none";
    }
});


// ========================================
// LOGIN (PKCE)
// ========================================

function gerarCodeVerifier(tamanho) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const aleatorio = crypto.getRandomValues(new Uint8Array(tamanho));
    return Array.from(aleatorio, n => chars[n % chars.length]).join("");
}

async function gerarCodeChallenge(verifier) {
    const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(verifier)
    );
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

async function entrarComSpotify() {
    const verifier = gerarCodeVerifier(64);
    const challenge = await gerarCodeChallenge(verifier);

    localStorage.setItem("spotify_code_verifier", verifier);

    const parametros = new URLSearchParams({
        client_id: CLIENT_ID,
        response_type: "code",
        redirect_uri: REDIRECT_URI,
        scope: SCOPES,
        code_challenge_method: "S256",
        code_challenge: challenge
    });

    window.location.href =
        "https://accounts.spotify.com/authorize?" + parametros;
}

function salvarTokens(dados) {
    localStorage.setItem("spotify_access_token", dados.access_token);
    localStorage.setItem(
        "spotify_expira_em",
        String(Date.now() + (dados.expires_in - 60) * 1000)
    );
    // o refresh_token só vem quando o Spotify decide trocá-lo
    if (dados.refresh_token) {
        localStorage.setItem("spotify_refresh_token", dados.refresh_token);
    }
}

function sairDoSpotify() {
    ["spotify_access_token", "spotify_expira_em", "spotify_refresh_token"]
        .forEach(k => localStorage.removeItem(k));
}

async function pedirToken(parametros) {
    const resposta = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(parametros)
    });

    if (!resposta.ok) {
        console.error("Erro ao obter token:", await resposta.text());
        return null;
    }

    const dados = await resposta.json();
    salvarTokens(dados);
    return dados.access_token;
}

async function obterAccessToken(code) {
    const verifier = localStorage.getItem("spotify_code_verifier");
    if (!verifier) return null;

    const token = await pedirToken({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        code_verifier: verifier
    });

    localStorage.removeItem("spotify_code_verifier");
    return token;
}

// Devolve um token válido, renovando sozinho quando expira
async function obterTokenValido() {
    const token = localStorage.getItem("spotify_access_token");
    const expiraEm = Number(localStorage.getItem("spotify_expira_em") || 0);

    if (token && Date.now() < expiraEm) return token;

    const refresh = localStorage.getItem("spotify_refresh_token");
    if (!refresh) return null;

    const novo = await pedirToken({
        grant_type: "refresh_token",
        refresh_token: refresh,
        client_id: CLIENT_ID
    });

    if (!novo) sairDoSpotify();
    return novo;
}

async function verificarLogin() {
    const code = new URLSearchParams(window.location.search).get("code");
    if (!code) return;

    // limpa a URL já, para o F5 não reenviar um code usado
    window.history.replaceState({}, document.title, window.location.pathname);
    await obterAccessToken(code);
}

async function atualizarBotaoEntrar() {
    const token = await obterTokenValido();

    if (!token) {
        botaoEntrar.textContent = "Entrar";
        return false;
    }

    try {
        const resposta = await fetch("https://api.spotify.com/v1/me", {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!resposta.ok) throw new Error(resposta.status);

        const perfil = await resposta.json();
        botaoEntrar.textContent = perfil.display_name || "Conectado";
        return true;
    } catch (erro) {
        console.error("Erro ao buscar perfil:", erro);
        return false;
    }
}

botaoEntrar.addEventListener("click", async () => {
    if (!(await obterTokenValido())) entrarComSpotify();
});


// ========================================
// PLAYER: EMBED (alternativa sem login)
// ========================================

function tocarEmbed(id) {
    playerSpotify.src =
        `https://open.spotify.com/embed/track/${id}?utm_source=generator&theme=0`;

    playerContainer.style.display = "block";
    barraPlayer.style.display = "none";
}

fecharPlayer.addEventListener("click", () => {
    playerSpotify.src = "";
    playerContainer.style.display = "none";
});


// ========================================
// PLAYER: WEB PLAYBACK SDK (Premium)
// ========================================

let player = null;
let deviceId = null;

function iniciarPlayer() {
    window.onSpotifyWebPlaybackSDKReady = () => {
        player = new Spotify.Player({
            name: "MusicHub",
            getOAuthToken: async cb => cb(await obterTokenValido()),
            volume: 0.7
        });

        player.addListener("ready", ({ device_id }) => {
            deviceId = device_id;
            console.log("Player pronto:", device_id);
        });

        player.addListener("not_ready", () => { deviceId = null; });

        player.addListener("account_error", () => {
            alert("O player do Spotify exige uma conta Premium.");
        });

        player.addListener("authentication_error", () => {
            sairDoSpotify();
            botaoEntrar.textContent = "Entrar";
        });

        player.addListener("initialization_error", ({ message }) => {
            console.error("Navegador não suportado:", message);
        });

        player.addListener("player_state_changed", estado => {
            if (!estado) return;

            const faixa = estado.track_window.current_track;
            playerNome.textContent = faixa.name;
            playerArtista.textContent = faixa.artists.map(a => a.name).join(", ");
            playerCapa.src = faixa.album.images[0]?.url || "";

            btnPlayPause.innerHTML = estado.paused
                ? '<i class="fa-solid fa-play"></i>'
                : '<i class="fa-solid fa-pause"></i>';

            barraPlayer.style.display = "flex";
        });

        player.connect();
    };

    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    document.head.appendChild(script);
}

async function tocarMusica(id) {
    // O id vem do nosso servidor, mas garantimos que só tem letras e números
    if (!/^[A-Za-z0-9]+$/.test(id)) return;

    resultadosPesquisa.style.display = "none";

    // sem login ou player ainda não pronto: usa o embed
    if (!player || !deviceId) {
        tocarEmbed(id);
        return;
    }

    // esconde o embed e libera o áudio (necessário em alguns navegadores)
    playerContainer.style.display = "none";
    playerSpotify.src = "";
    player.activateElement();

    const token = await obterTokenValido();
    if (!token) {
        tocarEmbed(id);
        return;
    }

    const resposta = await fetch(
        `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
        {
            method: "PUT",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ uris: [`spotify:track:${id}`] })
        }
    );

    if (!resposta.ok) {
        console.error("Erro ao tocar:", resposta.status);
        tocarEmbed(id);
    }
}

btnPlayPause.addEventListener("click", () => player?.togglePlay());
btnAnterior.addEventListener("click", () => player?.previousTrack());
btnProxima.addEventListener("click", () => player?.nextTrack());


// ========================================
// INICIAR
// ========================================

(async () => {
    await verificarLogin();
    const logado = await atualizarBotaoEntrar();
    if (logado) iniciarPlayer();
})();   
// ========================================
// CONFIGURAÇÕES
// ========================================

const API_URL = "http://127.0.0.1:3000";

const FOTO_PADRAO = "../Home/imagens/Foto-album.svg";


// ========================================
// ELEMENTOS DO HTML
// ========================================

const campoPesquisa = document.getElementById("campoPesquisa");
const botaoPesquisa = document.getElementById("botaoPesquisa");
const resultadosPesquisa = document.getElementById("resultadosPesquisa");
const caixaPesquisa = document.querySelector(".pesquisar");

const playerContainer = document.getElementById("playerContainer");
const playerSpotify = document.getElementById("playerSpotify");
const fecharPlayer = document.getElementById("fecharPlayer");

const bannerInicio = document.querySelector(".banner-inicio");
const statusAgora = document.getElementById("status-ouvindo");
const barraPreenchida = document.getElementById("barra-preenchida");
const tempoAtual = document.getElementById("tempo-atual");
const tempoTotal = document.getElementById("tempo-total");
const fotoAgora = document.getElementById("foto-michael");
const nomeAgora = document.getElementById("nome-ouvindo");
const artistaAgora = document.getElementById("artista-ouvindo");


// ========================================
// EXIBIÇÃO
// ========================================

function criarItem(nome, subtitulo, imagem, aoClicar, redonda = false) {
    const item = document.createElement("div");
    item.classList.add("resultado-musica");

    if (imagem) {
        const img = document.createElement("img");
        img.src = imagem;
        img.alt = nome;
        if (redonda) img.classList.add("img-redonda");
        item.appendChild(img);
    }

    const info = document.createElement("div");
    info.classList.add("info-musica");

    const spanNome = document.createElement("span");
    spanNome.classList.add("nome-musica");
    spanNome.textContent = nome;
    info.appendChild(spanNome);

    if (subtitulo) {
        const spanSub = document.createElement("span");
        spanSub.classList.add("nome-artista");
        spanSub.textContent = subtitulo;
        info.appendChild(spanSub);
    }

    item.appendChild(info);

    if (aoClicar) {
        item.addEventListener("click", aoClicar);
    } else {
        item.style.cursor = "default";
    }

    return item;
}

function criarTitulo(texto) {
    const titulo = document.createElement("div");
    titulo.classList.add("secao-titulo");
    titulo.textContent = texto;
    return titulo;
}

function criarVoltar(aoClicar) {
    const voltar = criarItem("Voltar", "", "", aoClicar);
    voltar.classList.add("item-voltar");
    return voltar;
}

function exibir(...elementos) {
    resultadosPesquisa.replaceChildren(...elementos);
    resultadosPesquisa.style.display = "block";
    resultadosPesquisa.scrollTop = 0;
}

function mostrarMensagem(titulo, subtitulo = "") {
    exibir(criarItem(titulo, subtitulo, "", null));
}


// ========================================
// REQUISIÇÕES AO SERVIDOR
// ========================================

async function buscarJSON(caminho, opcoes = {}) {
    const resposta = await fetch(API_URL + caminho, opcoes);

    if (!resposta.ok) {
        const erro = new Error("Erro " + resposta.status);
        erro.status = resposta.status;
        throw erro;
    }

    return resposta.json();
}

function tratarErro(erro) {
    if (erro.name === "AbortError") return;

    console.error(erro);

    if (erro.status === 429) {
        mostrarMensagem("Muitas pesquisas", "Aguarde alguns instantes.");
    } else if (erro.status === 403) {
        mostrarMensagem("Consulta bloqueada", "O Spotify não liberou esta informação.");
    } else if (erro.status) {
        mostrarMensagem("Não foi possível carregar", "Tente novamente.");
    } else {
        mostrarMensagem("Servidor indisponível", "Tente novamente mais tarde.");
    }
}


// ========================================
// TELAS: RESULTADOS > DISCOGRAFIA > ÁLBUM
// ========================================

let ultimosResultados = null;

function mostrarResultados(dados) {
    ultimosResultados = dados;

    const { musicas, artistas } = dados;

    if (!musicas.length && !artistas.length) {
        mostrarMensagem("Nenhum resultado encontrado");
        return;
    }

    const elementos = [];

    if (artistas.length) {
        elementos.push(criarTitulo("Artistas"));
        artistas.forEach(a => {
            elementos.push(
                criarItem(a.nome, "Artista", a.imagem, () => abrirArtista(a), true)
            );
        });
    }

    if (musicas.length) {
        elementos.push(criarTitulo("Músicas"));
        musicas.forEach(m => {
            elementos.push(
                criarItem(m.nome, m.artistas, m.imagem, () =>
                    tocarEmbed("track", m.id, {
                        nome: m.nome,
                        artistas: m.artistas,
                        imagem: m.imagem
                    })
                )
            );
        });
    }

    exibir(...elementos);
}

async function abrirArtista(artista) {
    mostrarMensagem("Carregando...", artista.nome);

    try {
        const albuns = await buscarJSON(`/api/artista/${artista.id}/albuns`);

        const voltar = criarVoltar(() => mostrarResultados(ultimosResultados));
        const titulo = criarTitulo(`Discografia de ${artista.nome}`);

        if (!albuns.length) {
            exibir(voltar, titulo, criarItem("Nenhum álbum encontrado", "", "", null));
            return;
        }

        exibir(
            voltar,
            titulo,
            ...albuns.map(a =>
                criarItem(
                    a.nome,
                    `${a.tipo} · ${a.ano}`,
                    a.imagem,
                    () => abrirAlbum(a.id, () => abrirArtista(artista))
                )
            )
        );

    } catch (erro) {
        tratarErro(erro);
    }
}

async function abrirAlbum(albumId, aoVoltar) {
    mostrarMensagem("Carregando álbum...");

    try {
        const album = await buscarJSON(`/api/album/${albumId}`);

        const voltar = criarVoltar(aoVoltar);
        const titulo = criarTitulo(`${album.nome} · ${album.artistas} · ${album.ano}`);

        const tocarTudo = criarItem(
            "Tocar álbum inteiro", "", album.imagem, () =>
                tocarEmbed("album", album.id, {
                    nome: album.nome,
                    artistas: album.artistas,
                    imagem: album.imagem,
                    faixas: album.faixas
                })
        );
        tocarTudo.classList.add("item-destaque");

        const faixas = album.faixas.map(f =>
            criarItem(
                `${f.numero}. ${f.nome}`,
                f.artistas,
                "",
                () => tocarEmbed("track", f.id, {
                    nome: f.nome,
                    artistas: f.artistas,
                    imagem: album.imagem
                })
            )
        );

        exibir(voltar, titulo, tocarTudo, ...faixas);

    } catch (erro) {
        tratarErro(erro);
    }
}


// ========================================
// PESQUISA
// ========================================

let controlador;

async function pesquisarSpotify(texto) {
    if (controlador) controlador.abort();
    controlador = new AbortController();

    try {
        const dados = await buscarJSON(
            `/api/buscar?q=${encodeURIComponent(texto)}`,
            { signal: controlador.signal }
        );
        mostrarResultados(dados);
    } catch (erro) {
        tratarErro(erro);
    }
}

botaoPesquisa.addEventListener("click", () => {
    const texto = campoPesquisa.value.trim();
    if (texto) pesquisarSpotify(texto);
});

campoPesquisa.addEventListener("keydown", e => {
    if (e.key === "Enter") botaoPesquisa.click();
});

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
    if (!e.composedPath().includes(caixaPesquisa)) {
        resultadosPesquisa.style.display = "none";
    }
});


// ========================================
// CARD "OUVINDO AGORA"
// ========================================

let infoAtual = null;   // música ou álbum escolhido no player
let faixaAtual = null;  // faixa que está tocando (quando é um álbum)

function formatarTempo(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const minutos = Math.floor(total / 60);
    const segundos = String(total % 60).padStart(2, "0");
    return `${minutos}:${segundos}`;
}

// Fundo desfocado do banner acompanha a capa atual
function definirFundo(imagem) {
    const src = (imagem || FOTO_PADRAO).replace(/"/g, "%22");
    bannerInicio.style.setProperty("--capa-fundo", `url("${src}")`);
}

function atualizarProgresso(posicao, duracao) {
    const porcentagem = duracao > 0 ? Math.min(100, (posicao / duracao) * 100) : 0;
    barraPreenchida.style.width = porcentagem + "%";
    tempoAtual.textContent = formatarTempo(posicao);
    tempoTotal.textContent = formatarTempo(duracao);
}

function mostrarOuvindoAgora(pausado = false) {
    if (!infoAtual) return;

    // sai do modo "nada tocando"
    bannerInicio.classList.remove("ocioso");

    const nome = faixaAtual ? faixaAtual.nome : infoAtual.nome;
    const artistas = faixaAtual ? faixaAtual.artistas : infoAtual.artistas;

    fotoAgora.src = infoAtual.imagem || FOTO_PADRAO;
    definirFundo(infoAtual.imagem);

    statusAgora.textContent = pausado ? "Pausado" : "Ouvindo agora";
    nomeAgora.textContent = nome;
    artistaAgora.textContent = artistas || "";
}

// Só é chamado quando o player é fechado (pausar NÃO limpa o card)
function limparOuvindoAgora() {
    // modo "nada tocando": fica igual à página home
    bannerInicio.classList.add("ocioso");

    infoAtual = null;
    faixaAtual = null;

    fotoAgora.src = FOTO_PADRAO;
    definirFundo(null);

    statusAgora.textContent = "Ouvindo agora";
    nomeAgora.textContent = "Nada tocando";
    artistaAgora.textContent = "";
    atualizarProgresso(0, 0);
}

// O embed do Spotify avisa a página sobre play, pausa, faixa e posição
window.addEventListener("message", e => {
    if (e.origin !== "https://open.spotify.com") return;
    if (e.source !== playerSpotify.contentWindow) return;
    if (!e.data || e.data.type !== "playback_update" || !infoAtual) return;

    const dados = e.data.payload || {};

    // Em álbuns, descobre qual faixa está tocando agora
    const uri = dados.playingURI || "";
    if (infoAtual.faixas && uri.startsWith("spotify:track:")) {
        const idFaixa = uri.split(":")[2];
        faixaAtual = infoAtual.faixas.find(f => f.id === idFaixa) || faixaAtual;
    }

    mostrarOuvindoAgora(Boolean(dados.isPaused));
    atualizarProgresso(dados.position || 0, dados.duration || 0);
});

limparOuvindoAgora();


// ========================================
// PLAYER (EMBED)
// ========================================

const ID_VALIDO = /^[A-Za-z0-9]+$/;

function tocarEmbed(tipo, id, info) {
    if (!ID_VALIDO.test(id)) return;

    infoAtual = info;
    faixaAtual = null;
    mostrarOuvindoAgora(false);
    atualizarProgresso(0, 0);

    playerSpotify.src =
        `https://open.spotify.com/embed/${tipo}/${id}?utm_source=generator&theme=0`;

    playerContainer.style.display = "block";
    resultadosPesquisa.style.display = "none";
}

fecharPlayer.addEventListener("click", () => {
    playerSpotify.src = "";
    playerContainer.style.display = "none";
    limparOuvindoAgora();
});
// FINALIZADO
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const {
    SPOTIFY_CLIENT_ID,
    SPOTIFY_CLIENT_SECRET,
    ORIGEM_PERMITIDA,
    PORT = 3000
} = process.env;

if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    console.error("Defina SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET no .env");
    process.exit(1);
}

const app = express();

app.use(cors({ origin: ORIGEM_PERMITIDA }));
app.use("/api/", rateLimit({ windowMs: 60 * 1000, max: 60 }));


// ========== TOKEN (com cache) ==========

let cacheToken = { valor: null, expiraEm: 0 };

async function obterToken() {
    if (cacheToken.valor && Date.now() < cacheToken.expiraEm) {
        return cacheToken.valor;
    }

    const basic = Buffer
        .from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`)
        .toString("base64");

    const resposta = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
            Authorization: `Basic ${basic}`,
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: "grant_type=client_credentials"
    });

    if (!resposta.ok) {
        throw new Error(`Falha ao obter token: ${resposta.status}`);
    }

    const dados = await resposta.json();

    cacheToken = {
        valor: dados.access_token,
        expiraEm: Date.now() + (dados.expires_in - 60) * 1000
    };

    return cacheToken.valor;
}


// ========== AUXILIARES ==========

async function spotifyGet(caminho) {
    const token = await obterToken();

    const resposta = await fetch("https://api.spotify.com/v1" + caminho, {
        headers: { Authorization: `Bearer ${token}` }
    });

    if (!resposta.ok) {
        const erro = new Error(`Spotify respondeu ${resposta.status}`);
        erro.status = resposta.status;
        throw erro;
    }

    return resposta.json();
}

function responderErro(res, erro) {
    console.error(erro.message);

    if (erro.status === 429) {
        return res.status(429).json({ erro: "Muitas pesquisas. Tente em instantes." });
    }
    if (erro.status === 403) {
        return res.status(403).json({ erro: "O Spotify bloqueou esta consulta." });
    }
    if (erro.status === 404) {
        return res.status(404).json({ erro: "Não encontrado." });
    }
    res.status(502).json({ erro: "Erro ao consultar o Spotify." });
}

const ID_VALIDO = /^[A-Za-z0-9]{10,30}$/;

const imagemDe = item => item.images?.[0]?.url || "";


// ========== BUSCA (músicas + artistas) ==========

app.get("/api/buscar", async (req, res) => {
    const q = String(req.query.q || "").trim();

    if (q.length < 2 || q.length > 100) {
        return res.status(400).json({ erro: "Pesquisa inválida." });
    }

    try {
        const dados = await spotifyGet(
            "/search?type=track,artist&limit=10&q=" + encodeURIComponent(q)
        );

        const musicas = (dados.tracks?.items || []).map(m => ({
            id: m.id,
            nome: m.name,
            artistas: m.artists.map(a => a.name).join(", "),
            imagem: m.album.images[0]?.url || "",
            albumId: m.album.id
        }));

        const artistas = (dados.artists?.items || []).map(a => ({
            id: a.id,
            nome: a.name,
            imagem: imagemDe(a)
        }));

        res.json({ musicas, artistas });

    } catch (erro) {
        responderErro(res, erro);
    }
});


// ========== DISCOGRAFIA DO ARTISTA ==========

app.get("/api/artista/:id/albuns", async (req, res) => {
    const { id } = req.params;

    if (!ID_VALIDO.test(id)) {
        return res.status(400).json({ erro: "ID inválido." });
    }

    try {
        // o Spotify limita a 10 por página: busca até 5 páginas (50 itens)
        const itens = [];

        for (let pagina = 0; pagina < 5; pagina++) {
            const dados = await spotifyGet(
                `/artists/${id}/albums?include_groups=album,single&market=BR&limit=10&offset=${pagina * 10}`
            );

            const lote = dados.items || [];
            itens.push(...lote);

            if (lote.length < 10 || !dados.next) break;
        }

        // remove edições repetidas (mesmo nome e ano)
        const vistos = new Set();
        const albuns = [];

        for (const a of itens) {
            const ano = (a.release_date || "").slice(0, 4);
            const chave = `${a.name.toLowerCase()}|${ano}`;
            if (vistos.has(chave)) continue;
            vistos.add(chave);

            albuns.push({
                id: a.id,
                nome: a.name,
                imagem: imagemDe(a),
                ano,
                tipo: a.album_type === "single" ? "Single" : "Álbum"
            });
        }

        res.json(albuns);

    } catch (erro) {
        responderErro(res, erro);
    }
});


// ========== ÁLBUM COM FAIXAS ==========

app.get("/api/album/:id", async (req, res) => {
    const { id } = req.params;

    if (!ID_VALIDO.test(id)) {
        return res.status(400).json({ erro: "ID inválido." });
    }

    try {
        const a = await spotifyGet(`/albums/${id}?market=BR`);

        res.json({
            id: a.id,
            nome: a.name,
            imagem: imagemDe(a),
            artistas: a.artists.map(x => x.name).join(", "),
            ano: (a.release_date || "").slice(0, 4),
            faixas: (a.tracks?.items || []).map(t => ({
                id: t.id,
                numero: t.track_number,
                nome: t.name,
                artistas: t.artists.map(x => x.name).join(", ")
            }))
        });

    } catch (erro) {
        responderErro(res, erro);
    }
});


app.listen(PORT, () => {
    console.log(`Servidor rodando em http://127.0.0.1:${PORT}`);
});
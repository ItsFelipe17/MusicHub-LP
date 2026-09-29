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

// Só o seu site pode chamar esta API
app.use(cors({ origin: ORIGEM_PERMITIDA }));

// Limite de 60 requisições por minuto por IP
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
        // renova 60s antes de expirar
        expiraEm: Date.now() + (dados.expires_in - 60) * 1000
    };

    return cacheToken.valor;
}


// ========== ROTA DE BUSCA ==========

app.get("/api/buscar", async (req, res) => {
    const q = String(req.query.q || "").trim();

    if (q.length < 2 || q.length > 100) {
        return res.status(400).json({ erro: "Pesquisa inválida." });
    }

    try {
        const token = await obterToken();

        const url =
            "https://api.spotify.com/v1/search?type=track&limit=10&q=" +
            encodeURIComponent(q);

        const resposta = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (resposta.status === 429) {
            return res.status(429).json({ erro: "Muitas pesquisas. Tente em instantes." });
        }

        if (!resposta.ok) {
            return res.status(502).json({ erro: "Erro ao consultar o Spotify." });
        }

        const dados = await resposta.json();

        // Devolve só o necessário
        const musicas = dados.tracks.items.map(m => ({
            id: m.id,
            nome: m.name,
            artistas: m.artists.map(a => a.name).join(", "),
            imagem: m.album.images[0]?.url || ""
        }));

        res.json(musicas);

    } catch (erro) {
        console.error(erro.message);
        res.status(500).json({ erro: "Erro interno." });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://127.0.0.1:${PORT}`);
});
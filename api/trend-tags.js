export default async function handler(req, res) {
    const allowedOrigins = [
        process.env.SITE1_ORIGIN,
        process.env.SITE2_ORIGIN
    ].filter(Boolean);

    const origin = req.headers.origin;

    if (!origin || !allowedOrigins.includes(origin)) {
        res.setHeader("Vary", "Origin");
        return res.status(403).json({
            error: { message: "Origin not allowed" }
        });
    }

    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Vary", "Origin");

    if (req.method === "OPTIONS") {
        return res.status(204).end();
    }

    if (req.method !== "POST") {
        return res.status(405).json({
            error: { message: "POST only" }
        });
    }

    const {
        TREND_AI_API_KEY,
        TREND_AI_API_URL,
        TREND_AI_MODEL
    } = process.env;

    if (!TREND_AI_API_KEY || !TREND_AI_API_URL || !TREND_AI_MODEL) {
        return res.status(500).json({
            error: { message: "AI server settings are missing" }
        });
    }

    const content =
        typeof req.body?.content === "string"
            ? req.body.content.trim()
            : "";

    if (!content || content.length > 10000) {
        return res.status(400).json({
            error: { message: "本文が空か、長すぎます" }
        });
    }

    try {
        const upstream = await fetch(TREND_AI_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${TREND_AI_API_KEY}`
            },
            body: JSON.stringify({
                model: TREND_AI_MODEL,
                messages: [
                    {
                        role: "system",
                        content: "あなたは日本語SNSのトレンドタグ提案AIです。投稿本文に合う短いトレンド語を最大3個提案してください。ハッシュ記号は付けず、重複や説明文なしでJSON配列だけ返してください。例: [\"ピカチュウ\",\"新作ゲーム\"]"
                    },
                    { role: "user", content }
                ],
                temperature: 1
            })
        });

        const result = await upstream.json().catch(() => ({}));

        if (!upstream.ok) {
            console.error("Upstream AI error:", upstream.status);
            return res.status(502).json({
                error: {
                    message: "AIサービスへの接続に失敗しました"
                }
            });
        }

        return res.status(200).json(result);
    } catch (error) {
        console.error("AI request failed:", error.message);
        return res.status(502).json({
            error: {
                message: "AIサーバーとの通信に失敗しました"
            }
        });
    }
}

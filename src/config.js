require('dotenv').config();

module.exports = {
    // ===== API KEYS =====
    apiKey: process.env.BINANCE_API_KEY,
    apiSecret: process.env.BINANCE_API_SECRET,
    useTestnet: true,  // Passer à false pour le réel
    
    // ===== PARAMÈTRES DE TRADING =====
    symbol: "BTCUSDT",
    interval: "1h",          // Timeframe 1 heure
    
    // ===== GESTION DES RISQUES =====
    tradingCapital: 50,      // Capital de départ
    riskPerTrade: 0.02,      // 2% du capital par trade (1$)
    stopLossATR: 2,          // Stop Loss = 2 × ATR
    takeProfitATR: 3,        // Take Profit = 3 × ATR
    
    // ===== STRATÉGIE =====
    minConfidence: 5,        // Confiance minimum (1-10)
    enableShort: true,       // Activer les shorts
    pyramiding: 1,           // Max positions simultanées
    
    // ===== COOLDOWN =====
    cooldown: 30000,         // 30 secondes entre les trades
    
    // ===== DEBUG =====
    debug: true
};
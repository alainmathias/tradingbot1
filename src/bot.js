// bot.js - Bot avec stratégie avancée
const axios = require('axios');
const config = require('./config');
const { client, syncTime } = require('./binance');
const TradingSystem = require('./tradingSystem');

let lastTrade = 0;
let position = null;

// Récupération des bougies
async function getCandles(limit = 100) {
    try {
        const baseUrl = config.useTestnet 
            ? 'https://testnet.binancefuture.com'
            : 'https://fapi.binance.com';
        const res = await axios.get(
            `${baseUrl}/fapi/v1/klines?symbol=${config.symbol}&interval=${config.interval}&limit=${limit}`
        );
        
        return res.data.map(c => ({
            time: c[0],
            open: parseFloat(c[1]),
            high: parseFloat(c[2]),
            low: parseFloat(c[3]),
            close: parseFloat(c[4]),
            volume: parseFloat(c[5])
        }));
    } catch (err) {
        console.log("❌ Erreur getCandles:", err.message);
        return [];
    }
}

// Calcul taille position basée sur le risque
function calculatePositionSize(price, stopLoss) {
    const capital = config.tradingCapital;
    const riskAmount = capital * config.riskPerTrade;
    const stopDistance = Math.abs(price - stopLoss);
    let size = riskAmount / stopDistance;
    size = Math.max(size, 0.001);
    return parseFloat(size.toFixed(3));
}

// Ouvrir un trade
async function openTrade(signal, price, stopLoss, takeProfit) {
    try {
        const size = calculatePositionSize(price, stopLoss);
        const side = signal === 'BUY' ? 'BUY' : 'SELL';
        
        console.log(`\n🚀 OUVERTURE ${side}`);
        console.log(`   Entry: ${price} | Size: ${size} BTC`);
        console.log(`   SL: ${stopLoss.toFixed(2)} | TP: ${takeProfit.toFixed(2)}`);
        
        // Ordre principal
        const order = await client.futuresOrder({
            symbol: config.symbol,
            side: side,
            type: "MARKET",
            quantity: size
        });
        
        // Stop Loss
        await client.futuresOrder({
            symbol: config.symbol,
            side: side === 'BUY' ? 'SELL' : 'BUY',
            type: "STOP_MARKET",
            stopPrice: parseFloat(stopLoss.toFixed(2)),
            closePosition: true
        });
        
        // Take Profit
        await client.futuresOrder({
            symbol: config.symbol,
            side: side === 'BUY' ? 'SELL' : 'BUY',
            type: "TAKE_PROFIT_MARKET",
            stopPrice: parseFloat(takeProfit.toFixed(2)),
            closePosition: true
        });
        
        position = { side, entry: price, size, stopLoss, takeProfit };
        console.log(`✅ ${side} exécuté !`);
        
    } catch (err) {
        console.log("❌ OPEN ERROR:", err.message);
    }
}

// Fermer un trade
async function closePosition() {
    if (!position) return;
    
    try {
        const positions = await client.futuresPositionRisk();
        const current = positions.find(p => p.symbol === config.symbol);
        
        if (!current || Number(current.positionAmt) === 0) {
            position = null;
            return;
        }
        
        const closeSide = Number(current.positionAmt) > 0 ? "SELL" : "BUY";
        const size = Math.abs(Number(current.positionAmt));
        
        await client.futuresOrder({
            symbol: config.symbol,
            side: closeSide,
            type: "MARKET",
            quantity: size,
            reduceOnly: true
        });
        
        console.log(`✅ Position fermée`);
        position = null;
        
    } catch (err) {
        console.log("❌ CLOSE ERROR:", err.message);
    }
}

// Vérifier les positions existantes
async function syncPosition() {
    try {
        const positions = await client.futuresPositionRisk();
        const current = positions.find(p => p.symbol === config.symbol);
        const qty = current ? Number(current.positionAmt) : 0;
        
        if (qty === 0 && position) {
            console.log("🔄 Position fermée détectée");
            position = null;
        } else if (qty !== 0 && !position) {
            console.log("🔄 Position existante restaurée");
            position = {
                side: qty > 0 ? "BUY" : "SELL",
                entry: Number(current.entryPrice),
                size: Math.abs(qty)
            };
        }
    } catch (err) {
        console.log("❌ Sync error:", err.message);
    }
}

// Boucle principale
async function run() {
    try {
        await syncPosition();
        
        const candles = await getCandles(100);
        if (candles.length < 50) return;
        
        const tradingSystem = new TradingSystem(candles, config);
        const signal = tradingSystem.generateSignal();
        
        const now = Date.now();
        
        if (signal.signal !== 'NONE' && !position && now - lastTrade > config.cooldown) {
            await openTrade(signal.signal, signal.entry, signal.stopLoss, signal.takeProfit);
            lastTrade = now;
        }
        
        // Log périodique
        if (config.debug && signal.signal === 'NONE') {
            console.log(`📊 ${new Date().toLocaleTimeString()} | RSI: ${signal.rsi?.toFixed(1)} | Trend: ${signal.trend}`);
        }
        
    } catch (err) {
        console.log("❌ BOT ERROR:", err.message);
    }
}

// Démarrage
(async () => {
    try {
        await syncTime();
        console.log(`✅ BOT ADVANCÉ DÉMARRÉ`);
        console.log(`   Stratégie: Patterns + RSI + MACD + EMA`);
        console.log(`   Timeframe: ${config.interval}`);
        console.log(`   Capital: ${config.tradingCapital} USDT`);
        console.log(`   Risque/trade: ${config.riskPerTrade * 100}%`);
        console.log(`   SL: ${config.stopLossATR}×ATR | TP: ${config.takeProfitATR}×ATR`);
        
        setInterval(run, 15000);
        
    } catch (err) {
        console.log("❌ START ERROR:", err.message);
    }
})();
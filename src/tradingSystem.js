// tradingSystem.js - Version corrigée
class TradingSystem {
    constructor(candles, config) {
        this.candles = candles;
        this.config = config;
    }

    // Calcul de l'ATR
    calculateATR(period = 14) {
        if (this.candles.length < period + 1) return 0;
        
        const trueRanges = [];
        for (let i = 1; i < this.candles.length; i++) {
            const high = this.candles[i].high;
            const low = this.candles[i].low;
            const prevClose = this.candles[i-1].close;
            
            trueRanges.push(Math.max(
                high - low,
                Math.abs(high - prevClose),
                Math.abs(low - prevClose)
            ));
        }
        
        const recentTR = trueRanges.slice(-period);
        return recentTR.reduce((a, b) => a + b, 0) / period;
    }

    // Calcul de l'EMA
    calculateEMA(data, period) {
        const k = 2 / (period + 1);
        let ema = data[0];
        for (let i = 1; i < data.length; i++) {
            ema = data[i] * k + ema * (1 - k);
        }
        return ema;
    }

    // RSI
    calculateRSI(period = 14) {
        if (this.candles.length < period + 1) return 50;
        
        const closes = this.candles.map(c => c.close);
        let gains = 0, losses = 0;
        
        for (let i = closes.length - period; i < closes.length; i++) {
            const diff = closes[i] - closes[i-1];
            if (diff >= 0) gains += diff;
            else losses -= diff;
        }
        
        const avgGain = gains / period;
        const avgLoss = losses / period;
        if (avgLoss === 0) return 100;
        return 100 - (100 / (1 + (avgGain / avgLoss)));
    }

    // MACD
    calculateMACD() {
        const closes = this.candles.map(c => c.close);
        const ema12 = this.calculateEMA(closes, 12);
        const ema26 = this.calculateEMA(closes, 26);
        const macd = ema12 - ema26;
        
        const macdHistory = [];
        for (let i = closes.length - 26; i < closes.length; i++) {
            const e12 = this.calculateEMA(closes.slice(0, i+1), 12);
            const e26 = this.calculateEMA(closes.slice(0, i+1), 26);
            macdHistory.push(e12 - e26);
        }
        const signal = this.calculateEMA(macdHistory, 9);
        
        return { macd, signal, histogram: macd - signal };
    }

    // Détection de la tendance
    detectTrend() {
        const closes = this.candles.map(c => c.close);
        const ema20 = this.calculateEMA(closes, 20);
        const ema50 = this.calculateEMA(closes, 50);
        const currentPrice = closes[closes.length - 1];
        const rsi = this.calculateRSI(14);
        const macd = this.calculateMACD();
        
        if (currentPrice > ema20 && ema20 > ema50 && rsi > 50 && macd.histogram > 0) {
            return { trend: 'BULLISH', strength: 8 };
        }
        if (currentPrice < ema20 && ema20 < ema50 && rsi < 50 && macd.histogram < 0) {
            return { trend: 'BEARISH', strength: 8 };
        }
        if (currentPrice > ema20 && rsi > 50) {
            return { trend: 'WEAKLY_BULLISH', strength: 4 };
        }
        if (currentPrice < ema20 && rsi < 50) {
            return { trend: 'WEAKLY_BEARISH', strength: 4 };
        }
        return { trend: 'NEUTRAL', strength: 2 };
    }

    // Détection des patterns
    detectPatterns() {
        const patterns = [];
        const last = this.candles[this.candles.length - 1];
        const prev = this.candles[this.candles.length - 2];
        
        if (!last || !prev) return patterns;
        
        const body = Math.abs(last.close - last.open);
        const upperWick = last.high - Math.max(last.open, last.close);
        const lowerWick = Math.min(last.open, last.close) - last.low;
        
        // Doji
        if (body < (last.high - last.low) * 0.1) {
            patterns.push({ type: 'DOJI', signal: 'NEUTRAL', strength: 2 });
        }
        
        // Marteau (signal haussier)
        if (lowerWick > body * 2 && upperWick < body * 0.5) {
            const isDowntrend = this.candles.slice(-10).every((c, i, arr) => 
                i === 0 || c.close < arr[i-1].close
            );
            if (isDowntrend) {
                patterns.push({ type: 'HAMMER', signal: 'BUY', strength: 7 });
            }
        }
        
        // Étoile filante (signal baissier)
        if (upperWick > body * 2 && lowerWick < body * 0.5) {
            const isUptrend = this.candles.slice(-10).every((c, i, arr) => 
                i === 0 || c.close > arr[i-1].close
            );
            if (isUptrend) {
                patterns.push({ type: 'SHOOTING_STAR', signal: 'SELL', strength: 7 });
            }
        }
        
        // Engloutissement haussier
        if (last.close > last.open && prev.close < prev.open &&
            last.open < prev.close && last.close > prev.open) {
            patterns.push({ type: 'BULLISH_ENGULFING', signal: 'BUY', strength: 8 });
        }
        
        // Engloutissement baissier
        if (last.close < last.open && prev.close > prev.open &&
            last.open > prev.close && last.close < prev.open) {
            patterns.push({ type: 'BEARISH_ENGULFING', signal: 'SELL', strength: 8 });
        }
        
        return patterns;
    }

    // Générer le signal
    generateSignal() {
        const trend = this.detectTrend();
        const patterns = this.detectPatterns();
        const currentPrice = this.candles[this.candles.length - 1].close;
        const atr = this.calculateATR(14);
        const rsi = this.calculateRSI(14);
        
        let signal = 'NONE';
        let confidence = 0;
        let reasons = [];
        
        // === STRATÉGIE POUR TEST (décommente pour forcer les trades) ===
        // TEMPORAIRE : Force BUY si RSI < 60 et tendance haussière
        if (trend.trend.includes('BULLISH') && rsi < 80 && rsi > 35) {
            signal = 'BUY';
            confidence = 7;
            reasons.push(`RSI à ${rsi.toFixed(1)} (zone test)`);
        }
        // TEMPORAIRE : Force SELL si RSI > 40 et tendance baissière
        else if (trend.trend.includes('BEARISH') && rsi > 40 && rsi < 65) {
            signal = 'SELL';
            confidence = 7;
            reasons.push(`RSI à ${rsi.toFixed(1)} (zone test)`);
        }
        // === FIN ZONE TEST ===
        
        // Si pas de signal forcé, utiliser la stratégie normale
        if (signal === 'NONE') {
            if (trend.trend.includes('BULLISH')) {
                const buyPattern = patterns.find(p => p.signal === 'BUY' && p.strength >= 7);
                if (buyPattern) {
                    signal = 'BUY';
                    confidence = Math.min(10, 7 + trend.strength / 2);
                    reasons.push(`${buyPattern.type} détecté`);
                } else if (rsi < 35) {
                    signal = 'BUY';
                    confidence = 6;
                    reasons.push(`RSI à ${rsi.toFixed(1)} (survendu)`);
                }
                
                if (rsi > 70 && confidence > 5) {
                    confidence -= 2;
                    reasons.push('RSI surachat');
                }
            }
            else if (trend.trend.includes('BEARISH')) {
                const sellPattern = patterns.find(p => p.signal === 'SELL' && p.strength >= 7);
                if (sellPattern) {
                    signal = 'SELL';
                    confidence = Math.min(10, 7 + trend.strength / 2);
                    reasons.push(`${sellPattern.type} détecté`);
                } else if (rsi > 65) {
                    signal = 'SELL';
                    confidence = 6;
                    reasons.push(`RSI à ${rsi.toFixed(1)} (suracheté)`);
                }
                
                if (rsi < 30 && confidence > 5) {
                    confidence -= 2;
                    reasons.push('RSI survente');
                }
            }
        }
        
        // Vérifier la confiance minimale
        if (confidence < this.config.minConfidence) {
            signal = 'NONE';
        }
        
        // Calculer SL et TP
        let stopLoss = 0;
        let takeProfit = 0;
        
        if (signal !== 'NONE') {
            const atrValue = Math.max(atr, currentPrice * 0.005);
            
            if (signal === 'BUY') {
                stopLoss = currentPrice - atrValue * this.config.stopLossATR;
                takeProfit = currentPrice + atrValue * this.config.takeProfitATR;
            } else if (signal === 'SELL') {
                stopLoss = currentPrice + atrValue * this.config.stopLossATR;
                takeProfit = currentPrice - atrValue * this.config.takeProfitATR;
            }
        }
        
        // Logs détaillés
        console.log(`\n🔍 VÉRIFICATION:`);
        console.log(`   Trend: ${trend.trend} | RSI: ${rsi.toFixed(1)}`);
        console.log(`   Signal: ${signal} | Confiance: ${confidence}/${this.config.minConfidence}`);
        console.log(`   Patterns: ${patterns.map(p => p.type).join(', ') || 'aucun'}`);
        
        if (signal !== 'NONE') {
            console.log(`   🎯 ${signal} déclenché !`);
            console.log(`   Raisons: ${reasons.join(', ')}`);
            console.log(`   SL: ${stopLoss.toFixed(2)} | TP: ${takeProfit.toFixed(2)}`);
        }
        
        return {
            signal,
            confidence,
            entry: currentPrice,
            stopLoss,
            takeProfit,
            atr,
            rsi,
            reasons,
            trend: trend.trend,
            patterns: patterns.map(p => p.type)
        };
    }
}

module.exports = TradingSystem;
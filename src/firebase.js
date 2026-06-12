// firebase.js - Version pour le nouveau bot
const admin = require('firebase-admin');

let db = null;
let initialized = false;
let lastSaveTime = 0;
const COOLDOWN_MS = 5000; // 5 secondes entre chaque sauvegarde

// Collection séparée pour le nouveau bot
const COLLECTION_NAME = 'trades_advanced';  // ← NOUVELLE COLLECTION

function initFirebase() {
    if (initialized) return;
    
    try {
        const credentialsJson = process.env.FIREBASE_CREDENTIALS_JSON;
        
        if (!credentialsJson) {
            console.log("⚠️ Firebase non configuré (variables manquantes)");
            return false;
        }
        
        const serviceAccount = JSON.parse(credentialsJson);
        
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
        }
        
        db = admin.firestore();
        initialized = true;
        console.log("✅ Firebase connecté (collection: " + COLLECTION_NAME + ")");
        return true;
        
    } catch (err) {
        console.log("❌ Firebase erreur:", err.message);
        return false;
    }
}

async function saveTrade(trade) {
    if (!db) {
        console.log("⚠️ Firebase non disponible");
        return false;
    }
    
    // Éviter les sauvegardes trop fréquentes
    const now = Date.now();
    if (now - lastSaveTime < COOLDOWN_MS) {
        console.log("⏳ Cooldown Firebase, sauvegarde ignorée");
        return false;
    }
    lastSaveTime = now;
    
    try {
        const docRef = db.collection(COLLECTION_NAME).doc();
        
        const tradeData = {
            // Identification
            strategy: "advanced_multi_indicator",
            version: "2.0.0",
            
            // Informations trade
            side: trade.side,
            type: trade.type || "OPEN",
            confidence: trade.confidence || null,
            
            // Prix
            entryPrice: trade.entryPrice || null,
            exitPrice: trade.exitPrice || null,
            stopLoss: trade.stopLoss || null,
            takeProfit: trade.takeProfit || null,
            
            // Taille
            size: trade.size || null,
            pnl: trade.pnl || null,
            
            // Indicateurs au moment du trade
            rsi: trade.rsi || null,
            trend: trade.trend || null,
            patterns: trade.patterns || [],
            reasons: trade.reasons || [],
            
            // Métadonnées
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            date: new Date().toISOString(),
            createdAt: Date.now()
        };
        
        await docRef.set(tradeData);
        console.log(`💾 Trade ${trade.type} sauvegardé dans ${COLLECTION_NAME} (ID: ${docRef.id})`);
        return true;
        
    } catch (err) {
        console.log("❌ Erreur sauvegarde:", err.message);
        return false;
    }
}

async function saveOpenTrade(tradeSignal, price, size, stopLoss, takeProfit) {
    return await saveTrade({
        type: "OPEN",
        side: tradeSignal.signal,
        entryPrice: price,
        size: size,
        stopLoss: stopLoss,
        takeProfit: takeProfit,
        confidence: tradeSignal.confidence,
        rsi: tradeSignal.rsi,
        trend: tradeSignal.trend,
        patterns: tradeSignal.patterns,
        reasons: tradeSignal.reasons,
        timestamp: new Date().toISOString()
    });
}

async function saveClosedTrade(position, exitPrice, pnl, closeReason) {
    return await saveTrade({
        type: "CLOSED",
        side: position.side,
        entryPrice: position.entry,
        exitPrice: exitPrice,
        size: position.size,
        pnl: pnl.toFixed(2),
        closeReason: closeReason,
        timestamp: new Date().toISOString()
    });
}

async function getRecentTrades(limit = 50) {
    if (!db) return [];
    
    try {
        const snapshot = await db.collection(COLLECTION_NAME)
            .orderBy('timestamp', 'desc')
            .limit(limit)
            .get();
        
        const trades = [];
        snapshot.forEach(doc => {
            trades.push({ id: doc.id, ...doc.data() });
        });
        return trades;
        
    } catch (err) {
        console.log("❌ Erreur lecture:", err.message);
        return [];
    }
}

async function getStats() {
    if (!db) return null;
    
    try {
        // Trades fermés
        const closedSnapshot = await db.collection(COLLECTION_NAME)
            .where('type', '==', 'CLOSED')
            .get();
        
        let totalPnl = 0;
        let wins = 0;
        let losses = 0;
        
        closedSnapshot.forEach(doc => {
            const pnl = doc.data().pnl;
            if (pnl) {
                totalPnl += parseFloat(pnl);
                if (parseFloat(pnl) > 0) wins++;
                else if (parseFloat(pnl) < 0) losses++;
            }
        });
        
        return {
            totalTrades: closedSnapshot.size,
            totalPnl: totalPnl.toFixed(2),
            wins: wins,
            losses: losses,
            winRate: closedSnapshot.size > 0 ? (wins / closedSnapshot.size * 100).toFixed(1) : 0
        };
        
    } catch (err) {
        console.log("❌ Erreur stats:", err.message);
        return null;
    }
}

module.exports = { 
    initFirebase, 
    saveTrade, 
    saveOpenTrade, 
    saveClosedTrade, 
    getRecentTrades, 
    getStats,
    COLLECTION_NAME 
};
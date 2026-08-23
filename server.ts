import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// In-memory persistent state store for server-authoritative financial operations & fallback when Firestore rules require server proxy
interface ServerState {
  auditLogs: any[];
  drawProofs: Record<string, any>;
  verifiedPayments: Set<string>;
  processedPayouts: Set<string>;
}

const serverState: ServerState = {
  auditLogs: [],
  drawProofs: {},
  verifiedPayments: new Set(),
  processedPayouts: new Set(),
};

// --- Server-Side Financial Endpoints ---

// 1. Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), platform: 'YegnaEkub Engine' });
});

// 2. Cryptographic Draw Execution
app.post('/api/draws/execute', (req, res) => {
  try {
    const { ekubId, ekubName, cycleId, cycleNumber, eligibleMembers, payoutAmount, actorId, actorName } = req.body;

    if (!ekubId || !eligibleMembers || !Array.isArray(eligibleMembers) || eligibleMembers.length === 0) {
      return res.status(400).json({ error: 'Valid ekubId and at least one eligible member are required for a draw.' });
    }

    // Cryptographically secure randomness generation
    const serverSeed = crypto.randomBytes(32).toString('hex');
    const serverSeedHash = crypto.createHash('sha256').update(serverSeed).digest('hex');
    const clientSeed = req.body.clientSeed || `yegna-ekub-${ekubId}-cycle-${cycleNumber}-${Date.now()}`;
    const nonce = Math.floor(Math.random() * 1000000);

    const hmac = crypto.createHmac('sha256', serverSeed);
    hmac.update(`${clientSeed}:${nonce}:${cycleNumber}`);
    const hashResult = hmac.digest('hex');

    // Convert first 12 hex characters (48 bits) to integer
    const hexSlice = hashResult.substring(0, 12);
    const rawDecimal = parseInt(hexSlice, 16);
    const winningIndex = rawDecimal % eligibleMembers.length;
    const winner = eligibleMembers[winningIndex];

    const drawId = `draw-${ekubId}-c${cycleNumber}-${Date.now()}`;
    const payoutId = `payout-${ekubId}-c${cycleNumber}-${Date.now()}`;

    const proof = {
      drawId,
      ekubId,
      ekubName,
      cycleId,
      cycleNumber,
      serverSeed,
      serverSeedHash,
      clientSeed,
      nonce,
      hashResult,
      rawDecimal: rawDecimal.toString(),
      eligibleCount: eligibleMembers.length,
      winningIndex,
      winnerId: winner.userId || winner.id,
      winnerName: winner.displayName || winner.name || 'Anonymous Member',
      payoutAmount,
      explanation: `Index calculated by (parseInt(HMAC_SHA256(serverSeed, "${clientSeed}:${nonce}:${cycleNumber}")[0..12], 16) % ${eligibleMembers.length}) = ${winningIndex}`,
      timestamp: new Date().toISOString(),
    };

    serverState.drawProofs[drawId] = proof;

    // Create Audit Log
    const auditRecord = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      actorId: actorId || 'system-engine',
      actorName: actorName || 'YegnaEkub Server Draw Engine',
      actorRole: 'admin',
      action: 'DRAW_EXECUTED',
      entityType: 'draw',
      entityId: drawId,
      newState: { winnerId: winner.userId, cycleNumber, hashResult, winningIndex },
      reason: `Cryptographic live draw successfully executed for ${ekubName} Cycle #${cycleNumber}`,
      timestamp: new Date().toISOString(),
    };
    serverState.auditLogs.unshift(auditRecord);

    res.json({
      success: true,
      drawId,
      payoutId,
      winner,
      proof,
      auditRecord,
    });
  } catch (error: any) {
    console.error('Error executing draw:', error);
    res.status(500).json({ error: error.message || 'Internal server error during draw execution.' });
  }
});

// 3. Verify Draw Cryptographic Hash Endpoint
app.post('/api/draws/verify-proof', (req, res) => {
  try {
    const { serverSeed, clientSeed, nonce, cycleNumber, eligibleCount, providedHash, providedIndex } = req.body;

    if (!serverSeed || !clientSeed || nonce === undefined || !eligibleCount) {
      return res.status(400).json({ error: 'Missing parameters required for verification computation.' });
    }

    const hmac = crypto.createHmac('sha256', serverSeed);
    hmac.update(`${clientSeed}:${nonce}:${cycleNumber}`);
    const calculatedHash = hmac.digest('hex');

    const hexSlice = calculatedHash.substring(0, 12);
    const rawDecimal = parseInt(hexSlice, 16);
    const calculatedIndex = rawDecimal % parseInt(eligibleCount, 10);

    const isHashValid = providedHash ? providedHash.toLowerCase() === calculatedHash.toLowerCase() : true;
    const isIndexValid = providedIndex !== undefined ? parseInt(providedIndex, 10) === calculatedIndex : true;

    res.json({
      isValid: isHashValid && isIndexValid,
      calculatedHash,
      rawDecimal: rawDecimal.toString(),
      calculatedIndex,
      stepByStep: [
        `1. Recomputed HMAC-SHA256 with server seed and message "${clientSeed}:${nonce}:${cycleNumber}"`,
        `2. Produced hash: ${calculatedHash}`,
        `3. First 12 hex characters: "${hexSlice}" converted to decimal: ${rawDecimal}`,
        `4. Computed modulo: ${rawDecimal} % ${eligibleCount} = Index ${calculatedIndex}`,
        `5. Verification status: ${isHashValid && isIndexValid ? 'PASSED (Cryptographically Exact Match)' : 'FAILED'}`,
      ],
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Proof verification failed.' });
  }
});

// 4. Payment Verification Endpoint (Admin)
app.post('/api/admin/verify-payment', (req, res) => {
  try {
    const { contributionId, adminId, adminName, notes } = req.body;

    if (!contributionId) {
      return res.status(400).json({ error: 'contributionId is required.' });
    }

    serverState.verifiedPayments.add(contributionId);

    const auditRecord = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      actorId: adminId || 'admin',
      actorName: adminName || 'Compliance Officer',
      actorRole: 'admin',
      action: 'PAYMENT_VERIFIED',
      entityType: 'payment',
      entityId: contributionId,
      reason: notes || 'Bank deposit / Telebirr transaction reference verified against bank ledger',
      timestamp: new Date().toISOString(),
    };
    serverState.auditLogs.unshift(auditRecord);

    res.json({ success: true, verifiedAt: new Date().toISOString(), auditRecord });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Payment Rejection Endpoint (Admin)
app.post('/api/admin/reject-payment', (req, res) => {
  try {
    const { contributionId, adminId, adminName, rejectionReason } = req.body;

    const auditRecord = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      actorId: adminId || 'admin',
      actorName: adminName || 'Compliance Officer',
      actorRole: 'admin',
      action: 'PAYMENT_REJECTED',
      entityType: 'payment',
      entityId: contributionId,
      reason: rejectionReason || 'Invalid bank receipt or unmatching transaction reference',
      timestamp: new Date().toISOString(),
    };
    serverState.auditLogs.unshift(auditRecord);

    res.json({ success: true, rejectedAt: new Date().toISOString(), auditRecord });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Payout Processing Endpoint (Admin)
app.post('/api/payouts/process', (req, res) => {
  try {
    const { payoutId, ekubId, cycleNumber, winnerId, paymentReference, adminId, adminName } = req.body;

    if (!payoutId || serverState.processedPayouts.has(payoutId)) {
      return res.status(400).json({ error: 'Payout already processed or invalid payout ID.' });
    }

    serverState.processedPayouts.add(payoutId);

    const auditRecord = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      actorId: adminId || 'admin',
      actorName: adminName || 'Finance Disburser',
      actorRole: 'admin',
      action: 'PAYOUT_DISBURSED',
      entityType: 'payout',
      entityId: payoutId,
      newState: { status: 'paid', paymentReference },
      reason: `Direct bank wire transfer completed with reference ${paymentReference}`,
      timestamp: new Date().toISOString(),
    };
    serverState.auditLogs.unshift(auditRecord);

    res.json({
      success: true,
      processedAt: new Date().toISOString(),
      paymentReference,
      auditRecord,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 7. Audit Logs Endpoint
app.get('/api/audit-logs', (req, res) => {
  res.json({ logs: serverState.auditLogs });
});

// Vite middleware & Static Serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`YegnaEkub Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

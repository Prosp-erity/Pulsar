#!/bin/bash
# 15-minute monitoring script.
# Takes a snapshot of the app's performance every 2 minutes for 15 minutes.
# Outputs TSV that I can read back to write the report.

DURATION_MS=900000   # 15 minutes
INTERVAL_MS=120000   # 2 minutes
OUTFILE="/home/z/my-project/download/monitoring.tsv"

echo -e "timestamp\tequity\trealizedPnl\tunrealizedPnl\tpositions\ttrades\twins\tlosses\twinRate\topenExposure\terrors" > "$OUTFILE"

START=$(date +%s%3N)
END=$((START + DURATION_MS))

echo "Monitoring started at $(date -Iseconds)"
echo "Will run until $(date -d @$((END/1000)) -Iseconds)"
echo "Snapshots written to $OUTFILE"
echo ""

while [ $(date +%s%3N) -lt $END ]; do
  NOW=$(date +%H:%M:%S)
  # Use agent-browser to extract live state from the running app
  STATE=$(agent-browser eval "
(() => {
  const raw = window.localStorage.getItem('neonscalp.session.v1');
  if (!raw) return JSON.stringify({error: 'no session'});
  const p = JSON.parse(raw);
  // Read live DOM values
  const text = document.body.textContent || '';
  // Count error badges
  const errorCount = (document.body.innerHTML.match(/error/gi) || []).length;
  return JSON.stringify({
    realizedPnl: p.realizedPnl,
    tradeCount: p.trades.length,
    positionCount: p.positions.length,
    savedAt: p.savedAt,
    errors: errorCount,
  });
})()
" 2>&1 | tail -1)

  echo -e "$NOW\t$STATE" >> "$OUTFILE"
  echo "[$NOW] $STATE"

  # Wait for next interval
  sleep $((INTERVAL_MS / 1000))
done

echo ""
echo "Monitoring complete at $(date -Iseconds)"
echo "Final results in $OUTFILE"

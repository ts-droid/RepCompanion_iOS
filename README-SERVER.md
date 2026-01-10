# RepCompanion Server - Auto-Start Guide

## ✅ Rätt Server-mapp
**ENDAST använd denna server:**
```
/Users/thomassoderberg/.gemini/antigravity/scratch/test/RepCompanion 2
```

## 🚫 Fel Server-mappar (STÄNG NER Dessa!)
- `/Users/thomassoderberg/.gemini/antigravity/scratch/Test/RepCompanion 2` (med stort T)
- `/Users/thomassoderberg/.gemini/antigravity/scratch/RepCompanion 2`
- Alla andra server-instanser

## 🚀 Starta Servern

### Automatisk start vid systemstart (rekommenderas)
```bash
cd "/Users/thomassoderberg/.gemini/antigravity/scratch/test/RepCompanion 2"
./install-auto-start.sh
```

Detta installerar en macOS LaunchAgent som:
- Startar servern automatiskt vid systemstart
- Startar om servern automatiskt om den kraschar
- Körs i bakgrunden hela tiden

### Starta servern nu (med auto-restart)
```bash
cd "/Users/thomassoderberg/.gemini/antigravity/scratch/test/RepCompanion 2"
./start-server.sh
```

Detta startar servern med auto-restart. Om servern kraschar startar den automatiskt om efter 3 sekunder.

### Manuell start (utan auto-restart)
```bash
cd "/Users/thomassoderberg/.gemini/antigravity/scratch/test/RepCompanion 2"
PORT=5001 npm run dev
```

### Avinstallera auto-start
```bash
cd "/Users/thomassoderberg/.gemini/antigravity/scratch/test/RepCompanion 2"
./uninstall-auto-start.sh
```

## 🛑 Stoppa Alla Servrar

```bash
cd "/Users/thomassoderberg/.gemini/antigravity/scratch/test/RepCompanion 2"
./stop-all-servers.sh
```

Detta stoppar ALLA server-processer, inklusive de i fel mappar.

## 📋 Verifiera Server-status

```bash
# Kontrollera om servern körs
lsof -ti:5001

# Kontrollera loggar
tail -f /tmp/repcompanion-server.log

# Testa servern
curl http://localhost:5001/api/health
```

## ⚙️ Konfiguration

- **Port:** 5001
- **Log-fil:** `/tmp/repcompanion-server.log`
- **Auto-reload:** Aktiverat med `tsx watch`
- **Auto-restart:** Aktiverat med `start-server.sh` eller LaunchAgent

## 🔍 Felsökning

Om servern inte startar:
1. Kör `./stop-all-servers.sh` för att stoppa alla servrar
2. Kontrollera att port 5001 är ledig: `lsof -ti:5001`
3. Starta servern igen: `./start-server.sh`
4. Kontrollera loggar: `tail -f /tmp/repcompanion-server.log`

## ⚠️ VIKTIGT

- **ALDRIG** starta servrar i andra mappar
- **ALDRIG** använd port 5000 (använd alltid 5001)
- **ALDRIG** starta flera server-instanser samtidigt
- **ALLTID** använd `./stop-all-servers.sh` innan du startar en ny server

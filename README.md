# JukeDecker

Privates, nicht kommerzielles Projekt für den persönlichen Gebrauch.

JukeDecker wird die Mobil-Version (Android-Tablet und -Handy) einer
privaten Musik-Anwendung: zwei Plattenspieler-Decks und eine Musikbox, die
Playlisten aus einem selbst erzeugten Paket abspielen. Die Musik kommt über
den eingebetteten YouTube-Player. Es werden keine YouTube-Inhalte
heruntergeladen.

## Stand

(1) `app/` ist die App (Version steht in `app/version.js`). Zurzeit gibt es
    das Gerüst: Startseite, Paket-Import, Einstellungen, Party-Modus und
    Offline-Betrieb. PlayDecker und Jukeboxer folgen.
(2) `app/gemeinsam/` enthält unveränderte Kopien gemeinsamer Bausteine
    (Designs, Schriften). Herkunft und Prüfsummen stehen in
    `app/gemeinsam/HERKUNFT.txt`. Diese Dateien werden nie von Hand
    bearbeitet.
(3) `messung/` ist die frühere Messseite. Sie bleibt vorerst erreichbar.

## Was hier nicht liegt

In diesem Repo liegen nur die statischen Dateien der Seite. Playlisten,
Nutzerdaten, Anmeldedaten, Schlüssel und Messprotokolle liegen nicht hier.

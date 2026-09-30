# v1.1.3 — Sauvegardes de bases et de dossiers

## Configuration

Dans **Bases & Dossiers**, créez une source, testez-la, puis créez un job en
choisissant cette source, une cible de stockage et éventuellement un cron. Les
identifiants des sources sont chiffrés dans le catalogue SQLite et ne sont pas
renvoyés par l'API de lecture. Sauvegardez aussi le catalogue et sa clé de
chiffrement avant toute migration.

| Source | Prérequis sur le serveur DaliBackup | Format | Restauration |
| --- | --- | --- | --- |
| MySQL | `mysqldump`, accès à la base | `.sql.gz` complet | Décompresser puis importer avec `mysql` |
| PostgreSQL | `pg_dump`, accès à la base | `.sql.gz` complet | Décompresser puis importer avec `psql` |
| MSSQL | `sqlcmd`, droit `BACKUP DATABASE`, dossier d'échange | `.bak` natif avec `COMPRESSION` et `CHECKSUM` | `RESTORE DATABASE` via SQL Server |
| FTP/FTPS/SFTP | Accès récursif en lecture | `.tar.gz` complet puis incrémental | Script de reconstruction ci-dessous |
| SMB | Partage déjà monté / UNC lisible par le compte DaliBackup | `.tar.gz` complet puis incrémental | Script de reconstruction ci-dessous |

Les outils de base de données ne sont **pas inclus** dans l'exécutable Windows.
Pour MSSQL, « dossier côté SQL Server » est le chemin écrit par le moteur SQL,
et « dossier accessible » est le chemin vers les mêmes fichiers depuis le
processus DaliBackup. Les deux chemins peuvent différer pour un serveur distant.
Le fichier `.bak` temporaire est retiré du dossier d'échange après transfert.

Le mode dossiers compare taille et date de modification. Si le serveur distant
ne fournit pas de date fiable, le fichier est recopié à chaque passage pour ne
pas le manquer. Une nouvelle archive complète est émise périodiquement. La
rétention conserve automatiquement les bases complètes requises par les
incréments encore retenus ; le nombre de points conservés peut donc dépasser
temporairement la limite configurée. Les dossiers sont lus depuis le serveur
DaliBackup, pas par l'agent Hyper-V.

## Restaurer un dossier

Dans **Points de restauration**, utilisez **Télécharger la chaîne** sur le
point souhaité. Conservez les archives dans l'ordre indiqué : base complète,
puis incréments successifs. Sur une machine disposant de Node.js et des
dépendances du projet :

```bash
node scripts/restore-folder-chain.mjs /chemin/vers/dossier-vide base.tar.gz incr1.tar.gz incr2.tar.gz
```

Le script refuse un dossier de sortie non vide, valide les chemins de l'archive,
applique les fichiers modifiés puis les suppressions. Vérifiez le résultat sur
un répertoire isolé avant de remplacer des données actives.

## Limites et validation

- Les bases utilisent des dumps **complets** ; aucun WAL/binlog/journal SQL
  incrémental n'est annoncé.
- Les tests automatisés valident le pipeline et la reconstruction sur dossier
  local monté, ainsi que l'invocation des trois clients SQL avec des utilitaires
  simulés. Ils ne remplacent pas un test avec vos vrais serveurs FTP/SFTP/SQL.
- FTPS et SFTP sont à privilégier ; FTP transmet les données sans chiffrement.
- Une sauvegarde réussie ne vaut pas preuve de restaurabilité : réalisez un
  test de restauration isolé pour chaque type de source et cible.

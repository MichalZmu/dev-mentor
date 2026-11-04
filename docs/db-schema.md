# Domain schema ownership

`packages/db/src/entities.ts` declares every domain table and its real scalar columns with MikroORM `defineEntity`. PostgreSQL constraints, foreign keys, partial indexes, the shared booking exclusion constraint and the append-only audit trigger are owned by the versioned SQL migrations in `packages/db/migrations/`.

The domain tables and the independent `auth` schema are explicitly excluded from automatic schema diff through `schemaGenerator.skipTables`. This prevents a metadata diff from replacing PostgreSQL-only integrity rules. Do not use schema update or schema create to deploy this application. Create a blank MikroORM migration (`npm run db:migration:create -- --blank`), review its SQL and add its class to the explicit `runDomainMigrations` list. Never edit an applied migration. Update full entity column metadata in the same change.

Migration `202611030001` creates the domain, `btree_gist`, half-open interval exclusion for held/confirmed bookings, foreign keys/check constraints, financial ledgers, durable inbox/outbox and append-only audit. Migration `202611030002` adds request/transition context to audit and operational indexes without rewriting historical audit entries. Migration `202611030003` marks generated availability separately so recurring rule edits preserve manually entered slots. The integration suite checks an upgrade from the first version, empty migration, repeat migration, actual columns, exclusion conflicts and immutable audit.

Auth migration ownership remains with Better Auth in its separate schema. The domain only stores auth user IDs as opaque text and does not manage or copy credentials.

Use different PostgreSQL login roles for migrations and runtime. The migration principal needs DDL and permission to install `btree_gist`; web and worker need `USAGE` on their schemas and DML on their tables. They must not own the database/schema/tables and must not have schema `CREATE`, role management, superuser or database creation privileges. Revoke `UPDATE`/`DELETE` on `audit_log`; its trigger also rejects mutations. Grant auth runtime only its own required DML. Provision passwords through the deployment secret store, never migration SQL. Tests use a separate temporary restricted role to verify real SELECT/DML and DDL rejection.

The default demo policy uses 50-minute sessions, a 15-minute hold, 24-hour change cutoff, PLN minor units and a rounded 15% fee. Mentor earnings become available after a completed paid session and a seven-day local settlement delay, unless a refund or unresolved support case exists. These local defaults do not approve a production marketplace settlement policy. Production policy parameters, retention and provider compliance must be agreed before accepting real payments.

`seedDemoPlatform` is an explicit local bootstrap after auth/schema migration. It accepts existing auth IDs and inserts clearly fictitious demo history. Web/worker startup does not seed or migrate. Booking/payment/session IDs share the same persistent aggregate ID; a package has its own payment order and receives credits only after a verified paid event. In the current internal event DTO `PaymentEvent.bookingId` is the payment order ID for either kind; it is resolved by the database rather than inferred from a client-controlled type.

## Runda R2: pochodzenie dostępności i metoda płatności

Migracja `Migration202611030004` dodaje utrwalony wybór metody płatności i pochodzenie oferty terminu. Pierwsze zaakceptowane żądanie checkout zapisuje metodę atomowo przed zleceniem PSP lub zużyciem kredytu; ponowienie z inną metodą daje409. Zwrot nadmiarowego historycznego obciążenia używa własnego snapshotu płatności, nie wartości kredytu sesji.

Oferty ręczne i wygenerowane z reguł są rozróżnione. Usunięcie reguły wycofuje jej ofertę terminu również wtedy, gdy istniejący hold dopiero później wygasa. Rezerwacje i niezależne oferty ręczne pozostają zachowane; stary slotId nie obchodzi aktywności oferty.

Ponieważ schemat jest SQL-owned, programmatic migrator i CLI mają `migrations.snapshot=false`. Migracje nie zapisują plików w katalogu pracy i działają także z read-only CWD; regresja wykonuje prawdziwe migracje i ponowienie z `/sys` na nowej bazie PostgreSQL. Testowe snapshoty wytworzone przed poprawką zachowano poza źródłami z sumami; nie stanowią plików migracji.

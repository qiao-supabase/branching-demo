DROP POLICY IF EXISTS "Ok to access realtime tables" ON "realtime"."messages";

CREATE EXTENSION IF NOT EXISTS pgmq;
SELECT pgmq.create('my_queue');

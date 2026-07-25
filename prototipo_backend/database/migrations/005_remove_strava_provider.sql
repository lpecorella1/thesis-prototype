BEGIN;

DELETE FROM device_connections
WHERE provider_key = 'strava';

DELETE FROM device_providers
WHERE provider_key = 'strava';

COMMIT;

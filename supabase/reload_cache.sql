-- Force PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';

-- Also notify config reload
NOTIFY pgrst, 'reload config';

CREATE OR REPLACE FUNCTION public.try_consume_download(p_file_id UUID)
RETURNS TABLE(
    success            BOOLEAN,
    new_download_count INT,
    new_status         TEXT,
    download_limit     INT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_now      TIMESTAMPTZ := now();
    v_updated  RECORD;
BEGIN
    --
    -- Atomic download-consume: UPDATE with row-level lock
    -- serialises concurrent requests.
    --
    UPDATE public.shared_files sf
    SET
        download_count = sf.download_count + 1,
        status = CASE
            WHEN v_now > sf.expires_at  THEN 'expired'
            WHEN sf.download_count + 1 >= sf.download_limit THEN 'limit_reached'
            ELSE sf.status
        END,
        updated_at = v_now
    WHERE sf.id = p_file_id
      AND sf.status = 'active'
      AND v_now <= sf.expires_at
      AND sf.download_count < sf.download_limit
    RETURNING
        sf.download_count AS return_count,
        sf.status         AS return_status,
        sf.download_limit AS return_limit
    INTO v_updated;

    -- Case 1: download slot consumed
    IF v_updated IS NOT NULL THEN
        success            := TRUE;
        new_download_count := v_updated.return_count;
        new_status         := v_updated.return_status;
        download_limit     := v_updated.return_limit;
        RETURN NEXT;
        RETURN;
    END IF;

    -- Case 2: UPDATE did nothing — read current state
    SELECT
        sf.status,
        sf.download_count,
        sf.download_limit
    INTO
        new_status,
        new_download_count,
        download_limit
    FROM public.shared_files sf
    WHERE sf.id = p_file_id;

    IF NOT FOUND THEN
        success            := FALSE;
        new_download_count := 0;
        new_status         := 'not_found';
        download_limit     := 0;
        RETURN NEXT;
        RETURN;
    END IF;

    -- File exists but expired / at limit
    success := FALSE;
    RETURN NEXT;
END;
$$;
